import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout({ children, title }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5f5f5" }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: "250px" }}>
        <Header title={title} />
        <main style={{ padding: "20px" }}>{children}</main>
      </div>
    </div>
  );
}