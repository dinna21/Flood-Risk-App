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

  const timelineData = predictions
    .slice()
    .reverse()
    .slice(-20)
    .map((p) => ({
      index: predictions.length,
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
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-spin">{"\u2699\uFE0F"}</div>
          <p className="text-slate-400">Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-300">{"\uD83D\uDCCA"} Model Monitoring Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">Real-time prediction analytics and model performance tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-sm">Live</span>
          </div>
          <span className="text-slate-500 text-xs">Updated: {lastUpdate}</span>
          <button onClick={fetchData} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg">
            {"\u21BB"} Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Predictions", value: predictions.length, color: "text-blue-400", bg: "bg-blue-950", icon: "\uD83C\uDFAF" },
          { label: "Avg Risk Score", value: `${(avgScore * 100).toFixed(1)}%`, color: "text-yellow-400", bg: "bg-yellow-950", icon: "\uD83D\uDCC8" },
          { label: "High Risk Areas", value: riskCounts.High + riskCounts["Very High"], color: "text-red-400", bg: "bg-red-950", icon: "\u26A0\uFE0F" },
          { label: "Safe Areas", value: riskCounts.Low, color: "text-green-400", bg: "bg-green-950", icon: "\u2705" },
        ].map((kpi) => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 border border-slate-700`}>
            <div className="text-2xl mb-1">{kpi.icon}</div>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
            <div className="text-slate-400 text-xs mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-slate-300 font-bold mb-1">Risk Distribution</h3>
          <p className="text-slate-500 text-xs mb-4">Breakdown of all predictions by risk level</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-slate-500">No data yet</div>
          )}
        </div>

        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-slate-300 font-bold mb-1">Risk Level Counts</h3>
          <p className="text-slate-500 text-xs mb-4">Number of predictions per risk category</p>
          <div className="space-y-4 mt-6">
            {[
              { label: "Low", count: riskCounts.Low, color: "bg-green-500", text: "text-green-400" },
              { label: "Moderate", count: riskCounts.Moderate, color: "bg-yellow-500", text: "text-yellow-400" },
              { label: "High", count: riskCounts.High, color: "bg-red-500", text: "text-red-400" },
              { label: "Very High", count: riskCounts["Very High"], color: "bg-red-900", text: "text-red-300" },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className={r.text}>{r.label}</span>
                  <span className="text-slate-400">{r.count} predictions</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div className={`${r.color} h-3 rounded-full transition-all duration-500`}
                    style={{ width: predictions.length > 0 ? `${(r.count / predictions.length) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {timelineData.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-slate-300 font-bold mb-1">Risk Score Timeline</h3>
          <p className="text-slate-500 text-xs mb-4">Last 20 predictions over time</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {districtData.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-slate-300 font-bold mb-1">Average Risk by District</h3>
          <p className="text-slate-500 text-xs mb-4">Compare flood risk levels across districts</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={districtData} margin={{ bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="district" stroke="#94a3b8" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
              <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
              <Bar dataKey="avgScore" radius={[6, 6, 0, 0]}>
                {districtData.map((_entry, index) => (
                  <Cell key={index}
                    fill={
                      districtData[index].avgScore > 60 ? "#ef4444" :
                      districtData[index].avgScore > 40 ? "#f59e0b" :
                      "#22c55e"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {predictions.length === 0 && (
        <div className="bg-slate-800 rounded-xl p-12 text-center">
          <div className="text-5xl mb-4">{"\uD83D\uDCCA"}</div>
          <p className="text-slate-400 text-lg">No predictions yet</p>
          <p className="text-slate-500 text-sm mt-2">Make predictions in the Predict tab to see monitoring data here</p>
        </div>
      )}
    </div>
  );
}
