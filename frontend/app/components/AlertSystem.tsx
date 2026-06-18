"use client";
import { useEffect, useState, useRef, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Alert {
  id: number;
  district: string;
  flood_risk_score: number;
  risk_level: string;
  created_at: string;
}

interface Toast {
  alert: Alert;
  timer: ReturnType<typeof setTimeout> | null;
}

export default function AlertSystem({
  onAlertCount,
  onAlertClick
}: {
  onAlertCount?: (count: number) => void;
  onAlertClick?: (district: string) => void;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const dismissedRef = useRef<Set<number>>(new Set());
  const toastIdRef = useRef(0);
  const errorCountRef = useRef(0);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const allRisk = (data.predictions || []) as Alert[];
      setAlerts(allRisk);
      errorCountRef.current = 0;
      if (onAlertCount) onAlertCount(allRisk.filter((p) => p.flood_risk_score >= 0.5).length);
    } catch (e) {
      errorCountRef.current++;
      if (errorCountRef.current <= 1 || errorCountRef.current % 5 === 0) {
        console.error("Alert fetch failed:", e);
      }
    }
  }, [onAlertCount]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const addToast = useCallback((alert: Alert) => {
    const id = ++toastIdRef.current;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.alert.id !== id || t.timer !== timer));
    }, 6000);
    setToasts((prev) => {
      if (prev.length >= 2) return [...prev.slice(1), { alert: { ...alert, id }, timer }];
      return [...prev, { alert: { ...alert, id }, timer }];
    });
  }, []);

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.alert.id !== id));
  };

  const highRiskCount = alerts.filter((a) => a.flood_risk_score >= 0.5 && !dismissedRef.current.has(a.id)).length;

  const getLevelStyles = (level: string) => {
    switch (level) {
      case "Very High": return { bg: "#3b0505", border: "#ef4444", text: "#fca5a5", dot: "#ef4444" };
      case "High":      return { bg: "#3d1a00", border: "#f97316", text: "#fdba74", dot: "#f97316" };
      case "Moderate":  return { bg: "#3d2e00", border: "#eab308", text: "#fde047", dot: "#eab308" };
      case "Low":       return { bg: "#052e16", border: "#22c55e", text: "#86efac", dot: "#22c55e" };
      default:          return { bg: "#1e293b", border: "#64748b", text: "#94a3b8", dot: "#64748b" };
    }
  };

  return (
    <>
      {/* Toast container - fixed bottom-right, doesn't overlap content */}
      <div style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 9999,
        display: "flex", flexDirection: "column-reverse", gap: 8, maxWidth: 320,
      }}>
        {toasts.map((t) => {
          const s = getLevelStyles(t.alert.risk_level);
          return (
            <div
              key={t.alert.id}
              className="toast-enter"
              onClick={() => {
                dismissToast(t.alert.id);
                if (onAlertClick) onAlertClick(t.alert.district);
              }}
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderRadius: 12,
                padding: "10px 14px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer",
                animation: "toastIn 0.3s ease forwards",
                pointerEvents: "auto",
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: s.dot, flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 600,
                  color: "#fff", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {t.alert.district} — {t.alert.risk_level}
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: s.text }}>
                  {(t.alert.flood_risk_score * 100).toFixed(1)}%
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismissToast(t.alert.id); }}
                style={{
                  background: "none", border: "none", color: s.text,
                  cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px", flexShrink: 0,
                }}
              >
                {"\u00D7"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Notification panel dropdown */}
      {showPanel && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9997 }}
            onClick={() => setShowPanel(false)}
          />
          <div style={{
            position: "fixed", top: 56, right: 16, zIndex: 9998,
            background: "rgba(4,20,36,0.98)", border: "1px solid var(--glass-border)",
            borderRadius: 16, width: 340, maxHeight: "70vh", overflowY: "auto",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)", padding: 16,
          }}>
            <h3 style={{
              fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600,
              color: "var(--text-primary)", marginBottom: 12,
            }}>
              Notification Center
            </h3>
            {alerts.length === 0 ? (
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "var(--text-muted)" }}>
                No predictions yet
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {alerts.slice().reverse().slice(0, 20).map((a) => {
                  const s = getLevelStyles(a.risk_level);
                  return (
                    <div key={a.id} onClick={() => {
                      setShowPanel(false);
                      if (onAlertClick) onAlertClick(a.district);
                    }} style={{
                      background: "var(--glass)", border: "1px solid var(--glass-border)",
                      borderRadius: 10, padding: "8px 12px",
                      display: "flex", alignItems: "center", gap: 10,
                      cursor: "pointer",
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(100,200,255,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--glass)";
                    }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: s.dot, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 500, color: "#fff" }}>
                          {a.district}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: s.text }}>
                            {(a.flood_risk_score * 100).toFixed(1)}%
                          </span>
                          <span style={{
                            fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 500,
                            color: s.dot, textTransform: "uppercase",
                          }}>
                            {a.risk_level}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
