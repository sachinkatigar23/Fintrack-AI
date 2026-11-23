// ─────────────────────────────────────────────────────────────
// Quick add: turn short English / Hinglish text (typed or spoken) into
// income / expense drafts. PURE function - nothing is saved here.
//   "250 petrol kal upi"            -> expense ₹250, Transport, yesterday, UPI
//   "300 ka khana aur 120 auto"     -> two expenses
//   "salary 35000 mila"             -> income ₹35,000, Salary
// ─────────────────────────────────────────────────────────────

// ───────── Word lists ─────────
const ONES = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twenty: 20, fifty: 50,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  bees: 20, pachaas: 50,
  dedh: 1.5, dhai: 2.5,
};
const HUNDRED = new Set(["hundred", "sau"]);
const THOUSAND = new Set(["thousand", "hazaar", "hazar", "k"]);
const LAKH = new Set(["lakh", "lac"]);
const isNumberWord = (w) => w in ONES || HUNDRED.has(w) || THOUSAND.has(w) || LAKH.has(w);

const INCOME_CUES = new Set(["received", "got", "credited", "salary", "mila", "mile", "aaya", "income", "refund", "cashback", "earned"]);

const PAYMENT_PHRASES = [
  ["google pay", "upi"],
  ["bank transfer", "bankTransfer"],
];
const PAYMENT_WORDS = {
  upi: "upi", gpay: "upi", phonepe: "upi", paytm: "upi", bhim: "upi",
  card: "card", credit: "card", debit: "card",
  cash: "cash", nakad: "cash", nagad: "cash",
  neft: "bankTransfer", imps: "bankTransfer", bank: "bankTransfer", transfer: "bankTransfer",
};

const EXPENSE_KEYWORDS = {
  "Food & Dining": ["chai", "tea", "coffee", "nashta", "khana", "lunch", "dinner", "breakfast", "swiggy", "zomato", "biryani", "pizza", "groceries", "grocery", "sabzi", "doodh", "milk", "kirana", "dmart", "bigbasket", "blinkit", "zepto"],
  Transport: ["petrol", "diesel", "fuel", "uber", "ola", "rapido", "auto", "rickshaw", "bus", "metro", "cab", "toll", "parking"],
  "Bills & Utilities": ["recharge", "bijli", "electricity", "light bill", "wifi", "broadband", "mobile bill", "gas cylinder", "water bill", "dth"],
  Shopping: ["amazon", "flipkart", "myntra", "meesho", "kapde", "clothes", "shoes", "shirt"],
  Entertainment: ["movie", "film", "netflix", "hotstar", "spotify", "pvr", "game"],
  Health: ["dawai", "medicine", "doctor", "hospital", "pharmacy", "gym"],
  Education: ["fees", "book", "kitab", "course", "udemy", "coaching", "exam"],
  Travel: ["train", "flight", "hotel", "irctc", "trip"],
  "Rent & Housing": ["rent", "kiraya", "pg", "hostel"],
};
const INCOME_KEYWORDS = {
  Rental: ["rent received", "kiraya mila"],
  Salary: ["salary"],
  Freelance: ["freelance", "project", "client"],
  Gift: ["gift", "shagun"],
  Investment: ["interest", "dividend"],
  Business: ["business", "dukan", "sale"],
};

const FILLERS = new Set(["paid", "spent", "for", "on", "ka", "ki", "ke", "ko", "liya", "diya", "kharcha", "by", "via", "using", "se", "me", "mein",
  // the same fillers written in Devanagari
  "का", "की", "के", "को", "से", "में", "मे", "लिए", "दिया", "लिया"]);

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};
const WEEKDAYS = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};

// ───────── Helpers ─────────
const DEVANAGARI_DIGITS = "०१२३४५६७८९";
const toAsciiDigits = (s) => s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const shift = (d, days) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const titleCase = (s) => s.replace(/(^|\s)(\p{L})/gu, (m, sp, ch) => sp + ch.toUpperCase());
const validDay = (y, m, d) => {
  const x = new Date(y, m, d);
  return x.getFullYear() === y && x.getMonth() === m && x.getDate() === d ? x : null;
};

