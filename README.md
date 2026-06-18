# 🌊 Sri Lanka Flood Risk Intelligence System

### ML Opsidian Genesis — TensorTitans_mlops
### IEEE Student Branch — University of Colombo School of Computing

[![Backend](https://img.shields.io/badge/Backend-Railway-purple)](https://flood-risk-app-production.up.railway.app)
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black)](https://flood-risk-app-two.vercel.app/)
[![Model](https://img.shields.io/badge/Model-CatBoost-blue)](https://catboost.ai)
[![Score](https://img.shields.io/badge/Best%20Score-0.38114-green)](https://github.com/dinna21/Flood-Risk-App)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📖 Table of Contents

- [What This System Does](#-what-this-system-does)
- [Live Demo](#-live-demo)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quick Start (Local Setup)](#-quick-start-local-setup)
- [Deploy to Production](#-deploy-to-production)
- [Full API Reference](#-full-api-reference)
- [ML Model Details](#-ml-model-details)
- [Risk Calibration System](#-risk-calibration-system)
- [MLOps Pipeline](#-mlops-pipeline)
- [Monitoring & Alerting](#-monitoring--alerting)
- [Data Drift Detection](#-data-drift-detection)
- [Supabase Setup](#-supabase-setup)
- [Automation Scripts](#-automation-scripts)
- [Key Findings](#-key-findings)
- [Live Links](#-live-links)

---

## 🎯 What This System Does

A **production-grade MLOps system** that predicts flood risk scores (0–1) for any location in Sri Lanka using a CatBoost machine learning model trained on environmental, geographical, and infrastructure data.

### Key Features

| Feature | Description |
|---------|-------------|
| **Risk Prediction** | Get instant flood risk scores with confidence level and AI-generated explanations |
| **Interactive Map** | Click any location in Sri Lanka for real-time predictions with color-coded markers |
| **District Profiles** | 24 districts with pre-configured geographical data (elevation, rainfall, river proximity, flood history) |
| **Monitoring Dashboard** | Real-time charts: risk distribution pie, timeline, district comparison, KPI cards |
| **Live Alerts** | Auto-detects high-risk predictions (≥50%) and shows toast notifications |
| **Pipeline Management** | View model status, detect data drift, trigger simulated retraining |
| **Prediction Logging** | All predictions stored in Supabase PostgreSQL for audit and analysis |
| **AI Explanations** | Contextual risk analysis with recommended actions per severity level |

---

## 🌐 Live Demo

| Component | URL |
|-----------|-----|
| **Frontend** | [https://flood-risk-app.vercel.app](https://flood-risk-app.vercel.app) |
| **Backend API** | [https://flood-risk-app-production.up.railway.app](https://flood-risk-app-production.up.railway.app) |
| **API Docs (Swagger)** | [https://flood-risk-app-production.up.railway.app/docs](https://flood-risk-app-production.up.railway.app/docs) |
| **API Docs (ReDoc)** | [https://flood-risk-app-production.up.railway.app/redoc](https://flood-risk-app-production.up.railway.app/redoc) |

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────┐
│                  User Browser (Vercel)                │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Predict │  │ Risk Map │  │ Monitoring/Pipeline │  │
│  └────┬────┘  └────┬─────┘  └─────────┬──────────┘  │
│       │            │                  │              │
└───────┼────────────┼──────────────────┼──────────────┘
        │            │                  │
        ▼            ▼                  ▼
┌──────────────────────────────────────────────────────┐
│            FastAPI Backend (Railway)                  │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐     │
│  │ /predict │  │ /pipeline  │  │ /monitoring  │     │
│  └────┬─────┘  └─────┬──────┘  └──────┬───────┘     │
│       │              │                │              │
│       ▼              ▼                ▼              │
│  ┌────────────────────────────────────────┐         │
│  │        CatBoost Model (.cbm)            │         │
│  │     + Risk Calibration Layer            │         │
│  └────────────────┬───────────────────────┘         │
└───────────────────┼─────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│              Supabase PostgreSQL                      │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │ predictions  │  │ retrain_logs │                  │
│  └──────────────┘  └──────────────┘                  │
└──────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16 + Tailwind CSS 4 | Web interface with dark theme |
| **Maps** | React Leaflet | Interactive Sri Lanka map |
| **Charts** | Recharts | Real-time monitoring dashboard |
| **Backend** | FastAPI + Python 3.11 | REST API server with auto-docs |
| **Model** | CatBoost Regressor | Flood risk prediction engine |
| **Calibration** | Tiered risk factor multipliers | Domain-aware score adjustment |
| **Database** | Supabase PostgreSQL | Prediction and retraining logs |
| **Hosting** | Railway (backend) + Vercel (frontend) | Cloud deployment |
| **CI/CD** | GitHub → Railway auto-deploy | Continuous deployment |

---

## 📁 Project Structure

```
flood-risk-app/
│
├── backend/
│   ├── main.py                 # FastAPI application (457 lines)
│   ├── requirements.txt        # Python dependencies
│   ├── Procfile                # Railway start command
│   ├── runtime.txt             # Python version pin (3.11.12)
│   ├── pipeline_check.py       # Automated pipeline health checks
│   ├── save_model.py           # Model training script
│   └── model/
│       ├── flood_model.cbm     # Trained CatBoost model
│       ├── medians.csv         # Feature median values
│       └── feature_names.json  # Feature metadata (43 features)
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Main app (4 tabs)
│   │   ├── globals.css         # Dark theme design system
│   │   ├── layout.tsx          # Root layout
│   │   └── components/
│   │       ├── Map.tsx              # Leaflet map (24 districts)
│   │       ├── MonitoringDashboard.tsx  # Recharts dashboard
│   │       ├── PipelineStatus.tsx  # MLOps pipeline page
│   │       ├── AlertSystem.tsx     # Toast notifications
│   │       └── BatchUpload.tsx
│   ├── .env.local              # Environment variables
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
│
├── README.md                   # This file
└── report.tex                  # IEEE technical report (LaTeX)
```

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### 1. Clone & Setup Backend
```bash
git clone https://github.com/dinna21/Flood-Risk-App.git
cd Flood-Risk-App/backend
pip install -r requirements.txt
```

Create `.env`:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxxx
```

```bash
uvicorn main:app --reload
# Backend: http://localhost:8000
```

### 2. Setup Frontend
```bash
cd ../frontend
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
# Frontend: http://localhost:3000
```

---

## 🚢 Deploy to Production

### Backend (Railway)
Railway auto-deploys on push to `main`. Requires `Procfile`, `runtime.txt`, and `requirements.txt` in the `backend/` directory.

### Frontend (Vercel)
1. Import `dinna21/Flood-Risk-App` on Vercel
2. Set **Root Directory** → `frontend`
3. Set environment variable: `NEXT_PUBLIC_API_URL` = your Railway URL
4. Deploy

---

## 🌐 Full API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API status and version |
| `GET` | `/health` | Health check with timestamp |
| `POST` | `/predict` | Get flood risk prediction |
| `GET` | `/history` | Last 20 predictions |
| `GET` | `/stats` | Aggregated prediction statistics |

### MLOps Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/pipeline/status` | Model metadata: version, features, size, deployment |
| `GET` | `/monitoring/drift` | Data drift detection (baseline vs recent) |
| `GET` | `/monitoring/performance` | Score distribution, risk breakdown, top districts |
| `POST` | `/pipeline/retrain-trigger` | Queue a simulated retraining job |
| `POST` | `/pipeline/retrain-cancel` | Cancel a queued retraining job |

### Example: Predict

```bash
curl -X POST https://flood-risk-app-production.up.railway.app/predict \
  -H "Content-Type: application/json" \
  -d '{
    "district": "Ratnapura",
    "latitude": 6.6828,
    "longitude": 80.3992,
    "elevation_m": 3,
    "rainfall_7d_mm": 320,
    "monthly_rainfall_mm": 800,
    "distance_to_river_m": 50,
    "historical_flood_count": 10,
    "drainage_index": 0.1,
    "flood_occurrence_current_event": "Yes",
    "water_presence_flag": "High"
  }'
```

### Example Response

```json
{
  "flood_risk_score": 0.7464,
  "risk_level": "Very High",
  "risk_color": "#7f1d1d",
  "district": "Ratnapura",
  "message": "Ratnapura has very high flood risk. Evacuate if needed.",
  "timestamp": "2026-06-18T05:30:00"
}
```

---

## 🤖 ML Model Details

### Training Configuration

| Parameter | Value |
|-----------|-------|
| Algorithm | CatBoost Regressor |
| Loss Function | MAE (Mean Absolute Error) |
| Iterations | 3,000 |
| Learning Rate | 0.03 |
| Tree Depth | 7 |
| L2 Regularization | 5 |
| Min Data in Leaf | 10 |
| Ensemble | 5 seeds averaged |
| Training Data | 19,700 rows |
| Features | 43 environmental features |
| **Best Public Score** | **0.38114** |

### Feature Categories

| Category | Features |
|----------|----------|
| **Location** | District, latitude, longitude |
| **Weather** | Rainfall (7-day, monthly), NDVI, NDWI |
| **Terrain** | Elevation, terrain roughness, drainage index |
| **Water** | Distance to river, water presence, inundation area |
| **Infrastructure** | Road quality, hospital distance, evacuation center, infrastructure score |
| **History** | Historical flood count, flood occurrence |
| **Land** | Land cover, soil type, built-up percentage |
| **Socioeconomic** | Population density, socioeconomic index, electricity, water supply |

---

## 📐 Risk Calibration System

The base CatBoost model outputs scores clustered around ~0.40 (Moderate) due to the training data being 96% synthetic. A **tiered calibration layer** adjusts scores based on real-world domain knowledge:

### Calibration Factors

| Factor | High Risk (↑) | Low Risk (↓) |
|--------|--------------|-------------|
| Elevation < 3m | +0.18 | Elevation > 1000m: -0.20 |
| Rainfall > 250mm | +0.15 | Rainfall < 15mm: -0.10 |
| River < 80m | +0.12 | River > 2500m: -0.12 |
| Historical floods | ×0.025 per event | 0 floods: -0.06 |
| Active flood event | +0.12 | |
| High water presence | +0.08 | |
| Poor drainage (<0.5) | proportional | Good drainage: -adjustment |

### Score Range (after calibration)

| District | Score | Level | Why |
|----------|-------|-------|-----|
| Ratnapura | 0.746 | Very High | 3m elevation, 320mm rain, 10 floods |
| Kalutara | 0.751 | Very High | Coastal, 260mm rain, 6 floods |
| Galle | 0.682 | High | Coastal, 220mm rain, active flooding |
| Colombo | 0.408 | Moderate | Urban, moderate parameters |
| Jaffna | 0.437 | Moderate | Dry, 50mm rain, safe river distance |
| Nuwara Eliya | 0.219 | Low | 1800m elevation, 0 floods, good drainage |

---

## 🔬 MLOps Pipeline

### Pipeline Management Tab

The frontend Pipeline tab provides:

| Section | Data Source | What It Shows |
|---------|------------|---------------|
| **Pipeline Health** | `GET /pipeline/status` | Model version, file size, features count, deployment env, status |
| **Drift Detection** | `GET /monitoring/drift` | Baseline vs recent mean/std comparison, drift flag, recommendation |
| **Performance Metrics** | `GET /monitoring/performance` | Score distribution (min/max/mean/std), risk level counts, top 5 districts |
| **Retrain Trigger** | `POST /pipeline/retrain-trigger` | Reason dropdown, trigger button, job status, cancel button |

---

## 📊 Monitoring & Alerting

### Real-Time Dashboard
- **KPI Cards**: Total predictions, avg risk score, high-risk count, safe areas count
- **Risk Distribution**: Donut chart (PieChart) breaking down Low/Moderate/High/Very High
- **Risk Level Counts**: Horizontal progress bars per risk category
- **Score Timeline**: Line chart of last 20 predictions over time
- **District Comparison**: Bar chart of top 8 districts by average score
- **10-second auto-refresh** with Live indicator

### Notification System
- **Toast notifications**: Small auto-dismiss popups (6s) at bottom-right for new predictions
- **Bell icon**: Header badge shows count of high-risk (≥50%) predictions
- **Notification Center**: Click bell to see all predictions with severity dots and danger levels
- **Click-to-action**: Click any alert to jump to Predict tab with that district pre-filled

---

## 📉 Data Drift Detection

The `/monitoring/drift` endpoint compares recent prediction statistics against a baseline:

| Metric | Baseline | Recent (example) | Status |
|--------|----------|-----------------|--------|
| Mean Score | 0.478 | 0.507 | Normal (diff < 0.05) |
| Std Dev | 0.046 | 0.127 | Normal |

**Drift is detected when** the recent mean deviates by more than 0.05 from baseline. When drift is detected, the recommendation changes from "Monitor closely" to "Retrain recommended."

---

## 🗄️ Supabase Setup

Run these in your **Supabase SQL Editor** to create the required tables:

```sql
-- Prediction logging
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  district TEXT,
  latitude FLOAT,
  longitude FLOAT,
  elevation_m FLOAT,
  rainfall_7d_mm FLOAT,
  historical_flood_count INT,
  flood_risk_score FLOAT,
  risk_level TEXT,
  input_data JSONB
);

-- Retrain job logging
CREATE TABLE IF NOT EXISTS retrain_logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT,
  job_id TEXT,
  status TEXT
);
```

> **Note**: If RLS (Row Level Security) is enabled on your Supabase project, disable it for these tables or create appropriate policies to allow inserts and reads.

---

## 🤖 Automation Scripts

### Pipeline Health Check

Run `backend/pipeline_check.py` to validate the production system:

```bash
cd backend
python pipeline_check.py
```

**Checks performed:**
1. **Health Check** — GET `/health` (PASS if 200 OK)
2. **Prediction Test** — POST `/predict` with Colombo test data (PASS if score 0–1)
3. **Drift Detection** — GET `/monitoring/drift` (WARNING if drift detected)

Output saved to `pipeline_report.json` for CI/CD integration.

### Model Retraining

To retrain the model with improved hyperparameters:

```bash
cd E:\flood-risk-app
python save_model.py
```

This generates new `flood_model.cbm`, `medians.csv`, and `feature_names.json` in `backend/model/`.

---

## 🔑 Key Findings

### 1. Synthetic Data Limitation
**96% of training data was synthetic** (18,949 of 19,700 rows). This caused the raw model to output scores clustered in the moderate range (30-50%). Real-world MLOps insight: model performance is bounded by training data quality.

### 2. Calibration Bridges the Gap
The domain-aware calibration layer uses established flood risk factors (elevation thresholds, rainfall levels, river proximity) from Sri Lanka disaster management guidelines to adjust scores. This is documented and transparent — every weight has a justification.

### 3. Production Monitoring Matters
The drift detection endpoint revealed that while the calibration layer produces meaningful scores (0.22–0.78 range), the underlying model distribution still needs improvement. The system is designed to detect and flag when retraining is needed.

### 4. MLOps > Model Accuracy
The judging criteria emphasize deployment (25%), monitoring (25%), and innovation (10%) over raw model scores. Our system demonstrates:
- ✅ Cloud deployment on Railway + Vercel
- ✅ Real-time monitoring with Recharts
- ✅ Data drift detection
- ✅ Simulated retraining pipeline
- ✅ Automated pipeline checks
- ✅ Prediction logging with Supabase
- ✅ CI/CD via GitHub → Railway auto-deploy

---

## 👥 Team

| Name | Role |
|------|------|
| [Member 1] | ML Model Development + Backend Engineering |
| [Member 2] | Frontend Development + Deployment |

**Competition**: ML Opsidian Genesis — Final Round 2026
**Organization**: IEEE Student Branch, University of Colombo School of Computing

---

## 🔗 Live Links

| Resource | URL |
|----------|-----|
| **Frontend** | [https://flood-risk-app.vercel.app](https://flood-risk-app.vercel.app) |
| **Backend API** | [https://flood-risk-app-production.up.railway.app](https://flood-risk-app-production.up.railway.app) |
| **API Docs** | [https://flood-risk-app-production.up.railway.app/docs](https://flood-risk-app-production.up.railway.app/docs) |
| **GitHub** | [https://github.com/dinna21/Flood-Risk-App](https://github.com/dinna21/Flood-Risk-App) |

---

## 📄 License

MIT License — IEEE Student Branch UCSC 2026
