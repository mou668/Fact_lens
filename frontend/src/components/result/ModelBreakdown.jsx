import { CheckCircle2, XCircle } from "lucide-react";
import { metaFor, pct } from "./verdict.js";

/** Per-model results with a P(FAKE) bar and the majority-vote outcome. */
export default function ModelBreakdown({ models = [], votes }) {
  if (!models.length) return null;

  return (
    <section aria-labelledby="models-title" className="card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="models-title" className="text-lg font-semibold">Model-by-model results</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Each model votes independently; the verdict needs a majority.
          </p>
        </div>
        {votes && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {votes.FAKE} FAKE · {votes.REAL} REAL
          </span>
        )}
      </div>

      <ul className="space-y-4">
        {models.map((model) => {
          const meta = metaFor(model.label);
          const pFake = typeof model.p_fake === "number"
            ? model.p_fake
            : model.label === "FAKE" ? model.confidence : 1 - model.confidence;
          return (
            <li key={model.name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  {model.label === "FAKE"
                    ? <XCircle className="h-4 w-4 text-fake" aria-hidden="true" />
                    : <CheckCircle2 className="h-4 w-4 text-real" aria-hidden="true" />}
                  {model.name}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}>
                    {model.label}
                  </span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {pct(model.confidence)} confidence
                  </span>
                </span>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full ${pFake >= 0.5 ? "bg-fake" : "bg-real"}`}
                  style={{ width: `${Math.round(pFake * 100)}%`, transition: "width 500ms ease" }}
                />
                <span className="absolute left-1/2 top-0 h-full w-px bg-slate-400/70" aria-hidden="true" />
              </div>
              <div className="mt-0.5 flex justify-between text-[10px] uppercase tracking-wide text-slate-400">
                <span>real</span>
                <span>p(fake) {pct(pFake)}</span>
                <span>fake</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
