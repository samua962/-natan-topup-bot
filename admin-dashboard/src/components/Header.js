import React from "react";

export default function Header({ title }) {
  return (
    <header style={{
      background: "white",
      padding: "15px 20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
      <h1 style={{ margin: 0, fontSize: "24px", color: "#333" }}>{title}</h1>
      
      <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
        <span>👋 Admin</span>
        <button style={{
          background: "#ef4444",
          color: "white",
          border: "none",
          padding: "8px 15px",
          borderRadius: "5px",
          cursor: "pointer"
        }}>
          Logout
        </button>
      </div>
    </header>
  );
}