import { HelpCircle, X } from "lucide-react";
import { useState } from "react";
import { usePreferences } from "../context/PreferencesContext.jsx";

export default function HelpTooltip({ text, ariaLabel }) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-label={ariaLabel || t("Help")}
        aria-expanded={open}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-1 top-1 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label={t("Close")}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
          {text}
        </span>
      )}
    </span>
  );
}