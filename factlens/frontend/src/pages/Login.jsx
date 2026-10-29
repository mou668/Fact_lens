import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import AuthShell from "../components/AuthShell.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { usePreferences } from "../context/PreferencesContext.jsx";

export default function Login() {
  const { user, login } = useAuth();
  const { t } = usePreferences();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={loc.state?.from || "/analyze"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await login(email, password);
      nav(loc.state?.from || "/analyze", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to analyze news articles.">
      {loc.state?.message && <p role="status" className="mb-4 rounded-lg bg-uncertain/15 p-3 text-sm text-uncertain">{loc.state.message}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-fake/10 p-3 text-sm text-fake">{error}</p>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">{t("Email")}</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">{t("Password")}</label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button className="btn-primary w-full" disabled={busy || !email || !password}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {busy ? t("Logging in…") : t("Log in")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">{t("No account?")} <Link to="/register" className="font-medium text-primary hover:underline">{t("Create one")}</Link></p>
    </AuthShell>
  );
}
