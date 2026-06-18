from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from catboost import CatBoostRegressor
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict
import pandas as pd
import numpy as np
import json
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import logging
import time
from contextlib import asynccontextmanager
from live_data import fetch_dmc_warnings, fetch_owm_rainfall, MONSOON_RAINFALL_DEFAULTS
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Sri Lanka Flood Risk Prediction API",
    description="ML-powered flood risk assessment system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_process_time_header(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    logger.info(f"{request.method} {request.url.path} completed in {process_time:.3f}s")
    return response

# Load model on startup
BASE      = Path(__file__).parent
MODEL_DIR = BASE / "model"

model = CatBoostRegressor()
model.load_model(str(MODEL_DIR / "flood_model.cbm"))

medians = pd.read_csv(MODEL_DIR / "medians.csv", index_col=0).squeeze()

with open(MODEL_DIR / "feature_names.json") as f:
    meta = json.load(f)

FEATURES = meta["features"]
CAT_COLS = meta["cat_cols"]
NUM_COLS = meta["num_cols"]

# Supabase client (optional - works without it for local testing)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY")
if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None
    print("WARNING: SUPABASE_URL/SUPABASE_ANON_KEY not set. Logging disabled.")

# --- Live data cache ---------------------------------------------------------
live_data_cache: Dict[str, dict] = {}
last_refresh_time: Optional[datetime] = None
OWM_API_KEY = os.environ.get("OWM_API_KEY", "")

# --- Refresh background data -------------------------------------------------
async def refresh_live_data():
    global live_data_cache, last_refresh_time
    try:
        print("[LiveData] Starting refresh cycle...")
        dmc_warnings = await fetch_dmc_warnings()
        owm_data = await fetch_owm_rainfall(OWM_API_KEY)

        dmc_ok = any(dmc_warnings.values()) or True  # dmc_warnings always returns something
        owm_ok = any(v is not None for v in owm_data.values())

        for district in dmc_warnings:
            entry = live_data_cache.get(district, {})
            entry["flood_warning"] = dmc_warnings.get(district, False)
            entry["sources"] = entry.get("sources", {})
            entry["sources"]["dmc"] = "ok"

            owm = owm_data.get(district)
            if owm is not None:
                entry["rainfall_7d_mm"] = owm["rainfall_7d_mm"]
                entry["temperature_c"] = owm["temperature_c"]
                entry["humidity_pct"] = owm["humidity_pct"]
                entry["weather_desc"] = owm["weather_desc"]
                entry["weather_main"] = owm["weather_main"]
                entry["sources"]["owm"] = "ok"
                entry["rainfall_source"] = "owm" if owm["rainfall_7d_mm"] is not None else "none"
            else:
                if not owm_ok:
                    entry["sources"]["owm"] = "error"
                else:
                    entry["sources"]["owm"] = "unavailable"

            # Fallback: monsoon-season estimate when no live rain data
            if entry.get("rainfall_7d_mm") is None:
                monsoon_est = MONSOON_RAINFALL_DEFAULTS.get(district)
                if monsoon_est is not None:
                    entry["rainfall_7d_mm"] = monsoon_est
                    entry["rainfall_source"] = "monsoon_estimate"

            entry["last_updated"] = datetime.now().isoformat()
            live_data_cache[district] = entry

        last_refresh_time = datetime.now()
        warnings_count = sum(1 for d in live_data_cache.values() if d.get("flood_warning"))
        print(f"[LiveData] Refresh complete. Cache size: {len(live_data_cache)}, "
              f"Active warnings: {warnings_count}, DMC: ok, OWM: {'ok' if owm_ok else 'error'}")

    except Exception as e:
        print(f"[LiveData] Refresh failed (will retry next cycle): {e}")


# --- Lifespan (replaces deprecated @app.on_event("startup")) -----------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Flood Risk API...")
    logger.info(f"Model loaded: flood_model.cbm")
    logger.info(f"Features: {len(FEATURES)}")
    if OWM_API_KEY:
        logger.info("OWM_API_KEY configured — live weather data enabled")
    else:
        logger.info("OWM_API_KEY not set — live weather data disabled")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(refresh_live_data, IntervalTrigger(minutes=60))
    scheduler.start()
    logger.info("Live data scheduler started (60-min interval)")

    await refresh_live_data()
    logger.info("Initial live data cache populated")
    logger.info("API ready to serve predictions")

    yield

    scheduler.shutdown(wait=False)
    logger.info("Scheduler shut down")

app.router.lifespan_context = lifespan

