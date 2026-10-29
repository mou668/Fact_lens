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
  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { "Content-Type": "application/json" };
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
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
  // Analysis (real ML pipeline in ml/)
  analyze: (text) => request("/api/analyze", { method: "POST", body: { text } }),
  factCheck: (claim) => request("/api/factcheck", { method: "POST", body: { claim } }),
  getResult: (id) => request(`/api/result/${id}`),
  getHistory: ({ q = "", label = "ALL", offset = 0, limit = 10 } = {}) => {
    const params = new URLSearchParams({ q, label, offset: String(offset), limit: String(limit) });
    return request(`/api/history?${params}`);
  },
  deleteHistory: (id) => request(`/api/history/${id}`, { method: "DELETE" }),
  analyzeUrl: (url) => request("/api/analyze-url", { method: "POST", body: { url } }),
  analyzeFile: (file) => {
    const body = new FormData();
    body.append("file", file);
    return request("/api/analyze-file", { method: "POST", body });
  },
  extractImageText: (file) => {
    const body = new FormData();
    body.append("file", file);
    return request("/api/extract-image-text", { method: "POST", body });
  },
  downloadReport: async (id) => {
    const token = tokenStore.get();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${API_URL}/api/result/${id}/report.pdf`, { headers });
    if (!response.ok) throw new ApiError("Could not generate the report.", response.status);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `factlens-report-${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  getModels: () => request("/api/models"),
  sendFeedback: (analysis_id, correct, comment) => request("/api/feedback", { method: "POST", body: { analysis_id, correct, comment } }),
};
