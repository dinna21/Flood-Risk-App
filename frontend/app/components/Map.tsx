"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MapPrediction {
  lat: number;
  lng: number;
  district: string;
  score: number;
  level: string;
  color: string;
}

interface DistrictInfo {
  coords: [number, number];
  elevation: number;
  rainfall: number;
  floodCount: number;
  riverDist: number;
  drainage: number;
  floodEvent: string;
  waterPresence: string;
}

const DISTRICTS: Record<string, DistrictInfo> = {
  Colombo:      { coords:[6.9271,79.8612], elevation:10,  rainfall:150, floodCount:3,  riverDist:200, drainage:0.4,  floodEvent:"No",  waterPresence:"Medium" },
  Gampaha:      { coords:[7.0917,80.0000], elevation:15,  rainfall:160, floodCount:3,  riverDist:250, drainage:0.4,  floodEvent:"No",  waterPresence:"Medium" },
  Kandy:        { coords:[7.2906,80.6337], elevation:500, rainfall:180, floodCount:2,  riverDist:400, drainage:0.5,  floodEvent:"No",  waterPresence:"Low" },
  Galle:        { coords:[6.0535,80.2210], elevation:5,   rainfall:220, floodCount:5,  riverDist:100, drainage:0.3,  floodEvent:"Yes", waterPresence:"High" },
  Matara:       { coords:[5.9549,80.5550], elevation:5,   rainfall:200, floodCount:4,  riverDist:150, drainage:0.3,  floodEvent:"Yes", waterPresence:"High" },
  Hambantota:   { coords:[6.1429,81.1212], elevation:10,  rainfall:90,  floodCount:2,  riverDist:500, drainage:0.5,  floodEvent:"No",  waterPresence:"Low" },
  Kurunegala:   { coords:[7.4863,80.3647], elevation:100, rainfall:130, floodCount:2,  riverDist:600, drainage:0.5,  floodEvent:"No",  waterPresence:"Medium" },
  Ratnapura:    { coords:[6.6828,80.3992], elevation:3,   rainfall:320, floodCount:10, riverDist:50,  drainage:0.1,  floodEvent:"Yes", waterPresence:"High" },
  Kalutara:     { coords:[6.5854,79.9607], elevation:5,   rainfall:260, floodCount:6,  riverDist:80,  drainage:0.2,  floodEvent:"Yes", waterPresence:"High" },
  Badulla:      { coords:[6.9934,81.0550], elevation:680, rainfall:160, floodCount:2,  riverDist:400, drainage:0.5,  floodEvent:"No",  waterPresence:"Low" },
  Monaragala:   { coords:[6.8728,81.3507], elevation:150, rainfall:110, floodCount:2,  riverDist:700, drainage:0.5,  floodEvent:"No",  waterPresence:"Medium" },
  Polonnaruwa:  { coords:[7.9403,81.0188], elevation:50,  rainfall:90,  floodCount:3,  riverDist:300, drainage:0.4,  floodEvent:"No",  waterPresence:"Medium" },
  Anuradhapura: { coords:[8.3114,80.4037], elevation:100, rainfall:70,  floodCount:1,  riverDist:1000,drainage:0.6,  floodEvent:"No",  waterPresence:"Low" },
  Trincomalee:  { coords:[8.5874,81.2152], elevation:10,  rainfall:110, floodCount:3,  riverDist:400, drainage:0.4,  floodEvent:"No",  waterPresence:"Medium" },
  Batticaloa:   { coords:[7.7170,81.7000], elevation:3,   rainfall:140, floodCount:5,  riverDist:80,  drainage:0.3,  floodEvent:"Yes", waterPresence:"High" },
  Ampara:       { coords:[7.2833,81.6667], elevation:30,  rainfall:110, floodCount:3,  riverDist:300, drainage:0.4,  floodEvent:"No",  waterPresence:"Medium" },
  Jaffna:       { coords:[9.6615,80.0255], elevation:5,   rainfall:50,  floodCount:1,  riverDist:1500,drainage:0.5,  floodEvent:"No",  waterPresence:"Low" },
  Kilinochchi:  { coords:[9.3833,80.4000], elevation:15,  rainfall:55,  floodCount:1,  riverDist:1200,drainage:0.5,  floodEvent:"No",  waterPresence:"Low" },
  Mannar:       { coords:[8.9833,79.9000], elevation:5,   rainfall:55,  floodCount:1,  riverDist:1000,drainage:0.5,  floodEvent:"No",  waterPresence:"Low" },
  Vavuniya:     { coords:[8.7500,80.5000], elevation:80,  rainfall:75,  floodCount:1,  riverDist:800, drainage:0.6,  floodEvent:"No",  waterPresence:"Low" },
  Nuwara_Eliya: { coords:[6.9497,80.7891], elevation:1800,rainfall:60,  floodCount:0,  riverDist:3000,drainage:0.8,  floodEvent:"No",  waterPresence:"Low" },
  Kegalle:      { coords:[7.2513,80.3464], elevation:180, rainfall:210, floodCount:3,  riverDist:250, drainage:0.4,  floodEvent:"No",  waterPresence:"Medium" },
  Matale:       { coords:[7.4675,80.6234], elevation:350, rainfall:140, floodCount:2,  riverDist:400, drainage:0.5,  floodEvent:"No",  waterPresence:"Low" },
  Puttalam:     { coords:[8.0362,79.8283], elevation:10,  rainfall:65,  floodCount:1,  riverDist:800, drainage:0.5,  floodEvent:"No",  waterPresence:"Low" },
};

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function getDistrict(lat: number, lng: number): { name: string; info: DistrictInfo } {
  let closest = "Colombo";
  let minDist = Infinity;
  for (const [name, info] of Object.entries(DISTRICTS)) {
    const [dlat, dlng] = info.coords;
    const dist = Math.sqrt(Math.pow(lat - dlat, 2) + Math.pow(lng - dlng, 2));
    if (dist < minDist) {
      minDist = dist;
      closest = name;
    }
  }
  return { name: closest.replace("_", " "), info: DISTRICTS[closest] };
}

