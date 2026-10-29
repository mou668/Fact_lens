import { useMemo, useState } from "react";
import { Highlighter } from "lucide-react";
import { FAKE_PALETTE, REAL_PALETTE, intensityClasses } from "./verdict.js";
import { usePreferences } from "../../context/PreferencesContext.jsx";

const PREVIEW_CHARS = 1400;

function buildSegments(text, highlights) {
  const sorted = highlights
    .filter((h) => h.start >= 0 && h.end <= text.length && h.start < h.end)
    .sort((a, b) => a.start - b.start);
  const out = [];
  let cursor = 0;
  for (const h of sorted) {
    if (h.start < cursor) continue;
    if (h.start > cursor) out.push({ text: text.slice(cursor, h.start) });
    out.push({ text: text.slice(h.start, h.end), score: h.score });
    cursor = h.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

/**
 * Renders the original article with per-word attribution colours.
 * Falls back to a ranked word list when the backend only sent `words`.
 */
export default function WordHighlights({ text = "", highlights = [], words = [] }) {
  const { t } = usePreferences();
  const [expanded, setExpanded] = useState(false);
  const truncated = text.length > PREVIEW_CHARS && !expanded;
  const displayText = truncated ? text.slice(0, PREVIEW_CHARS) : text;

  const maxAbs = useMemo(
    () => Math.max(...highlights.map((h) => Math.abs(h.score)), ...words.map((w) => Math.abs(w.score)), 0.0001),
    [highlights, words]
  );

  const segments = useMemo(
    () => (highlights.length && displayText ? buildSegments(displayText, highlights) : null),
    [displayText, highlights]
  );

  return (
    <section aria-labelledby="highlights-title" className="card">
      <div className="mb-1 flex items-center gap-2">
        <Highlighter className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 id="highlights-title" className="text-lg font-semibold">{t("Word highlights")}</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {t("Red words pushed the verdict toward FAKE, green words toward REAL. Hover a word for its SHAP value.")}
      </p>

      {segments ? (
        <>
          <p className="whitespace-pre-wrap text-sm leading-7">
            {segments.map((seg, i) =>
              seg.score === undefined ? (
                <span key={i}>{seg.text}</span>
              ) : (
                <mark
                  key={i}
                  title={`SHAP ${seg.score > 0 ? "+" : ""}${seg.score.toFixed(3)}`}
                  className={`rounded px-0.5 ${intensityClasses(seg.score / maxAbs, seg.score > 0 ? FAKE_PALETTE : REAL_PALETTE)}`}
                >
                  {seg.text}
                </mark>
              )
            )}
          </p>
          {text.length > PREVIEW_CHARS && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {expanded ? t("Show less") : t("Show full article")}
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {words.length ? (
            words.map((w) => (
              <span
                key={w.word}
                className={`rounded px-2 py-0.5 text-sm ${intensityClasses(w.score / maxAbs, w.score > 0 ? FAKE_PALETTE : REAL_PALETTE)}`}
                title={`SHAP ${w.score > 0 ? "+" : ""}${w.score.toFixed(3)}`}
              >
                {w.word}
              </span>
            ))
          ) : (
            <p className="text-sm text-slate-500">{t("No word-level explanation available.")}</p>
          )}
        </div>
      )}
    </section>
  );
}
