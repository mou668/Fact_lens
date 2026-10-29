import { useState } from "react";
import { AlertOctagon, ChevronDown } from "lucide-react";
import { usePreferences } from "../../context/PreferencesContext.jsx";

function scoreClasses(score) {
  if (score >= 70) return { bar: "bg-fake", text: "text-fake" };
  if (score >= 40) return { bar: "bg-uncertain", text: "text-uncertain" };
  return { bar: "bg-real", text: "text-real" };
}

/** Manipulation tactics detected in the text, with the phrases that triggered them. */
export default function TacticsPanel({ tactics = [], manipulationScore }) {
  const { t } = usePreferences();
  const [showAll, setShowAll] = useState(false);
  if (!tactics.length) return null;

  const active = tactics.filter((t) => t.score > 0);
  const visible = showAll ? tactics : active.length ? active : tactics.slice(0, 3);

  return (
    <section aria-labelledby="tactics-title" className="card">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 id="tactics-title" className="text-lg font-semibold">{t("Manipulation tactics")}</h2>
        </div>
        {typeof manipulationScore === "number" && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {manipulationScore}/100
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {t("Named rhetorical patterns found in the text, independent of the model vote.")}
      </p>

      <ul className="space-y-4">
        {visible.map((tactic) => {
          const tone = scoreClasses(tactic.score);
          return (
            <li key={tactic.id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{tactic.name}</span>
                <span className={`tabular-nums text-xs font-semibold ${tone.text}`}>{tactic.score}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${tactic.score}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tactic.description}</p>
              {tactic.matches?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {tactic.matches.slice(0, 5).map((match) => (
                    <span
                      key={match}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      “{match}”
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        onClick={() => setShowAll((v) => !v)}
        aria-expanded={showAll}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {showAll ? t("Show only detected tactics") : t("Show all tactic categories")}
        <ChevronDown className={`h-4 w-4 transition ${showAll ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
    </section>
  );
}
