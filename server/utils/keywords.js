// Keyword dictionary for quick add and "smart category" (English, Hinglish, Hindi).
// The client keeps the same lists in client/src/utils/keywords.js - change both together.

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
  Rental: ["rent received", "kiraya mila", "rent from tenant", "किराया मिला"],
  Salary: ["salary", "bonus", "सैलरी", "तनख्वाह"],
  Freelance: ["freelance", "project", "client"],
  Gift: ["gift", "shagun", "pocket money", "शगुन"],
  Investment: ["interest", "dividend", "fd"],
  Business: ["business", "dukan", "sale"],
  Other: ["cashback", "refund"],
};
