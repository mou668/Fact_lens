import { GitBranch, Sparkles } from "lucide-react";
import { metaFor, pct } from "./verdict.js";
import { usePreferences } from "../../context/PreferencesContext.jsx";

/** "What would change the verdict?" — occlusion-based counterfactual edits. */
export default function Counterfactuals({ counterfactuals }) {
  const { t } = usePreferences();
  if (!counterfactuals) return null;
  const { flipped, options = [], note, attempts = 0 } = counterfactuals;

  return (
    <section aria-labelledby="counterfactual-title" className="card">
      <div className="mb-1 flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 id="counterfactual-title" className="text-lg font-semibold">{t("What would change the verdict?")}</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {t("We removed the words the model relied on most and re-ran the full ensemble.")} {attempts} {t(attempts === 1 ? "edit tested." : "edits tested.")}
      </p>

      {flipped ? (
        <ul className="space-y-3">
          {options.map((option, index) => {
            const meta = metaFor(option.label);
            return (
              <li
                key={index}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t("Remove")}</span>
                  {option.remove.map((word) => (
                    <span
                      key={word}
                      className="rounded bg-fake/10 px-2 py-0.5 font-medium text-fake line-through"
                    >
                      {word}
                    </span>
                  ))}
                  <span aria-hidden="true" className="text-slate-400">→</span>
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${meta.bg} ${meta.text}`}>
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {t(option.label)} {t("at")} {pct(option.confidence)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                  “{option.text}…”
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-3">
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {note}
          </p>
          {counterfactuals.closest && (
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("Closest attempt")}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t("Remove")}</span>
                {counterfactuals.closest.remove.map((word) => (
                  <span key={word} className="rounded bg-fake/10 px-2 py-0.5 font-medium text-fake line-through">
                    {word}
                  </span>
                ))}
                <span aria-hidden="true" className="text-slate-400">→</span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${metaFor(counterfactuals.closest.label).bg} ${metaFor(counterfactuals.closest.label).text}`}>
                  {t("still")} {t(counterfactuals.closest.label)} {t("at")} {pct(counterfactuals.closest.confidence)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                P(FAKE) fell from {pct(counterfactuals.original?.p_fake ?? 0)} to {pct(counterfactuals.closest.p_fake)}.
              </p>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        {t("Counterfactuals are exploratory: they show what the model is sensitive to, not what is factually true.")}
      </p>
    </section>
  );
}
