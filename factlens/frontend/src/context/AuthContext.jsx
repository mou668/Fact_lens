import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, tokenStore } from "../api/client.js";

const AuthContext = createContext(null);

function tokenExpiry(token) {
  try {
    const { exp } = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return exp * 1000;
  } catch {
    return 0;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef();
  const navigate = useNavigate();

  const logout = useCallback(async (reason) => {
    clearTimeout(timer.current);
    if (tokenStore.get()) api.logout().catch(() => {});
    tokenStore.clear();
    setUser(null);
    navigate("/login", { replace: true, state: reason ? { message: reason } : undefined });
  }, [navigate]);

  const startSession = useCallback((token, u) => {
    tokenStore.set(token);
    setUser(u);
    clearTimeout(timer.current);
    const ms = tokenExpiry(token) - Date.now();
    timer.current = setTimeout(() => logout("Your session expired. Please log in again."), Math.max(ms, 0));
  }, [logout]);

  // Restore session on load
  useEffect(() => {
    const token = tokenStore.get();
    if (!token || tokenExpiry(token) < Date.now()) {
      tokenStore.clear();
      setLoading(false);
      return;
    }
    api.me().then((u) => startSession(token, u)).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, [startSession]);

  // Any 401 from the API client -> auto logout
  useEffect(() => {
    const onExpired = () => logout("Your session expired. Please log in again.");
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [logout]);

  const login = async (email, password) => {
    const r = await api.login(email, password);
    startSession(r.access_token, r.user);
  };
  const register = async (name, email, password) => {
    const r = await api.register(name, email, password);
    startSession(r.access_token, r.user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
