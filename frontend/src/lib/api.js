import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("nri_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("nri_token");
      localStorage.removeItem("nri_user");
      if (!window.location.pathname.startsWith("/login"))
        window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
export const unwrap = (response) =>
  response?.data?.data ?? response?.data ?? response;
export const getArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of [
    "items",
    "results",
    "properties",
    "expenses",
    "documents",
    "notifications",
    "requests",
    "vendors",
    "data",
    "logs",
    "events",
  ]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
};
export const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  "Something went wrong. Please try again.";
