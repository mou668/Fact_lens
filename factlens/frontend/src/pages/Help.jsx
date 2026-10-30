import { useState, useMemo, useRef } from "react";
import {
  Search, BookOpen, HelpCircle, MessageSquare, Keyboard, ChevronDown,
  FileText, Link2, Image, Upload, BarChart3, Eye, Brain, Zap,
  CheckCircle2, AlertTriangle, Clock, Send, Mail, User, Tag,
  Lightbulb, Shield, Lock, Trash2, RefreshCw,
} from "lucide-react";
import { API_URL, tokenStore } from "../api/client.js";
import { usePreferences } from "../context/PreferencesContext.jsx";
import HelpTooltip from "../components/HelpTooltip.jsx";
import WasThisHelpful from "../components/WasThisHelpful.jsx";

const FAQ_GROUPS = [
  {
    group: "Using the app",
    items: [
      { q: "What file types can I upload?", a: "You can upload .txt, .pdf, and .docx files up to 5 MB." },
      { q: "Can I analyze images?", a: "Yes, upload PNG or JPG images. FactLens uses OCR to extract text." },
      { q: "What URLs work?", a: "Public HTTP/HTTPS article URLs. Avoid paywalled or login-required pages." },
      { q: "Is there a text limit?", a: "Yes, 20,000 characters per analysis." },
    ],
  },
  {
    group: "Results",
    items: [
      { q: "Why is it FAKE?", a: "The model detected writing patterns common in misinformation. Check the word highlights and SHAP chart for details." },
      { q: "Can it be wrong?", a: "Yes. FactLens detects writing style, not facts. Always verify important news from trusted sources." },
      { q: "What does confidence mean?", a: "How sure the ensemble is. Below 65% is flagged as low confidence." },
      { q: "Why do models disagree?", a: "Different models focus on different features. Disagreement means the verdict is less certain." },
    ],
  },
  {
    group: "Privacy & account",
    items: [
      { q: "Is my article saved?", a: "Yes, your analysis history is stored in your account. You can delete individual entries." },
      { q: "How do I delete my history?", a: "Go to History, click the trash icon next to any analysis." },
      { q: "How do I reset my password?", a: "Contact support or use the password reset flow if available." },
      { q: "Is my data shared?", a: "No. Your data is private and never shared with third parties." },
    ],
  },
  {
    group: "Troubleshooting",
    items: [
      { q: "Upload fails", a: "Check file type (.txt/.pdf/.docx) and size (under 5 MB). Try a different file." },
      { q: "URL cannot be fetched", a: "The page may be paywalled, require login, or block automated access. Try copying the text instead." },
      { q: "Analysis is slow", a: "Large articles take longer. The model runs 5 ML models in parallel." },
      { q: "I see an error message", a: "Check the message for details. Common causes: network issues, invalid input, or server load." },
    ],
  },
];

const GLOSSARY = [
  { term: "SHAP", def: "SHapley Additive exPlanations — shows how much each word or feature pushed the prediction." },
  { term: "Attention", def: "How much the model focused on each word when making its decision." },
  { term: "Ensemble", def: "Multiple models voting together for a more reliable verdict." },
  { term: "Confidence", def: "How certain the model is, expressed as a percentage." },
  { term: "Token", def: "A word or piece of text that the model processes." },
  { term: "TF-IDF", def: "Term Frequency-Inverse Document Frequency — measures how important a word is in a document." },
];

const SHORTCUTS = [
  { keys: "Ctrl + Enter", desc: "Submit analysis" },
  { keys: "Esc", desc: "Close dialogs / cancel" },
  { keys: "Tab", desc: "Navigate between elements" },
  { keys: "Enter", desc: "Activate focused button" },
];

