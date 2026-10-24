import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Cpu, RefreshCw } from "lucide-react";
import { api } from "../api/client.js";
import VerdictHero from "../components/result/VerdictHero.jsx";
import WordHighlights from "../components/result/WordHighlights.jsx";
import ModelBreakdown from "../components/result/ModelBreakdown.jsx";
import ShapChart from "../components/result/ShapChart.jsx";
import AttentionHeatmap from "../components/result/AttentionHeatmap.jsx";
import Counterfactuals from "../components/result/Counterfactuals.jsx";
import TacticsPanel from "../components/result/TacticsPanel.jsx";

function Skeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" aria-busy="true" aria-label="Loading analysis">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="card space-y-4">
        <div className="h-6 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-10 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card h-64 animate-pulse" />
        <div className="card h-64 animate-pulse" />
      </div>
    </div>
  );
}

export default function Result() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.getResult(id));
    } catch (err) {
      setError(err.message || "Could not load this analysis.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <section className="mx-auto max-w-xl">
        <div className="card text-center">
          <h1 className="text-lg font-semibold">Analysis unavailable</h1>
          <p role="alert" className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error}</p>
          <div className="mt-5 flex justify-center gap-3">
            <button onClick={load} className="btn-primary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
            <Link to="/analyze" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              New analysis
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const models = data.models || [];
  const votes = data.votes || {
    FAKE: models.filter((m) => m.label === "FAKE").length,
    REAL: models.filter((m) => m.label === "REAL").length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/history"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to history
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Analysis #{data.id ?? id}</h1>
        </div>
        <Link to="/analyze" className="btn-primary">
          Analyze another article
        </Link>
      </header>

      <VerdictHero data={{ ...data, votes }} />

      <WordHighlights text={data.text || ""} highlights={data.highlights || []} words={data.words || []} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ModelBreakdown models={models} votes={votes} />
        <ShapChart shap={data.shap || []} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AttentionHeatmap attention={data.attention} />
        <TacticsPanel tactics={data.tactics || []} manipulationScore={data.manipulation_score} />
      </div>

      <Counterfactuals counterfactuals={data.counterfactuals} />

      <section aria-label="Engine details" className="card text-sm">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <Cpu className="h-4 w-4 text-primary" aria-hidden="true" /> How this was produced
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-slate-600 dark:text-slate-300 sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Explanation</dt>
            <dd className="text-right">{data.explanation?.source || "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Attention</dt>
            <dd className="text-right">{data.explanation?.attention_source || "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Models loaded</dt>
            <dd className="text-right">{(data.engine?.models_loaded || []).join(", ") || "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Engine</dt>
            <dd className="text-right">v{data.engine?.version || "—"}{data.engine?.degraded ? " (degraded)" : ""}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
