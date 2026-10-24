import { Clock } from "lucide-react";

export default function ComingSoon({ title, description, owner }) {
  return (
    <section aria-labelledby="page-title" className="mx-auto max-w-3xl">
      <h1 id="page-title" className="mb-6 text-2xl font-bold">{title}</h1>
      <div className="card text-center">
        <Clock className="mx-auto mb-3 h-10 w-10 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Coming soon</h2>
        <p className="mt-1 text-slate-500 dark:text-slate-400">{description}</p>
        {owner && <p className="mt-4 text-xs uppercase tracking-wide text-slate-400">Owner: {owner}</p>}
      </div>
    </section>
  );
}
