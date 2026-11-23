// ─────────────────────────────────────────────────────────────
// AI service - the single place that talks to the AI provider (Google Gemini).
// Rule: the backend calculates every number first; the AI only receives
// these verified figures and explains them in plain language.
// Because everything goes through this file, the provider/model can be
// changed without touching the rest of the application.
// ─────────────────────────────────────────────────────────────
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const MODEL = () => process.env.GEMINI_MODEL || "gemini-3.6-flash";

let client = null;
const getClient = () => {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
};

export const isAIEnabled = () => Boolean(process.env.GEMINI_API_KEY);

// Shared instructions added to every prompt. The currency comes from the
// user's profile (context.currency); amounts are never converted.
const currencyRule = (code) => {
  const c = /^[A-Z]{3}$/.test(String(code || "")) ? code : "INR";
  return c === "INR"
    ? "Money is in Indian Rupees (INR). Write amounts like ₹4,940 (never use $)."
    : `Money is in ${c}. Write amounts with the ${c} currency symbol, using the numbers exactly as given.`;
};

const systemRules = (currency) => `
You are FinTrack AI, a friendly personal finance coach for users in India.
Rules:
- Use ONLY the numbers given in the context. Never invent, estimate or recalculate figures.
- ${currencyRule(currency)}
- Be short, clear and practical. No legal or investment guarantees.
- Reply with valid JSON only, matching the requested format exactly.
`;

// Remove ```json fences if the model adds them, then parse
const parseJSON = (text) => {
  if (!text) throw new Error("Empty AI response");
  const cleaned = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
};

const withTimeout = (promise, ms = 25000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("AI request timed out")), ms)),
  ]);

// Lenient parse (opt-in): strict parse first, then the first {...} block in the reply
const extractJSON = (text) => {
  try {
    return parseJSON(text);
  } catch (error) {
    const s = String(text || "");
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start === -1 || end <= start) throw error;
    return JSON.parse(s.slice(start, end + 1));
  }
};

// 503 / 429 = provider overloaded or rate limited (worth retrying)
const isBusyError = (error) =>
  /\b(503|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(
    `${error?.status || ""} ${error?.message || ""}`
  );

// Errors where trying the fallback model makes sense
const isFallbackError = (error) =>
  isBusyError(error) ||
  /timed out/i.test(error?.message || "") ||
  /\b404\b|NOT_FOUND|not found/i.test(`${error?.status || ""} ${error?.message || ""}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ask the model for a JSON answer.
 * @param {string} task  - what to do + the JSON format to return
 * @param {object} context - verified figures calculated by the backend
 * @param {{ imagePath?: string, mimeType?: string }} [file] - optional image or PDF (receipt scan)
 * @param {{ timeoutMs?: number, retries?: number, lenientJSON?: boolean, useFallbackModel?: boolean }} [options]
 *   All optional; without them the behaviour is exactly the original one.
 */
export const generateJSON = async (task, context = {}, file, options = {}) => {
  const { timeoutMs = 25000, retries = 0, lenientJSON = false, useFallbackModel = false } = options;
  if (!retries && !useFallbackModel && timeoutMs === 25000 && !lenientJSON) {
    return generateJSONOnce(task, context, file);
  }

  const models = [MODEL()];
  const fallback = process.env.GEMINI_FALLBACK_MODEL;
  if (useFallbackModel && fallback && fallback !== MODEL()) models.push(fallback);

  let lastError;
  for (let m = 0; m < models.length; m++) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await generateJSONOnce(task, context, file, { model: models[m], timeoutMs, lenientJSON });
      } catch (error) {
        lastError = error;
        if (error.code === "AI_DISABLED") throw error;
        // Only busy errors are retried on the same model
        if (!isBusyError(error) || attempt === retries) break;
        await sleep(1500 * (attempt + 1));
      }
    }
    if (!isFallbackError(lastError)) break;
  }
  throw lastError;
};

const generateJSONOnce = async (task, context = {}, file, opts = {}) => {
  const ai = getClient();
  if (!ai) {
    const err = new Error("AI is not configured. Add GEMINI_API_KEY to server/.env");
    err.code = "AI_DISABLED";
    throw err;
  }

  const prompt = `${systemRules(context?.currency)}\nTASK:\n${task}\n\nVERIFIED CONTEXT (JSON):\n${JSON.stringify(context)}`;

  const contents = file?.imagePath
    ? [
        { inlineData: { mimeType: file.mimeType, data: fs.readFileSync(file.imagePath).toString("base64") } },
        { text: prompt },
      ]
    : prompt;

  const response = await withTimeout(
    ai.models.generateContent({
      model: opts.model || MODEL(),
      contents,
      config: { responseMimeType: "application/json", temperature: 0.4 },
    }),
    opts.timeoutMs ?? 25000
  );

  const text = typeof response.text === "function" ? response.text() : response.text;
  return opts.lenientJSON ? extractJSON(text) : parseJSON(text);
};

// Runs the AI call; on any failure returns the fallback (built from the same
// verified numbers) so the feature keeps working without the AI service.
export const explainOrFallback = async (task, context, fallback) => {
  try {
    const data = await generateJSON(task, context);
    return { ...data, aiGenerated: true };
  } catch (error) {
    if (error.code !== "AI_DISABLED") console.error("AI error:", error.message);
    return {
      ...fallback,
      aiGenerated: false,
      aiNote:
        error.code === "AI_DISABLED"
          ? "AI explanations are off (no API key). Showing calculated summary."
          : "AI is temporarily unavailable. Showing calculated summary.",
    };
  }
};

// Simple in-memory cache (per user + key) so repeated page visits don't
// call the AI again. Cleared on server restart.
const cache = new Map();
export const cached = async (key, ttlMs, producer) => {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await producer();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
};

export const clearUserCache = (userId) => {
  for (const k of cache.keys()) if (k.startsWith(`${userId}:`)) cache.delete(k);
};
