import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id} type={show ? "text" : "password"} value={value} onChange={onChange}
        autoComplete={autoComplete} required className="input pr-10"
        aria-invalid={invalid || undefined} aria-describedby={describedBy}
      />
      <button
        type="button" onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
        className="absolute inset-y-0 right-0 px-3 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-r-lg"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function passwordStrength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const levels = [
    { label: "Too weak", color: "bg-fake", w: "w-1/5" },
    { label: "Weak", color: "bg-fake", w: "w-2/5" },
    { label: "Fair", color: "bg-uncertain", w: "w-3/5" },
    { label: "Good", color: "bg-uncertain", w: "w-4/5" },
    { label: "Strong", color: "bg-real", w: "w-full" },
  ];
  return levels[Math.max(0, s - 1)];
}
