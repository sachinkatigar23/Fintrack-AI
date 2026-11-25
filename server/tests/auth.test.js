import { test } from "node:test";
import assert from "node:assert/strict";
import { generateOtp, hashOtp, verifyOtp, canSendOtp } from "../utils/otp.js";
import { describeDevice } from "../utils/userAgent.js";
import { judgeMx, checkEmailDomain } from "../utils/emailDomain.js";

test("generateOtp: always 6 digits", () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const code = generateOtp();
    assert.match(code, /^\d{6}$/);
    seen.add(code);
  }
  // random enough that 2000 draws are almost all different
  assert.ok(seen.size > 1900);
});

test("hashOtp + verifyOtp: right code passes, wrong code fails", () => {
  const code = "042917";
  const hash = hashOtp(code);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, code);
  assert.equal(verifyOtp("042917", hash), true);
  assert.equal(verifyOtp("042918", hash), false);
  assert.equal(verifyOtp("42917", hash), false); // not 6 digits
  assert.equal(verifyOtp("abcdef", hash), false);
  assert.equal(verifyOtp("042917", undefined), false);
  assert.equal(verifyOtp("042917", "not-a-hash"), false);
});

test("canSendOtp: 60 s between sends, 5 per hour", () => {
  const now = new Date(2026, 10, 25, 12, 0, 0);
  const sec = (s) => new Date(now.getTime() - s * 1000);

  assert.deepEqual(canSendOtp({}, now), { allowed: true, windowStart: now, sendCount: 1 });

  const tooSoon = canSendOtp({ sentAt: sec(20), windowStart: sec(20), sendCount: 1 }, now);
  assert.equal(tooSoon.allowed, false);
  assert.equal(tooSoon.retryAfter, 40);

  const ok = canSendOtp({ sentAt: sec(61), windowStart: sec(600), sendCount: 3 }, now);
  assert.equal(ok.allowed, true);
  assert.equal(ok.sendCount, 4);

  const capped = canSendOtp({ sentAt: sec(120), windowStart: sec(1800), sendCount: 5 }, now);
  assert.equal(capped.allowed, false);
  assert.equal(capped.retryAfter, 1800);

  // a new hour starts a new window
  const fresh = canSendOtp({ sentAt: sec(3700), windowStart: sec(3700), sendCount: 5 }, now);
  assert.equal(fresh.allowed, true);
  assert.equal(fresh.sendCount, 1);
});

test("describeDevice: a short summary from the user-agent", () => {
  const ua = {
    chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    edgeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
    safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    chromeAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1",
    samsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36",
  };
  assert.equal(describeDevice(ua.chromeWin), "Chrome on Windows");
  assert.equal(describeDevice(ua.edgeWin), "Edge on Windows");
  assert.equal(describeDevice(ua.firefoxLinux), "Firefox on Linux");
  assert.equal(describeDevice(ua.safariMac), "Safari on macOS");
  assert.equal(describeDevice(ua.chromeAndroid), "Chrome on Android");
  assert.equal(describeDevice(ua.safariIphone), "Safari on iOS");
  assert.equal(describeDevice(ua.chromeIphone), "Chrome on iOS");
  assert.equal(describeDevice(ua.samsung), "Samsung Internet on Android");
  assert.equal(describeDevice("curl/8.4.0"), "curl");
  assert.equal(describeDevice(""), "Unknown device");
  assert.equal(describeDevice(undefined), "Unknown device");
});

test("email domain check: no MX -> can't receive mail; network trouble -> allowed", async () => {
  assert.equal(judgeMx([{ exchange: "mx.example.org", priority: 10 }]).ok, true);
  assert.equal(judgeMx([{ exchange: "", priority: 0 }]).ok, false); // null MX
  assert.equal(judgeMx(null, "ENOTFOUND").ok, false);
  assert.equal(judgeMx(null, "ENODATA").ok, false);
  assert.deepEqual(judgeMx(null, "ETIMEOUT"), { ok: true, checked: false });
  assert.deepEqual(judgeMx(null, "ECONNREFUSED"), { ok: true, checked: false });

  const fail = (code) => async () => {
    throw Object.assign(new Error(code), { code });
  };
  assert.equal((await checkEmailDomain("a@nowhere.invalid", { resolveMx: fail("ENOTFOUND") })).ok, false);
  assert.equal((await checkEmailDomain("a@offline.test", { resolveMx: fail("ECONNREFUSED") })).ok, true);
  // a lookup that never answers is cut off by the timeout and allowed
  const slow = () => new Promise(() => {});
  const r = await checkEmailDomain("a@slow.test", { resolveMx: slow, timeoutMs: 50 });
  assert.deepEqual(r, { ok: true, checked: false });
  assert.equal((await checkEmailDomain("not-an-email")).ok, false);
});
