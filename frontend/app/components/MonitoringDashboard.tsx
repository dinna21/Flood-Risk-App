"use client";
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Prediction {
  id: number;
  created_at: string;
  district: string;
  flood_risk_score: number;
  risk_level: string;
}

const panelStyle: React.CSSProperties = {
  background: "var(--glass)",
  border: "1px solid var(--glass-border)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 0 0 1px var(--glass-border), 0 8px 32px rgba(2,11,24,0.6), inset 0 1px 0 rgba(100,200,255,0.15)",
};

const sectionLabel: React.CSSProperties = {
  fontFamily: "'Inter',sans-serif",
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--text-muted)",
  marginBottom: 10,
};

export default function MonitoringDashboard() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const timelineData = predictions
    .slice()
    .reverse()
    .map((p, i) => ({
      index: i + 1,
      score: parseFloat((p.flood_risk_score * 100).toFixed(1)),
      district: p.district,
      time: new Date(p.created_at).toLocaleTimeString(),
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
      district: district.slice(0, 8),
      avgScore: parseFloat(((total / count) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 8);

  const riskDistribution = [
    { level: "Low",       count: predictions.filter((p) => p.flood_risk_score < 0.3).length,                                              color: "var(--risk-low)" },
    { level: "Moderate",  count: predictions.filter((p) => p.flood_risk_score >= 0.3 && p.flood_risk_score < 0.5).length,                 color: "var(--risk-moderate)" },
    { level: "High",      count: predictions.filter((p) => p.flood_risk_score >= 0.5 && p.flood_risk_score < 0.7).length,                 color: "var(--risk-high)" },
    { level: "Very High", count: predictions.filter((p) => p.flood_risk_score >= 0.7).length,                                             color: "#FF1744" },
  ];

  const tooltipStyle = {
    contentStyle: { backgroundColor: "rgba(4,20,36,0.95)", border: "1px solid var(--glass-border)", borderRadius: 10, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 },
    labelStyle: { color: "var(--text-muted)", fontFamily: "'Inter',sans-serif" },
    itemStyle: { color: "var(--accent)" },
  };

  if (loading) {
    return (
      <div style={panelStyle}>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
          Loading monitoring data...
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ ...panelStyle, padding: "16px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Model Monitoring Dashboard
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--risk-low)", display: "inline-block", animation: "ripplePulse 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--risk-low)" }}>Live</span>
          </div>
        </div>
      </div>

      {/* Risk distribution cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {riskDistribution.map((r) => (
          <div key={r.level} style={{ ...panelStyle, padding: "14px 12px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 28, fontWeight: 700, color: r.color, letterSpacing: "-0.03em" }}>
              {r.count}
            </div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginTop: 4 }}>
              {r.level}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline chart */}
      {timelineData.length > 0 && (
        <div style={panelStyle}>
          <p style={sectionLabel}>Risk Score Timeline</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,96,128,0.3)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fill: "var(--text-muted)" }} />
              <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fill: "var(--text-muted)" }} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={{ fill: "var(--accent)", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "var(--cyan)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* District bar chart */}
      {districtData.length > 0 && (
        <div style={panelStyle}>
          <p style={sectionLabel}>Average Risk by District</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={districtData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,96,128,0.3)" />
              <XAxis dataKey="district" stroke="var(--text-muted)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fill: "var(--text-muted)" }} />
              <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fill: "var(--text-muted)" }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="avgScore" radius={[6, 6, 0, 0]}>
                {districtData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      entry.avgScore > 60 ? "var(--risk-high)" :
                      entry.avgScore > 40 ? "var(--risk-moderate)" :
                      "var(--risk-low)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {predictions.length === 0 && (
        <div style={{ ...panelStyle, textAlign: "center", padding: 40 }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
            No predictions yet. Make some predictions to see monitoring data.
          </p>
        </div>
      )}
    </div>
  );
}
