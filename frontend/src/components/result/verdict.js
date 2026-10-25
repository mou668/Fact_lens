import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

/** Shared verdict metadata so every component uses the same colours/labels. */
export const LABEL_META = {
  REAL: {
    title: "Likely real",
    short: "Real",
    text: "text-real",
    bg: "bg-real/10",
    border: "border-real/30",
    bar: "bg-real",
    ring: "ring-real/40",
    Icon: ShieldCheck,
  },
  FAKE: {
    title: "Likely fake",
    short: "Fake",
    text: "text-fake",
    bg: "bg-fake/10",
    border: "border-fake/30",
    bar: "bg-fake",
    ring: "ring-fake/40",
    Icon: ShieldAlert,
  },
  UNCERTAIN: {
    title: "Not enough agreement",
    short: "Uncertain",
    text: "text-uncertain",
    bg: "bg-uncertain/10",
    border: "border-uncertain/30",
    bar: "bg-uncertain",
    ring: "ring-uncertain/40",
    Icon: ShieldQuestion,
  },
};

export const metaFor = (label) => LABEL_META[label] || LABEL_META.UNCERTAIN;

export const pct = (value, digits = 0) =>
  typeof value === "number" ? `${(value * 100).toFixed(digits)}%` : "—";

/** Bucket an intensity (0..1) into a static Tailwind class (JIT-safe). */
export function intensityClasses(value, palette) {
  const v = Math.min(1, Math.abs(value));
  const index = v >= 0.8 ? 5 : v >= 0.6 ? 4 : v >= 0.4 ? 3 : v >= 0.2 ? 2 : 1;
  return palette[index];
}

export const FAKE_PALETTE = {
  1: "bg-fake/10 text-slate-700 dark:text-slate-200",
  2: "bg-fake/20 text-slate-800 dark:text-slate-100",
  3: "bg-fake/30 text-slate-900 dark:text-white",
  4: "bg-fake/40 text-slate-900 dark:text-white",
  5: "bg-fake/55 text-white",
};

export const REAL_PALETTE = {
  1: "bg-real/10 text-slate-700 dark:text-slate-200",
  2: "bg-real/20 text-slate-800 dark:text-slate-100",
  3: "bg-real/30 text-slate-900 dark:text-white",
  4: "bg-real/40 text-slate-900 dark:text-white",
  5: "bg-real/55 text-white",
};

export const ATTENTION_PALETTE = {
  1: "bg-primary/10 text-slate-700 dark:text-slate-200",
  2: "bg-primary/20 text-slate-800 dark:text-slate-100",
  3: "bg-primary/35 text-slate-900 dark:text-white",
  4: "bg-primary/50 text-white",
  5: "bg-primary/70 text-white",
};
