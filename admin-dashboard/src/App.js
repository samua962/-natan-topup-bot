import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import API from "./api/api";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Categories from "./pages/Categories";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";

function ProtectedRoute({ children, isAuthenticated }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppContent({ isAuthenticated, setIsAuthenticated, sidebarOpen, setSidebarOpen }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar setSidebarOpen={setSidebarOpen} onLogout={() => {
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminUser");
          delete API.defaults.headers.common["Authorization"];
          setIsAuthenticated(false);
        }} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-3 md:p-6">
          <Routes>
            <Route path="/" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/products" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Products />
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Orders />
              </ProtectedRoute>
            } />
            <Route path="/categories" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Categories />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Profile />
              </ProtectedRoute>
            } />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    
    if (token) {
      API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      verifyToken();
    } else {
      setLoading(false);
      setIsAuthenticated(false);
    }
  }, []);

  const verifyToken = async () => {
    try {
      const response = await API.post("/auth/verify");
      if (response.data.valid) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        delete API.defaults.headers.common["Authorization"];
        setIsAuthenticated(false);
      }
    } catch (error) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
      delete API.defaults.headers.common["Authorization"];
      setIsAuthenticated(false);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <Login onLogin={() => {
              setIsAuthenticated(true);
              window.location.href = "/";
            }} />
          } 
        />
        <Route 
          path="/*" 
          element={
            <AppContent 
              isAuthenticated={isAuthenticated} 
              setIsAuthenticated={setIsAuthenticated}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
            />
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;