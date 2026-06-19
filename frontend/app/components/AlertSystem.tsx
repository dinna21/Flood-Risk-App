"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Alert {
  id: number;
  district: string;
  flood_risk_score: number;
  risk_level: string;
  created_at: string;
}

interface ToastItem {
  id: number;
  alert: Alert;
  timer: ReturnType<typeof setTimeout> | null;
}

const SEVERITY = {
  "Very High": { accent: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", text: "#fca5a5", badge: "rgba(239,68,68,0.2)", icon: "AlertTriangle" },
  "High":      { accent: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)", text: "#fdba74", badge: "rgba(249,115,22,0.2)", icon: "AlertTriangle" },
  "Moderate":  { accent: "#eab308", bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.35)", text: "#fde047", badge: "rgba(234,179,8,0.2)", icon: "Info" },
  "Low":       { accent: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)", text: "#93c5fd", badge: "rgba(59,130,246,0.2)", icon: "Info" },
};

function severityStyle(level: string) {
  return SEVERITY[level as keyof typeof SEVERITY] || SEVERITY["Low"];
}

function slTime(ts: string) {
  const t = ts.includes("Z") || ts.includes("+") ? ts : ts + "Z";
  return new Date(t).toLocaleTimeString("en-US", {
    timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export default function AlertSystem({
  onAlertCount,
  onAlertClick
}: {
  onAlertCount?: (count: number) => void;
  onAlertClick?: (district: string) => void;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [unreadIds, setUnreadIds] = useState<Set<number>>(new Set());
  const dismissedRef = useRef<Set<number>>(new Set());
  const toastIdRef = useRef(0);
  const pauseTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const highRiskCount = alerts.filter(
    (a) => a.flood_risk_score >= 0.5 && !dismissedRef.current.has(a.id)
  ).length;

  const addToast = useCallback((alert: Alert) => {
    const id = ++toastIdRef.current;
    const timer = setTimeout(() => removeToast(id), 5500);
    pauseTimers.current.set(id, timer);
    setToasts((prev) => {
      const next = [...prev, { id, alert, timer }];
      return next.length > 3 ? next.slice(-3) : next;
    });
    setUnreadIds((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
    return id;
  }, []);

  const removeToast = useCallback((id: number) => {
    const t = pauseTimers.current.get(id);
    if (t) clearTimeout(t);
    pauseTimers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const dismissToast = (id: number) => {
    setUnreadIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setTimeout(() => removeToast(id), 200);
  };

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const all = (data.predictions || []) as Alert[];
      setAlerts(all);
      if (onAlertCount) onAlertCount(all.filter((p) => p.flood_risk_score >= 0.5).length);
    } catch { /* silent */ }
  }, [onAlertCount]);

  useEffect(() => {
    fetchAlerts();
    const i = setInterval(fetchAlerts, 15000);
    return () => clearInterval(i);
  }, [fetchAlerts]);

  const markAllRead = () => {
    setUnreadIds(new Set());
  };

  return (
    <>
      {/* ── Toast Container ── */}
      <div style={{
        position: "fixed", top: 64, right: 16, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8, maxWidth: 360, width: "100%",
        pointerEvents: "none",
      }}>
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => {
            const s = severityStyle(t.alert.risk_level);
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 80, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                layout
                style={{ pointerEvents: "auto" }}
                onMouseEnter={() => {
                  const timer = pauseTimers.current.get(t.id);
                  if (timer) clearTimeout(timer);
                }}
                onMouseLeave={() => {
                  const timer = setTimeout(() => removeToast(t.id), 4000);
                  pauseTimers.current.set(t.id, timer);
                }}
              >
                <div
                  onClick={() => {
                    dismissToast(t.id);
                    if (onAlertClick) onAlertClick(t.alert.district);
                  }}
                  style={{
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    cursor: "pointer",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                    display: "flex", alignItems: "flex-start", gap: 12,
                    transition: "background 0.15s ease",
                  }}
                >
                  {/* Severity dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", background: s.accent,
                    marginTop: 4, flexShrink: 0,
                    boxShadow: `0 0 8px ${s.accent}`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 600,
                      textTransform: "uppercase", letterSpacing: "0.08em",
                      color: s.text, marginBottom: 4,
                    }}>
                      {t.alert.risk_level === "Very High" || t.alert.risk_level === "High"
                        ? "Flood Risk Alert"
                        : t.alert.risk_level === "Moderate"
                        ? "Moderate Risk Detected"
                        : "Low Risk Location"}
                    </div>
                    <div style={{
                      fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600,
                      color: "#fff", marginBottom: 3, whiteSpace: "nowrap",
                      overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {t.alert.district}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600,
                        color: s.accent,
                      }}>
                        {(t.alert.flood_risk_score * 100).toFixed(1)}%
                      </span>
                      <span style={{
                        fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 500,
                        color: s.text, padding: "2px 8px", borderRadius: 20,
                        background: s.badge, textTransform: "uppercase", letterSpacing: "0.04em",
                      }}>
                        {t.alert.risk_level}
                      </span>
                      <span style={{
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                        color: "var(--text-muted)", marginLeft: "auto",
                      }}>
                        {slTime(t.alert.created_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismissToast(t.id); }}
                    style={{
                      background: "none", border: "none",
                      color: "var(--text-muted)", cursor: "pointer",
                      fontSize: 18, lineHeight: 1, padding: "0 2px",
                      flexShrink: 0, marginTop: -2,
                    }}
                  >
                    {"\u00D7"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Notification Center Dropdown ── */}
      <AnimatePresence>
        {showPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ position: "fixed", inset: 0, zIndex: 9997 }}
              onClick={() => setShowPanel(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{
                position: "fixed", top: 56, right: 16, zIndex: 9998,
                background: "rgba(4,20,36,0.98)", border: "1px solid var(--glass-border)",
                borderRadius: 16, width: 360, maxHeight: "65vh", overflowY: "auto",
                boxShadow: "0 12px 48px rgba(0,0,0,0.6)", padding: 0,
                backdropFilter: "blur(24px)",
              }}
            >
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 16px 10px", position: "sticky", top: 0,
                background: "rgba(4,20,36,0.98)", zIndex: 1,
                borderBottom: "1px solid rgba(100,200,255,0.08)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                    Notifications
                  </h3>
                  {unreadIds.size > 0 && (
                    <span style={{
                      background: "rgba(59,130,246,0.2)", color: "#93c5fd",
                      borderRadius: 20, padding: "1px 8px",
                      fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600,
                    }}>
                      {unreadIds.size} new
                    </span>
                  )}
                </div>
                {unreadIds.size > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: "none", border: "none", color: "var(--text-muted)",
                      fontFamily: "'Inter',sans-serif", fontSize: 11, cursor: "pointer",
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {alerts.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center" }}>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "var(--text-muted)" }}>
                    No notifications yet
                  </p>
                </div>
              ) : (
                <div style={{ padding: "6px 8px" }}>
                  {alerts.slice().reverse().slice(0, 10).map((a, i) => {
                    const s = severityStyle(a.risk_level);
                    return (
                      <div
                        key={a.id}
                        onClick={() => {
                          setShowPanel(false);
                          markAllRead();
                          if (onAlertClick) onAlertClick(a.district);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                          transition: "background 0.12s ease",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(100,200,255,0.06)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%", background: s.accent,
                          flexShrink: 0, boxShadow: `0 0 6px ${s.accent}`,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 500, color: "#fff" }}>
                            {a.district}
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 2, alignItems: "center" }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: s.accent, fontWeight: 500 }}>
                              {(a.flood_risk_score * 100).toFixed(1)}%
                            </span>
                            <span style={{
                              fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 500,
                              color: s.text, textTransform: "uppercase",
                            }}>
                              {a.risk_level}
                            </span>
                          </div>
                        </div>
                        <span style={{
                          fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                          color: "var(--text-muted)", flexShrink: 0,
                        }}>
                          {slTime(a.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
