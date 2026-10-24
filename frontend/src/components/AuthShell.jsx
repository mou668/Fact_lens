import { ScanSearch } from "lucide-react";

export default function AuthShell({ title, subtitle, children }) {
  return (
    <main className="grid min-h-screen place-items-center bg-navy p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-2xl font-bold text-white">
          <ScanSearch className="h-7 w-7 text-primary" aria-hidden="true" /> FactLens
        </div>
        <div className="card">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
