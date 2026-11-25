// "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/131.0 Safari/537.36" -> "Chrome on Windows" (pure)

const browserOf = (ua) => {
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
  if (/^curl\//i.test(ua)) return "curl";
  if (/node|undici|axios|PostmanRuntime/i.test(ua)) return "an app";
  return null;
};

const osOf = (ua) => {
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
};

export const describeDevice = (userAgent) => {
  const ua = String(userAgent || "");
  if (!ua.trim()) return "Unknown device";
  const browser = browserOf(ua);
  const os = osOf(ua);
  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser === "an app" ? "An app" : browser;
  if (os) return `A browser on ${os}`;
  return "Unknown device";
};