// Split on " and ", " aur ", " और ", "," and ";" (commas inside numbers like 1,500 are kept)
export const splitSegments = (text) =>
  toAsciiDigits(String(text || ""))
    .replace(/(\d),(?=\d)/g, "$1")
    .split(/\s+(?:and|aur|और)\s+|[,;]/i)
    .map((s) => s.trim())
    .filter(Boolean);

const TOKEN_RE = /\d+(?:\.\d+)?k\b|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d+(?:\.\d+)?(?:st|nd|rd|th)?|[\p{L}\p{M}]+/gu;

// Find a phrase (one or more words) in the token list; returns the index of its first token or -1
const findPhrase = (tokens, used, phrase) => {
  const words = phrase.split(" ");
  for (let i = 0; i + words.length <= tokens.length; i++) {
    if (words.every((w, j) => tokens[i + j] === w && !used[i + j])) return i;
  }
  return -1;
};

// ───────── Parts of one segment ─────────
const parseDate = (tokens, used, today) => {
  const t0 = startOfDay(today);
  const mark = (...idx) => idx.forEach((i) => (used[i] = true));

  const dby = findPhrase(tokens, used, "day before yesterday");
  if (dby >= 0) {
    mark(dby, dby + 1, dby + 2);
    return shift(t0, -2);
  }

  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    const w = tokens[i];
    if (w === "aaj" || w === "today") {
      mark(i);
      return t0;
    }
    // In money records "kal" always means yesterday - never a future date
    if (w === "kal" || w === "yesterday") {
      mark(i);
      return shift(t0, -1);
    }
    if (w === "parso") {
      mark(i);
      return shift(t0, -2);
    }
    if (w in WEEKDAYS) {
      const isLast = i > 0 && tokens[i - 1] === "last" && !used[i - 1];
      let back = (t0.getDay() - WEEKDAYS[w] + 7) % 7;
      if (back === 0 && isLast) back = 7;
      mark(i);
      if (isLast) mark(i - 1);
      return shift(t0, -back);
    }
    // 12/11 or 12/11/2026 (day/month, Indian style)
    let m = w.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (m) {
      mark(i);
      const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : t0.getFullYear();
      let d = validDay(year, Number(m[2]) - 1, Number(m[1]));
      if (d && !m[3] && d > t0) d = validDay(year - 1, Number(m[2]) - 1, Number(m[1]));
      if (d) return d;
      continue;
    }
    // "12 nov" / "12th nov" / "nov 12"
    const dayNum = (s) => {
      const x = String(s || "").match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
      return x && Number(x[1]) >= 1 && Number(x[1]) <= 31 ? Number(x[1]) : null;
    };
    if (dayNum(w) && tokens[i + 1] in MONTHS && !used[i + 1]) {
      const d = validDay(t0.getFullYear(), MONTHS[tokens[i + 1]], dayNum(w));
      mark(i, i + 1);
      if (d) return d > t0 ? validDay(t0.getFullYear() - 1, d.getMonth(), d.getDate()) || t0 : d;
    }
    if (w in MONTHS && dayNum(tokens[i + 1]) && !used[i + 1]) {
      const d = validDay(t0.getFullYear(), MONTHS[w], dayNum(tokens[i + 1]));
      mark(i, i + 1);
      if (d) return d > t0 ? validDay(t0.getFullYear() - 1, d.getMonth(), d.getDate()) || t0 : d;
    }
    // "12th" alone: that day of this month (last month if it is still ahead)
    m = w.match(/^(\d{1,2})(st|nd|rd|th)$/);
    if (m) {
      mark(i);
      let d = validDay(t0.getFullYear(), t0.getMonth(), Number(m[1]));
      if (d && d > t0) d = validDay(t0.getFullYear(), t0.getMonth() - 1, Number(m[1])) || validDay(shift(t0, -31).getFullYear(), shift(t0, -31).getMonth(), Number(m[1]));
      if (d) return d;
    }
  }
  return null;
};

