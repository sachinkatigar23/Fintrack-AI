import Income from "../models/Income.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pick = (body) => {
  const allowed = ["title", "amount", "source", "paymentMethod", "date", "notes"];
  return Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
};

// GET /income?search=&source=&from=&to=
export const getIncomes = async (req, res) => {
  try {
    const { search, source, from, to } = req.query;
    const filter = { user: req.user.userId };

    if (search?.trim()) filter.title = { $regex: escapeRegex(search.trim()), $options: "i" };
    if (source && source !== "all") filter.source = source;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(`${to}T23:59:59.999`);
    }

    const incomes = await Income.find(filter).sort({ date: -1, createdAt: -1 });
    return res.status(200).json({ success: true, data: { incomes } });
  } catch (error) {
    console.error("Get incomes error:", error);
    return res.status(500).json({ success: false, message: "Unable to load incomes" });
  }
};

export const createIncome = async (req, res) => {
  try {
    const income = await Income.create({ ...pick(req.body), user: req.user.userId });
    return res.status(201).json({ success: true, message: "Income added", data: { income } });
  } catch (error) {
    console.error("Create income error:", error);
    return res.status(400).json({ success: false, message: error.message || "Unable to add income" });
  }
};

export const updateIncome = async (req, res) => {
  try {
    const income = await Income.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      pick(req.body),
      { returnDocument: "after", runValidators: true }
    );
    if (!income) return res.status(404).json({ success: false, message: "Income not found" });
    return res.status(200).json({ success: true, message: "Income updated", data: { income } });
  } catch (error) {
    console.error("Update income error:", error);
    return res.status(400).json({ success: false, message: error.message || "Unable to update income" });
  }
};

export const deleteIncome = async (req, res) => {
  try {
    const income = await Income.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
    if (!income) return res.status(404).json({ success: false, message: "Income not found" });
    return res.status(200).json({ success: true, message: "Income deleted" });
  } catch (error) {
    console.error("Delete income error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete income" });
  }
};