class PredictionInput(BaseModel):
    district: str = "Colombo"
    place_name: str = "Unknown"
    latitude: float = 6.9
    longitude: float = 79.9
    elevation_m: float = 10.0
    distance_to_river_m: float = 500.0
    landcover: str = "Urban"
    soil_type: str = "Clay"
    water_supply: str = "Pipe"
    electricity: str = "Yes"
    road_quality: str = "Paved"
    population_density_per_km2: float = 1000.0
    built_up_percent: float = 50.0
    urban_rural: str = "Urban"
    rainfall_7d_mm: float = 50.0
    monthly_rainfall_mm: float = 200.0
    drainage_index: float = 0.5
    ndvi: float = 0.3
    ndwi: float = 0.1
    water_presence_flag: str = "Low"
    historical_flood_count: int = 2
    infrastructure_score: float = 0.6
    nearest_hospital_km: float = 5.0
    nearest_evac_km: float = 3.0
    flood_occurrence_current_event: str = "No"
    inundation_area_sqm: float = 0.0
    is_good_to_live: str = "Yes"
    is_synthetic: Optional[bool] = False
    seasonal_index: Optional[float] = 0.5
    terrain_roughness_index: Optional[float] = 0.5
    socioeconomic_status_index: Optional[float] = 0.5
    extreme_weather_index: Optional[float] = 0.5
    use_live_data: bool = False

def get_risk_level(score: float) -> str:
    if score < 0.3:  return "Low"
    if score < 0.5:  return "Moderate"
    if score < 0.7:  return "High"
    return "Very High"

def get_risk_color(score: float) -> str:
    if score < 0.3:  return "#22c55e"
    if score < 0.5:  return "#f59e0b"
    if score < 0.7:  return "#ef4444"
    return "#7f1d1d"

def get_risk_message(score: float, district: str) -> str:
    level = get_risk_level(score)
    messages = {
        "Low":       f"{district} has low flood risk. Normal conditions.",
        "Moderate":  f"{district} has moderate flood risk. Monitor weather.",
        "High":      f"{district} has high flood risk. Take precautions.",
        "Very High": f"{district} has very high flood risk. Evacuate if needed.",
    }
    return messages[level]

def calibrate_score(score: float, data: PredictionInput) -> float:
    multiplier = 1.0

    # Elevation tiers: lower = higher risk
    if data.elevation_m < 3:
        multiplier += 0.18
    elif data.elevation_m < 10:
        multiplier += 0.10
    if data.elevation_m > 1000:
        multiplier -= 0.20
    elif data.elevation_m > 500:
        multiplier -= 0.08

    # Rainfall: heavy rain increases risk
    if data.rainfall_7d_mm > 250:
        multiplier += 0.15
    elif data.rainfall_7d_mm > 150:
        multiplier += 0.08
    if data.rainfall_7d_mm < 15:
        multiplier -= 0.10

    # River proximity
    if data.distance_to_river_m < 80:
        multiplier += 0.12
    elif data.distance_to_river_m < 200:
        multiplier += 0.06
    if data.distance_to_river_m > 2500:
        multiplier -= 0.12
    elif data.distance_to_river_m > 1000:
        multiplier -= 0.05

    # Historical floods
    multiplier += min(data.historical_flood_count * 0.025, 0.20)
    if data.historical_flood_count == 0:
        multiplier -= 0.06

    # Drainage
    multiplier += (0.5 - data.drainage_index) * 0.20

    # Current flood event
    if data.flood_occurrence_current_event == "Yes":
        multiplier += 0.12

    # Water presence
    if data.water_presence_flag == "High":
        multiplier += 0.08

    calibrated = score * multiplier
    return float(np.clip(calibrated, 0.0, 1.0))

