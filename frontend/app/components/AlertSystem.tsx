"use client";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Alert {
  id: number;
  district: string;
  flood_risk_score: number;
  risk_level: string;
  created_at: string;
}

export default function AlertSystem() {
  const [alerts, setAlerts]       = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const res  = await fetch(`${API_URL}/history`);
      const data = await res.json();
      const highRisk = (data.predictions || []).filter(
        (p: Alert) => p.flood_risk_score >= 0.5
      );
      setAlerts(highRisk);
    } catch (e) {
      console.error(e);
    }
  };

  const visibleAlerts = alerts.filter((a) => !dismissed.includes(a.id));
  if (visibleAlerts.length === 0) return null;

  return (
    <div style={{
      position: "fixed", top: 16, right: 16,
      zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 340,
    }}>
      {visibleAlerts.slice(0, 3).map((alert) => (
        <div
          key={alert.id}
          style={{
            background: "rgba(30, 5, 5, 0.88)",
            border: "1px solid var(--risk-high)",
            borderRadius: 16,
            padding: "14px 16px",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow: "0 0 0 1px rgba(255,61,0,0.25), 0 8px 32px rgba(2,11,24,0.7)",
            display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
            animation: "slideInTop 300ms ease forwards",
          }}
        >
          <div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--risk-high)", marginBottom: 4 }}>
              High Risk Alert
            </div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>
              {alert.district}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--risk-high)" }}>
              {(alert.flood_risk_score * 100).toFixed(1)}% — {alert.risk_level}
            </div>
          </div>
          <button
            onClick={() => setDismissed((prev) => [...prev, alert.id])}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 2px",
              flexShrink: 0,
            }}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
