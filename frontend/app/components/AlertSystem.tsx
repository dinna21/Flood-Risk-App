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
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/history`);
      const data = await res.json();
      const highRisk = (data.predictions || []).filter(
        (p: Alert) => p.flood_risk_score >= 0.5
      );
      setAlerts(highRisk);
    } catch (e) {
      console.error(e);
    }
  };

  const visibleAlerts = alerts.filter(
    (a) => !dismissed.includes(a.id)
  );

  if (visibleAlerts.length === 0 || !visible) return null;

  const getAlertColor = (score: number) => {
    if (score >= 0.7) return {
      bg: "bg-red-950",
      border: "border-red-500",
      badge: "bg-red-500",
      text: "text-red-300",
      icon: "\uD83D\uDD34"
    };
    return {
      bg: "bg-orange-950",
      border: "border-orange-500",
      badge: "bg-orange-500",
      text: "text-orange-300",
      icon: "\uD83D\uDFE0"
    };
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full">
      <div className="flex justify-end">
        <button
          onClick={() => setVisible(false)}
          className="text-xs text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded-lg"
        >
          Hide Alerts
        </button>
      </div>

      {visibleAlerts.slice(0, 3).map((alert) => {
        const colors = getAlertColor(alert.flood_risk_score);
        return (
          <div key={alert.id}
            className={`${colors.bg} ${colors.border} border rounded-xl p-3 shadow-2xl backdrop-blur-sm`}
          >
            <div className="flex justify-between items-start gap-2">
              <div className="flex gap-2 items-start">
                <span className="text-lg mt-0.5">
                  {colors.icon}
                </span>
                <div>
                  <div className={`text-xs font-bold uppercase tracking-wider ${colors.text} mb-0.5`}>
                    {"\u26A0\uFE0F"} Flood Risk Alert
                  </div>
                  <div className="text-white font-bold text-sm">
                    {alert.district}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs text-white px-2 py-0.5 rounded-full ${colors.badge}`}>
                      {alert.risk_level}
                    </span>
                    <span className={`text-xs ${colors.text}`}>
                      {(alert.flood_risk_score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDismissed(
                  prev => [...prev, alert.id]
                )}
                className="text-slate-400 hover:text-white text-xl leading-none shrink-0"
              >
                {"\u00D7"}
              </button>
            </div>
          </div>
        );
      })}

      {visibleAlerts.length > 3 && (
        <div className="text-center text-xs text-slate-400 bg-slate-800 rounded-lg py-1">
          +{visibleAlerts.length - 3} more alerts
        </div>
      )}
    </div>
  );
}
