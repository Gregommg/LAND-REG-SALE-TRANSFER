import axios from "axios";

// In development, the Vite dev server proxies /api to the backend (see
// vite.config.js), so a relative path works. In production, set
// VITE_API_BASE_URL to your deployed backend's URL, e.g.
// https://your-backend.onrender.com/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

// Attach the JWT (if present) to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto logout on 401 (expired / invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
