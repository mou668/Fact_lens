import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import AuthShell from "../components/AuthShell.jsx";
import PasswordInput, { passwordStrength } from "../components/PasswordInput.jsx";
import { usePreferences } from "../context/PreferencesContext.jsx";

export default function Register() {
  const { user, register } = useAuth();
  const { t } = usePreferences();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/analyze" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const strength = passwordStrength(form.password);

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = "Name must be at least 2 characters";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email address";
    if (form.password.length < 8) e.password = "Password must be at least 8 characters";
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) e.password = "Use at least one letter and one number";
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
      nav("/analyze", { replace: true });
    } catch (err) {
      setError(err.message);
      setErrors(err.errors || {});
    } finally {
      setBusy(false);
    }
  };

  const field = (k, label, type, auto) => (
    <div>
      <label htmlFor={k} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={k} type={type} className="input" value={form[k]} onChange={set(k)} autoComplete={auto}
        aria-invalid={!!errors[k] || undefined} aria-describedby={errors[k] ? `${k}-err` : undefined} required />
      {errors[k] && <p id={`${k}-err`} className="mt-1 text-xs text-fake">{errors[k]}</p>}
    </div>
  );

  return (
    <AuthShell title="Create your account" subtitle="Start detecting misinformation with explanations.">
      {error && <p role="alert" className="mb-4 rounded-lg bg-fake/10 p-3 text-sm text-fake">{error}</p>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        {field("name", t("Full name"), "text", "name")}
        {field("email", t("Email"), "email", "email")}
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">{t("Password")}</label>
          <PasswordInput id="password" value={form.password} onChange={set("password")} autoComplete="new-password"
            invalid={!!errors.password} describedBy="pw-hint" />
          {form.password && (
            <div className="mt-2" aria-live="polite">
              <div className="h-1.5 rounded bg-slate-200 dark:bg-slate-700"><div className={`h-1.5 rounded ${strength.color} ${strength.w}`} /></div>
              <p className="mt-1 text-xs text-slate-500">{t("Strength:")} {strength.label}</p>
            </div>
          )}
          <p id="pw-hint" className={`mt-1 text-xs ${errors.password ? "text-fake" : "text-slate-500"}`}>
            {errors.password || t("At least 8 characters with a letter and a number.")}
          </p>
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {busy ? t("Creating account…") : t("Create your account")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">{t("Already registered?")} <Link to="/login" className="font-medium text-primary hover:underline">{t("Log in")}</Link></p>
    </AuthShell>
  );
}
