import { Menu, Moon, Sun, BookOpenCheck } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";
import { usePreferences } from "../context/PreferencesContext.jsx";

export default function TopBar({ onMenu }) {
  const { theme, toggle } = useTheme();
  const { language, setLanguage, simpleMode, setSimpleMode, t } = usePreferences();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <button onClick={onMenu} className="rounded-md p-2 md:hidden" aria-label={t("Open navigation")}><Menu className="h-5 w-5" /></button>
      <div className="flex-1" />
      <label className="sr-only" htmlFor="interface-language">{t("Language")}</label>
      <select
        id="interface-language"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className="mr-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <option value="en">English</option>
        <option value="te">తెలుగు</option>
        <option value="hi">हिन्दी</option>
      </select>
      <button
        onClick={() => setSimpleMode(!simpleMode)}
        aria-pressed={simpleMode}
        className={`mr-2 inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-slate-800 ${simpleMode ? "text-primary" : ""}`}
        title={t("Simple mode")}
      >
        <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t("Simple mode")}</span>
      </button>
      <button
        onClick={toggle}
        aria-label={t(theme === "dark" ? "Switch to light mode" : "Switch to dark mode")}
        className="rounded-md p-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-slate-800"
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
    </header>
  );
}
