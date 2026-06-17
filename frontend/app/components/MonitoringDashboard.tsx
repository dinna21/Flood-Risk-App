"use client";
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  Cell, PieChart, Pie, Legend
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Prediction {
  id: number;
  created_at: string;
  district: string;
  flood_risk_score: number;
  risk_level: string;
}

const tooltipStyle = {
  contentStyle: { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: 12 },
};

export default function MonitoringDashboard() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("");

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/history`);
      const data = await res.json();
      setPredictions(data.predictions || []);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const riskCounts = {
    Low: predictions.filter(p => p.flood_risk_score < 0.3).length,
    Moderate: predictions.filter(p => p.flood_risk_score >= 0.3 && p.flood_risk_score < 0.5).length,
    High: predictions.filter(p => p.flood_risk_score >= 0.5 && p.flood_risk_score < 0.7).length,
    "Very High": predictions.filter(p => p.flood_risk_score >= 0.7).length,
  };

  const pieData = [
    { name: "Low", value: riskCounts.Low, color: "#22c55e" },
    { name: "Moderate", value: riskCounts.Moderate, color: "#f59e0b" },
    { name: "High", value: riskCounts.High, color: "#ef4444" },
    { name: "Very High", value: riskCounts["Very High"], color: "#7f1d1d" },
  ].filter(d => d.value > 0);

  const timelineData = predictions.slice().reverse().slice(-20).map((p) => ({
    score: parseFloat((p.flood_risk_score * 100).toFixed(1)),
    time: new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));

  const districtData = Object.entries(
    predictions.reduce((acc, p) => {
      if (!acc[p.district]) acc[p.district] = { total: 0, count: 0 };
      acc[p.district].total += p.flood_risk_score;
      acc[p.district].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>)
  )
    .map(([district, { total, count }]) => ({
      district: district.length > 10 ? district.slice(0, 10) + "..." : district,
      avgScore: parseFloat(((total / count) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 8);

  const avgScore = predictions.length > 0
    ? predictions.reduce((s, p) => s + p.flood_risk_score, 0) / predictions.length
    : 0;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12, animation: "spin 1s linear infinite" }}>{"\u2699\uFE0F"}</div>
          <p style={{ color: "#94a3b8", fontFamily: "'Inter',sans-serif", fontSize: 13 }}>Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ paddingBottom: 8 }}>
      {/* Header */}
      <div style={{
        background: "var(--glass)", border: "1px solid var(--glass-border)", borderRadius: 16,
        padding: "14px 20px", display: "flex", flexWrap: "wrap", justifyContent: "space-between",
        alignItems: "center", gap: 12, backdropFilter: "blur(24px) saturate(180%)",
      }}>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            {"\uD83D\uDCCA"} Model Monitoring Dashboard
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>Real-time prediction analytics</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 6px #22c55e" }} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#22c55e" }}>Live</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)" }}>{lastUpdate}</span>
          <button
            onClick={fetchData}
            style={{
              background: "rgba(58,96,128,0.25)", border: "1px solid var(--glass-border)",
              borderRadius: 8, color: "var(--text-secondary)", fontFamily: "'Inter',sans-serif",
              fontSize: 11, padding: "5px 12px", cursor: "pointer",
            }}
          >
            {"\u21BB"} Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total", value: predictions.length, color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)", icon: "\uD83C\uDFAF" },
          { label: "Avg Risk", value: `${(avgScore * 100).toFixed(1)}%`, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)", icon: "\uD83D\uDCC8" },
          { label: "High Risk", value: riskCounts.High + riskCounts["Very High"], color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", icon: "\u26A0\uFE0F" },
          { label: "Safe", value: riskCounts.Low, color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", icon: "\u2705" },
        ].map((kpi) => (
          <div key={kpi.label} style={{
            background: kpi.bg, border: `1px solid ${kpi.border}`, borderRadius: 14,
            padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6,
          }}>
            <span style={{ fontSize: 18 }}>{kpi.icon}</span>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: kpi.color, letterSpacing: "-0.03em" }}>
              {kpi.value}
            </div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Pie */}
        <div style={{ background: "var(--glass)", border: "1px solid var(--glass-border)", borderRadius: 16, padding: 18, backdropFilter: "blur(24px) saturate(180%)" }}>
          <h3 style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 12 }}>
            Risk Distribution
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'Inter',sans-serif" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontFamily: "'Inter',sans-serif", fontSize: 12 }}>
              No data yet
            </div>
          )}
        </div>

        {/* Risk Level Bars */}
        <div style={{ background: "var(--glass)", border: "1px solid var(--glass-border)", borderRadius: 16, padding: 18, backdropFilter: "blur(24px) saturate(180%)" }}>
          <h3 style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 12 }}>
            Risk Level Counts
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            {[
              { label: "Low", count: riskCounts.Low, color: "#22c55e" },
              { label: "Moderate", count: riskCounts.Moderate, color: "#f59e0b" },
              { label: "High", count: riskCounts.High, color: "#ef4444" },
              { label: "Very High", count: riskCounts["Very High"], color: "#7f1d1d" },
            ].map((r) => (
              <div key={r.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 500, color: r.color }}>{r.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--text-secondary)" }}>{r.count}</span>
                </div>
                <div style={{ width: "100%", height: 6, background: "rgba(58,96,128,0.3)", borderRadius: 3 }}>
                  <div style={{
                    height: 6, borderRadius: 3, background: r.color,
                    width: predictions.length > 0 ? `${(r.count / predictions.length) * 100}%` : "0%",
                    transition: "width 500ms ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {timelineData.length > 0 && (
        <div style={{ background: "var(--glass)", border: "1px solid var(--glass-border)", borderRadius: 16, padding: 18, backdropFilter: "blur(24px) saturate(180%)" }}>
          <h3 style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 12 }}>
            Risk Score Timeline
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,96,128,0.25)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }} />
              <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* District Bar Chart */}
      {districtData.length > 0 && (
        <div style={{ background: "var(--glass)", border: "1px solid var(--glass-border)", borderRadius: 16, padding: 18, backdropFilter: "blur(24px) saturate(180%)" }}>
          <h3 style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 12 }}>
            Average Risk by District
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={districtData} margin={{ bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,96,128,0.25)" />
              <XAxis dataKey="district" stroke="var(--text-muted)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }} angle={-30} textAnchor="end" />
              <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="avgScore" radius={[4, 4, 0, 0]}>
                {districtData.map((_e, i) => (
                  <Cell key={i} fill={districtData[i].avgScore > 60 ? "#ef4444" : districtData[i].avgScore > 40 ? "#f59e0b" : "#22c55e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {predictions.length === 0 && (
        <div style={{ background: "var(--glass)", border: "1px solid var(--glass-border)", borderRadius: 16, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{"\uD83D\uDCCA"}</div>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: "var(--text-secondary)" }}>No predictions yet</p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Make predictions in the Predict tab to see monitoring data
          </p>
        </div>
      )}
    </div>
  );
}