const parsePayment = (tokens, used) => {
  for (const [phrase, method] of PAYMENT_PHRASES) {
    const i = findPhrase(tokens, used, phrase);
    if (i >= 0) {
      phrase.split(" ").forEach((_, j) => (used[i + j] = true));
      return method;
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    if (!used[i] && tokens[i] in PAYMENT_WORDS) {
      used[i] = true;
      return PAYMENT_WORDS[tokens[i]];
    }
  }
  return null;
};

// Value of a run of number words / numbers: "dedh hazaar" = 1500, "2 lakh" = 200000
const valueOf = (run) => {
  let total = 0;
  let current = 0;
  for (const w of run) {
    if (/^\d/.test(w)) current += parseFloat(w);
    else if (w in ONES) current += ONES[w];
    else if (HUNDRED.has(w)) current = (current || 1) * 100;
    else if (THOUSAND.has(w)) {
      total += (current || 1) * 1000;
      current = 0;
    } else if (LAKH.has(w)) {
      total += (current || 1) * 100000;
      current = 0;
    }
  }
  return Math.round((total + current) * 100) / 100;
};

const parseAmount = (tokens, used) => {
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    const w = tokens[i];
    const numeric = /^\d+(?:\.\d+)?k?$/.test(w);
    // a multiplier word on its own ("k", "sau") only counts after a number
    if (!numeric && !(w in ONES)) continue;

    const run = [];
    let j = i;
    if (numeric) {
      run.push(w.endsWith("k") ? w.slice(0, -1) : w);
      if (w.endsWith("k")) run.push("k");
      used[j] = true;
      j += 1;
    }
    while (j < tokens.length && !used[j] && isNumberWord(tokens[j])) {
      run.push(tokens[j]);
      used[j] = true;
      j += 1;
    }
    const value = valueOf(run);
    if (value > 0) return value;
  }
  return null;
};

// Earliest keyword (single or multi word) from a { name: [keywords] } map
const findKeyword = (tokens, used, map) => {
  let best = null;
  for (const [name, words] of Object.entries(map)) {
    for (const kw of words) {
      const i = findPhrase(tokens, used, kw);
      if (i >= 0 && (!best || i < best.index || (i === best.index && kw.length > best.keyword.length))) {
        best = { name, keyword: kw, index: i };
      }
    }
  }
  if (best) best.keyword.split(" ").forEach((_, j) => (used[best.index + j] = true));
  return best;
};

// ───────── Main ─────────
export const parseSegment = (segment, today = new Date()) => {
  const text = toAsciiDigits(segment)
    .toLowerCase()
    .replace(/₹/g, " ")
    .replace(/\b(?:rs\.?|rupees|rupaye|rupaya|inr)(?=\s|\d|$)/g, " ");
  const tokens = text.match(TOKEN_RE) || [];
  const used = tokens.map(() => false);

  const parsedDate = parseDate(tokens, used, today);
  const paymentMethod = parsePayment(tokens, used);
  const amount = parseAmount(tokens, used);

  const isIncome = tokens.some((w, i) => INCOME_CUES.has(w) && !used[i]) || findPhrase(tokens, used, "rent received") >= 0;
  const type = isIncome ? "income" : "expense";
  const match = findKeyword(tokens, used, isIncome ? INCOME_KEYWORDS : EXPENSE_KEYWORDS);
  // cue words are not part of the title
  tokens.forEach((w, i) => INCOME_CUES.has(w) && (used[i] = true));

  let title = match ? titleCase(match.keyword) : "";
  if (!title) {
    const rest = tokens.filter((w, i) => !used[i] && !FILLERS.has(w) && !/^\d/.test(w) && !isNumberWord(w));
    title = titleCase(rest.join(" ")).slice(0, 40).trim();
  }
  const titleGuessed = !title;
  if (!title) title = isIncome ? "Quick income" : "Quick expense";

  // Never a future date
  const t0 = startOfDay(today);
  const date = parsedDate && parsedDate <= t0 ? parsedDate : t0;

  const missing = [];
  if (!amount) missing.push("amount");
  if (!match) missing.push(isIncome ? "source" : "category");
  if (titleGuessed) missing.push("title");

  const item = {
    type,
    title,
    amount: amount || null,
    paymentMethod: paymentMethod || (isIncome ? "bankTransfer" : "upi"),
    date: iso(date),
    confidence: amount && match ? "high" : amount ? "medium" : "low",
    missing,
    text: segment.trim(),
  };
  if (isIncome) item.source = match ? match.name : null;
  else item.category = match ? match.name : null;
  return item;
};

