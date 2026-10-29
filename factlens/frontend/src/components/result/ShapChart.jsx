import { BarChart3 } from "lucide-react";
import { usePreferences } from "../../context/PreferencesContext.jsx";

/**
 * Diverging SHAP chart. Positive values push the text toward FAKE (red),
 * negative values push it toward REAL (green).
 */
export default function ShapChart({ shap = [] }) {
  const { t } = usePreferences();
  if (!shap.length) return null;

  const items = [...shap]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 10);
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 0.0001);

  return (
    <section aria-labelledby="shap-title" className="card">
      <div className="mb-1 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 id="shap-title" className="text-lg font-semibold">{t("SHAP explanations")}</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {t("How much each feature moved the prediction away from the model's baseline, in log-odds.")}
      </p>

      <ul className="space-y-2.5">
        {items.map((item, index) => {
          const width = Math.max(2, (Math.abs(item.value) / max) * 50);
          const positive = item.value >= 0;
          return (
            <li key={`${item.feature}-${index}`} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate" title={item.feature}>{item.feature}</span>
              <div className="relative h-4 rounded bg-slate-100 dark:bg-slate-800">
                <span className="absolute left-1/2 top-0 h-full w-px bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
                <span
                  className={`absolute top-0 h-full rounded ${positive ? "bg-fake/70" : "bg-real/70"}`}
                  style={{
                    width: `${width}%`,
                    left: positive ? "50%" : `${50 - width}%`,
                    transition: "width 500ms ease",
                  }}
                  aria-hidden="true"
                />
              </div>
              <span className={`w-16 text-right tabular-nums ${positive ? "text-fake" : "text-real"}`}>
                {item.value > 0 ? "+" : ""}{item.value.toFixed(3)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
        <span>← {t("pushes REAL")}</span>
        <span>{t("pushes FAKE")} →</span>
      </div>
    </section>
  );
}
