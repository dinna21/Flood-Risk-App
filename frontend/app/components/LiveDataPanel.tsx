"use client";
import { useEffect, useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DistrictLiveData {
  flood_warning: boolean;
  rainfall_7d_mm: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  weather_desc: string | null;
  weather_main: string | null;
  last_updated: string | null;
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

function SkeletonCard() {
  return <div className="skeleton-card" />;
}

export default function LiveDataPanel() {
  const [liveData, setLiveData] = useState<LiveDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{
          background: "var(--glass)", border: "1px solid var(--glass-border)",
          borderRadius: 16, padding: "18px 20px", marginBottom: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              {"🛰"} Live Data
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="loading-ring" style={{ width: 20, height: 20, borderWidth: 2 }} />
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--text-muted)" }}>Loading...</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {Array.from({ length: 24 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error && !liveData) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{"🛰"}</div>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
          {error}
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
    );
  }

  const districts = liveData?.districts || {};
  const totalWarnings = liveData?.total_warnings || 0;
  const sourcesStatus = liveData?.sources_status || { dmc: "unavailable", owm: "unavailable" };
  const cacheAge = liveData?.cache_age_seconds ?? -1;
  const cacheAgeText = cacheAge >= 0
    ? `${Math.floor(cacheAge / 60)}m ${Math.floor(cacheAge % 60)}s ago`
    : "Never";

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      {/* SECTION A — Status Bar */}
      <div style={{
        background: "var(--glass)", border: "1px solid var(--glass-border)",
        borderRadius: 16, padding: "14px 20px", marginBottom: 16,
        backdropFilter: "blur(24px) saturate(180%)",
        display: "flex", flexWrap: "wrap", justifyContent: "space-between",
        alignItems: "center", gap: 12,
      }}>
        <div>
          <h2 style={{
            fontFamily: "'Space Grotesk',sans-serif", fontSize: 16,
            fontWeight: 600, color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}>
            {"🛰"} Live Data
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="source-pill">
            <SourceDot status={sourcesStatus.dmc} />
            DMC Warnings
          </span>
          <span className="source-pill">
            <SourceDot status={sourcesStatus.owm} />
            OpenWeatherMap
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
            color: "var(--text-muted)",
          }}>
            Updated {cacheAgeText}
          </span>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            style={{
              background: "rgba(58,96,128,0.25)", border: "1px solid var(--glass-border)",
              borderRadius: 8, color: "var(--text-secondary)",
              fontFamily: "'Inter',sans-serif", fontSize: 11,
              padding: "4px 12px", cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            {refreshing ? "..." : "\u21BB Refresh"}
          </button>
        </div>
      </div>

      {/* SECTION B — Warning Banner */}
      {totalWarnings > 0 && (
        <div style={{
          background: "rgba(255,61,0,0.12)", border: "1px solid rgba(255,61,0,0.35)",
          borderRadius: 14, padding: "14px 20px", marginBottom: 16,
          backdropFilter: "blur(24px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="warning-pulse" style={{ fontSize: 18 }}>{"⚠"}</span>
            <span style={{
              fontFamily: "'Space Grotesk',sans-serif", fontSize: 14,
              fontWeight: 600, color: "#fc8181",
            }}>
              {totalWarnings} Active Flood Warning{totalWarnings > 1 ? "s" : ""} Detected by DMC
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {DISTRICT_ORDER.filter(d => districts[d]?.flood_warning).map(d => (
              <span key={d} style={{
                background: "rgba(255,61,0,0.2)", border: "1px solid rgba(255,61,0,0.4)",
                borderRadius: 20, padding: "2px 10px",
                fontFamily: "'Inter',sans-serif", fontSize: 11,
                fontWeight: 500, color: "#fc8181",
              }}>
                {"⚠"} {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SECTION C — District Grid */}
      <div className="live-grid">
        {DISTRICT_ORDER.map(district => {
          const d = districts[district];
          const hasWarning = d?.flood_warning === true;
          const cardClass = `live-card${hasWarning ? " warning-active" : ""}`;

          return (
            <div key={district} className={cardClass}>
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
                    {"⚠"} ACTIVE WARNING
                  </span>
                ) : (
                  <span style={{
                    background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
                    borderRadius: 20, padding: "1px 8px",
                    fontFamily: "'Inter',sans-serif", fontSize: 10,
                    fontWeight: 500, color: "#86efac",
                    whiteSpace: "nowrap",
                  }}>
                    {"✓"} Clear
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{
                    fontFamily: "'Inter',sans-serif", fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    color: "var(--text-muted)",
                  }}>
                    Rainfall
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                    fontWeight: 500, color: getRainfallColor(d?.rainfall_7d_mm ?? null),
                  }}>
                    {d?.rainfall_7d_mm !== null ? `${d?.rainfall_7d_mm} mm` : "--"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{
                    fontFamily: "'Inter',sans-serif", fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    color: "var(--text-muted)",
                  }}>
                    Temp
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                    color: "var(--text-secondary)",
                  }}>
                    {d?.temperature_c !== null ? `${d?.temperature_c}°C` : "--"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{
                    fontFamily: "'Inter',sans-serif", fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    color: "var(--text-muted)",
                  }}>
                    Humidity
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                    color: "var(--text-secondary)",
                  }}>
                    {d?.humidity_pct !== null ? `${d?.humidity_pct}%` : "--"}
                  </span>
                </div>

                <div style={{ marginTop: 4 }}>
                  <span style={{
                    fontFamily: "'Inter',sans-serif", fontSize: 10,
                    fontStyle: "italic", color: "var(--text-muted)",
                  }}>
                    {d?.weather_desc || "No data"}
                  </span>
                </div>
              </div>
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
          Rainfall from OpenWeatherMap API.
          If sources are unavailable, predictions use form defaults.
        </p>
      </div>
    </div>
  );
}