export const parseQuickAdd = (text, today = new Date()) => ({
  items: splitSegments(text).map((segment) => parseSegment(segment, today)),
});

export const hasDevanagariLetters = (text) => /[ऀ-ॣ॰-ॿ]/.test(String(text || ""));

// ───────── AI fill-in (pure merge) ─────────
// The AI result is cleaned like the receipt scan, and only fields the rules
// could not find are taken from it. Returns { items, filled } (filled = number of fields taken from AI).
export const mergeAIItems = (ruleItems, aiItems, { today = new Date(), categories = [], sources = [], paymentMethods = [] } = {}) => {
  const t0 = iso(startOfDay(today));
  const pickName = (value, list) => {
    const v = String(value ?? "").trim().toLowerCase();
    return v ? list.find((x) => x.toLowerCase() === v) || null : null;
  };
  const cleanAmount = (value) => {
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
    const m = toAsciiDigits(String(value ?? "")).replace(/₹|\brs\.?|\binr\b|,|\s/gi, "").match(/\d+(?:\.\d+)?/);
    const n = m ? Number(m[0]) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  };
  const cleanDate = (value) => {
    const v = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const [y, m, d] = v.split("-").map(Number);
    return validDay(y, m - 1, d) && v <= t0 ? v : null; // never a future date
  };

  let filled = 0;
  const items = ruleItems.map((item, i) => {
    const ai = Array.isArray(aiItems) ? aiItems[i] : null;
    if (!ai || typeof ai !== "object") return item;
    const out = { ...item };

    // The AI may correct the type only when the text had no income cue the rules understood
    const aiType = ai.type === "income" || ai.type === "expense" ? ai.type : null;
    if (aiType && aiType !== out.type && out.missing.includes(out.type === "income" ? "source" : "category")) {
      out.type = aiType;
      if (aiType === "income") {
        delete out.category;
        out.source = null;
        out.paymentMethod = out.paymentMethod === "upi" ? "bankTransfer" : out.paymentMethod;
      } else {
        delete out.source;
        out.category = null;
      }
      out.missing = out.missing.filter((m) => m !== "category" && m !== "source").concat(aiType === "income" ? "source" : "category");
      filled += 1;
    }

    if (out.missing.includes("amount")) {
      const amount = cleanAmount(ai.amount);
      if (amount) {
        out.amount = amount;
        filled += 1;
      }
    }
    if (out.type === "expense" && out.missing.includes("category")) {
      const category = pickName(ai.category, categories);
      if (category) {
        out.category = category;
        filled += 1;
      }
    }
    if (out.type === "income" && out.missing.includes("source")) {
      const source = pickName(ai.source ?? ai.category, sources);
      if (source) {
        out.source = source;
        filled += 1;
      }
    }
    if (out.missing.includes("title")) {
      const title = String(ai.title ?? "").replace(/[<>]/g, "").trim().slice(0, 40);
      if (title) {
        out.title = title;
        filled += 1;
      }
    }
    // Date: only when the rules fell back to today and the AI read an earlier one
    const aiDate = cleanDate(ai.date);
    if (aiDate && out.date === t0 && aiDate !== t0) {
      out.date = aiDate;
      filled += 1;
    }
    const aiPay = pickName(ai.paymentMethod, paymentMethods);
    if (aiPay && !item.text.match(/upi|gpay|phonepe|paytm|bhim|card|credit|debit|cash|nakad|nagad|neft|imps|bank|transfer/i) && aiPay !== out.paymentMethod) {
      out.paymentMethod = aiPay;
      filled += 1;
    }

    out.missing = [
      ...(out.amount ? [] : ["amount"]),
      ...((out.type === "income" ? out.source : out.category) ? [] : [out.type === "income" ? "source" : "category"]),
      ...(out.missing.includes("title") && out.title === item.title ? ["title"] : []),
    ];
    const known = out.type === "income" ? out.source : out.category;
    out.confidence = out.amount && known ? "high" : out.amount ? "medium" : "low";
    return out;
  });
  return { items, filled };
};
