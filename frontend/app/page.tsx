"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import MonitoringDashboard from "./components/MonitoringDashboard";
import PipelineStatus from "./components/PipelineStatus";
import AlertSystem from "./components/AlertSystem";
import LiveDataPanel from "./components/LiveDataPanel";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crosshair,
  MapIcon,
  MapPin,
  Radio,
  RefreshCw,
  Settings2,
  Waves,
  Zap,
} from "./components/Icons";

/* Leaflet map must be client-only (no SSR) */
const FloodRiskMap = dynamic(() => import("./components/Map"), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Interfaces (unchanged) ─────────────────────────────────────── */
interface PredictionResult {
  flood_risk_score: number;
  risk_level: string;
  risk_color: string;
  district: string;
  message: string;
  timestamp: string;
  live_data_applied?: boolean;
  live_data_overrides?: {
    flood_warning?: boolean;
    rainfall_7d_mm?: number;
  };
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

/* ─── generateExplanation ───────────────────────────────────────── */
function generateExplanation(
  formData: Record<string, number | string>,
  score: number,
  level: string
): string {
  const riskPct = (score * 100).toFixed(1);
  const data = formData as Record<string, number | string>;

  const rainRisk = (data.rainfall_7d_mm as number) > 100
    ? "heavy recent rainfall"
    : (data.rainfall_7d_mm as number) > 50
    ? "moderate recent rainfall"
    : "low recent rainfall";

  const riverRisk = (data.distance_to_river_m as number) < 200
    ? "very close river proximity"
    : (data.distance_to_river_m as number) < 500
    ? "moderate river proximity"
    : "safe river distance";

  const elevRisk = (data.elevation_m as number) < 5
    ? "very low elevation (high flood exposure)"
    : (data.elevation_m as number) < 20
    ? "low elevation"
    : "safe elevation";

  const drainRisk = (data.drainage_index as number) < 0.3
    ? "poor drainage capacity"
    : (data.drainage_index as number) < 0.6
    ? "moderate drainage"
    : "good drainage";

  const histRisk = (data.historical_flood_count as number) > 5
    ? "frequent historical flooding"
    : (data.historical_flood_count as number) > 2
    ? "some historical flood events"
    : "minimal flood history";

  const actions = level === "Very High" ? [
    "Evacuate immediately if water levels rise",
    "Contact emergency services: 119",
    "Move valuables to higher ground",
    "Follow official evacuation routes"
  ] : level === "High" ? [
    "Monitor river and drainage levels closely",
    "Prepare emergency evacuation plan",
    "Stock emergency supplies for 3 days",
    "Register with nearest evacuation center"
  ] : level === "Moderate" ? [
    "Monitor weather forecasts daily",
    "Ensure drainage channels are clear",
    "Keep emergency contacts ready",
    `Nearest evacuation center: ${data.nearest_evac_km}km away`
  ] : [
    "Continue normal activities",
    "Stay informed about weather updates",
    "Maintain drainage systems regularly"
  ];

  return `This location in ${data.district} shows ${level.toLowerCase()} flood risk at ${riskPct}%. Key factors: ${rainRisk}, ${riverRisk}, ${elevRisk}, and ${drainRisk}. The area has ${histRisk} with ${data.historical_flood_count} recorded flood events. Soil type (${data.soil_type}) and land cover (${data.landcover}) further influence drainage.

Recommended Actions:
${actions.map((a, i) => `${i+1}. ${a}`).join('\n')}`;
}

/* ─── useCountUp hook (unchanged) ───────────────────────────────── */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

/* ─── Risk Arc SVG (88px compact) ────────────────────────────────── */
function RiskRing({ score, color }: { score: number; color: string }) {
  const radius       = 36;
  const circumference = 2 * Math.PI * radius;
  const offset        = circumference - (score / 100) * circumference;
  const animatedScore = useCountUp(score, 800);

  return (
    <div className="result-ring-wrap">
      <svg viewBox="0 0 88 88" aria-hidden="true">
        <circle cx="44" cy="44" r={radius}
          fill="none"
          stroke="rgba(100,200,255,0.08)"
          strokeWidth="6" />
        <circle
          cx="44" cy="44" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 44 44)"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color, lineHeight: 1, letterSpacing: "-0.03em" }}>
          {animatedScore.toFixed(1)}
        </span>
        <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 9, fontWeight: 400, color: "var(--text-muted)", marginTop: 1 }}>
          %
        </span>
      </div>
    </div>
  );
}