export default function Help() {
  const { t } = usePreferences();
  const [query, setQuery] = useState("");
  const [openFaq, setOpenFaq] = useState(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "", category: "general" });
  const [contactStatus, setContactStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const searchRef = useRef(null);

  const filteredFaqs = useMemo(() => {
    if (!query.trim()) return FAQ_GROUPS;
    const q = query.toLowerCase();
    return FAQ_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const submitContact = async (e) => {
    e.preventDefault();
    setSending(true);
    setContactStatus(null);
    try {
      const token = tokenStore.get();
      const res = await fetch(`${API_URL}/api/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) {
        setContactStatus("success");
        setContactForm({ name: "", email: "", message: "", category: "general" });
      } else {
        setContactStatus("error");
      }
    } catch {
      setContactStatus("error");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl space-y-8" aria-labelledby="help-title">
      <header>
        <h1 id="help-title" className="text-2xl font-bold">{t("Help & FAQ")}</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">{t("Find answers and learn how to use FactLens")}</p>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search help topics…")}
          aria-label={t("Search help topics")}
          className="input w-full pl-10"
        />
      </div>

      {/* Quick start */}
      <section className="card" aria-labelledby="quickstart-title">
        <h2 id="quickstart-title" className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Quick start")}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: FileText, step: "1", title: t("Paste or upload"), desc: t("Paste text, upload a file, or enter a URL") },
            { icon: Search, step: "2", title: t("Click Analyze"), desc: t("Click the Analyze button to start") },
            { icon: BarChart3, step: "3", title: t("Read results"), desc: t("Review the verdict, confidence, and explanations") },
          ].map((s) => (
            <li key={s.step} className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <s.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{s.title}</span>
              <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{s.desc}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* How to read results */}
      <section className="card" aria-labelledby="readresults-title">
        <h2 id="readresults-title" className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <Eye className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("How to read your result")}
        </h2>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-real" aria-hidden="true" />
            <div><strong>{t("Label")}</strong>: {t("Label desc")}</div>
          </div>
          <div className="flex gap-3">
            <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <strong>{t("Confidence")}</strong>
              <HelpTooltip
                text={t("How certain the model is, expressed as a percentage.")}
                ariaLabel={t("What does confidence mean?")}
              />
              : {t("Confidence desc")}
            </div>
          </div>
          <div className="flex gap-3">
            <Brain className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div><strong>{t("Per-model table")}</strong>: {t("Per-model desc")}</div>
          </div>
          <div className="flex gap-3">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-fake" aria-hidden="true" />
            <div><strong>{t("Word highlights")}</strong>: {t("Word highlights desc help")}</div>
          </div>
          <div className="flex gap-3">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div><strong>{t("Attention heatmap")}</strong>: {t("Attention desc help")}</div>
          </div>
          <div className="flex gap-3">
            <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <strong>{t("SHAP chart")}</strong>
              <HelpTooltip
                text={t("SHapley Additive exPlanations — shows how much each word or feature pushed the prediction.")}
                ariaLabel={t("What is SHAP?")}
              />
              : {t("SHAP desc help")}
            </div>
          </div>
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-uncertain" aria-hidden="true" />
            <div><strong>{t("Low confidence")}</strong>: {t("Low confidence desc")}</div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="card" aria-labelledby="faq-title">
        <h2 id="faq-title" className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <HelpCircle className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Frequently asked questions")}
        </h2>
        {filteredFaqs.length === 0 && (
          <p className="text-sm text-slate-500">{t("No matching questions.")}</p>
        )}
        {filteredFaqs.map((group) => (
          <div key={group.group} className="mb-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t(group.group)}
            </h3>
            <div className="space-y-2">
              {group.items.map((item, idx) => {
                const key = `${group.group}-${idx}`;
                const isOpen = openFaq === key;
                return (
                  <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : key)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-${key}`}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <span>{t(item.q)}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {isOpen && (
                      <div id={`faq-${key}`} className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <p>{t(item.a)}</p>
                        <div className="mt-3">
                          <WasThisHelpful itemId={key} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Glossary */}
      <section className="card" aria-labelledby="glossary-title">
        <h2 id="glossary-title" className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Glossary")}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">{g.term}</dt>
              <dd className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(g.def)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Contact form */}
      <section className="card" aria-labelledby="contact-title">
        <h2 id="contact-title" className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <MessageSquare className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Contact / feedback")}
        </h2>
        {contactStatus === "success" && (
          <p role="status" className="mb-4 rounded-lg bg-real/10 p-3 text-sm text-real">{t("Message sent successfully!")}</p>
        )}
        {contactStatus === "error" && (
          <p role="alert" className="mb-4 rounded-lg bg-fake/10 p-3 text-sm text-fake">{t("Could not send message. Please try again.")}</p>
        )}
        <form onSubmit={submitContact} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-name" className="mb-1 block text-sm font-medium">{t("Name")}</label>
              <input
                id="contact-name"
                type="text"
                value={contactForm.name}
                onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="mb-1 block text-sm font-medium">{t("Email")}</label>
              <input
                id="contact-email"
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                className="input w-full"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="contact-category" className="mb-1 block text-sm font-medium">{t("Category")}</label>
            <select
              id="contact-category"
              value={contactForm.category}
              onChange={(e) => setContactForm((f) => ({ ...f, category: e.target.value }))}
              className="input w-full"
            >
              <option value="general">{t("General")}</option>
              <option value="bug">{t("Bug report")}</option>
              <option value="feature">{t("Feature request")}</option>
              <option value="other">{t("Other")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="contact-message" className="mb-1 block text-sm font-medium">{t("Message")}</label>
            <textarea
              id="contact-message"
              value={contactForm.message}
              onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
              className="input min-h-32 resize-y"
              required
            />
          </div>
          <button type="submit" disabled={sending} className="btn-primary">
            {sending ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {sending ? t("Sending…") : t("Send message")}
          </button>
        </form>
      </section>

      {/* Keyboard shortcuts */}
      <section className="card" aria-labelledby="shortcuts-title">
        <h2 id="shortcuts-title" className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <Keyboard className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Keyboard shortcuts")}
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
              <th className="py-2 pr-2">Keys</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-2"><kbd className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-800">{s.keys}</kbd></td>
                <td className="py-2 text-slate-600 dark:text-slate-300">{t(s.desc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}