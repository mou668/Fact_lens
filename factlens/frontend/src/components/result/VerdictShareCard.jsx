import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { translateMessage, usePreferences } from "../../context/PreferencesContext.jsx";

function createCard(data, labels) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create a share card.");
  context.fillStyle = "#0f172a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#2563eb";
  context.fillRect(0, 0, 16, canvas.height);
  context.fillStyle = "#ffffff";
  context.font = "700 30px sans-serif";
  context.fillText("FactLens", 72, 94);
  context.fillStyle = data.label === "FAKE" ? "#f87171" : data.label === "REAL" ? "#4ade80" : "#fbbf24";
  context.font = "700 72px sans-serif";
  context.fillText(data.label, 72, 230);
  context.fillStyle = "#e2e8f0";
  context.font = "400 32px sans-serif";
  const summary = labels.summary;
  context.fillText(summary, 72, 300, 1030);
  context.fillStyle = "#94a3b8";
  context.font = "400 26px sans-serif";
  context.fillText(`${labels.confidence}: ${(data.confidence * 100).toFixed(1)}%`, 72, 370);
  if (data.source_domain) context.fillText(data.source_domain, 72, 425);
  context.fillStyle = "#64748b";
  context.font = "400 20px sans-serif";
  context.fillText(labels.disclaimer, 72, 565);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create the share card image."));
    }, "image/png");
  });
}

export default function VerdictShareCard({ data }) {
  const { t } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const share = async () => {
    setBusy(true);
    setError("");
    try {
      const blob = await createCard(data, {
        summary: t(`Summary ${data.label}`),
        confidence: t("Confidence"),
        disclaimer: t("AI-assisted assessment · verify important claims independently"),
      });
      const file = new File([blob], `factlens-verdict-${data.id}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "FactLens verdict", files: [file] });
      } else {
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(href);
      }
    } catch (err) {
      if (err.name !== "AbortError") setError(translateMessage(err.message || "Could not share the verdict card.", t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={share} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">
        {navigator.share ? <Share2 className="h-4 w-4" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
        {t(navigator.share ? "Share verdict card" : "Download verdict card")}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-fake">{error}</p>}
    </div>
  );
}
