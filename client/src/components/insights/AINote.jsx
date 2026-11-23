import { Info, Sparkles } from "../common/icons.js";

// Small line under AI answers: says whether the text came from the AI or from the rule-based fallback
export default function AINote({ data }) {
  if (!data) return null;
  if (data.aiGenerated) {
    return (
      <div className="ai-note">
        <Sparkles /> Explained by AI using figures calculated from your records.
      </div>
    );
  }
  if (data.aiNote) {
    return (
      <div className="ai-note">
        <Info /> {data.aiNote}
      </div>
    );
  }
  return null;
}
