/**
 * The ONLY place that talks to the backend.
 * - Reads API_URL from .env (VITE_API_URL)
 * - Attaches the JWT from localStorage
 * - On 401, clears the token and fires "auth:expired" (AuthContext logs out)
 */
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "factlens_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || {};
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("Cannot reach the server. Is the backend running?", 0);
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:expired"));
    }
    throw new ApiError(data.detail || `Request failed (${res.status})`, res.status, data.errors);
  }
  return data;
}

export const api = {
  // Auth
  register: (name, email, password) => request("/api/auth/register", { method: "POST", body: { name, email, password }, auth: false }),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
  // Analysis (stubbed on the backend -- TODO real ML)
  analyze: (text) => request("/api/analyze", { method: "POST", body: { text } }),
  getResult: (id) => request(`/api/result/${id}`),
  getHistory: () => request("/api/history"),
  sendFeedback: (analysis_id, correct, comment) => request("/api/feedback", { method: "POST", body: { analysis_id, correct, comment } }),
};
