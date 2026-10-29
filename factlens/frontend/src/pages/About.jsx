import { useEffect, useState } from "react";
import {
  Shield, Brain, Layers, BarChart3, Eye, Lock, Cpu, Database,
  Zap, Globe, Code2, Server, Container, GitBranch, Heart,
  BookOpen, Users, GraduationCap, Award, Sparkles, Target,
  FileText, Search, Lightbulb, ChevronRight, AlertTriangle,
} from "lucide-react";
import { api } from "../api/client.js";
import { usePreferences } from "../context/PreferencesContext.jsx";


const TECH_STACK = [
  { name: "FastAPI", icon: Zap, color: "text-green-600" },
  { name: "React", icon: Code2, color: "text-blue-500" },
  { name: "PostgreSQL", icon: Database, color: "text-blue-700" },
  { name: "PyTorch", icon: Brain, color: "text-orange-500" },
  { name: "Hugging Face", icon: Globe, color: "text-yellow-600" },
  { name: "SHAP", icon: BarChart3, color: "text-purple-500" },
  { name: "Docker", icon: Container, color: "text-blue-400" },
];

const MODELS = [
  { name: "BERT", desc: "Transformer-based contextual understanding of language" },
  { name: "LSTM", desc: "Sequential pattern learning for long-form text" },
  { name: "XGBoost", desc: "Gradient boosting for structured feature analysis" },
  { name: "Logistic Regression", desc: "Linear baseline with interpretable coefficients" },
  { name: "SVM", desc: "Margin-based classification for high-dimensional features" },
];

const STEPS = [
  { icon: FileText, label: "Input", desc: "Paste text, upload file, or enter URL" },
  { icon: Zap, label: "Preprocessing", desc: "Clean and tokenize the article text" },
  { icon: Layers, label: "Feature Extraction", desc: "TF-IDF, embeddings, and linguistic features" },
  { icon: Brain, label: "Model Analysis", desc: "Ensemble of 5 ML models vote on the verdict" },
  { icon: Lightbulb, label: "Explanation", desc: "SHAP, attention, and word highlights" },
];

const TEAM = [
  { name: "Mounika", roll: "23EG105E50" },
  { name: "Gunda Pavan", roll: "23EG105E20" },
  { name: "Siripuram Hasini", roll: "23EG105E60" },
];

