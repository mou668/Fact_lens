import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Database, Loader2, RefreshCw, Trophy } from "lucide-react";
import { api } from "../api/client.js";

const pct = (value) => (typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—");
const num = (value) => (typeof value === "number" ? value.toLocaleString() : "—");

function MetricTable({ models, onSelect, selected }) {
  const entries = Object.entries(models || {});
  if (!entries.length) return null;

  const best = (key) =>
    Math.max(...entries.map(([, m]) => (m.test?.[key] ?? m.val?.[key] ?? -1)));

  const columns = [
    { key: "accuracy", label: "Acc." },
    { key: "precision", label: "Prec.", className: "hidden sm:table-cell" },
    { key: "recall", label: "Rec.", className: "hidden sm:table-cell" },
    { key: "f1", label: "F1" },
    { key: "roc_auc", label: "AUC" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <th className="py-2 pr-2 font-medium">Model</th>
            {columns.map((c) => (
              <th key={c.key} className={`px-1 py-2 text-right font-medium ${c.className || ""}`} title={c.key}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, report]) => {
            const metrics = report.test || report.val;
            const isSelected = selected === name;
            return (
              <tr
                key={name}
                onClick={() => onSelect(isSelected ? null : name)}
                className={`cursor-pointer border-b border-slate-100 transition dark:border-slate-800 ${
                  isSelected ? "bg-primary/5" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <td className="py-2 pr-2">
                  <button
                    className="flex items-center gap-1.5 whitespace-nowrap text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-expanded={isSelected}
                  >
                    {name}
                    {metrics?.accuracy === best("accuracy") && (
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-uncertain" aria-label="Best accuracy" />
                    )}
                  </button>
                  <p className="text-[10px] font-normal text-slate-400">n = {num(metrics?.support)}</p>
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-1 py-2.5 text-right tabular-nums ${c.className || ""} ${
                      metrics?.[c.key] === best(c.key) ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {pct(metrics?.[c.key])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RocChart({ curve, auc }) {
  const fpr = curve?.fpr || [];
  const tpr = curve?.tpr || [];
  if (!fpr.length || !tpr.length) {
    return <p className="text-xs text-slate-500">ROC points are not available for this run.</p>;
  }
  const points = fpr.map((x, index) => `${(x * 280 + 10).toFixed(1)},${(170 - tpr[index] * 150).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox="0 0 300 190" role="img" aria-label={`ROC curve, AUC ${typeof auc === "number" ? auc.toFixed(4) : "unavailable"}`} className="h-44 w-full">
        <line x1="10" y1="170" x2="290" y2="170" stroke="currentColor" className="text-slate-300" />
        <line x1="10" y1="20" x2="10" y2="170" stroke="currentColor" className="text-slate-300" />
        <line x1="10" y1="170" x2="290" y2="20" stroke="currentColor" strokeDasharray="4 4" className="text-slate-300" />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" />
        <text x="150" y="188" textAnchor="middle" className="fill-slate-500 text-[10px]">False positive rate</text>
        <text x="7" y="95" textAnchor="middle" transform="rotate(-90 7 95)" className="fill-slate-500 text-[10px]">True positive rate</text>
      </svg>
      <p className="text-center text-xs font-semibold text-slate-600 dark:text-slate-300">ROC-AUC: {typeof auc === "number" ? auc.toFixed(4) : "—"}</p>
    </div>
  );
}

function ConfusionMatrix({ matrix }) {
  if (!matrix) return null;
  const cell = "rounded-lg p-3 text-center";
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div />
      <div className="text-center font-medium text-slate-500">Pred REAL</div>
      <div className="text-center font-medium text-slate-500">Pred FAKE</div>
      <div className="self-center font-medium text-slate-500">Actual REAL</div>
      <div className={`${cell} bg-real/10 text-real`}>
        <div className="text-lg font-bold">{matrix.tn}</div>
        <div>true negative</div>
      </div>
      <div className={`${cell} bg-fake/10 text-fake`}>
        <div className="text-lg font-bold">{matrix.fp}</div>
        <div>false positive</div>
      </div>
      <div className="self-center font-medium text-slate-500">Actual FAKE</div>
      <div className={`${cell} bg-fake/10 text-fake`}>
        <div className="text-lg font-bold">{matrix.fn}</div>
        <div>false negative</div>
      </div>
      <div className={`${cell} bg-real/10 text-real`}>
        <div className="text-lg font-bold">{matrix.tp}</div>
        <div>true positive</div>
      </div>
    </div>
  );
}

export default function Models() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.getModels());
    } catch (err) {
      setError(err.message || "Could not load model metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="card flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading model metrics…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="card text-center">
          <h1 className="text-lg font-semibold">Metrics unavailable</h1>
          <p role="alert" className="mt-2 text-sm text-slate-500">{error}</p>
          <button onClick={load} className="btn-primary mt-4">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const report = metrics.models || {};
  const dataset = metrics.dataset;
  const ensemble = metrics.ensemble;
  const selectedReport = selected ? report[selected] : null;
  const selectedMetrics = selectedReport?.test || selectedReport?.val;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Models &amp; performance</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Held-out test results produced by <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">python -m ml.train</code>.
          Click a row for the confusion matrix.
        </p>
      </header>

      <section className="card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Live pipeline:</span>
          {(data?.available || []).map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full bg-real/10 px-2.5 py-1 text-xs font-medium text-real">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {name}
            </span>
          ))}
          {(data?.expected || [])
            .filter((name) => !(data?.available || []).includes(name))
            .map((name) => (
              <span key={name} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {name} (not loaded)
              </span>
            ))}
        </div>
        {data?.degraded && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-uncertain/10 p-3 text-xs text-uncertain">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Degraded mode: {data.error || "some artifacts are missing. Run the training pipeline to load every model."}
          </p>
        )}
      </section>

      {!Object.keys(report).length ? (
        <section className="card text-center">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">No metrics yet</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Train the models first: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">python -m ml.train --with-bert</code>
          </p>
        </section>
      ) : (
        <>
          {dataset && (
            <section aria-labelledby="dataset-title" className="card">
              <div className="mb-3 flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 id="dataset-title" className="text-lg font-semibold">Dataset</h2>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Source</dt>
                  <dd className="font-medium" title={dataset.name}>{dataset.name.split("(")[0].trim()}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Usable rows</dt>
                  <dd className="font-medium">{num(dataset.clean_rows)} <span className="text-xs text-slate-400">/ {num(dataset.raw_rows)} raw</span></dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Class balance</dt>
                  <dd className="font-medium">REAL {num(dataset.class_counts?.REAL)} · FAKE {num(dataset.class_counts?.FAKE)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Split</dt>
                  <dd className="font-medium">
                    {dataset.split ? `${num(dataset.split.train)} / ${num(dataset.split.val)} / ${num(dataset.split.test)}` : "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-400">
                Duplicate articles removed and Reuters wire datelines stripped before splitting.
              </p>
            </section>
          )}

          <section aria-labelledby="perf-title" className="card">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 id="perf-title" className="text-lg font-semibold">Per-model test performance</h2>
            </div>
            <MetricTable models={report} selected={selected} onSelect={setSelected} />

            {selectedReport && (
              <div className="mt-5 grid gap-5 border-t border-slate-200 pt-5 dark:border-slate-800 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">{selected} — confusion matrix</h3>
                  <ConfusionMatrix matrix={selectedMetrics?.confusion_matrix} />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">{selected} — ROC curve</h3>
                  <RocChart curve={selectedMetrics?.roc_curve} auc={selectedMetrics?.roc_auc} />
                </div>
                <div className="md:col-span-2">
                  <h3 className="mb-2 text-sm font-semibold">Training details</h3>
                  <dl className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    {Object.entries(selectedReport.info || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-4 border-b border-slate-100 py-1 dark:border-slate-800">
                        <dt className="text-slate-500">{key.replaceAll("_", " ")}</dt>
                        <dd className="text-right font-medium">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}
          </section>

          {ensemble && (
            <section aria-labelledby="ensemble-title" className="card">
              <h2 id="ensemble-title" className="text-lg font-semibold">Majority-vote ensemble</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Evaluated on {num(ensemble.test_subset)} test rows. UNCERTAIN is returned when the models disagree.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Coverage</p>
                  <p className="text-xl font-bold">{pct(ensemble.coverage)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Accuracy (decided)</p>
                  <p className="text-xl font-bold">{pct(ensemble.accuracy_on_decided)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Uncertain</p>
                  <p className="text-xl font-bold">{num(ensemble.uncertain)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Mean confidence</p>
                  <p className="text-xl font-bold">{pct(ensemble.mean_confidence)}</p>
                </div>
              </div>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full">
                <div className="bg-fake" style={{ width: `${((ensemble.vote_distribution?.FAKE || 0) / ensemble.test_subset) * 100}%` }} title="FAKE" />
                <div className="bg-real" style={{ width: `${((ensemble.vote_distribution?.REAL || 0) / ensemble.test_subset) * 100}%` }} title="REAL" />
                <div className="bg-uncertain" style={{ width: `${((ensemble.vote_distribution?.UNCERTAIN || 0) / ensemble.test_subset) * 100}%` }} title="UNCERTAIN" />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {num(ensemble.vote_distribution?.FAKE)} FAKE · {num(ensemble.vote_distribution?.REAL)} REAL ·{" "}
                {num(ensemble.vote_distribution?.UNCERTAIN)} UNCERTAIN
              </p>
            </section>
          )}

          {metrics.generated_at && (
            <p className="text-xs text-slate-400">
              Generated {new Date(metrics.generated_at).toLocaleString()}
              {metrics.system ? ` · ${metrics.system.platform} · ${metrics.system.cpu_count} CPUs` : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
