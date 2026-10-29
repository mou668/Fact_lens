import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { API_URL, tokenStore } from "../api/client.js";
import { usePreferences } from "../context/PreferencesContext.jsx";

export default function WasThisHelpful({ itemId }) {
  const { t } = usePreferences();
  const [vote, setVote] = useState(null);
  const [sending, setSending] = useState(false);

  const submit = async (helpful) => {
    if (vote !== null || sending) return;
    setSending(true);
    try {
      const token = tokenStore.get();
      await fetch(`${API_URL}/api/help/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ item_id: itemId, helpful }),
      });
    } catch {
      // silently ignore - feedback is best-effort
    } finally {
      setVote(helpful ? "yes" : "no");
      setSending(false);
    }
  };

  if (vote) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {vote === "yes" ? t("Thanks for your feedback!") : t("We'll try to improve.")}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">{t("Was this helpful?")}</span>
      <button
        type="button"
        onClick={() => submit(true)}
        disabled={sending}
        aria-label={t("Yes, helpful")}
        className="rounded p-1 text-slate-400 hover:text-real focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
      >
        <ThumbsUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => submit(false)}
        disabled={sending}
        aria-label={t("No, not helpful")}
        className="rounded p-1 text-slate-400 hover:text-fake focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
      >
        <ThumbsDown className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}