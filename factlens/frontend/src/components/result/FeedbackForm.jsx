import { useState } from "react";
import { api } from "../../api/client.js";
import { translateMessage, usePreferences } from "../../context/PreferencesContext.jsx";

export default function FeedbackForm({ analysisId }) {
  const { t } = usePreferences();
  const [correct, setCorrect] = useState(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (event) => {
    event.preventDefault();
    if (correct === null) return;
    setBusy(true);
    setError("");
    try {
      await api.sendFeedback(analysisId, correct, comment.trim() || undefined);
      setSubmitted(true);
    } catch (err) {
      setError(translateMessage(err.message || "Could not send feedback.", t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="feedback-title">
      <h2 id="feedback-title" className="text-lg font-semibold">{t("Feedback")}</h2>
      {submitted ? (
        <p role="status" className="mt-3 text-sm text-real">{t("Thank you for your feedback.")}</p>
      ) : (
        <form onSubmit={send} className="mt-3 space-y-3">
          <fieldset>
            <legend className="mb-2 text-sm text-slate-600 dark:text-slate-300">{t("Was this analysis helpful?")}</legend>
            <div className="flex flex-wrap gap-2">
              {[true, false].map((value) => (
                <button
                  type="button"
                  key={String(value)}
                  aria-pressed={correct === value}
                  onClick={() => setCorrect(value)}
                  className={`rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${correct === value ? "border-primary bg-primary/10 text-primary" : "border-slate-300 dark:border-slate-700"}`}
                >
                  {t(value ? "Yes, correct" : "No, incorrect")}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="sr-only">{t("Add a comment (optional)")}</span>
            <textarea className="input min-h-20" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t("Add a comment (optional)")} />
          </label>
          {error && <p role="alert" className="text-sm text-fake">{error}</p>}
          <button type="submit" className="btn-primary" disabled={correct === null || busy}>{busy ? t("Sending feedback…") : t("Send feedback")}</button>
        </form>
      )}
    </section>
  );
}
