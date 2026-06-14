"use client";
import { useState, useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Interfaces (unchanged) ─────────────────────────────────────── */
interface PredictionResult {
  flood_risk_score: number;
  risk_level: string;
  risk_color: string;
  district: string;
  message: string;
  timestamp: string;
}

interface HistoryItem {
  id: number;
  created_at: string;
  district: string;
  flood_risk_score: number;
  risk_level: string;
}

interface Stats {
  total_predictions: number;
  avg_risk_score: number;
  high_risk_count: number;
  districts_analyzed: string[];
}

/* ─── Helpers (unchanged) ────────────────────────────────────────── */
function getRiskClass(level: string): string {
  switch (level) {
    case "Low":       return "badge-low";
    case "Moderate":  return "badge-moderate";
    case "High":      return "badge-high";
    case "Very High": return "badge-veryhigh";
    default:          return "badge-default";
  }
}

function getRiskColor(level: string): string {
  switch (level) {
    case "Low":       return "var(--risk-low)";
    case "Moderate":  return "var(--risk-moderate)";
    case "High":      return "var(--risk-high)";
    case "Very High": return "#FF1744";
    default:          return "var(--text-secondary)";
  }
}

/* ─── useCountUp hook (unchanged) ───────────────────────────────── */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

/* ─── Risk Arc SVG (200×200, 8px stroke, animated) ──────────────── */
function RiskRing({ score, color }: { score: number; color: string }) {
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const animatedScore = useCountUp(score, 800);

  return (
    <div className="risk-ring-container">
      <svg className="risk-ring-svg" viewBox="0 0 200 200" aria-hidden="true">
        <circle className="risk-ring-bg" cx="100" cy="100" r={radius} />
        <circle
          className="risk-ring-fill"
          cx="100" cy="100" r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="risk-score-center">
        <span className="risk-score-value" style={{ color }}>
          {animatedScore.toFixed(1)}
        </span>
        <span className="risk-score-pct">%</span>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function Home() {
  /* ── State (unchanged) ── */
  const [form, setForm] = useState({
    district: "Colombo",
    latitude: 6.9,
    longitude: 79.9,
    elevation_m: 10.0,
    distance_to_river_m: 500.0,
    rainfall_7d_mm: 50.0,
    monthly_rainfall_mm: 200.0,
    historical_flood_count: 2,
    drainage_index: 0.5,
    ndvi: 0.3,
    ndwi: 0.1,
    infrastructure_score: 0.6,
    nearest_hospital_km: 5.0,
    nearest_evac_km: 3.0,
    landcover: "Urban",
    soil_type: "Clay",
    water_supply: "Pipe",
    electricity: "Yes",
    road_quality: "Paved",
    urban_rural: "Urban",
    water_presence_flag: "Low",
    flood_occurrence_current_event: "No",
    is_good_to_live: "Yes",
  });

  const [result, setResult]   = useState<PredictionResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    fetchHistory();
    fetchStats();
    const interval = setInterval(() => {
      fetchHistory();
      fetchStats();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  /* ── API calls (unchanged) ── */
  const fetchHistory = async () => {
    try {
      const res  = await fetch(`${API_URL}/history`);
      const data = await res.json();
      console.log("History:", data);
      setHistory(data.predictions || []);
    } catch (e) {
      console.error("History fetch failed:", e);
      setError("Failed to load history");
    }
  };

  const fetchStats = async () => {
    try {
      const res  = await fetch(`${API_URL}/stats`);
      const data = await res.json();
      console.log("Stats:", data);
      setStats(data);
    } catch (e) {
      console.error("Stats fetch failed:", e);
      setError("Failed to load stats");
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Prediction failed");
      const data = await res.json();
      setResult(data);
      fetchHistory();
      fetchStats();
      setTimeout(() => {
        fetchHistory();
        fetchStats();
      }, 1000);
    } catch (e) {
      setError("Failed to get prediction. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: isNaN(Number(value)) ? value : Number(value),
    }));
  };

  /* ── Derived display values ── */
  const riskScore = result ? result.flood_risk_score * 100 : 0;
  const riskColor = result ? getRiskColor(result.risk_level) : "var(--accent)";

  /* ── Score color for history items ── */
  const historyScoreColor = (level: string) => {
    switch (level) {
      case "Low":       return "var(--risk-low)";
      case "Moderate":  return "var(--risk-moderate)";
      case "High":      return "var(--risk-high)";
      case "Very High": return "#FF1744";
      default:          return "var(--text-secondary)";
    }
  };

  /* ── JSX ── */
  return (
    <>
      {/* Animated background orbs */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />
      <div className="orb orb-4" aria-hidden="true" />
      <div className="orb orb-5" aria-hidden="true" />

      <div className="page-root">

        {/* ════════════════ HEADER (52px) ════════════════ */}
        <header className="header-bar">
          <div className="header-title">
            Sri Lanka <span className="accent">Flood Risk Intelligence</span>
          </div>

          <div className="header-stats">
            <div className="stat-chip">
              <span className="stat-chip-value">
                {stats ? stats.total_predictions : "—"}
              </span>
              <span className="stat-chip-label">Total Predictions</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip-value">
                {stats ? (stats.avg_risk_score * 100).toFixed(1) + "%" : "—"}
              </span>
              <span className="stat-chip-label">Avg Risk Score</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip-value">
                {stats ? stats.high_risk_count : "—"}
              </span>
              <span className="stat-chip-label">High Risk Areas</span>
            </div>
          </div>
        </header>

        {/* ════════════════ BODY GRID ════════════════ */}
        <div className="body-grid">

          {/* ─── LEFT COLUMN — Input Form (400px, no scroll) ─── */}
          <div className="form-column">
            <div className="glass-panel form-panel">

              <div className="form-content">

                {/* ── GROUP 1: LOCATION ── */}
                <div className="form-group-label">Location</div>
                <div className="form-group">
                  {/* District — full width */}
                  <div className="fields-1">
                    <div className="field-row">
                      <label className="field-label" htmlFor="district">District</label>
                      <div className="select-wrapper">
                        <select
                          id="district" name="district"
                          value={form.district}
                          onChange={handleChange}
                          className="glass-input"
                        >
                          {["Colombo","Gampaha","Kandy","Galle","Matara",
                            "Hambantota","Kurunegala","Ratnapura","Kalutara",
                            "Badulla","Monaragala","Polonnaruwa","Anuradhapura",
                            "Trincomalee","Batticaloa","Ampara","Jaffna",
                            "Kilinochchi","Mannar","Vavuniya","Nuwara Eliya",
                            "Kegalle","Matale","Puttalam"].map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {/* Latitude / Longitude — 2 col */}
                  <div className="fields-2">
                    <div className="field-row">
                      <label className="field-label" htmlFor="latitude">Latitude</label>
                      <input id="latitude" type="number" name="latitude"
                        value={form.latitude} onChange={handleChange}
                        className="glass-input" step="any" />
                    </div>
                    <div className="field-row">
                      <label className="field-label" htmlFor="longitude">Longitude</label>
                      <input id="longitude" type="number" name="longitude"
                        value={form.longitude} onChange={handleChange}
                        className="glass-input" step="any" />
                    </div>
                  </div>
                </div>

                {/* ── GROUP 2: WEATHER & TERRAIN ── */}
                <div className="form-group-label">Weather &amp; Terrain</div>
                <div className="form-group">
                  {/* 3 col */}
                  <div className="fields-3">
                    <div className="field-row">
                      <label className="field-label" htmlFor="elevation_m">Elevation (m)</label>
                      <input id="elevation_m" type="number" name="elevation_m"
                        value={form.elevation_m} onChange={handleChange}
                        className="glass-input" step="any" />
                    </div>
                    <div className="field-row">
                      <label className="field-label" htmlFor="rainfall_7d_mm">Rain 7d (mm)</label>
                      <input id="rainfall_7d_mm" type="number" name="rainfall_7d_mm"
                        value={form.rainfall_7d_mm} onChange={handleChange}
                        className="glass-input" step="any" />
                    </div>
                    <div className="field-row">
                      <label className="field-label" htmlFor="monthly_rainfall_mm">Monthly (mm)</label>
                      <input id="monthly_rainfall_mm" type="number" name="monthly_rainfall_mm"
                        value={form.monthly_rainfall_mm} onChange={handleChange}
                        className="glass-input" step="any" />
                    </div>
                  </div>
                </div>

                {/* ── GROUP 3: ENVIRONMENT ── */}
                <div className="form-group-label">Environment</div>
                <div className="form-group">
                  {/* River / Evac — 2 col */}
                  <div className="fields-2">
                    <div className="field-row">
                      <label className="field-label" htmlFor="distance_to_river_m">River Dist. (m)</label>
                      <input id="distance_to_river_m" type="number" name="distance_to_river_m"
                        value={form.distance_to_river_m} onChange={handleChange}
                        className="glass-input" step="any" />
                    </div>
                    <div className="field-row">
                      <label className="field-label" htmlFor="nearest_evac_km">Evac. Center (km)</label>
                      <input id="nearest_evac_km" type="number" name="nearest_evac_km"
                        value={form.nearest_evac_km} onChange={handleChange}
                        className="glass-input" step="any" />
                    </div>
                  </div>
                  {/* Land Cover / Soil Type — 2 col */}
                  <div className="fields-2">
                    <div className="field-row">
                      <label className="field-label" htmlFor="landcover">Land Cover</label>
                      <div className="select-wrapper">
                        <select id="landcover" name="landcover"
                          value={form.landcover} onChange={handleChange}
                          className="glass-input">
                          {["Urban","Forest","Agriculture","Wetland","Water","Barren"]
                            .map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="field-row">
                      <label className="field-label" htmlFor="soil_type">Soil Type</label>
                      <div className="select-wrapper">
                        <select id="soil_type" name="soil_type"
                          value={form.soil_type} onChange={handleChange}
                          className="glass-input">
                          {["Clay","Sandy","Loam","Silt","Rock"]
                            .map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── GROUP 4: RISK FACTORS ── */}
                <div className="form-group-label">Risk Factors</div>
                <div className="form-group">
                  {/* Road / Water presence — 2 col */}
                  <div className="fields-2">
                    <div className="field-row">
                      <label className="field-label" htmlFor="road_quality">Road Quality</label>
                      <div className="select-wrapper">
                        <select id="road_quality" name="road_quality"
                          value={form.road_quality} onChange={handleChange}
                          className="glass-input">
                          {["Paved","Gravel","Dirt","None"]
                            .map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="field-row">
                      <label className="field-label" htmlFor="water_presence_flag">Water Presence</label>
                      <div className="select-wrapper">
                        <select id="water_presence_flag" name="water_presence_flag"
                          value={form.water_presence_flag} onChange={handleChange}
                          className="glass-input">
                          {["Low","Medium","High"]
                            .map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  {/* Flood event / Urban-Rural — 2 col */}
                  <div className="fields-2">
                    <div className="field-row">
                      <label className="field-label" htmlFor="flood_occurrence_current_event">Current Flood Event</label>
                      <div className="select-wrapper">
                        <select id="flood_occurrence_current_event" name="flood_occurrence_current_event"
                          value={form.flood_occurrence_current_event} onChange={handleChange}
                          className="glass-input">
                          {["Yes","No"].map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="field-row">
                      <label className="field-label" htmlFor="urban_rural">Urban / Rural</label>
                      <div className="select-wrapper">
                        <select id="urban_rural" name="urban_rural"
                          value={form.urban_rural} onChange={handleChange}
                          className="glass-input">
                          {["Urban","Rural"].map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  {/* Flood count / Drainage / Infra — 3 col */}
                  <div className="fields-3">
                    <div className="field-row">
                      <label className="field-label" htmlFor="historical_flood_count">Flood Count</label>
                      <input id="historical_flood_count" type="number" name="historical_flood_count"
                        value={form.historical_flood_count} onChange={handleChange}
                        className="glass-input" step="1" />
                    </div>
                    <div className="field-row">
                      <label className="field-label" htmlFor="drainage_index">Drainage (0–1)</label>
                      <input id="drainage_index" type="number" name="drainage_index"
                        value={form.drainage_index} onChange={handleChange}
                        className="glass-input" step="0.01" />
                    </div>
                    <div className="field-row">
                      <label className="field-label" htmlFor="infrastructure_score">Infra. Score</label>
                      <input id="infrastructure_score" type="number" name="infrastructure_score"
                        value={form.infrastructure_score} onChange={handleChange}
                        className="glass-input" step="0.01" />
                    </div>
                  </div>
                  {/* Hospital / NDVI — 2 col */}
                  <div className="fields-2">
                    <div className="field-row">
                      <label className="field-label" htmlFor="nearest_hospital_km">Hospital (km)</label>
                      <input id="nearest_hospital_km" type="number" name="nearest_hospital_km"
                        value={form.nearest_hospital_km} onChange={handleChange}
                        className="glass-input" step="any" />
                    </div>
                    <div className="field-row">
                      <label className="field-label" htmlFor="ndvi">NDVI</label>
                      <input id="ndvi" type="number" name="ndvi"
                        value={form.ndvi} onChange={handleChange}
                        className="glass-input" step="0.01" />
                    </div>
                  </div>
                </div>

              </div>{/* end form-content */}

              {/* Predict button — margin-top: auto pushes to bottom */}
              <button
                id="predict-btn"
                onClick={handleSubmit}
                disabled={loading}
                className={`predict-btn${loading ? " loading" : ""}`}
              >
                {loading ? "Analyzing Risk..." : "Predict Flood Risk"}
              </button>

              {error && (
                <div className="error-msg" role="alert">{error}</div>
              )}

            </div>
          </div>

          {/* ─── RIGHT COLUMN ─── */}
          <div className="right-column">

            {/* ── PREDICTION RESULT PANEL ── */}
            <div className="glass-panel result-panel">
              <div className="result-title">Prediction Result</div>

              {/* Empty state */}
              {!result && !loading && (
                <div className="result-empty">
                  <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
                    <circle cx="26" cy="26" r="25" stroke="var(--glass-border)" strokeWidth="1.5"/>
                    <path
                      d="M26 12 C26 12 18 22 18 28 C18 32.4 21.6 36 26 36 C30.4 36 34 32.4 34 28 C34 22 26 12 26 12Z"
                      fill="none" stroke="var(--text-muted)"
                      strokeWidth="1.5" strokeLinejoin="round"
                    />
                  </svg>
                  <p className="result-empty-text">
                    Fill in the location details and click Predict to assess flood risk
                  </p>
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div className="result-empty">
                  <div className="loading-ring" />
                  <p className="result-empty-text">Analyzing flood risk...</p>
                </div>
              )}

              {/* Result — grid: 200px arc | details */}
              {result && !loading && (
                <div className="result-content" key={result.timestamp}>

                  {/* Left: Arc + animated score */}
                  <RiskRing score={riskScore} color={riskColor} />

                  {/* Right: badge + message + meta */}
                  <div className="risk-details">
                    <div className={`risk-badge ${getRiskClass(result.risk_level)}`}>
                      {result.risk_level} Risk
                    </div>

                    <p className="risk-message">{result.message}</p>

                    <div className="risk-meta">
                      <div className="risk-meta-item">
                        <span className="risk-meta-label">District</span>
                        <span className="risk-meta-value">{result.district}</span>
                      </div>
                      <div className="risk-meta-item">
                        <span className="risk-meta-label">Time</span>
                        <span className="risk-meta-value">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="risk-meta-item">
                        <span className="risk-meta-label">Score</span>
                        <span className="risk-meta-value" style={{ color: riskColor }}>
                          {(result.flood_risk_score * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* ── RECENT PREDICTIONS PANEL ── */}
            <div className="glass-panel history-panel">
              <div className="history-title">
                Recent Predictions
                <button
                  onClick={() => { fetchHistory(); fetchStats(); }}
                  className="refresh-btn"
                  title="Refresh history"
                >
                  ↻
                </button>
              </div>

              {history.length === 0 ? (
                <div className="history-empty">No predictions recorded yet</div>
              ) : (
                <div className="history-list">
                  {history.slice(0, 10).map((item) => (
                    <div className="history-item" key={item.id}>
                      <span className="history-district">{item.district}</span>
                      <span
                        className="history-score"
                        style={{ color: historyScoreColor(item.risk_level) }}
                      >
                        {(item.flood_risk_score * 100).toFixed(1)}%
                      </span>
                      <span className={`history-badge ${getRiskClass(item.risk_level)}`}>
                        {item.risk_level}
                      </span>
                      <span className="history-time">
                        {new Date(item.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>{/* end right-column */}
        </div>{/* end body-grid */}
      </div>{/* end page-root */}
    </>
  );
}
