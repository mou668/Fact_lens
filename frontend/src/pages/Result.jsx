// TODO (Frontend teammate): render label badge, model breakdown, highlighted words, SHAP chart.
// Data comes from api.getResult(id) -> see API contract in README.
import { useParams } from "react-router-dom";
import ComingSoon from "../components/ComingSoon.jsx";

export default function Result() {
  const { id } = useParams();
  return <ComingSoon title={`Result #${id}`} description="Verdict, per-model confidence, word highlights and SHAP explanations." owner="Frontend teammate" />;
}
