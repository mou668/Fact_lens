import { ScanSearch } from "lucide-react";
import { usePreferences } from "../context/PreferencesContext.jsx";

export default function AuthShell({ title, subtitle, children }) {
  const { language, setLanguage, t } = usePreferences();
  return (
    <main className="grid min-h-screen place-items-center bg-navy p-4">
      <div className="w-full max-w-md">
        <div className="mb-3 flex justify-end">
          <label htmlFor="auth-language" className="sr-only">{t("Language")}</label>
          <select id="auth-language" value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-md border border-white/20 bg-navy-light px-2 py-1 text-sm text-white">
            <option value="en">English</option>
            <option value="te">తెలుగు</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>
        <div className="mb-6 flex items-center justify-center gap-2 text-2xl font-bold text-white">
          <ScanSearch className="h-7 w-7 text-primary" aria-hidden="true" /> FactLens
        </div>
        <div className="card">
          <h1 className="text-xl font-semibold">{t(title)}</h1>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">{t(subtitle)}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
