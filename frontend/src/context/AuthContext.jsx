import { createContext, useContext, useEffect, useState } from "react";
import { api, unwrap } from "../lib/api";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("nri_user") || "null");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(
    Boolean(localStorage.getItem("nri_token")),
  );
  useEffect(() => {
    if (!localStorage.getItem("nri_token")) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => {
        const d = unwrap(r);
        const next = d.user || d;
        setUser(next);
        localStorage.setItem("nri_user", JSON.stringify(next));
      })
      .catch(() => {
        localStorage.removeItem("nri_token");
        localStorage.removeItem("nri_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);
  const login = async (email, password) => {
    const d = unwrap(await api.post("/auth/login", { email, password }));
    const token = d.token || d.data?.token;
    const nextUser = d.user || d.data?.user;
    if (!token)
      throw new Error(
        "The API response did not include a token. Check the backend login response.",
      );
    localStorage.setItem("nri_token", token);
    if (nextUser) localStorage.setItem("nri_user", JSON.stringify(nextUser));
    setUser(nextUser || null);
    return nextUser;
  };
  const register = async (payload) => {
    const d = unwrap(await api.post("/auth/register", payload));
    const token = d.token || d.data?.token;
    const nextUser = d.user || d.data?.user;
    if (token) {
      localStorage.setItem("nri_token", token);
      if (nextUser) localStorage.setItem("nri_user", JSON.stringify(nextUser));
      setUser(nextUser || null);
    }
    return d;
  };
  const logout = () => {
    localStorage.removeItem("nri_token");
    localStorage.removeItem("nri_user");
    setUser(null);
    window.location.href = "/login";
  };
  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
