"use client";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Eye,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  TrendingUp,
} from "./Icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PipelineStatusData {
  model_version: string;
  model_file: string;
  model_size_mb: number;
  training_data: string;
  algorithm: string;
  features_count: number;
  deployment_env: string;
  python_version: string;
  status: string;
  uptime: string;
}

interface DriftData {
  drift_detected: boolean;
  baseline_mean: number;
  recent_mean: number | null;
  baseline_std: number;
  recent_std: number | null;
  sample_size: number;
  status: string;
  recommendation: string;
}

interface PerformanceData {
  total_predictions: number;
  risk_levels: Record<string, number>;
  score_distribution: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  top_districts: { district: string; count: number }[];
  error?: string;
}

interface RetrainResult {
  job_id: string;
  status: string;
  reason: string;
  triggered_at: string;
  estimated_duration: string;
  message: string;
}

const panelS: React.CSSProperties = {
  background: "var(--glass)", border: "1px solid var(--glass-border)",
  borderRadius: 16, padding: 18, backdropFilter: "blur(24px) saturate(180%)",
};

const labelS: React.CSSProperties = {
  fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 500,
  textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)",
};

export default function PipelineStatus() {
  const [pipeline, setPipeline] = useState<PipelineStatusData | null>(null);
  const [drift, setDrift] = useState<DriftData | null>(null);
  const [perf, setPerf] = useState<PerformanceData | null>(null);
  const [retrainReason, setRetrainReason] = useState("Scheduled retraining");
  const [retrainResult, setRetrainResult] = useState<RetrainResult | null>(null);
  const [retrainLoading, setRetrainLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [ps, dr, pr] = await Promise.all([
        fetch(`${API_URL}/pipeline/status`).then(r => r.json()),
        fetch(`${API_URL}/monitoring/drift`).then(r => r.json()),
        fetch(`${API_URL}/monitoring/performance`).then(r => r.json()),
      ]);
      setPipeline(ps);
      setDrift(dr);
      setPerf(pr);
    } catch (e) {
      setError("Failed to load pipeline data");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const triggerRetrain = async () => {
    setRetrainLoading(true);
    try {
      const res = await fetch(`${API_URL}/pipeline/retrain-trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: retrainReason }),
      });
      const data = await res.json();
      setRetrainResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setRetrainLoading(false);
    }
  };

  const [cancelLoading, setCancelLoading] = useState(false);
  const cancelRetrain = async (jobId: string) => {
    setCancelLoading(true);
    try {
      const res = await fetch(`${API_URL}/pipeline/retrain-cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      const data = await res.json();
      setRetrainResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 384 }}>
        <div style={{ textAlign: "center" }}>
          <RefreshCw size={28} strokeWidth={1.75} style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite", color: "var(--accent)" }} />
          <p style={{ color: "#94a3b8" }}>Loading pipeline data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...panelS, textAlign: "center", padding: 40 }}>
        <p style={{ color: "var(--risk-high)", fontFamily: "'Inter',sans-serif", fontSize: 14 }}>{error}</p>
        <button onClick={fetchAll} style={{
          marginTop: 12, background: "var(--glass)", border: "1px solid var(--glass-border)",
          borderRadius: 8, color: "var(--text-secondary)", padding: "6px 16px", cursor: "pointer", fontFamily: "'Inter',sans-serif", fontSize: 12,
        }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }} className="space-y-4">
      {/* Pipeline Health Cards */}
      <div style={panelS}>
        <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, letterSpacing: "-0.02em" }}>
          <Settings2 size={14} strokeWidth={1.75} style={{ color: "var(--text-secondary)", marginRight: 8, verticalAlign: "middle" }} />
          Pipeline Health
        </h3>
        {pipeline && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { label: "Model Version", value: pipeline.model_version },
              { label: "Algorithm", value: pipeline.algorithm },
              { label: "Model File", value: pipeline.model_file },
              { label: "Model Size", value: `${pipeline.model_size_mb} MB` },
              { label: "Features", value: pipeline.features_count.toString() },
              { label: "Training Data", value: pipeline.training_data },
              { label: "Deployment", value: pipeline.deployment_env },
              { label: "Python", value: pipeline.python_version },
              { label: "Status", value: pipeline.status, color: pipeline.status === "healthy" ? "var(--risk-low)" : "var(--risk-high)", primary: true },
              { label: "Uptime", value: pipeline.uptime },
            ].map((item) => (
              <div key={item.label} className={(item as { primary?: boolean }).primary ? "pipeline-card-primary" : undefined} style={{
                background: "var(--glass)", border: "1px solid var(--glass-border)",
                borderLeftColor: (item as { primary?: boolean }).primary ? (item as { color?: string }).color : undefined,
                borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4,
              }}>
                <span style={{ ...labelS, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {(item as { primary?: boolean }).primary && <ShieldCheck size={14} strokeWidth={1.75} style={{ color: (item as { color?: string }).color }} />}
                  {item.label}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 500,
                  color: (item as { color?: string }).color || "var(--text-primary)",
                }}>
                  {(item as { value: string; color?: string }).value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drift Detection */}
      <div style={panelS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            <TrendingUp size={14} strokeWidth={1.75} style={{ color: "var(--text-secondary)", marginRight: 8, verticalAlign: "middle" }} />
            Data Drift Detection
          </h3>
          <button onClick={fetchAll} style={{
            background: "rgba(58,96,128,0.25)", border: "1px solid var(--glass-border)",
            borderRadius: 8, color: "var(--text-secondary)", fontFamily: "'Inter',sans-serif",
            fontSize: 11, padding: "4px 12px", cursor: "pointer",
          }}><RefreshCw size={13} strokeWidth={1.75} style={{ marginRight: 6, verticalAlign: "middle" }} />Refresh</button>
        </div>
        {drift && (
          <div>
              <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
              padding: "12px 16px", borderRadius: 10,
              background: drift.drift_detected ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
              border: `1px solid ${drift.drift_detected ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
              borderLeft: `3px solid ${drift.drift_detected ? "var(--risk-high)" : "var(--risk-low)"}`,
            }}>
              {drift.drift_detected ? <AlertTriangle size={14} strokeWidth={2} style={{ color: "var(--risk-high)" }} /> : <CheckCircle2 size={14} strokeWidth={2} style={{ color: "var(--risk-low)" }} />}
              <span style={{
                fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600,
                color: drift.drift_detected ? "#fca5a5" : "#86efac",
              }}>
                {drift.status === "drift_warning" ? "Drift Detected" : "No Drift Detected"}
              </span>
            </div>
            {drift.sample_size > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={labelS}>Baseline Mean</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--text-secondary)" }}>{drift.baseline_mean}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={labelS}>Recent Mean</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: drift.drift_detected ? "#fca5a5" : "var(--text-secondary)" }}>{drift.recent_mean}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={labelS}>Sample Size</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--text-secondary)" }}>{drift.sample_size}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={labelS}>Baseline Std</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--text-secondary)" }}>{drift.baseline_std}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={labelS}>Recent Std</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--text-secondary)" }}>{drift.recent_std}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={labelS}>Recommendation</span>
                    <span className="recommendation-pill" style={{ color: drift.drift_detected ? "#fca5a5" : "#86efac" }}>
                      {drift.drift_detected ? <AlertTriangle size={11} strokeWidth={2} /> : <Eye size={11} strokeWidth={1.75} />}
                      {drift.recommendation}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      <div style={panelS}>
        <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, letterSpacing: "-0.02em" }}>
          <BarChart3 size={14} strokeWidth={1.75} style={{ color: "var(--text-secondary)", marginRight: 8, verticalAlign: "middle" }} />
          Performance Metrics
        </h3>
        {perf && !perf.error && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <span style={labelS}>Score Distribution</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {[
                  { label: "Min", value: perf.score_distribution.min },
                  { label: "Max", value: perf.score_distribution.max },
                  { label: "Mean", value: perf.score_distribution.mean },
                  { label: "Std Dev", value: perf.score_distribution.std },
                ].map((s) => (
                  <div key={s.label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--text-secondary)" }}>{s.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--text-primary)" }}>{s.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <span style={labelS}>Risk Level Breakdown</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {Object.entries(perf.risk_levels).map(([level, count]) => (
                    <div key={level} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--text-secondary)" }}>{level}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--text-primary)" }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <span style={labelS}>Top 5 Districts</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {perf.top_districts.map((d, i) => (
                  <div key={d.district} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 600,
                        color: "var(--text-muted)", width: 16,
                      }}>{i + 1}</span>
                      <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{d.district}</span>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--accent)" }}>{d.count} predictions</span>
                  </div>
                ))}
                {perf.top_districts.length === 0 && (
                  <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--text-muted)" }}>No data</span>
                )}
              </div>
            </div>
          </div>
        )}
        {perf?.error && (
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{perf.error}</p>
        )}
      </div>

      {/* Retrain Trigger */}
      <div style={panelS}>
        <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, letterSpacing: "-0.02em" }}>
          <RotateCcw size={14} strokeWidth={1.75} style={{ color: "var(--text-secondary)", marginRight: 8, verticalAlign: "middle" }} />
          Retrain Trigger
        </h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 200 }}>
            <span style={labelS}>Retraining Reason</span>
            <select
              value={retrainReason}
              onChange={(e) => setRetrainReason(e.target.value)}
              style={{
                height: 36, background: "var(--glass)", border: "1px solid var(--glass-border)",
                borderRadius: 10, color: "var(--text-primary)", fontFamily: "'Inter',sans-serif",
                fontSize: 13, padding: "0 10px", outline: "none",
              }}
            >
              {["Scheduled retraining", "Data drift detected", "Performance degradation", "New data available"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <button
            onClick={triggerRetrain}
            disabled={retrainLoading}
            style={{
              height: 36, padding: "0 20px",
              background: retrainLoading ? "rgba(239,68,68,0.3)" : "linear-gradient(135deg, #38B6FF 0%, #00E5FF 100%)",
              border: "none", borderRadius: 8, color: "#020B18",
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              opacity: retrainLoading ? 0.7 : 1,
            }}
          >
            <RotateCcw size={14} strokeWidth={1.75} style={retrainLoading ? { animation: "spin 0.9s linear infinite" } : undefined} />
            {retrainLoading ? "Triggering..." : "Trigger Retraining"}
          </button>
        </div>
        {retrainResult && (
          <div style={{
            marginTop: 16, padding: 14, borderRadius: 12,
            background: retrainResult.status === "cancelled" ? "rgba(148,163,184,0.1)" : "rgba(34,197,94,0.1)",
            border: retrainResult.status === "cancelled" ? "1px solid rgba(148,163,184,0.25)" : "1px solid rgba(34,197,94,0.25)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <span style={{ ...labelS, color: retrainResult.status === "cancelled" ? "#94a3b8" : "#86efac" }}>Job ID</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: retrainResult.status === "cancelled" ? "#94a3b8" : "#86efac" }}>{retrainResult.job_id}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <span style={labelS}>Status</span>
                  <span style={{
                    fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700,
                    color: retrainResult.status === "cancelled" ? "#94a3b8" : "#86efac",
                    textTransform: "uppercase"
                  }}>{retrainResult.status}</span>
                </div>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{retrainResult.message}</p>
              </div>
              {retrainResult.status === "triggered" && (
                <button
                  onClick={() => cancelRetrain(retrainResult.job_id)}
                  disabled={cancelLoading}
                  style={{
                    height: 30, padding: "0 14px",
                    background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 8, color: "#fca5a5",
                    fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 500,
                    cursor: cancelLoading ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap", flexShrink: 0,
                    opacity: cancelLoading ? 0.5 : 1,
                  }}
                >
                  {cancelLoading ? "..." : "Cancel"}
                </button>
              )}
            </div>
          </div>
        )}
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
          <AlertTriangle size={12} strokeWidth={1.75} style={{ marginRight: 6, verticalAlign: "middle", color: "var(--risk-moderate)" }} />
          This will queue a retraining job (15-20 mins)
        </p>
      </div>
    </div>
  );
}
