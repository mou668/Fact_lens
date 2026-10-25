import { Flame } from "lucide-react";
import { ATTENTION_PALETTE, intensityClasses } from "./verdict.js";

const SOURCE_LABEL = {
  lstm: "BiLSTM attention over input tokens",
  bert: "BERT CLS attention, last layer, averaged over heads",
  none: "not available",
};

/** Token-level attention heatmap produced by the sequence model. */
export default function AttentionHeatmap({ attention }) {
  const tokens = attention?.tokens || [];
  if (!tokens.length) return null;

  return (
    <section aria-labelledby="attention-title" className="card">
      <div className="mb-1 flex items-center gap-2">
        <Flame className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 id="attention-title" className="text-lg font-semibold">Attention heatmap</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {SOURCE_LABEL[attention.source] || SOURCE_LABEL.none}. Darker tokens received more attention.
      </p>

      <div className="flex flex-wrap gap-1" role="list">
        {tokens.map((t, i) => (
          <span
            key={`${t.token}-${i}`}
            role="listitem"
            title={`weight ${t.weight.toFixed(3)}`}
            className={`rounded px-1.5 py-0.5 text-xs ${intensityClasses(t.weight, ATTENTION_PALETTE)}`}
          >
            {t.token}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
        <span>low</span>
        <span className="flex h-2 w-32 overflow-hidden rounded">
          <span className="h-full flex-1 bg-primary/10" />
          <span className="h-full flex-1 bg-primary/20" />
          <span className="h-full flex-1 bg-primary/35" />
          <span className="h-full flex-1 bg-primary/50" />
          <span className="h-full flex-1 bg-primary/70" />
        </span>
        <span>high</span>
      </div>
    </section>
  );
}