export default function About() {
  const { t } = usePreferences();
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    api.getModels()
      .then((data) => setMetrics(data?.metrics || {}))
      .catch(() => setMetrics({}))
      .finally(() => setLoadingMetrics(false));
  }, []);

  const report = metrics?.models || {};
  const hasMetrics = Object.keys(report).length > 0;

  return (
    <section className="mx-auto max-w-5xl space-y-8" aria-labelledby="about-title">
      {/* Hero */}
      <header className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Shield className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
        <h1 id="about-title" className="text-3xl font-bold tracking-tight">
          {t("FactLens: AI-Powered Fake News Detection")}
        </h1>
        <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
          {t("Mission statement")}
        </p>
      </header>

      {/* Problem */}
      <section className="card" aria-labelledby="problem-title">
        <h2 id="problem-title" className="mb-3 flex items-center gap-2 text-xl font-semibold">
          <AlertIcon className="h-5 w-5 text-fake" aria-hidden="true" />
          {t("The problem")}
        </h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t("Problem description")}
        </p>
      </section>

      {/* How it works */}
      <section className="card" aria-labelledby="how-title">
        <h2 id="how-title" className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("How it works")}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-5">
          {STEPS.map((step, i) => (
            <li key={step.label} className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <step.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t(step.label)}</span>
              <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{t(step.desc)}</span>
              {i < STEPS.length - 1 && (
                <ChevronRight className="mt-2 hidden h-4 w-4 text-slate-300 sm:block" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Models */}
      <section className="card" aria-labelledby="models-title">
        <h2 id="models-title" className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <Brain className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Our models")}
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          {t("Ensemble explanation")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODELS.map((m) => (
            <div key={m.name} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{m.name}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(m.desc)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Explainability */}
      <section className="card" aria-labelledby="explain-title">
        <h2 id="explain-title" className="mb-3 flex items-center gap-2 text-xl font-semibold">
          <Eye className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Explainability")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
            <h3 className="font-medium text-slate-800 dark:text-slate-100">{t("Word highlights")}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("Word highlights desc")}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
            <h3 className="font-medium text-slate-800 dark:text-slate-100">{t("Attention view")}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("Attention view desc")}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
            <h3 className="font-medium text-slate-800 dark:text-slate-100">{t("SHAP chart")}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("SHAP chart desc")}</p>
          </div>
        </div>
      </section>

      {/* Model performance */}
      <section className="card" aria-labelledby="perf-title">
        <h2 id="perf-title" className="mb-3 flex items-center gap-2 text-xl font-semibold">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Model performance")}
        </h2>
        {loadingMetrics ? (
          <p className="text-sm text-slate-500">{t("Loading metrics…")}</p>
        ) : hasMetrics ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                  <th className="py-2 pr-2">Model</th>
                  <th className="px-2 py-2 text-right">Accuracy</th>
                  <th className="px-2 py-2 text-right">F1</th>
                  <th className="px-2 py-2 text-right">AUC</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report).map(([name, r]) => {
                  const m = r?.test || r?.val || {};
                  return (
                    <tr key={name} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-2 font-medium">{name}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{typeof m.accuracy === "number" ? `${(m.accuracy * 100).toFixed(1)}%` : "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{typeof m.f1 === "number" ? `${(m.f1 * 100).toFixed(1)}%` : "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{typeof m.roc_auc === "number" ? m.roc_auc.toFixed(4) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("Metrics will appear after training")}</p>
        )}
      </section>

      {/* Limitations */}
      <section className="card border-uncertain/30 bg-uncertain/5" aria-labelledby="limits-title">
        <h2 id="limits-title" className="mb-3 flex items-center gap-2 text-xl font-semibold text-uncertain">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          {t("Limitations")}
        </h2>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex gap-2"><span className="text-uncertain">•</span> {t("Limitation 1")}</li>
          <li className="flex gap-2"><span className="text-uncertain">•</span> {t("Limitation 2")}</li>
          <li className="flex gap-2"><span className="text-uncertain">•</span> {t("Limitation 3")}</li>
        </ul>
      </section>

      {/* Privacy */}
      <section className="card" aria-labelledby="privacy-title">
        <h2 id="privacy-title" className="mb-3 flex items-center gap-2 text-xl font-semibold">
          <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Privacy")}
        </h2>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex gap-2"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-real" aria-hidden="true" /> {t("Privacy 1")}</li>
          <li className="flex gap-2"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-real" aria-hidden="true" /> {t("Privacy 2")}</li>
          <li className="flex gap-2"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-real" aria-hidden="true" /> {t("Privacy 3")}</li>
        </ul>
      </section>

      {/* Tech stack */}
      <section className="card" aria-labelledby="tech-title">
        <h2 id="tech-title" className="mb-3 flex items-center gap-2 text-xl font-semibold">
          <Code2 className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Tech stack")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {TECH_STACK.map((tech) => (
            <span key={tech.name} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-700">
              <tech.icon className={`h-3.5 w-3.5 ${tech.color}`} aria-hidden="true" />
              {tech.name}
            </span>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="card" aria-labelledby="team-title">
        <h2 id="team-title" className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <Users className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Team")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TEAM.map((member) => (
            <div key={member.roll} className="flex flex-col items-center rounded-lg border border-slate-200 p-4 text-center dark:border-slate-700">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                {member.name.charAt(0)}
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{member.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{member.roll}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col items-center rounded-lg border border-dashed border-slate-300 p-4 text-center dark:border-slate-600">
          <GraduationCap className="mb-2 h-6 w-6 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("Project guide")}</p>
          <p className="text-xs text-slate-400">{t("Guide slot")}</p>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          {t("Department")} · {t("University")}
        </p>
      </section>

      {/* Version */}
      <footer className="text-center text-xs text-slate-400">
        {t("Version")} {APP_VERSION}
      </footer>
    </section>
  );
}

// Need to import AlertTriangle
const APP_VERSION = "0.1.0";