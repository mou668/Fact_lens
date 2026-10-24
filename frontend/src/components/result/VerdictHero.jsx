import { AlertOctagon, Cpu, Gauge, Users } from "lucide-react";
import ConfidenceGauge from "./ConfidenceGauge.jsx";
import SeverityMeter from "./SeverityMeter.jsx";
import { metaFor, pct } from "./verdict.js";

function Chip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/60 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

export default function VerdictHero({ data }) {
  const meta = metaFor(data.label);
  const Icon = meta.Icon;
  const votes = data.votes || {};
  const totalVotes = (votes.FAKE || 0) + (votes.REAL || 0);
  const agreement = typeof data.agreement === "number" ? data.agreement : null;

  return (
    <section aria-labelledby="verdict-title" className={`card border ${meta.border}`}>
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${meta.bg} ${meta.text}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {data.label}
          </div>
          <h2 id="verdict-title" className="mt-3 text-2xl font-bold md:text-3xl">
            {meta.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">
            {data.explanation?.summary ||
              `Ensemble confidence ${pct(data.confidence)} across ${totalVotes || "the"} models.`}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {agreement !== null && (
              <Chip icon={Users}>
                {Math.round(agreement * 100)}% model agreement
              </Chip>
            )}
            {typeof data.manipulation_score === "number" && (
              <Chip icon={AlertOctagon}>{data.manipulation_score}/100 manipulation</Chip>
            )}
            {typeof data.engine?.processing_ms === "number" && (
              <Chip icon={Cpu}>{data.engine.processing_ms} ms</Chip>
            )}
            <Chip icon={Gauge}>
              {totalVotes ? `${votes.FAKE || 0} FAKE · ${votes.REAL || 0} REAL` : "single model"}
            </Chip>
          </div>

          {totalVotes > 0 && (
            <div className="mt-4" aria-hidden="true">
              <div className="flex gap-1.5">
                {(data.models || []).map((model) => (
                  <span
                    key={model.name}
                    title={`${model.name}: ${model.label}`}
                    className={`h-1.5 flex-1 rounded-full ${model.label === "FAKE" ? "bg-fake" : "bg-real"}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">one segment per model vote</p>
            </div>
          )}
        </div>

        <div className="flex justify-center md:justify-end">
          <ConfidenceGauge value={data.confidence} label={data.label} />
        </div>
      </div>

      {typeof data.severity === "number" && (
        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
          <SeverityMeter score={data.severity} band={data.severity_band} />
        </div>
      )}

      {data.engine?.degraded && (
        <p role="status" className="mt-4 rounded-lg bg-uncertain/10 px-3 py-2 text-xs text-uncertain">
          Degraded mode: {data.engine.models_loaded?.length
            ? `only ${data.engine.models_loaded.join(", ")} loaded.`
            : "no trained artifacts found — run the training pipeline."}
        </p>
      )}
    </section>
  );
}
