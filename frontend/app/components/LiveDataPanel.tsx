"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Radio,
  RefreshCw,
} from "./Icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DistrictLiveData {
  flood_warning: boolean;
  rainfall_7d_mm: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  weather_desc: string | null;
  weather_main: string | null;
  last_updated: string | null;
  rainfall_source?: string;
  cache_age_minutes?: number;
  data_freshness?: string;
  risk_context?: {
    elevation_m: number;
    historical_floods: number;
    drainage_index: number;
    risk_category: string;
  };
  sources: {
    dmc: string;
    owm: string;
  };
}

interface LiveDataResponse {
  districts: Record<string, DistrictLiveData>;
  last_refresh: string | null;
  total_warnings: number;
  cache_age_seconds: number;
  sources_status: {
    dmc: string;
    owm: string;
  };
}

const DISTRICT_ORDER = [
  "Colombo", "Gampaha", "Kandy", "Galle", "Matara",
  "Hambantota", "Kurunegala", "Ratnapura", "Kalutara",
  "Badulla", "Monaragala", "Polonnaruwa", "Anuradhapura",
  "Trincomalee", "Batticaloa", "Ampara", "Jaffna",
  "Kilinochchi", "Mannar", "Vavuniya", "Nuwara Eliya",
  "Kegalle", "Matale", "Puttalam",
];

const REFRESH_INTERVAL = 5 * 60; // 5 minutes in seconds

