import { metaFor, pct } from "./verdict.js";

/**
 * Semicircular confidence gauge.
 * `value` is the model's confidence in the reported verdict (0..1).
 */
export default function ConfidenceGauge({ value = 0, label = "UNCERTAIN", size = 220 }) {
  const meta = metaFor(label);
  const v = Math.max(0, Math.min(1, value));
  const radius = 84;
  const cx = 110;
  const cy = 104;
  const length = Math.PI * radius;

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg
        viewBox="0 0 220 128"
        width={size}
        height={(size * 128) / 220}
        role="img"
        aria-label={`${meta.title}, ${pct(v)} confidence`}
      >
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${length * v} ${length}`}
          className={meta.text}
          style={{ stroke: "currentColor", transition: "stroke-dasharray 600ms ease" }}
        />
        <text x={cx} y={cy - 16} textAnchor="middle" className="fill-slate-900 text-3xl font-bold dark:fill-white">
          {pct(v)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" className="fill-slate-500 text-[11px] uppercase tracking-wide dark:fill-slate-400">
          confidence
        </text>
      </svg>
      <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">
        {label === "UNCERTAIN" ? "lean toward one side, not enough agreement" : `${meta.short} verdict`}
      </p>
    </div>
  );
}
