import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Search, Trash2 } from "lucide-react";
import { api } from "../api/client.js";
import { translateMessage, usePreferences } from "../context/PreferencesContext.jsx";

const PAGE_SIZE = 10;
const LABELS = ["ALL", "REAL", "FAKE", "UNCERTAIN"];

export default function History() {
  const { t, locale } = usePreferences();
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("ALL");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await api.getHistory({ q: query.trim(), label, offset: page * PAGE_SIZE, limit: PAGE_SIZE });
        if (active) {
          setItems(result.items);
          setTotal(result.total);
        }
      } catch (err) {
        if (active) setError(translateMessage(err.message || "Could not load history.", t));
      } finally {
        if (active) setLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [label, page, query, t]);

  const updateQuery = (value) => {
    setQuery(value);
    setPage(0);
  };
  const updateLabel = (value) => {
    setLabel(value);
    setPage(0);
  };

  const remove = async (item) => {
    if (!window.confirm(t("Delete this analysis from your history?"))) return;
    setDeleting(item.id);
    setError("");
    try {
      await api.deleteHistory(item.id);
      const newTotal = total - 1;
      if (items.length === 1 && page > 0) setPage(page - 1);
      else {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        setTotal(newTotal);
      }
    } catch (err) {
      setError(translateMessage(err.message || "Could not delete this analysis.", t));
    } finally {
      setDeleting(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="mx-auto max-w-6xl space-y-6" aria-labelledby="history-title">
      <header>
        <h1 id="history-title" className="text-2xl font-bold">{t("History of your analyses")}</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">{t("Search and filter your analyses")}</p>
      </header>

      <div className="card">
        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_12rem]">
          <label className="relative block">
            <span className="sr-only">{t("Search articles")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              className="input pl-9"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder={t("Search articles")}
            />
          </label>
          <label>
            <span className="sr-only">{t("All verdicts")}</span>
            <select className="input" value={label} onChange={(event) => updateLabel(event.target.value)}>
              {LABELS.map((value) => <option key={value} value={value}>{value === "ALL" ? t("All verdicts") : value}</option>)}
            </select>
          </label>
        </div>

        {error && <p role="alert" className="mb-4 rounded-lg bg-fake/10 p-3 text-sm text-fake">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <th scope="col" className="px-3 py-3">{t("Article")}</th>
                <th scope="col" className="px-3 py-3">{t("Verdict")}</th>
                <th scope="col" className="px-3 py-3">{t("Confidence")}</th>
                <th scope="col" className="px-3 py-3">{t("Date")}</th>
                <th scope="col" className="px-3 py-3">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan="5" className="px-3 py-12 text-center text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />{t("Loading history…")}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="5" className="px-3 py-12 text-center text-slate-500">{t("No analyses found.")}</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="max-w-md px-3 py-4">
                    <p className="line-clamp-2">{item.snippet}</p>
                    {(item.source_domain || item.source_file) && <p className="mt-1 truncate text-xs text-slate-500">{item.source_domain || item.source_file}</p>}
                  </td>
                  <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold badge-${item.label}`}>{t(item.label)}</span></td>
                  <td className="px-3 py-4">{(item.confidence * 100).toFixed(1)}%</td>
                  <td className="whitespace-nowrap px-3 py-4 text-slate-500">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/result/${item.id}`} className="inline-flex items-center gap-1 rounded px-2 py-1 font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        {t("View details")} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        disabled={deleting === item.id}
                        aria-label={`${t("Delete")} ${item.id}`}
                        className="rounded p-2 text-slate-500 hover:bg-fake/10 hover:text-fake focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fake disabled:opacity-50"
                      >
                        {deleting === item.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
          <p className="text-slate-500">{total.toLocaleString(locale)} {t("results")} · {t("Page")} {page + 1} {t("of")} {pageCount}</p>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}>
              <ChevronLeft className="mr-1 inline h-4 w-4" aria-hidden="true" />{t("Previous")}
            </button>
            <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800" disabled={page + 1 >= pageCount || loading} onClick={() => setPage((current) => current + 1)}>
              {t("Next")}<ChevronRight className="ml-1 inline h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
