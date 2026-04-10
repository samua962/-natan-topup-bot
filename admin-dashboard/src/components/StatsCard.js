import React from "react";

export default function StatsCard({ title, value, icon, color, trend }) {
  return (
    <div style={{
      background: "white",
      borderRadius: "10px",
      padding: "20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      borderLeft: `4px solid ${color}`,
      transition: "transform 0.3s",
      cursor: "pointer"
    }}
    onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-5px)"}
    onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: "0 0 10px", color: "#666", fontSize: "14px" }}>{title}</h3>
          <div style={{ fontSize: "32px", fontWeight: "bold", color: "#333" }}>{value}</div>
          {trend && <div style={{ fontSize: "12px", color: trend > 0 ? "#10b981" : "#ef4444", marginTop: "10px" }}>
            {trend > 0 ? `↑ ${trend}%` : `↓ ${Math.abs(trend)}%`} from last month
          </div>}
        </div>
        <div style={{ fontSize: "48px", opacity: 0.5 }}>{icon}</div>
      </div>
    </div>
  );
}