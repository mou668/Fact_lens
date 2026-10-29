import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Cpu, Download, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { api } from "../api/client.js";
import { translateMessage, usePreferences } from "../context/PreferencesContext.jsx";
import VerdictHero from "../components/result/VerdictHero.jsx";
import WordHighlights from "../components/result/WordHighlights.jsx";
import ModelBreakdown from "../components/result/ModelBreakdown.jsx";
import ShapChart from "../components/result/ShapChart.jsx";
import AttentionHeatmap from "../components/result/AttentionHeatmap.jsx";
import Counterfactuals from "../components/result/Counterfactuals.jsx";
import TacticsPanel from "../components/result/TacticsPanel.jsx";
import FeedbackForm from "../components/result/FeedbackForm.jsx";
import VerdictShareCard from "../components/result/VerdictShareCard.jsx";

function Skeleton({ label }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6" aria-busy="true" aria-label={label}>
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
  const { t, speechLocale, simpleMode } = usePreferences();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [factChecks, setFactChecks] = useState([]);
  const [factCheckMessage, setFactCheckMessage] = useState("");

  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.getResult(id));
    } catch (err) {
      setError(translateMessage(err.message || "Could not load this analysis.", t));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const claim = data.claims?.[0]?.text || (data.text || "").slice(0, 500);
    if (!claim || claim.length < 10) return;
    let cancelled = false;
    setFactCheckMessage("");
    api.factCheck(claim)
      .then((result) => {
        if (!cancelled) setFactChecks(result.matches || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setFactChecks([]);
          if (err.status === 503) setFactCheckMessage(t("Fact-check lookup is not configured."));
          else setFactCheckMessage(t("Fact-check lookup is temporarily unavailable."));
        }
      });
    return () => { cancelled = true; };
  }, [data, t]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const simpleSummary = data ? t(`Summary ${data.label}`) : "";
  const toggleReadAloud = () => {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
      setActionError(t("Read-aloud is not supported in this browser."));
      return;
    }
    setActionError("");
    if (reading) {
      window.speechSynthesis.cancel();
      setReading(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(simpleSummary);
    utterance.lang = speechLocale;
    utterance.onend = () => setReading(false);
    utterance.onerror = () => setReading(false);
    window.speechSynthesis.speak(utterance);
    setReading(true);
  };

  const submitFeedback = async (analysisId, correct) => {
    setSubmittingFeedback(true);
    try {
      await api.feedback({ analysis_id: analysisId, correct: correct, comment: feedbackNote });
      setSubmittingFeedback(false);
      await load();
      setFeedbackNote("");
    } catch (err) {
      setSubmittingFeedback(false);
      setActionError("Failed to submit feedback");
    }
  };

  const smallSummary = data ? t(`Summary ${data.label}`) : "";

  if (loading) return <Skeleton label={t("Loading analysis…")} />;

  if (error) {
    return (
      <section className="mx-auto max-w-xl">
        <div className="card text-center">
          <h1 className="text-lg font-semibold">{t("Analysis unavailable")}</h1>
          <p role="alert" className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error}</p>
          <div className="mt-5 flex justify-center gap-3">
            <button onClick={load} className="btn-primary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t("Try again")}
            </button>
            <Link to="/analyze" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              {t("New analysis")}
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
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("Back to history")}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{t("Analysis details")} #{data.id ?? id}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={toggleReadAloud} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            {reading ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
            {t(reading ? "Stop reading" : "Read verdict aloud")}
          </button>
          <VerdictShareCard data={data} />
          <Link to="/analyze" className="btn-primary">{t("Analyze another article")}</Link>
        </div>
      </header>

      <VerdictHero data={{ ...data, votes }} simpleMode={simpleMode} simpleSummary={simpleSummary} />
      {actionError && <p role="alert" className="rounded-lg bg-fake/10 p-3 text-sm text-fake">{actionError}</p>}

      {(data.claims || []).length > 0 && (
        <section className="card" aria-label={t("Extracted claims")}>
          <h2 className="font-semibold">{t("Extracted claims")}</h2>
          <div className="mt-3 space-y-2">
            {data.claims.map((claim, index) => (
              <div key={`${claim.text}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className="min-w-0 flex-1 text-sm">{claim.text}</p>
                <span className={`badge-${claim.label}`}>{claim.label} · {Math.round(claim.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card" aria-label={t("Live evidence check")}>
        <h2 className="font-semibold">{t("Live evidence check")}</h2>
        {(data.evidence || data.source_evidence || []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t("No live evidence found. Configure GOOGLE_FACT_CHECK_API_KEY for real-time checks.")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {(data.evidence || data.source_evidence || []).map((ev, index) => (
              <article
                key={`${ev.link}-${index}`}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <p className="text-sm font-medium">{ev.title || ev.claim || "Claim"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {ev.source || "Unknown source"}
                  {ev.rating_or_stance && ` — ${ev.rating_or_stance}`}
                </p>
                {ev.link && (
                  <a
                    href={ev.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm text-primary hover:underline"
                  >
                    {t("Read fact-check")}
                  </a>
                )}
                {ev.rating_or_stance && (
                  <p className="mt-2 text-xs">
                    {t("Stance:")} {ev.rating_or_stance}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {data.source_url && (
        <section className="card" aria-label={t("Source credibility")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{t("Source credibility")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("FactLens checks article text, not publisher reputation.")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-uncertain/15 px-3 py-1 text-xs font-medium text-uncertain">{t("Publisher not independently verified")}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${data.source_secure ? "bg-real/15 text-real" : "bg-uncertain/15 text-uncertain"}`}>
                {data.source_secure ? t("Secure HTTPS connection") : t("HTTP connection")}
              </span>
            </div>
          </div>
          <a className="mt-3 block truncate text-sm text-primary hover:underline" href={data.source_url} target="_blank" rel="noopener noreferrer">{data.source_url}</a>
        </section>
      )}

      {!simpleMode && (
        <>
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
              <Cpu className="h-4 w-4 text-primary" aria-hidden="true" /> {t("How this was produced")}
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">{t("Explanation")}</dt><dd className="text-right">{data.explanation?.source || "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">{t("Attention")}</dt><dd className="text-right">{data.explanation?.attention_source || "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">{t("Models loaded")}</dt><dd className="text-right">{(data.engine?.models_loaded || []).join(", ") || "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">{t("Engine")}</dt><dd className="text-right">v{data.engine?.version || "—"}{data.engine?.degraded ? " (degraded)" : ""}</dd></div>
            </dl>
          </section>
        </>
      )}

      <div className="card mb-4">
        <h3 className="font-semibold">{t("Was this correct?")}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => submitFeedback(data.id, true)}
            className="btn-primary rounded-lg px-3 py-1 text-sm font-medium"
            disabled={submittingFeedback}
          >
            {t("Yes")}
          </button>
          <button
            onClick={() => submitFeedback(data.id, false)}
            className="rounded-lg px-3 py-1 text-sm text-red-600 hover:text-red-800"
            disabled={submittingFeedback}
          >
            {t("No")}
          </button>
        </div>
        <input
          type="text"
          placeholder={t("Optional note (max 200 characters)")}
          onChange={(e) => setFeedbackNote(e.target.value)}
          maxLength={200}
          className="input w-full mt-2 rounded-border border border-slate-300 focus-outline"
        />
      </div>

      <FeedbackForm analysisId={data.id ?? Number(id)} />
    </div>
  );
}