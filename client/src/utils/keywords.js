// Keyword dictionary for quick add and "smart category" (English, Hinglish, Hindi).
// Mirrors server/utils/keywords.js - change both together.
export const EXPENSE_KEYWORDS = {
  "Food & Dining": [
    "chai", "tea", "coffee", "nashta", "khana", "lunch", "dinner", "breakfast", "swiggy", "zomato", "biryani", "pizza",
    "groceries", "grocery", "sabzi", "doodh", "milk", "kirana", "dmart", "bigbasket", "blinkit", "zepto",
    "चाय", "दूध", "खाना", "नाश्ता", "सब्जी", "सब्ज़ी", "किराना",
  ],
  Transport: [
    "petrol", "diesel", "fuel", "uber", "ola", "rapido", "auto", "rickshaw", "bus", "metro", "cab", "toll", "parking",
    "पेट्रोल", "ऑटो", "बस", "मेट्रो",
  ],
  "Bills & Utilities": [
    "recharge", "bijli", "electricity", "light bill", "wifi", "broadband", "mobile bill", "gas cylinder", "water bill", "dth",
    "रिचार्ज", "बिजली",
  ],
  Shopping: ["amazon", "flipkart", "myntra", "meesho", "kapde", "clothes", "shoes", "shirt", "कपड़े", "कपडे"],
  Entertainment: ["movie", "film", "netflix", "hotstar", "spotify", "pvr", "game", "फिल्म"],
  Health: ["dawai", "medicine", "doctor", "hospital", "pharmacy", "gym", "दवाई", "दवा", "डॉक्टर"],
  Education: ["fees", "book", "kitab", "course", "udemy", "coaching", "exam", "फीस", "किताब"],
  Travel: ["train", "flight", "hotel", "irctc", "trip", "ट्रेन"],
  "Rent & Housing": ["rent", "kiraya", "pg", "hostel", "किराया"],
};

export const INCOME_KEYWORDS = {
  Rental: ["rent received", "kiraya mila", "rent from tenant", "किराया मिला", "rent", "kiraya", "किराया"],
  Salary: ["salary", "bonus", "सैलरी", "तनख्वाह"],
  Freelance: ["freelance", "project", "client"],
  Gift: ["gift", "shagun", "pocket money", "शगुन"],
  Investment: ["interest", "dividend", "fd"],
  Business: ["business", "dukan", "sale"],
  Other: ["cashback", "refund"],
};

// Guess the category (expense) or source (income) from a title, e.g. "Electricity bill" -> "Bills & Utilities".
// Returns null when no keyword matches. The earliest keyword in the title wins (longer phrase on a tie).
export const guessClassification = (title, type = "expense") => {
  const words = String(title || "")
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
  if (!words.length) return null;
  const dict = type === "income" ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;
  let best = null;
  for (const [name, list] of Object.entries(dict)) {
    for (const kw of list) {
      const parts = kw.normalize("NFC").split(" ");
      for (let i = 0; i + parts.length <= words.length; i++) {
        if (parts.every((p, j) => words[i + j] === p)) {
          if (!best || i < best.index || (i === best.index && kw.length > best.kw.length)) best = { name, kw, index: i };
          break;
        }
      }
    }
  }
  return best ? best.name : null;
};