function toSLTime(isoStr: string | null): string {
  if (!isoStr) return "Never";
  try {
    return new Date(isoStr).toLocaleTimeString("en-LK", {
      timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

function formatAge(minutes: number | undefined): string {
  if (minutes === undefined || minutes < 0) return "Never";
  if (minutes < 1) return "<1m ago";
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h}h ${m}m ago`;
}

function SourceDot({ status }: { status: string }) {
  const color =
    status === "ok" ? "#22c55e" :
    status === "error" ? "#ef4444" : "#64748b";
  return (
    <span style={{
      width: 8, height: 8, borderRadius: "50%",
      background: color, display: "inline-block",
      boxShadow: `0 0 8px ${color}`,
      flexShrink: 0,
    }} />
  );
}

function getRainfallColor(mm: number | null): string {
  if (mm === null) return "var(--text-muted)";
  if (mm > 250) return "var(--risk-high)";
  if (mm > 150) return "var(--risk-moderate)";
  if (mm < 15) return "var(--risk-low)";
  return "var(--text-secondary)";
}

function FreshnessDot({ freshness, ageMinutes }: { freshness?: string; ageMinutes?: number }) {
  const cls = freshness === "fresh" ? "fresh" : freshness === "stale" ? "stale" : "very-stale";
  const title = freshness ? `Last updated ${formatAge(ageMinutes)}` : "";
  return <span className={`freshness-dot ${cls}`} title={title} />;
}

function SkeletonCard() {
  return <div className="skeleton-card" />;
}

export default function LiveDataPanel() {
  const [liveData, setLiveData] = useState<LiveDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<"idle" | "success" | "fail" | "ratelimited">("idle");
  const [retryAfter, setRetryAfter] = useState(0);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);
  const [expandedDistrictData, setExpandedDistrictData] = useState<DistrictLiveData | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Fetch data ---
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setRefreshing(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/live-data`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LiveDataResponse = await res.json();
      setLiveData(data);
    } catch (e) {
      setError("Failed to load live data. The backend may be unavailable.");
      console.error("LiveData fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // --- Manual refresh via POST /live-data/refresh ---
  const manualRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshStatus("idle");
    try {
      const res = await fetch(`${API_URL}/live-data/refresh`, { method: "POST" });
      if (res.status === 429) {
        const body = await res.json();
        setRefreshStatus("ratelimited");
        setRetryAfter(body.retry_after_seconds || 60);
        setRefreshing(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData(false);
      setRefreshStatus("success");
      setCountdown(REFRESH_INTERVAL);
    } catch {
      setRefreshStatus("fail");
      setRefreshing(false);
    } finally {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = setTimeout(() => {
        setRefreshStatus("idle");
        setRefreshing(false);
      }, 2500);
    }
  }, [fetchData, refreshing]);

  // --- Expand card + fetch detail ---
  const toggleExpand = useCallback(async (district: string) => {
    if (expandedDistrict === district) {
      setExpandedDistrict(null);
      setExpandedDistrictData(null);
      return;
    }
    setExpandedDistrict(district);
    try {
      const res = await fetch(`${API_URL}/live-data/${encodeURIComponent(district)}`);
      if (res.ok) {
        const detail = await res.json();
        setExpandedDistrictData(detail);
      }
    } catch {
      setExpandedDistrictData(null);
    }
  }, [expandedDistrict]);

  // --- Initial fetch + auto-fetch every 5 min ---
  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
      setCountdown(REFRESH_INTERVAL);
    }, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- Countdown timer (1s ticks) ---
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? REFRESH_INTERVAL : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Cleanup status timeout ---
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{
          background: "var(--glass)", border: "1px solid var(--glass-border)",
          borderRadius: 16, padding: "18px 20px", marginBottom: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            <Radio size={15} strokeWidth={1.75} style={{ color: "var(--accent)", marginRight: 8, verticalAlign: "middle" }} /> Live Data
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="loading-ring" style={{ width: 20, height: 20, borderWidth: 2 }} />
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--text-muted)" }}>Loading...</span>
          </div>
        </div>
        <div className="live-grid">
          {Array.from({ length: 24 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error && !liveData) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{
          background: "rgba(255,61,0,0.08)", border: "1px solid rgba(255,61,0,0.2)",
          borderRadius: 16, padding: 40, textAlign: "center",
        }}>
          <AlertTriangle size={36} strokeWidth={1.5} style={{ color: "var(--risk-high)", marginBottom: 12 }} />
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
            Live data temporarily unavailable
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            The system will retry automatically. Predictions use form defaults.
          </p>
          <button
            onClick={() => { setLoading(true); fetchData(true); }}
            style={{
              background: "linear-gradient(135deg,#1A7FCC 0%,#38B6FF 100%)",
              border: "none", borderRadius: 10, color: "#fff",
              fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 12,
              padding: "8px 20px", cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const districts = liveData?.districts || {};
  const totalWarnings = liveData?.total_warnings || 0;
  const sourcesStatus = liveData?.sources_status || { dmc: "unavailable", owm: "unavailable" };
  const lastRefresh = liveData?.last_refresh || null;
  const cacheAge = liveData?.cache_age_seconds ?? -1;
  const isFresh = cacheAge >= 0 && cacheAge < 4200; // < 70 min
  const isStale = cacheAge >= 4200 && cacheAge < 10800; // 70-180 min
  const isVeryStale = cacheAge >= 10800;

  const dmcLabel =
    sourcesStatus.dmc === "ok" ? "Active" :
    sourcesStatus.dmc === "error" ? "Unreachable" :
    "No warnings posted";
  const owmLabel =
    sourcesStatus.owm === "ok" ? "Live weather" :
    sourcesStatus.owm === "error" ? "API error" :
    "Key not configured";

  const refreshBtnLabel =
    refreshing ? "Refreshing..." :
    refreshStatus === "success" ? "Updated" :
    refreshStatus === "fail" ? "Failed" :
    refreshStatus === "ratelimited" ? `Wait ${retryAfter}s` :
    "Refresh";

  const countdownDisplay =
    `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`;
  const progressPercent = ((REFRESH_INTERVAL - countdown) / REFRESH_INTERVAL) * 100;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      {/* SECTION A — Status Bar + Progress */}
      <div style={{
        background: "var(--glass)", border: "1px solid var(--glass-border)",
        borderRadius: 16, padding: "14px 20px 0 20px", marginBottom: 16,
        backdropFilter: "blur(24px) saturate(180%)",
      }}>
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "space-between",
          alignItems: "center", gap: 12, paddingBottom: 10,
        }}>
          <div>
            <h2 style={{
              fontFamily: "'Space Grotesk',sans-serif", fontSize: 16,
              fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em",
            }}>
              <Radio size={15} strokeWidth={1.75} style={{ color: "var(--accent)", marginRight: 8, verticalAlign: "middle" }} /> Live Data
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="source-pill" title="DMC (Disaster Management Centre) flood warnings scraped from dmc.gov.lk every 60 minutes. When no warnings are posted, this shows 'No warnings posted' — that is correct, not an error.">
              <SourceDot status={sourcesStatus.dmc} />
              {dmcLabel}
            </span>
            <span className="source-pill">
              <SourceDot status={sourcesStatus.owm} />
              {owmLabel}
            </span>
            <span className="live-countdown" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Clock size={11} strokeWidth={2} /> {countdownDisplay}</span>
            <button
              onClick={manualRefresh}
              disabled={refreshing}
              style={{
                background: "rgba(58,96,128,0.25)", border: "1px solid var(--glass-border)",
                borderRadius: 8, color:
                  refreshStatus === "success" ? "var(--risk-low)" :
                  refreshStatus === "fail" ? "var(--risk-high)" :
                  refreshStatus === "ratelimited" ? "var(--risk-moderate)" :
                  "var(--text-secondary)",
                fontFamily: "'Inter',sans-serif", fontSize: 11,
                padding: "4px 12px", cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.6 : 1, whiteSpace: "nowrap",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RefreshCw size={13} strokeWidth={1.75} style={refreshing ? { animation: "spin 0.9s linear infinite" } : undefined} />{refreshing ? "Refreshing..." : refreshBtnLabel}</span>
            </button>
          </div>
        </div>
        <div className="live-progress-bar" style={{ marginBottom: 0 }}>
          <div className="live-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* SECTION B — Warning Banner */}
      {totalWarnings > 0 ? (
        <div className="warning-banner-active" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <AlertTriangle size={15} strokeWidth={2} style={{ color: "var(--risk-high)" }} />
            <span style={{
              fontFamily: "'Space Grotesk',sans-serif", fontSize: 14,
              fontWeight: 600, color: "#fc8181",
            }}>
              ACTIVE FLOOD WARNINGS — {totalWarnings} district{totalWarnings > 1 ? "s" : ""}
            </span>
            <span style={{
              fontFamily: "'Inter',sans-serif", fontSize: 10,
              color: "var(--text-muted)", marginLeft: "auto",
            }}>
              Issued by DMC • Updated {formatAge(cacheAge >= 0 ? cacheAge / 60 : undefined)}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {DISTRICT_ORDER.filter(d => districts[d]?.flood_warning).map(d => (
              <span key={d} style={{
                background: "rgba(255,61,0,0.2)", border: "1px solid rgba(255,61,0,0.4)",
                borderRadius: 20, padding: "2px 10px", cursor: "pointer",
                fontFamily: "'Inter',sans-serif", fontSize: 11,
                fontWeight: 500, color: "#fc8181",
              }}
                onClick={() => toggleExpand(d)}
              >
                <AlertTriangle size={12} strokeWidth={2} /> {d}
              </span>
            ))}
          </div>
        </div>
      ) : isFresh && cacheAge >= 0 ? (
        <div className="warning-banner-clear" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Clock size={15} strokeWidth={2} style={{ color: "var(--risk-moderate)" }} />
            <span style={{
              fontFamily: "'Space Grotesk',sans-serif", fontSize: 14,
              fontWeight: 600, color: "#86efac",
            }}>
              No Active Flood Warnings — All districts clear
            </span>
          </div>
        </div>
      ) : (
        <div className="warning-banner-stale" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={15} strokeWidth={2} style={{ color: "var(--risk-low)" }} />
            <span style={{
              fontFamily: "'Space Grotesk',sans-serif", fontSize: 14,
              fontWeight: 600, color: "#fcd34d",
            }}>
              Live data is {formatAge(cacheAge >= 0 ? cacheAge / 60 : undefined)} old
            </span>
            <span
              onClick={manualRefresh}
              style={{
                color: "var(--accent)", cursor: "pointer",
                fontFamily: "'Inter',sans-serif", fontSize: 12,
                fontWeight: 500, textDecoration: "underline",
              }}
            >
              Refresh for latest warnings
            </span>
          </div>
        </div>
      )}

      {/* SECTION C — District Grid */}
      <div className="live-grid">
        {DISTRICT_ORDER.map(district => {
          const d = districts[district];
          const hasWarning = d?.flood_warning === true;
          const isExpanded = expandedDistrict === district;
          const cardClass = `live-card${hasWarning ? " warning-active" : ""}${isExpanded ? " card-expanded" : ""}`;

          return (
            <div key={district} className={cardClass} style={{ position: "relative" }}>
              {/* Freshness dot */}
              <FreshnessDot freshness={d?.data_freshness} ageMinutes={d?.cache_age_minutes} />

              {/* Header row */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", marginBottom: 10,
              }}>
                <span style={{
                  fontFamily: "'Space Grotesk',sans-serif", fontSize: 13,
                  fontWeight: 600, color: "var(--text-primary)",
                }}>
                  {district}
                </span>
                {hasWarning ? (
                  <span className="warning-pulse" style={{
                    background: "rgba(255,61,0,0.2)", border: "1px solid rgba(255,61,0,0.4)",
                    borderRadius: 20, padding: "1px 8px",
                    fontFamily: "'Inter',sans-serif", fontSize: 10,
                    fontWeight: 600, color: "#fc8181",
                    whiteSpace: "nowrap",
                  }}>
                    <AlertTriangle size={12} strokeWidth={2} /> Warning
                  </span>
                ) : (
                  <span style={{
                    background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
                    borderRadius: 20, padding: "1px 8px",
                    fontFamily: "'Inter',sans-serif", fontSize: 10,
                    fontWeight: 500, color: "#86efac",
                    whiteSpace: "nowrap",
                  }}>
                    <CheckCircle2 size={12} strokeWidth={2} /> Clear
                  </span>
                )}
              </div>

              {/* Core data */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    Rainfall
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 500, color: getRainfallColor(d?.rainfall_7d_mm ?? null) }}>
                    {d?.rainfall_7d_mm !== null ? `${d?.rainfall_7d_mm} mm` : "--"}
                    {d?.rainfall_source === "monsoon_estimate" && (
                      <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 9, color: "var(--text-muted)", marginLeft: 3 }}>(est.)</span>
                    )}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>Temp</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                    {d?.temperature_c !== null ? `${d?.temperature_c}°C` : "--"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>Humidity</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                    {d?.humidity_pct !== null ? `${d?.humidity_pct}%` : "--"}
                  </span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontStyle: "italic", color: "var(--text-muted)" }}>
                    {d?.weather_desc || "No data"}
                  </span>
                </div>
              </div>

              {/* Clickable area to expand */}
              <div
                onClick={() => toggleExpand(district)}
                style={{
                  position: "absolute", inset: 0, cursor: "pointer", zIndex: 1,
                  borderRadius: 12,
                }}
              />

              {/* Expanded detail section */}
              {isExpanded && (
                <div style={{
                  position: "relative", zIndex: 2, marginTop: 12,
                  paddingTop: 12, borderTop: "1px solid var(--glass-border)",
                }}>
                  {(expandedDistrictData?.risk_context || d?.risk_context) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>Elevation</span>
                        <span style={{
                          fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
                          color: ((expandedDistrictData?.risk_context || d?.risk_context)?.elevation_m ?? 999) < 10 ? "var(--risk-high)" :
                                 ((expandedDistrictData?.risk_context || d?.risk_context)?.elevation_m ?? 999) < 50 ? "var(--risk-moderate)" :
                                 "var(--risk-low)",
                        }}>
                          {(expandedDistrictData?.risk_context || d?.risk_context)?.elevation_m ?? "--"}m elevation
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>Floods</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--text-secondary)" }}>
                          {(expandedDistrictData?.risk_context || d?.risk_context)?.historical_floods ?? "--"} historical floods
                        </span>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>Drainage</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                            {(expandedDistrictData?.risk_context || d?.risk_context)?.drainage_index ?? "--"}
                          </span>
                        </div>
                        <div style={{ width: "100%", height: 4, background: "rgba(58,96,128,0.3)", borderRadius: 2 }}>
                          <div style={{
                            height: 4, borderRadius: 2,
                            background: "var(--accent)",
                            width: `${((expandedDistrictData?.risk_context || d?.risk_context)?.drainage_index ?? 0.5) * 100}%`,
                          }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <button
                    className="quick-predict-btn"
                    style={{ marginTop: 12 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent("selectDistrict", {
                        detail: { district, useLiveData: true },
                      }));
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <ArrowRight size={12} strokeWidth={1.75} /> Predict
                    </span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SECTION D — Data Quality Notice */}
      <div style={{
        marginTop: 20, padding: "10px 16px",
        borderTop: "1px solid var(--glass-border)",
      }}>
        <p style={{
          fontFamily: "'Inter',sans-serif", fontSize: 10,
          color: "var(--text-muted)", textAlign: "center",
          lineHeight: 1.5,
        }}>
          DMC data scraped from dmc.gov.lk every 60 minutes.
          Rainfall from OpenWeatherMap API; "(est.)" = monsoon climatology estimate.
          Last updated {toSLTime(lastRefresh)} (Sri Lanka time).
        </p>
      </div>
    </div>
  );
}