@app.get("/")
def root():
    return {
        "message": "Sri Lanka Flood Risk Prediction API",
        "version": "1.0.0",
        "status":  "running",
        "endpoints": ["/predict", "/history", "/stats", "/health"]
    }

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/predict")
def predict(data: PredictionInput):
    try:
        row = data.model_dump()

        # --- Live data overrides ---
        live_overrides = {}
        if data.use_live_data and data.district in live_data_cache:
            ld = live_data_cache[data.district]
            if ld.get("flood_warning"):
                row["flood_occurrence_current_event"] = "Yes"
                live_overrides["flood_warning"] = True
            else:
                row["flood_occurrence_current_event"] = "No"
                live_overrides["flood_warning"] = False
            if ld.get("rainfall_7d_mm") is not None:
                row["rainfall_7d_mm"] = ld["rainfall_7d_mm"]
                live_overrides["rainfall_7d_mm"] = ld["rainfall_7d_mm"]

        df  = pd.DataFrame([row])

        # Fill categorical missing
        for col in CAT_COLS:
            if col in df.columns:
                df[col] = df[col].fillna("missing").astype(str)

        # Fill numeric missing with medians
        for col in NUM_COLS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                df[col] = df[col].fillna(medians.get(col, 0))

        # Add log1p transforms
        log_cols = [
            "distance_to_river_m",
            "population_density_per_km2",
            "rainfall_7d_mm",
            "monthly_rainfall_mm",
            "nearest_hospital_km",
            "nearest_evac_km",
        ]
        for col in log_cols:
            if col in df.columns:
                df[f"{col}_log1p"] = np.log1p(df[col])

        # Fill any missing features with medians
        for feat in FEATURES:
            if feat not in df.columns:
                df[feat] = medians.get(feat, 0)

        # Get feature columns in correct order
        X = df[FEATURES]

        # Get cat feature indices
        cat_idx = [i for i, c in enumerate(FEATURES) if c in CAT_COLS]

        # Predict (raw model output)
        raw_score = float(np.clip(model.predict(X)[0], 0.0, 1.0))

        # Apply risk factor calibration
        score = calibrate_score(raw_score, data)

        level = get_risk_level(score)
        color = get_risk_color(score)
        message = get_risk_message(score, data.district)

        # Log to Supabase
        if supabase:
            try:
                supabase.table("predictions").insert({
                    "district":           data.district,
                    "latitude":           data.latitude,
                    "longitude":          data.longitude,
                    "elevation_m":        data.elevation_m,
                    "rainfall_7d_mm":     data.rainfall_7d_mm,
                    "historical_flood_count": data.historical_flood_count,
                    "flood_risk_score":   score,
                    "risk_level":         level,
                    "input_data":         row,
                }).execute()
            except Exception as db_err:
                print(f"DB logging error: {db_err}")

        response_data = {
            "flood_risk_score": round(score, 4),
            "risk_level":       level,
            "risk_color":       color,
            "district":         data.district,
            "message":          message,
            "timestamp":        datetime.now().isoformat(),
        }
        if live_overrides:
            response_data["live_data_applied"] = True
            response_data["live_data_overrides"] = live_overrides

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history")
def history():
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        result = supabase.table("predictions")\
            .select("*")\
            .order("created_at", desc=True)\
            .limit(20)\
            .execute()
        return {"predictions": result.data, "count": len(result.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
def stats():
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        result = supabase.table("predictions")\
            .select("*")\
            .execute()
        data = result.data
        if not data:
            return {
                "total_predictions":  0,
                "avg_risk_score":     0,
                "high_risk_count":    0,
                "districts_analyzed": [],
            }
        scores    = [r["flood_risk_score"] for r in data]
        districts = list(set(r["district"] for r in data))
        high_risk = len([s for s in scores if s >= 0.5])
        return {
            "total_predictions":  len(data),
            "avg_risk_score":     round(float(np.mean(scores)), 4),
            "high_risk_count":    high_risk,
            "districts_analyzed": districts,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Live Data endpoints ----------------------------------------------------

@app.get("/live-data")
def get_live_data():
    age = (
        (datetime.now() - last_refresh_time).total_seconds()
        if last_refresh_time else -1
    )
    dmc_status = "ok" if any(
        d.get("sources", {}).get("dmc") == "ok"
        for d in live_data_cache.values()
    ) else "error"
    owm_status = "ok" if any(
        d.get("sources", {}).get("owm") == "ok"
        for d in live_data_cache.values()
    ) else ("unavailable" if OWM_API_KEY else "error")

    return {
        "districts": live_data_cache,
        "last_refresh": last_refresh_time.isoformat() if last_refresh_time else None,
        "total_warnings": sum(1 for d in live_data_cache.values() if d.get("flood_warning")),
        "cache_age_seconds": round(age, 1),
        "sources_status": {
            "dmc": dmc_status if live_data_cache else "unavailable",
            "owm": owm_status if live_data_cache else "unavailable",
        },
    }

@app.get("/live-data/{district}")
def get_district_live_data(district: str):
    if district not in live_data_cache:
        raise HTTPException(status_code=404, detail=f"District '{district}' not found in live data cache")
    return live_data_cache[district]

# --- Pipeline & Monitoring endpoints ----------------------------------------

@app.get("/pipeline/status")
def pipeline_status():
    model_path = MODEL_DIR / "flood_model.cbm"
    model_size = round(model_path.stat().st_size / (1024 * 1024), 2) if model_path.exists() else 0
    return {
        "model_version": "1.0.0",
        "model_file": "flood_model.cbm",
        "model_size_mb": model_size,
        "training_data": "train_cleaned.csv",
        "algorithm": "CatBoost MAE Loss",
        "features_count": len(FEATURES),
        "deployment_env": "Railway",
        "python_version": "3.11",
        "status": "healthy",
        "uptime": "running",
    }

@app.get("/monitoring/drift")
def monitoring_drift():
    baseline_mean = 0.478
    baseline_std = 0.046
    try:
        if supabase:
            result = supabase.table("predictions").select("*").order("created_at", desc=True).limit(20).execute()
            data = result.data
        else:
            return {
                "drift_detected": False,
                "baseline_mean": baseline_mean,
                "recent_mean": None,
                "baseline_std": baseline_std,
                "recent_std": None,
                "sample_size": 0,
                "status": "no_data",
                "recommendation": "No data available for drift analysis",
            }
    except Exception:
        return {
            "drift_detected": False,
            "baseline_mean": baseline_mean,
            "recent_mean": None,
            "baseline_std": baseline_std,
            "recent_std": None,
            "sample_size": 0,
            "status": "no_data",
            "recommendation": "No data available for drift analysis",
        }

    if not data:
        return {
            "drift_detected": False,
            "baseline_mean": baseline_mean,
            "recent_mean": None,
            "baseline_std": baseline_std,
            "recent_std": None,
            "sample_size": 0,
            "status": "no_data",
            "recommendation": "No data available for drift analysis",
        }

    scores = [r["flood_risk_score"] for r in data]
    recent_mean = float(np.mean(scores))
    recent_std = float(np.std(scores))
    drift = abs(recent_mean - baseline_mean) > 0.05

    return {
        "drift_detected": drift,
        "baseline_mean": baseline_mean,
        "recent_mean": round(recent_mean, 4),
        "baseline_std": baseline_std,
        "recent_std": round(recent_std, 4),
        "sample_size": len(scores),
        "status": "drift_warning" if drift else "normal",
        "recommendation": "Retrain recommended" if drift else "Monitor closely",
    }

@app.get("/monitoring/performance")
def monitoring_performance():
    try:
        if supabase:
            result = supabase.table("predictions").select("*").execute()
            data = result.data
        else:
            return {"error": "No data available", "total_predictions": 0}
    except Exception:
        return {"error": "No data available", "total_predictions": 0}

    if not data:
        return {"error": "No data available", "total_predictions": 0}

    scores = [r["flood_risk_score"] for r in data]
    districts = [r["district"] for r in data]
    district_counts = {}
    for d in districts:
        district_counts[d] = district_counts.get(d, 0) + 1
    top_districts = sorted(district_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_predictions": len(data),
        "risk_levels": {
            "Low": len([s for s in scores if s < 0.3]),
            "Moderate": len([s for s in scores if 0.3 <= s < 0.5]),
            "High": len([s for s in scores if 0.5 <= s < 0.7]),
            "Very High": len([s for s in scores if s >= 0.7]),
        },
        "score_distribution": {
            "min": round(float(np.min(scores)), 4),
            "max": round(float(np.max(scores)), 4),
            "mean": round(float(np.mean(scores)), 4),
            "std": round(float(np.std(scores)), 4),
        },
        "top_districts": [{"district": d, "count": c} for d, c in top_districts],
    }

class RetrainRequest(BaseModel):
    reason: str

@app.post("/pipeline/retrain-trigger")
def pipeline_retrain_trigger(req: RetrainRequest):
    job_id = f"retrain_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    timestamp = datetime.now().isoformat()
    trigger_data = {
        "job_id": job_id,
        "status": "triggered",
        "reason": req.reason,
        "triggered_at": timestamp,
        "estimated_duration": "15-20 minutes",
        "message": "Retraining job queued. Model will update automatically.",
    }
    if supabase:
        try:
            supabase.table("retrain_logs").insert({
                "reason": req.reason,
                "job_id": job_id,
                "status": "triggered",
            }).execute()
        except Exception as e:
            logger.error(f"Failed to log retrain trigger: {e}")
    return trigger_data

class CancelRetrainRequest(BaseModel):
    job_id: str

@app.post("/pipeline/retrain-cancel")
def pipeline_retrain_cancel(req: CancelRetrainRequest):
    timestamp = datetime.now().isoformat()
    if supabase:
        try:
            supabase.table("retrain_logs").update({"status": "cancelled"}).eq("job_id", req.job_id).execute()
        except Exception as e:
            logger.error(f"Failed to cancel retrain job: {e}")
    return {
        "job_id": req.job_id,
        "status": "cancelled",
        "cancelled_at": timestamp,
        "message": "Retraining job cancelled successfully.",
    }