/* ─── Tab definitions ────────────────────────────────────────────── */
const TABS = [
  { id: "predict",  label: "Predict",    icon: Crosshair },
  { id: "map",      label: "Risk Map",   icon: MapIcon },
  { id: "monitor",  label: "Monitoring", icon: BarChart3 },
  { id: "pipeline", label: "Pipeline",   icon: Settings2 },
  { id: "live",     label: "Live Data",  icon: Radio },
];

/* ─── District auto-population defaults ─────────────────────────── */
const DISTRICT_DEFAULTS: Record<string, {
  elevation: number;
  rainfall: number;
  monthly: number;
  riverDist: number;
  floodCount: number;
  drainage: number;
  floodEvent: string;
  waterPresence: string;
}> = {
  Colombo:      { elevation:10,  rainfall:150, monthly:375, riverDist:200, floodCount:3,  drainage:0.4, floodEvent:"No",  waterPresence:"Medium" },
  Gampaha:      { elevation:15,  rainfall:160, monthly:400, riverDist:250, floodCount:3,  drainage:0.4, floodEvent:"No",  waterPresence:"Medium" },
  Kandy:        { elevation:500, rainfall:180, monthly:450, riverDist:400, floodCount:2,  drainage:0.5, floodEvent:"No",  waterPresence:"Low" },
  Galle:        { elevation:5,   rainfall:220, monthly:550, riverDist:100, floodCount:5,  drainage:0.3, floodEvent:"Yes", waterPresence:"High" },
  Matara:       { elevation:5,   rainfall:200, monthly:500, riverDist:150, floodCount:4,  drainage:0.3, floodEvent:"Yes", waterPresence:"High" },
  Hambantota:   { elevation:10,  rainfall:90,  monthly:225, riverDist:500, floodCount:2,  drainage:0.5, floodEvent:"No",  waterPresence:"Low" },
  Kurunegala:   { elevation:100, rainfall:130, monthly:325, riverDist:600, floodCount:2,  drainage:0.5, floodEvent:"No",  waterPresence:"Medium" },
  Ratnapura:    { elevation:3,   rainfall:320, monthly:800, riverDist:50,  floodCount:10, drainage:0.1, floodEvent:"Yes", waterPresence:"High" },
  Kalutara:     { elevation:5,   rainfall:260, monthly:650, riverDist:80,  floodCount:6,  drainage:0.2, floodEvent:"Yes", waterPresence:"High" },
  Badulla:      { elevation:680, rainfall:160, monthly:400, riverDist:400, floodCount:2,  drainage:0.5, floodEvent:"No",  waterPresence:"Low" },
  Monaragala:   { elevation:150, rainfall:110, monthly:275, riverDist:700, floodCount:2,  drainage:0.5, floodEvent:"No",  waterPresence:"Medium" },
  Polonnaruwa:  { elevation:50,  rainfall:90,  monthly:225, riverDist:300, floodCount:3,  drainage:0.4, floodEvent:"No",  waterPresence:"Medium" },
  Anuradhapura: { elevation:100, rainfall:70,  monthly:175, riverDist:1000,floodCount:1,  drainage:0.6, floodEvent:"No",  waterPresence:"Low" },
  Trincomalee:  { elevation:10,  rainfall:110, monthly:275, riverDist:400, floodCount:3,  drainage:0.4, floodEvent:"No",  waterPresence:"Medium" },
  Batticaloa:   { elevation:3,   rainfall:140, monthly:350, riverDist:80,  floodCount:5,  drainage:0.3, floodEvent:"Yes", waterPresence:"High" },
  Ampara:       { elevation:30,  rainfall:110, monthly:275, riverDist:300, floodCount:3,  drainage:0.4, floodEvent:"No",  waterPresence:"Medium" },
  Jaffna:       { elevation:5,   rainfall:50,  monthly:125, riverDist:1500,floodCount:1,  drainage:0.5, floodEvent:"No",  waterPresence:"Low" },
  Kilinochchi:  { elevation:15,  rainfall:55,  monthly:138, riverDist:1200,floodCount:1,  drainage:0.5, floodEvent:"No",  waterPresence:"Low" },
  Mannar:       { elevation:5,   rainfall:55,  monthly:138, riverDist:1000,floodCount:1,  drainage:0.5, floodEvent:"No",  waterPresence:"Low" },
  Vavuniya:     { elevation:80,  rainfall:75,  monthly:188, riverDist:800, floodCount:1,  drainage:0.6, floodEvent:"No",  waterPresence:"Low" },
  "Nuwara Eliya":{ elevation:1800,rainfall:60,  monthly:150, riverDist:3000,floodCount:0,  drainage:0.8, floodEvent:"No",  waterPresence:"Low" },
  Kegalle:      { elevation:180, rainfall:210, monthly:525, riverDist:250, floodCount:3,  drainage:0.4, floodEvent:"No",  waterPresence:"Medium" },
  Matale:       { elevation:350, rainfall:140, monthly:350, riverDist:400, floodCount:2,  drainage:0.5, floodEvent:"No",  waterPresence:"Low" },
  Puttalam:     { elevation:10,  rainfall:65,  monthly:163, riverDist:800, floodCount:1,  drainage:0.5, floodEvent:"No",  waterPresence:"Low" },
};

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
  const [explanation, setExplanation] = useState("");
  const [activeTab, setActiveTab] = useState("predict");
  const [alertCount, setAlertCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [useLiveData, setUseLiveData] = useState(false);

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { district, useLiveData } = (e as CustomEvent).detail;
      setActiveTab("predict");
      setUseLiveData(useLiveData ?? false);
      const defaults = DISTRICT_DEFAULTS[district];
      if (defaults) {
        setForm((prev) => ({
          ...prev,
          district,
          elevation_m: defaults.elevation,
          rainfall_7d_mm: defaults.rainfall,
          monthly_rainfall_mm: defaults.monthly,
          distance_to_river_m: defaults.riverDist,
          historical_flood_count: defaults.floodCount,
          drainage_index: defaults.drainage,
          flood_occurrence_current_event: defaults.floodEvent,
          water_presence_flag: defaults.waterPresence,
        }));
      }
    };
    window.addEventListener("selectDistrict", handler);
    return () => window.removeEventListener("selectDistrict", handler);
  }, []);

  /* ── API calls (unchanged) ── */
  const fetchHistory = async () => {
    try {
      const res  = await fetch(`${API_URL}/history`);
      const data = await res.json();
      setHistory(data.predictions || []);
    } catch (e) { console.error("History fetch failed:", e); }
  };

  const fetchStats = async () => {
    try {
      const res  = await fetch(`${API_URL}/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) { console.error("Stats fetch failed:", e); }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, use_live_data: useLiveData }),
      });
      if (!res.ok) throw new Error("Prediction failed");
      const data = await res.json();
      setResult(data);
      setExplanation(generateExplanation(form, data.flood_risk_score, data.risk_level));
      fetchHistory();
      fetchStats();
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
    if (name === "district" && typeof value === "string") {
      const defaults = DISTRICT_DEFAULTS[value];
      if (defaults) {
        setForm((prev) => ({
          ...prev,
          district: value,
          elevation_m: defaults.elevation,
          rainfall_7d_mm: defaults.rainfall,
          monthly_rainfall_mm: defaults.monthly,
          distance_to_river_m: defaults.riverDist,
          historical_flood_count: defaults.floodCount,
          drainage_index: defaults.drainage,
          flood_occurrence_current_event: defaults.floodEvent,
          water_presence_flag: defaults.waterPresence,
        }));
        return;
      }
    }
    setForm((prev) => ({
      ...prev,
      [name]: isNaN(Number(value)) ? value : Number(value),
    }));
  };

  /* ── Derived ── */
  const riskScore = result ? result.flood_risk_score * 100 : 0;
  const riskColor = result ? getRiskColor(result.risk_level) : "var(--accent)";

  const historyScoreColor = (level: string) => {
    switch (level) {
      case "Low":       return "var(--risk-low)";
      case "Moderate":  return "var(--risk-moderate)";
      case "High":      return "var(--risk-high)";
      case "Very High": return "#FF1744";
      default:          return "var(--text-secondary)";
    }
  };

  /* ────────────────────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Animated background orbs */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />
      <div className="orb orb-4" aria-hidden="true" />
      <div className="orb orb-5" aria-hidden="true" />

      {/* High-risk alert toasts */}
      <AlertSystem onAlertCount={setAlertCount} onAlertClick={(district) => {
        setActiveTab("predict");
        setShowNotifPanel(false);
        const defaults = DISTRICT_DEFAULTS[district];
        if (defaults) {
          setForm((prev) => ({
            ...prev,
            district,
            elevation_m: defaults.elevation,
            rainfall_7d_mm: defaults.rainfall,
            monthly_rainfall_mm: defaults.monthly,
            distance_to_river_m: defaults.riverDist,
            historical_flood_count: defaults.floodCount,
            drainage_index: defaults.drainage,
            flood_occurrence_current_event: defaults.floodEvent,
            water_presence_flag: defaults.waterPresence,
          }));
        }
      }} />

      {/* ── Page shell: full-viewport grid, header + scrollable body ── */}
      <div style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh", display: "flex", flexDirection: "column",
        background: "var(--void)",
      }}>

        {/* ════════ HEADER ════════ */}
        <header className="header-bar polish-header" style={{ flexShrink: 0, gridRow: "unset" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="brand-mark" aria-hidden="true" />
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span className="brand-kicker">Sri Lanka</span>
              <span className="brand-title">Flood Risk Intelligence</span>
            </div>
          </div>
          <div className="header-stats" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {stats ? (
              <div className="kpi-row">
                <div className="kpi-chip">
                  <div className="kpi-value" style={{ color: "var(--text-primary)" }}>{stats.total_predictions}</div>
                  <div className="kpi-label">Total Predictions</div>
                </div>
                <div className="kpi-chip">
                  <div className="kpi-value" style={{ color: "var(--risk-moderate)" }}>{(stats.avg_risk_score * 100).toFixed(1)}%</div>
                  <div className="kpi-label">Avg Risk</div>
                </div>
                <div className="kpi-chip">
                  <div className="kpi-value" style={{ color: "var(--risk-high)" }}>{stats.high_risk_count}</div>
                  <div className="kpi-label">High Risk</div>
                </div>
              </div>
            ) : (
              <div className="kpi-row">
                {[1, 2, 3].map(i => (
                  <div key={i} className="kpi-chip">
                    <div className="kpi-value" style={{ color: "var(--text-muted)" }}>--</div>
                    <div className="kpi-label">Loading</div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="icon-btn"
              style={{ position: "relative", width: 32, height: 32 }}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={16} strokeWidth={1.75} />
              {alertCount > 0 && (
                <span className="notif-badge">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* ════════ TAB BAR ════════ */}
        <nav className="polish-tabbar" style={{ flexShrink: 0, zIndex: 9 }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-item${active ? " active" : ""}`}
              >
                <span style={{ position: "relative", display: "inline-flex" }}>
                  <Icon size={15} strokeWidth={1.75} />
                  {tab.id === "live" && <span className="tab-live-dot" />}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ════════ TAB CONTENT ════════ */}
        <main style={{ flex: 1, overflowY: "auto", padding: 16 }}>

          {/* ── PREDICT TAB ── */}
          {activeTab === "predict" && (
            <div className="predict-outer">

              {/* ── LEFT FORM PANEL (unchanged content, new wrapper) ── */}
              <div className="predict-form-panel">
               <div className="glass-panel form-panel" style={{ height: "fit-content" }}>
                <div className="form-content">

                  {/* GROUP 1 — LOCATION */}
                  <div className="form-section-header"><span>Location</span><div className="section-rule" /></div>
                  <div className="form-group">
                    <div className="fields-1">
                      <div className="field-row">
                        <label className="field-label" htmlFor="district">District</label>
                        <div className="select-wrapper">
                          <select id="district" name="district" value={form.district}
                            onChange={handleChange} className="glass-input">
                            {["Colombo","Gampaha","Kandy","Galle","Matara",
                              "Hambantota","Kurunegala","Ratnapura","Kalutara",
                              "Badulla","Monaragala","Polonnaruwa","Anuradhapura",
                              "Trincomalee","Batticaloa","Ampara","Jaffna",
                              "Kilinochchi","Mannar","Vavuniya","Nuwara Eliya",
                              "Kegalle","Matale","Puttalam"].map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} strokeWidth={1.75} />
                        </div>
                      </div>
                    </div>
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

                  {/* GROUP 2 — WEATHER & TERRAIN */}
                  <div className="form-section-header"><span>Weather &amp; Terrain</span><div className="section-rule" /></div>
                  <div className="form-group">
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

                  {/* GROUP 3 — ENVIRONMENT */}
                  <div className="form-section-header"><span>Environment</span><div className="section-rule" /></div>
                  <div className="form-group">
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
                    <div className="fields-2">
                      <div className="field-row">
                        <label className="field-label" htmlFor="landcover">Land Cover</label>
                        <div className="select-wrapper">
                          <select id="landcover" name="landcover" value={form.landcover}
                            onChange={handleChange} className="glass-input">
                            {["Urban","Forest","Agriculture","Wetland","Water","Barren"]
                              .map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <ChevronDown size={12} strokeWidth={1.75} />
                        </div>
                      </div>
                      <div className="field-row">
                        <label className="field-label" htmlFor="soil_type">Soil Type</label>
                        <div className="select-wrapper">
                          <select id="soil_type" name="soil_type" value={form.soil_type}
                            onChange={handleChange} className="glass-input">
                            {["Clay","Sandy","Loam","Silt","Rock"]
                              .map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <ChevronDown size={12} strokeWidth={1.75} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GROUP 4 — RISK FACTORS */}
                  <div className="form-section-header"><span>Risk Factors</span><div className="section-rule" /></div>
                  <div className="form-group">
                    <div className="fields-2">
                      <div className="field-row">
                        <label className="field-label" htmlFor="road_quality">Road Quality</label>
                        <div className="select-wrapper">
                          <select id="road_quality" name="road_quality" value={form.road_quality}
                            onChange={handleChange} className="glass-input">
                            {["Paved","Gravel","Dirt","None"].map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <ChevronDown size={12} strokeWidth={1.75} />
                        </div>
                      </div>
                      <div className="field-row">
                        <label className="field-label" htmlFor="water_presence_flag">Water Presence</label>
                        <div className="select-wrapper">
                          <select id="water_presence_flag" name="water_presence_flag" value={form.water_presence_flag}
                            onChange={handleChange} className="glass-input">
                            {["Low","Medium","High"].map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <ChevronDown size={12} strokeWidth={1.75} />
                        </div>
                      </div>
                    </div>
                    <div className="fields-2">
                      <div className="field-row">
                        <label className="field-label" htmlFor="flood_occurrence_current_event">Current Flood Event</label>
                        <div className="select-wrapper">
                          <select id="flood_occurrence_current_event" name="flood_occurrence_current_event"
                            value={form.flood_occurrence_current_event}
                            onChange={handleChange} className="glass-input">
                            {["Yes","No"].map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <ChevronDown size={12} strokeWidth={1.75} />
                        </div>
                      </div>
                      <div className="field-row">
                        <label className="field-label" htmlFor="urban_rural">Urban / Rural</label>
                        <div className="select-wrapper">
                          <select id="urban_rural" name="urban_rural" value={form.urban_rural}
                            onChange={handleChange} className="glass-input">
                            {["Urban","Rural"].map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <ChevronDown size={12} strokeWidth={1.75} />
                        </div>
                      </div>
                    </div>
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

                {/* Live data toggle */}
                <div className="live-toggle-row">
                  <Radio size={14} strokeWidth={1.75} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: "'Inter',sans-serif", fontSize: 13,
                      fontWeight: 500, color: "var(--text-primary)",
                    }}>
                      Use Live Data
                    </div>
                    <div style={{
                      fontFamily: "'Inter',sans-serif", fontSize: 10,
                      color: "var(--text-muted)", marginTop: 1,
                    }}>
                      Syncs flood warnings & rainfall from live sources
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={useLiveData}
                      onChange={(e) => setUseLiveData(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                {useLiveData && (
                  <div style={{
                    background: "rgba(56,182,255,0.1)", border: "1px solid rgba(56,182,255,0.2)",
                    borderRadius: 8, padding: "6px 12px",
                    fontFamily: "'Inter',sans-serif", fontSize: 10,
                    color: "var(--accent)", textAlign: "center",
                  }}>
                    Live data will override flood event status and rainfall
                  </div>
                )}

                <button
                  id="predict-btn"
                  onClick={handleSubmit}
                  disabled={loading}
                  className={`predict-btn${loading ? " loading" : ""}`}
                >
                  {loading ? "Analyzing Risk..." : "Predict Flood Risk"}
                  {loading ? <RefreshCw size={14} strokeWidth={1.75} style={{ animation: "spin 0.9s linear infinite" }} /> : <ArrowRight size={14} strokeWidth={1.75} />}
                </button>
                {error && <div className="error-msg" role="alert">{error}</div>}
                </div>
              </div>

              {/* ── RIGHT RESULTS PANEL (3 sections, no outer scroll) ── */}
              <div className="predict-result-panel">

                {/* SECTION A: Ring + result — horizontal compact layout */}
                <div className="result-section-a">

                  {/* Left: SVG Ring (88px) */}
                  {result && !loading ? (
                    <RiskRing score={riskScore} color={riskColor} />
                  ) : (
                    <div className="ring-placeholder" />
                  )}

                  {/* Right: result content */}
                  <div className="result-content">
                    {result && !loading ? (
                      <>
                        <div className={`risk-badge ${getRiskClass(result.risk_level)}`}>
                          {result.risk_level} Risk
                        </div>
                        <p className="risk-message">{result.message}</p>
                        <div className="result-meta-row" style={{ marginTop: 4 }}>
                          <div className="result-meta-chip">
                            <MapPin size={12} strokeWidth={2} />
                            <span>{result.district}</span>
                          </div>
                          <div className="result-meta-chip">
                            <Clock size={12} strokeWidth={2} />
                            <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="result-meta-chip">
                            <Waves size={12} strokeWidth={2} />
                            <span style={{ color: riskColor }}>
                              {(result.flood_risk_score * 100).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                        {result.live_data_applied && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8,
                            padding: "5px 10px", background: "rgba(34,197,94,0.1)",
                            border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, width: "fit-content" }}>
                            <CheckCircle2 size={11} strokeWidth={2} style={{ color: "var(--risk-low)" }} />
                            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "#86efac", fontWeight: 500 }}>
                              Live data applied
                            </span>
                          </div>
                        )}
                      </>
                    ) : loading ? (
                      <>
                        <div className="content-placeholder-bar" style={{ width: 80 }} />
                        <div className="content-placeholder-bar" style={{ width: 180 }} />
                        <div className="content-placeholder-bar" style={{ width: 130 }} />
                        <div className="loading-ring" style={{ marginTop: 8 }} />
                      </>
                    ) : (
                      <>
                        <div className="content-placeholder-bar" style={{ width: 80 }} />
                        <div className="content-placeholder-bar" style={{ width: 180 }} />
                        <div className="content-placeholder-bar" style={{ width: 130 }} />
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, fontFamily: "'Inter',sans-serif" }}>
                          Fill details and click Predict
                        </p>
                      </>
                    )}
                  </div>
                </div>{/* end section-a */}

                {/* SECTION B: AI Risk Analysis — flex grow, internally scrollable */}
                <div className="result-section-b">
                  <div style={{
                    position: "sticky", top: 0, background: "var(--abyss)", zIndex: 1,
                    padding: "12px 16px 8px", borderBottom: "1px solid rgba(100,200,255,0.06)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <Brain size={13} strokeWidth={1.75} color="var(--text-secondary)" />
                    <span style={{
                      fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 12,
                      color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>
                      AI Risk Analysis
                    </span>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    {result && !loading && explanation ? (
                      <p style={{
                        color: "var(--text-secondary)", fontSize: 13,
                        lineHeight: 1.6, margin: 0, whiteSpace: "pre-line",
                        fontFamily: "'Inter',sans-serif",
                      }}>
                        {explanation}
                      </p>
                    ) : (
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", padding: "24px 0", gap: 10, textAlign: "center",
                      }}>
                        <Brain size={24} strokeWidth={1.5} color="var(--text-muted)" />
                        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, fontFamily: "'Inter',sans-serif" }}>
                          Fill details and click Predict to see AI analysis
                        </p>
                      </div>
                    )}
                  </div>
                </div>{/* end section-b */}

                {/* SECTION C: Recent Predictions — max 200px, internal scroll */}
                <div className="result-section-c">
                  <div className="result-section-c-header">
                    <span style={{
                      fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 12,
                      color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>
                      Recent Predictions
                    </span>
                    <button onClick={() => { fetchHistory(); fetchStats(); }}
                      style={{ background: "none", border: "none", cursor: "pointer",
                        padding: 2, color: "var(--text-muted)", display: "flex", alignItems: "center" }}
                      title="Refresh">
                      <RefreshCw size={12} strokeWidth={1.75} />
                    </button>
                  </div>
                  {history.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center",
                      fontSize: 12, color: "var(--text-muted)", fontFamily: "'Inter',sans-serif" }}>
                      No predictions recorded yet
                    </div>
                  ) : (
                    history.slice(0, 10).map((item) => (
                      <div className="pred-row" key={item.id}>
                        <span style={{
                          flex: 1, fontFamily: "'Inter',sans-serif", fontWeight: 500, fontSize: 12,
                          color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {item.district}
                        </span>
                        <span style={{
                          fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, fontSize: 12,
                          color: historyScoreColor(item.risk_level), width: 44, textAlign: "right", flexShrink: 0,
                        }}>
                          {(item.flood_risk_score * 100).toFixed(1)}%
                        </span>
                        <span className={`history-badge ${getRiskClass(item.risk_level)}`}
                          style={{ flexShrink: 0 }}>
                          {item.risk_level}
                        </span>
                        <span style={{
                          fontFamily: "'Inter',sans-serif", fontSize: 10, color: "var(--text-muted)",
                          width: 50, textAlign: "right", flexShrink: 0,
                        }}>
                          {new Date(item.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── MAP TAB ── */}
          {activeTab === "map" && (
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
              <FloodRiskMap />
            </div>
          )}

          {/* ── MONITORING TAB ── */}
          {activeTab === "monitor" && (
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
              <MonitoringDashboard />
            </div>
          )}

          {/* ── PIPELINE TAB ── */}
          {activeTab === "pipeline" && <PipelineStatus />}

          {/* ── LIVE DATA TAB ── */}
          {activeTab === "live" && <LiveDataPanel />}

        </main>

        {/* Footer */}
        <footer style={{
          textAlign: "center", padding: "12px 0",
          fontFamily: "'Inter',sans-serif", fontSize: 11, color: "var(--text-muted)",
          borderTop: "1px solid var(--glass-border)", flexShrink: 0,
        }}>
          ML Opsidian Genesis — TensorTitans_mlops — IEEE Student Branch UCSC
        </footer>
      </div>
    </>
  );
}