export default function FloodRiskMap() {
  const [predictions, setPredictions] = useState<MapPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [outOfBoundsMsg, setOutOfBoundsMsg] = useState("");

  const SL_LAT_MIN = 5.7;
  const SL_LAT_MAX = 9.9;
  const SL_LNG_MIN = 79.5;
  const SL_LNG_MAX = 81.9;

  const isWithinSL = (lat: number, lng: number) =>
    lat >= SL_LAT_MIN && lat <= SL_LAT_MAX && lng >= SL_LNG_MIN && lng <= SL_LNG_MAX;

  const predictForLocation = async (lat: number, lng: number) => {
    if (!isWithinSL(lat, lng)) {
      setOutOfBoundsMsg("Please click within Sri Lanka");
      setTimeout(() => setOutOfBoundsMsg(""), 3000);
      return;
    }
    setOutOfBoundsMsg("");
    setLoading(true);
    const { name: district, info } = getDistrict(lat, lng);
    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          district,
          latitude: lat,
          longitude: lng,
          elevation_m: info.elevation,
          rainfall_7d_mm: info.rainfall,
          monthly_rainfall_mm: info.rainfall * 2.5,
          distance_to_river_m: info.riverDist,
          historical_flood_count: info.floodCount,
          drainage_index: info.drainage,
          flood_occurrence_current_event: info.floodEvent,
          water_presence_flag: info.waterPresence,
        }),
      });
      const data = await res.json();
      setPredictions((prev) => [
        ...prev,
        { lat, lng, district, score: data.flood_risk_score, level: data.risk_level, color: data.risk_color },
      ]);
    } catch (e) {
      console.error("Map prediction failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadAllDistricts = async () => {
    setLoadingAll(true);
    setPredictions([]);
    for (const [name, info] of Object.entries(DISTRICTS)) {
      try {
        const district = name.replace("_", " ");
        const [lat, lng] = info.coords;
        const res = await fetch(`${API_URL}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            district,
            latitude: lat,
            longitude: lng,
            elevation_m: info.elevation,
            rainfall_7d_mm: info.rainfall,
            monthly_rainfall_mm: info.rainfall * 2.5,
            distance_to_river_m: info.riverDist,
            historical_flood_count: info.floodCount,
            drainage_index: info.drainage,
            flood_occurrence_current_event: info.floodEvent,
            water_presence_flag: info.waterPresence,
          }),
        });
        const data = await res.json();
        setPredictions((prev) => [
          ...prev,
          { lat, lng, district, score: data.flood_risk_score, level: data.risk_level, color: data.risk_color },
        ]);
        await new Promise((r) => setTimeout(r, 200));
      } catch (e) {
        console.error(e);
      }
    }
    setLoadingAll(false);
  };

  return (
    <div style={{ background: "var(--glass)", border: "1px solid var(--glass-border)", borderRadius: 20, padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Sri Lanka Flood Risk Map
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={loadAllDistricts}
            disabled={loadingAll}
            style={{
              background: "linear-gradient(135deg,#1A7FCC 0%,#38B6FF 100%)",
              border: "none", borderRadius: 10, color: "#fff",
              fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 12,
              letterSpacing: "0.08em", textTransform: "uppercase",
              padding: "8px 16px", cursor: loadingAll ? "not-allowed" : "pointer",
              opacity: loadingAll ? 0.6 : 1,
            }}
          >
            {loadingAll ? "Loading..." : "Load All Districts"}
          </button>
          <button
            onClick={() => setPredictions([])}
            style={{
              background: "rgba(58,96,128,0.35)", border: "1px solid var(--glass-border)",
              borderRadius: 10, color: "var(--text-secondary)",
              fontFamily: "'Inter',sans-serif", fontSize: 12,
              padding: "8px 14px", cursor: "pointer",
            }}
          >
            Clear Map
          </button>
        </div>
      </div>

      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
        Click anywhere on the map to predict flood risk for that location. Or load all districts at once.
        {loading && " Predicting..."}
      </p>

      {/* Map */}
      <div style={{ height: 450, borderRadius: 14, overflow: "hidden", border: "1px solid var(--glass-border)" }}>
        <MapContainer
          center={[7.8731, 80.7718]}
          zoom={8}
          maxBounds={[[5.7, 79.5], [9.9, 81.9]]}
          maxBoundsViscosity={1.0}
          minZoom={7}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <ClickHandler onMapClick={predictForLocation} />
          {predictions.map((p, i) => (
            <CircleMarker
              key={i}
              center={[p.lat, p.lng]}
              radius={16}
              fillColor={p.color}
              color={p.color}
              weight={2}
              opacity={0.9}
              fillOpacity={0.7}
            >
              <Popup>
                <div style={{ minWidth: 150, fontFamily: "'Inter',sans-serif", fontSize: 13 }}>
                  <strong>{p.district}</strong><br />
                  Risk Score: {(p.score * 100).toFixed(1)}%<br />
                  Level: {p.level}<br />
                  Lat: {p.lat.toFixed(4)}<br />
                  Lng: {p.lng.toFixed(4)}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {outOfBoundsMsg && (
        <div style={{
          background: "rgba(255,77,77,0.15)", border: "1px solid rgba(255,77,77,0.3)",
          borderRadius: 10, padding: "10px 16px", marginTop: 10,
          color: "#FF6B6B", fontFamily: "'Inter',sans-serif", fontSize: 13,
          textAlign: "center",
        }}>
          {outOfBoundsMsg}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
        {[
          { label: "Low Risk",  color: "#00E676" },
          { label: "Moderate",  color: "#FFB300" },
          { label: "High",      color: "#FF3D00" },
          { label: "Very High", color: "#7f1d1d" },
        ].map(({ label, color }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--text-secondary)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
