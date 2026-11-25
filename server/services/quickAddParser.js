// ─────────────────────────────────────────────────────────────
// Quick add: turn short English / Hinglish / Hindi text (typed or spoken) into
// income / expense drafts. PURE function - nothing is saved here.
//   "250 petrol kal upi"            -> expense ₹250, Transport, yesterday, UPI
//   "300 ka khana aur 120 auto"     -> two expenses
//   "salary 35000 mila"             -> income ₹35,000, Salary
//   "कल दो सौ चाय"                  -> expense ₹200, Food & Dining, yesterday
// Every item has date (YYYY-MM-DD), dateText and dateSource ("spoken" | "default").
// The date is never in the future.
// ─────────────────────────────────────────────────────────────
import { EXPENSE_KEYWORDS, INCOME_KEYWORDS } from "../utils/keywords.js";

// Devanagari words can be written with a combined or a separate nukta (ज़ / ज़): compare in one form
const norm = (s) => String(s).normalize("NFC");
const normKeys = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [norm(k), v]));
const normSet = (list) => new Set(list.map(norm));

// ───────── Word lists ─────────
const ONES = normKeys({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twenty: 20, fifty: 50,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  bees: 20, pachaas: 50,
  dedh: 1.5, dhai: 2.5,
  // Hindi (Devanagari)
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "पांच": 5, "छह": 6, "छः": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
  "बीस": 20, "पचास": 50, "डेढ़": 1.5, "ढाई": 2.5,
});
const HUNDRED = normSet(["hundred", "sau", "सौ"]);
const THOUSAND = normSet(["thousand", "hazaar", "hazar", "k", "हज़ार", "हजार"]);
const LAKH = normSet(["lakh", "lac", "लाख"]);
const isNumberWord = (w) => w in ONES || HUNDRED.has(w) || THOUSAND.has(w) || LAKH.has(w);

const INCOME_CUES = normSet([
  "received", "got", "credited", "salary", "mila", "mili", "mile", "aaya", "income", "refund", "cashback", "earned",
  "मिला", "मिली", "मिले", "आया", "सैलरी",
]);

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

// keyword lists in the same Unicode form as the text
const normDict = (dict) => Object.fromEntries(Object.entries(dict).map(([name, words]) => [name, words.map(norm)]));
const EXPENSE_DICT = normDict(EXPENSE_KEYWORDS);
const INCOME_DICT = normDict(INCOME_KEYWORDS);

const FILLERS = normSet([
  "paid", "spent", "for", "on", "ka", "ki", "ke", "ko", "liya", "diya", "kharcha", "by", "via", "using", "se", "me", "mein",
  // the same fillers written in Devanagari
  "का", "की", "के", "को", "से", "में", "मे", "लिए", "दिया", "लिया",
]);

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};
const WEEKDAYS = normKeys({
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
  // Hinglish
  somvar: 1, somvaar: 1, somwar: 1, mangalvar: 2, mangalwar: 2, budhvar: 3, budhwar: 3,
  guruvar: 4, guruwar: 4, brihaspativar: 4, shukravar: 5, shukrawar: 5, shanivar: 6, shaniwar: 6,
  ravivar: 0, raviwar: 0, itvaar: 0, itwar: 0, itvar: 0,
  // Hindi
  "सोमवार": 1, "मंगलवार": 2, "बुधवार": 3, "गुरुवार": 4, "बृहस्पतिवार": 4, "शुक्रवार": 5, "शनिवार": 6, "रविवार": 0, "इतवार": 0,
});

const TODAY_WORDS = normSet(["today", "aaj", "आज"]);
const YESTERDAY_WORDS = normSet(["yesterday", "kal", "कल"]);
const DBY_WORDS = normSet(["parso", "parson", "parsoon", "परसों", "परसो"]);
const LAST_WORDS = normSet(["last", "pichle", "pichhle", "pichla", "pichhla", "पिछले", "पिछला"]);
const WEEK_WORDS = normSet(["week", "hafte", "hafta", "हफ्ते", "हफ़्ते", "हफ्ता"]);
const DAY_WORDS = normSet(["days", "day", "din", "दिन"]);
const AGO_WORDS = normSet(["ago", "pehle", "pahle", "pehele", "पहले"]);
const DATE_WORDS = normSet(["tarikh", "tareekh", "tarik", "तारीख", "तारीख़"]);
// Words that make a date clearly future ("tomorrow", "agle hafte", "kal dena hai")
const FUTURE_WORDS = normSet(["tomorrow", "agle", "agla", "agli", "next", "अगले", "अगला", "अगली"]);
const FUTURE_VERBS = normSet([
  "dena", "dunga", "dungi", "karunga", "karungi", "karna", "hoga", "hogi", "jayega", "aayega", "bharna",
  "देना", "दूंगा", "दूँगा", "करूंगा", "करना", "होगा", "भरना",
]);

