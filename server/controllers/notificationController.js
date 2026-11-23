import Notification from "../models/Notification.js";

export const listNotifications = async (req, res) => {
  try {
    const [records, unread] = await Promise.all([
      Notification.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(30),
      Notification.countDocuments({ user: req.user.userId, read: false }),
    ]);
    return res.json({ success: true, data: { records, unread } });
  } catch (error) {
    console.error("Notifications error:", error);
    return res.status(500).json({ success: false, message: "Unable to load notifications" });
  }
};

export const markRead = async (req, res) => {
  const record = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.userId },
    { read: true },
    { returnDocument: "after" }
  );
  if (!record) return res.status(404).json({ success: false, message: "Notification not found" });
  return res.json({ success: true, data: { record } });
};

export const markAllRead = async (req, res) => {
  await Notification.updateMany({ user: req.user.userId, read: false }, { read: true });
  return res.json({ success: true, message: "All notifications marked as read" });
};

export const deleteNotification = async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, user: req.user.userId });
  return res.json({ success: true });
};
