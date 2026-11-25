import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { getStreak } from "../../services/streakService.js";

const router = express.Router();

// GET /streak -> { current, best, status, loggedToday, last7, nextMilestone, daysToNext }
router.get("/", protect, async (req, res) => {
  try {
    const { current, best, status, loggedToday, last7, nextMilestone, daysToNext } = await getStreak(req.user.userId);
    return res.json({ success: true, data: { current, best, status, loggedToday, last7, nextMilestone, daysToNext } });
  } catch (error) {
    console.error("Streak error:", error);
    return res.status(500).json({ success: false, message: "Unable to load your streak" });
  }
});

export default router;
