import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Link2, Loader2, Mic, Upload, X } from "lucide-react";
import { api } from "../api/client.js";
import { translateMessage, usePreferences } from "../context/PreferencesContext.jsx";

const TABS = [
  { id: "text", key: "Paste text", icon: FileText },
  { id: "file", key: "Upload file", icon: Upload },
  { id: "url", key: "Analyze URL", icon: Link2 },
  { id: "image", key: "Upload Image", icon: Upload },
];
const STEPS = ["Preprocessing", "Feature extraction", "Model prediction", "Explanation"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export default function Analyze() {
  const navigate = useNavigate();
  const { t, speechLocale } = usePreferences();
  const [tab, setTab] = useState("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [image, setImage] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [listening, setListening] = useState(false);
  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!busy) return undefined;
    const timer = window.setInterval(() => setStep((current) => Math.min(current + 1, STEPS.length - 1)), 1800);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
  }, []);

  const selectFile = (selected) => {
    setError("");
    const next = selected?.[0];
    if (!next) return;
    if (!/\.(txt|pdf|docx)$/i.test(next.name)) {
      setError(t("Choose a .txt, .pdf, or .docx file."));
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setError(t("Files must be 5 MB or smaller."));
      return;
    }
    setFile(next);
  };

  const selectImage = async (selected) => {
    setError("");
    setExtractedText("");
    const next = selected?.[0];
    if (!next) return;
    if (!/^image\/(png|jpeg)$/i.test(next.type)) {
      setError(t("Choose a PNG or JPG image."));
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setError(t("Images must be 5 MB or smaller."));
      return;
    }
    setImage(next);
    setBusy(true);
    try {
      const result = await api.extractImageText(next);
      setExtractedText(result.text);
    } catch (err) {
      setError(translateMessage(err.message || "Text extraction failed.", t));
    } finally {
      setBusy(false);
    }
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(t("Voice input is not supported in this browser."));
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = speechLocale;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      setText(transcript);
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(`${t("Voice input failed")}: ${event.error}`);
      }
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    try {
      recognitionRef.current = recognition;
      recognition.start();
      setError("");
      setListening(true);
    } catch (err) {
      setError(translateMessage(err.message || "Voice input could not be started.", t));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    let task;
    if (tab === "text") {
      if (text.trim().length < 10) {
        setError(t("Enter at least 10 characters to analyze."));
        return;
      }
      task = () => api.analyze(text.trim());
    } else if (tab === "file") {
      if (!file) {
        setError(t("Choose a .txt, .pdf, or .docx file."));
        return;
      }
      task = () => api.analyzeFile(file);
    } else if (tab === "image") {
      if (!image) {
        setError(t("Choose a PNG or JPG image."));
        return;
      }
      if (extractedText.trim().length < 10) {
        setError(t("Extracted text must contain at least 10 characters."));
        return;
      }
      task = () => api.analyze(extractedText.trim());
    } else {
      let parsed;
      try {
        parsed = new URL(url.trim());
      } catch {
        setError(t("Enter a URL beginning with http:// or https://."));
        return;
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setError(t("Enter a URL beginning with http:// or https://."));
        return;
      }
      task = () => api.analyzeUrl(parsed.href);
    }

    setBusy(true);
    setStep(0);
    try {
      const result = await task();
      navigate(`/result/${result.id}`);
    } catch (err) {
      setError(translateMessage(err.message || "Analysis failed.", t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6" aria-labelledby="analyze-title">
      <header>
        <h1 id="analyze-title" className="text-2xl font-bold">{t("Analyze an article")}</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">{t("Choose how to provide the story")}</p>
      </header>

      <div className="card">
        <div role="tablist" aria-label={t("Choose how to provide the story")} className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
          {TABS.map(({ id, key, icon: Icon }) => (
            <button
              key={id}
              id={`${id}-tab`}
              role="tab"
              aria-selected={tab === id}
              aria-controls={`${id}-panel`}
              onClick={() => { setTab(id); setError(""); }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === id ? "bg-primary text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" /> {t(key)}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          <div id={`${tab}-panel`} role="tabpanel" aria-labelledby={`${tab}-tab`}>
            {tab === "text" && (
              <div>
                <label htmlFor="article-text" className="mb-2 block text-sm font-medium">{t("Paste an article or claim")}</label>
                <textarea
                  id="article-text"
                  className="input min-h-56 resize-y"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={20000}
                  placeholder={t("Paste an article or claim")}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">{text.length.toLocaleString()} / 20,000</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={toggleVoice} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-primary hover:bg-primary/10" aria-label={t(listening ? "Stop voice input" : "Start voice input")}>
                      <Mic className="h-4 w-4" aria-hidden="true" /> {t(listening ? "Stop voice input" : "Start voice input")}
                    </button>
                    <button type="button" onClick={() => setText("")} disabled={!text} className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">
                      {t("Clear")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "file" && (
              <div>
                <label htmlFor="article-file" className="mb-2 block text-sm font-medium">{t("Supported files: .txt, .pdf, .docx (max 5 MB)")}</label>
                <input
                  ref={fileRef}
                  id="article-file"
                  type="file"
                  accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => selectFile(event.target.files)}
                  className="sr-only"
                />
                <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                  <Upload className="mx-auto mb-3 h-8 w-8 text-primary" aria-hidden="true" />
                  <button type="button" onClick={() => fileRef.current?.click()} className="font-medium text-primary hover:underline">
                    {file ? t("File selected") : t("Upload file")}
                  </button>
                  {file && (
                    <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                      <span className="max-w-[70%] truncate">{file.name}</span>
                      <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label={t("Clear")} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {!file && <p className="mt-2 text-sm text-slate-500">{t("Supported files: .txt, .pdf, .docx (max 5 MB)")}</p>}
                </div>
              </div>
            )}

            {tab === "image" && (
              <div>
                <label htmlFor="article-image" className="mb-2 block text-sm font-medium">{t("Screenshot or scanned article image (PNG/JPG, max 5 MB)")}</label>
                <input
                  ref={imageRef}
                  id="article-image"
                  type="file"
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  onChange={(event) => selectImage(event.target.files)}
                  className="sr-only"
                />
                <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
                  <Upload className="mx-auto mb-3 h-8 w-8 text-primary" aria-hidden="true" />
                  <button type="button" onClick={() => imageRef.current?.click()} className="font-medium text-primary hover:underline">
                    {image ? t("Image selected") : t("Upload Image")}
                  </button>
                  {image && (
                    <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                      <span className="max-w-[70%] truncate">{image.name}</span>
                      <button type="button" onClick={() => { setImage(null); setExtractedText(""); if (imageRef.current) imageRef.current.value = ""; }} aria-label={t("Clear")} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                {(busy || extractedText) && (
                  <div className="mt-4">
                    <label htmlFor="extracted-text" className="mb-2 block text-sm font-medium">{t("Extracted text — review and correct before analysis")}</label>
                    <textarea
                      id="extracted-text"
                      className="input min-h-44 resize-y"
                      value={extractedText}
                      onChange={(event) => setExtractedText(event.target.value)}
                      maxLength={20000}
                      disabled={busy}
                      placeholder={busy ? t("Extracting text…") : t("Extracted text appears here")}
                    />
                    <p className="mt-1 text-xs text-slate-500">{extractedText.length.toLocaleString()} / 20,000</p>
                  </div>
                )}
              </div>
            )}

            {tab === "url" && (
              <div>
                <label htmlFor="article-url" className="mb-2 block text-sm font-medium">{t("Enter article URL")}</label>
                <input
                  id="article-url"
                  type="url"
                  className="input"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/news/article"
                  maxLength={2048}
                />
                <p className="mt-2 text-xs text-slate-500">{t("Only public article pages are fetched. Publisher reputation is not independently verified.")}</p>
              </div>
            )}
          </div>

          {error && <p role="alert" className="mt-4 rounded-lg bg-fake/10 p-3 text-sm text-fake">{error}</p>}

          {busy && (
            <div className="mt-5">
              <p className="mb-2 text-xs text-slate-500">{t("Progress indicators are approximate while the model processes your article.")}</p>
              <ol aria-label="Analysis progress" aria-live="polite" className="grid gap-2 sm:grid-cols-4">
                {STEPS.map((item, index) => (
                  <li key={item} className={`rounded-lg border p-3 text-sm ${index < step ? "border-real/40 bg-real/10 text-real" : index === step ? "border-primary/40 bg-primary/10 text-primary" : "border-slate-200 text-slate-400 dark:border-slate-700"}`}>
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-current/10 text-xs">{index < step ? "✓" : index + 1}</span>
                    {t(item)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button className="btn-primary" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy ? t("Analyzing…") : t("Analyze story")}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
