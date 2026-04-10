import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../api/api";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await API.get("/users");
      setUsers(res.data);
    } catch (error) {
      console.error("Load users error:", error);
    }
    setLoading(false);
  }

  if (loading) return <Layout title="Users"><LoadingSpinner /></Layout>;

  return (
    <Layout title="Users">
      <div style={{
        background: "white",
        borderRadius: "10px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #e9ecef" }}>
          <h3>Total Users: {users.length}</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8f9fa" }}>
                <th style={{ padding: "15px", textAlign: "left" }}>ID</th>
                <th style={{ padding: "15px", textAlign: "left" }}>Telegram ID</th>
                <th style={{ padding: "15px", textAlign: "left" }}>Username</th>
                <th style={{ padding: "15px", textAlign: "left" }}>Joined Date</th>
                <th style={{ padding: "15px", textAlign: "left" }}>Orders</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid #e9ecef" }}>
                  <td style={{ padding: "12px" }}>#{u.id}</td>
                  <td style={{ padding: "12px" }}>{u.telegram_id}</td>
                  <td style={{ padding: "12px" }}>{u.username || "-"}</td>
                  <td style={{ padding: "12px" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: "12px" }}>-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}