export const FUTURE_WARNING = "Future dates can't be added – use Bills for upcoming payments.";

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
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// What was understood, e.g. "yesterday (24 Nov)", "3 days ago (Sun, 22 Nov)", "12 Oct 2025"
export const describeDate = (date, today = new Date()) => {
  const t0 = startOfDay(today);
  const d = startOfDay(date);
  const diff = Math.round((t0 - d) / 86400000);
  const dm = `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  if (diff === 0) return `today (${dm})`;
  if (diff === 1) return `yesterday (${dm})`;
  if (diff > 1 && diff < 7) return `${diff} days ago (${SHORT_DAYS[d.getDay()]}, ${dm})`;
  return d.getFullYear() === t0.getFullYear() ? dm : `${dm} ${d.getFullYear()}`;
};

// Split on " and ", " aur ", " और ", "," and ";" (commas inside numbers like 1,500 are kept)
export const splitSegments = (text) =>
  toAsciiDigits(norm(text || ""))
    .replace(/(\d),(?=\d)/g, "$1")
    .split(/\s+(?:and|aur|और)\s+|[,;]/i)
    .map((s) => s.trim())
    .filter(Boolean);

const TOKEN_RE = /\d+(?:\.\d+)?k\b|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d+(?:\.\d+)?(?:st|nd|rd|th)?|[\p{L}\p{M}]+/gu;

// Find a phrase (one or more words) in the token list; returns the index of its first token or -1
const findPhrase = (tokens, used, phrase) => {
  const words = phrase.split(" ");
  for (let i = 0; i + words.length <= tokens.length; i++) {
    if (words.every((w, j) => tokens[i + j] === w && !used[i + j])) return i;
  }
  return -1;
};

// A small count: digits or one number word ("do", "दो", "three")
const countOf = (w) => {
  if (/^\d{1,3}$/.test(w || "")) return Number(w);
  return w in ONES && Number.isInteger(ONES[w]) ? ONES[w] : null;
};

const dayNum = (s) => {
  const x = String(s || "").match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
  return x && Number(x[1]) >= 1 && Number(x[1]) <= 31 ? Number(x[1]) : null;
};

// Day of this month; last month's when this month's is still ahead (or doesn't exist)
const dayOfMonth = (t0, day) => {
  const d = validDay(t0.getFullYear(), t0.getMonth(), day);
  if (d && d <= t0) return d;
  const prev = shift(new Date(t0.getFullYear(), t0.getMonth(), 1), -1);
  return validDay(prev.getFullYear(), prev.getMonth(), day) || t0;
};

// Day and month without a year: this year, or last year when it is still ahead
const dayMonth = (t0, month, day) => {
  const d = validDay(t0.getFullYear(), month, day);
  if (!d) return null;
  return d <= t0 ? d : validDay(t0.getFullYear() - 1, month, day);
};

// ───────── Parts of one segment ─────────
// Returns { date, future } or null. Marks the date words as used (so they leave the title).
const parseDate = (tokens, used, today) => {
  const t0 = startOfDay(today);
  const mark = (...idx) => idx.forEach((i) => (used[i] = true));
  const futureVerb = tokens.some((w) => FUTURE_VERBS.has(w));

  // "day before yesterday"
  const dby = findPhrase(tokens, used, "day before yesterday");
  if (dby >= 0) {
    mark(dby, dby + 1, dby + 2);
    return { date: shift(t0, -2) };
  }

  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    const w = tokens[i];
    const next = tokens[i + 1];

    // Clearly future: tomorrow, agle hafte, next monday
    if (FUTURE_WORDS.has(w)) {
      mark(i);
      if (next && (WEEK_WORDS.has(next) || next in WEEKDAYS || next in MONTHS)) mark(i + 1);
      return { date: t0, future: true };
    }
    if (TODAY_WORDS.has(w)) {
      mark(i);
      return { date: t0 };
    }
    // "kal" means yesterday for something already paid - unless the sentence is clearly about the future
    if (YESTERDAY_WORDS.has(w)) {
      mark(i);
      if (futureVerb && w !== "yesterday") return { date: t0, future: true };
      return { date: shift(t0, -1) };
    }
    if (DBY_WORDS.has(w)) {
      mark(i);
      return { date: shift(t0, -2) };
    }
    // "N days ago", "N din pehle", "N दिन पहले"
    const n = countOf(w);
    if (n !== null && DAY_WORDS.has(next || "") && AGO_WORDS.has(tokens[i + 2] || "")) {
      mark(i, i + 1, i + 2);
      return { date: shift(t0, -n) };
    }
    // "last week", "pichle hafte"
    if (LAST_WORDS.has(w) && WEEK_WORDS.has(next || "")) {
      mark(i, i + 1);
      return { date: shift(t0, -7) };
    }
    // "last monday" = the Monday of the previous week (weeks start on Monday)
    if (LAST_WORDS.has(w) && next in WEEKDAYS) {
      mark(i, i + 1);
      const monday = shift(t0, -((t0.getDay() + 6) % 7));
      return { date: shift(monday, ((WEEKDAYS[next] + 6) % 7) - 7) };
    }
    // "monday" = the most recent one (today if it is that day)
    if (w in WEEKDAYS) {
      mark(i);
      return { date: shift(t0, -((t0.getDay() - WEEKDAYS[w] + 7) % 7)) };
    }
    // 12/11, 12-11, 12/11/2026 (day/month, Indian style)
    let m = w.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]) - 1;
      if (m[3]) {
        const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
        const d = validDay(year, month, day);
        if (d) {
          mark(i);
          return d > t0 ? { date: t0, future: true } : { date: d };
        }
      } else {
        const d = dayMonth(t0, month, day);
        if (d) {
          mark(i);
          return { date: d };
        }
      }
      continue;
    }
    // "12 nov", "12th november", "nov 12"
    if (dayNum(w) && next in MONTHS && !used[i + 1]) {
      const d = dayMonth(t0, MONTHS[next], dayNum(w));
      if (d) {
        mark(i, i + 1);
        return { date: d };
      }
    }
    if (w in MONTHS && dayNum(next) && !used[i + 1]) {
      const d = dayMonth(t0, MONTHS[w], dayNum(next));
      if (d) {
        mark(i, i + 1);
        return { date: d };
      }
    }
    // "5 tarikh", "५ तारीख"
    if (dayNum(w) && DATE_WORDS.has(next || "")) {
      mark(i, i + 1);
      return { date: dayOfMonth(t0, dayNum(w)) };
    }
    // "5th" / "on 5th"
    m = w.match(/^(\d{1,2})(st|nd|rd|th)$/);
    if (m && dayNum(w)) {
      mark(i);
      if (i > 0 && tokens[i - 1] === "on") mark(i - 1);
      return { date: dayOfMonth(t0, dayNum(w)) };
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

// Value of a run of number words / numbers: "dedh hazaar" = 1500, "2 lakh" = 200000, "दो सौ" = 200
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
  const text = toAsciiDigits(norm(segment))
    .toLowerCase()
    .replace(/₹/g, " ")
    .replace(/\b(?:rs\.?|rupees|rupaye|rupaya|inr)(?=\s|\d|$)/g, " ");
  const tokens = text.match(TOKEN_RE) || [];
  const used = tokens.map(() => false);

  const parsed = parseDate(tokens, used, today);
  const paymentMethod = parsePayment(tokens, used);
  const amount = parseAmount(tokens, used);

  const rentReceived = findPhrase(tokens, used, "rent received") >= 0;
  const isIncome = tokens.some((w, i) => INCOME_CUES.has(w) && !used[i]) || rentReceived;
  const type = isIncome ? "income" : "expense";
  const match = findKeyword(tokens, used, isIncome ? INCOME_DICT : EXPENSE_DICT);
  // cue words and leftover future verbs are not part of the title
  tokens.forEach((w, i) => (INCOME_CUES.has(w) || FUTURE_VERBS.has(w)) && (used[i] = true));

  let title = match ? titleCase(match.keyword) : "";
  if (!title) {
    const rest = tokens.filter((w, i) => !used[i] && !FILLERS.has(w) && !/^\d/.test(w) && !isNumberWord(w));
    title = titleCase(rest.join(" ")).slice(0, 40).trim();
  }
  const titleGuessed = !title;
  if (!title) title = isIncome ? "Quick income" : "Quick expense";

  // Never a future date
  const t0 = startOfDay(today);
  const spoken = Boolean(parsed);
  const date = parsed && parsed.date <= t0 ? parsed.date : t0;

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
    dateText: describeDate(date, today),
    dateSource: spoken && !parsed.future ? "spoken" : "default",
    confidence: amount && match ? "high" : amount ? "medium" : "low",
    missing,
    text: segment.trim(),
  };
  if (parsed?.future) item.warning = FUTURE_WARNING;
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
    // Date: only when the rules found no date in the text, and never a future one
    const aiDate = cleanDate(ai.date);
    if (aiDate && out.dateSource !== "spoken" && !out.warning && aiDate !== out.date) {
      const [y, m, d] = aiDate.split("-").map(Number);
      out.date = aiDate;
      out.dateText = describeDate(new Date(y, m - 1, d), today);
      out.dateSource = "spoken";
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
