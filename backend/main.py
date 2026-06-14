from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from catboost import CatBoostRegressor
from pathlib import Path
from datetime import datetime
from typing import Optional
import pandas as pd
import numpy as np
import json
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

app = FastAPI(
    title="Sri Lanka Flood Risk Prediction API",
    description="ML-powered flood risk assessment system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

        # Predict
        score = float(np.clip(model.predict(X)[0], 0.0, 1.0))
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

        return {
            "flood_risk_score": round(score, 4),
            "risk_level":       level,
            "risk_color":       color,
            "district":         data.district,
            "message":          message,
            "timestamp":        datetime.now().isoformat(),
        }

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
