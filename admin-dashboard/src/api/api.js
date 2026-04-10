import axios from "axios";

// Use environment variable or fallback to current domain
const getBaseUrl = () => {
  // In production (Railway), use the current domain
  if (window.location.hostname !== 'localhost') {
    return `${window.location.protocol}//${window.location.hostname}/api`;
  }
  // In development (local), use localhost
  return 'http://localhost:5000/api';
};

const API = axios.create({
  baseURL: getBaseUrl()
});

// Add token to requests if exists
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default API;