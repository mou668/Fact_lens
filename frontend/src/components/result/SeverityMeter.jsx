import { AlertTriangle } from "lucide-react";

const BANDS = [
  { at: 80, label: "Severe", className: "bg-fake", text: "text-fake" },
  { at: 60, label: "High", className: "bg-fake/80", text: "text-fake" },
  { at: 30, label: "Moderate", className: "bg-uncertain", text: "text-uncertain" },
  { at: 0, label: "Low", className: "bg-real", text: "text-real" },
];

const bandFor = (score) => BANDS.find((b) => score >= b.at) || BANDS[BANDS.length - 1];

/** 0-100 severity meter combining model probability and manipulation evidence. */
export default function SeverityMeter({ score = 0, band, compact = false }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const meta = bandFor(value);

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Severity
        </span>
        <span className={`font-semibold ${meta.text}`}>
          {value}/100 · {band || meta.label}
        </span>
      </div>
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Severity ${value} out of 100, ${band || meta.label}`}
      >
        <div className={`h-full rounded-full ${meta.className}`} style={{ width: `${value}%`, transition: "width 600ms ease" }} />
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-slate-400">
          <span>Low</span>
          <span>Moderate</span>
          <span>High</span>
          <span>Severe</span>
        </div>
      )}
    </div>
  );
}
