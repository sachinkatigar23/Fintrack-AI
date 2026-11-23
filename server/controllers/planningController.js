import { getSafeToSpend, checkAffordability, fallbackTip } from "../services/planningService.js";
import { explainOrFallback } from "../services/aiService.js";

// GET /planning/safe-to-spend
export const safeToSpend = async (req, res) => {
  try {
    const data = await getSafeToSpend(req.user.userId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Safe to spend error:", error);
    return res.status(500).json({ success: false, message: "Unable to calculate safe to spend" });
  }
};

// POST /planning/afford  { title, amount, category? } - nothing is saved
export const afford = async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const amount = Number(req.body.amount);
    const category = req.body.category || null;
    const { sts, result, currency } = await checkAffordability(req.user.userId, { amount, category });

    // The AI only adds one sentence of advice; the verdict and numbers never change
    const ai = await explainOrFallback(
      `The user asks whether they can afford "${title}". The verdict is already decided: "${result.verdict}" ("${result.headline}").
The user already sees that headline, so do NOT repeat it and do NOT write any amounts, percentages or dates.
Give ONE short, practical piece of advice (max 25 words) that fits the verdict, e.g. how to plan, wait or save for it.
Return JSON: {"tip": "one sentence"}`,
      {
        currency,
        item: title,
        price: result.numbers.amount,
        verdict: result.verdict,
        headline: result.headline,
        warnings: result.warnings,
        leftToday: sts.leftToday,
        spendableUntilPayday: sts.spendable,
        daysLeft: sts.daysLeft,
        status: sts.status,
      },
      { tip: fallbackTip(result.verdict) }
    );
    // A tip with figures could contradict the calculated numbers: use the rule-based one instead
    const aiTip = typeof ai.tip === "string" ? ai.tip.trim() : "";
    const tip = aiTip && !/\d/.test(aiTip) ? aiTip.slice(0, 240) : fallbackTip(result.verdict);

    return res.json({
      success: true,
      data: { title, ...result, tip, aiGenerated: Boolean(ai.aiGenerated) && tip === aiTip.slice(0, 240), aiNote: ai.aiNote },
    });
  } catch (error) {
    console.error("Afford check error:", error);
    return res.status(500).json({ success: false, message: "Unable to check this purchase" });
  }
};
