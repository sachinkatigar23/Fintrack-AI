// Can this email's domain receive mail? Looks up MX records with a 4 s timeout.
//  - ENOTFOUND / ENODATA, or a "null MX" (RFC 7505)   -> { ok: false }
//  - timeout or a network problem                     -> { ok: true, checked: false } (offline development keeps working)
import dns from "dns";

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("DNS timeout"), { code: "ETIMEOUT" })), ms)),
  ]);

// Pure part: decide from the lookup result
export const judgeMx = (records, errorCode) => {
  if (errorCode === "ENOTFOUND" || errorCode === "ENODATA") return { ok: false, checked: true };
  if (errorCode) return { ok: true, checked: false };
  const usable = (records || []).filter((r) => r && r.exchange && r.exchange !== ".");
  return usable.length ? { ok: true, checked: true } : { ok: false, checked: true };
};

// Optional: DNS_SERVERS=1.1.1.1,8.8.8.8 in .env when Node can't reach the system DNS server
// (e.g. a local VPN / proxy on 127.0.0.1). Without it the system's DNS settings are used.
let resolver = null;
const defaultResolveMx = (domain) => {
  const servers = String(process.env.DNS_SERVERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!servers.length) return dns.promises.resolveMx(domain);
  if (!resolver) {
    resolver = new dns.promises.Resolver({ timeout: 3000, tries: 1 });
    resolver.setServers(servers);
  }
  return resolver.resolveMx(domain);
};

export const checkEmailDomain = async (email, { timeoutMs = 4000, resolveMx = defaultResolveMx } = {}) => {
  const domain = String(email || "").split("@")[1]?.trim().toLowerCase();
  if (!domain) return { ok: false, checked: true };
  try {
    return judgeMx(await withTimeout(resolveMx(domain), timeoutMs));
  } catch (error) {
    return judgeMx(null, error.code || "ERROR");
  }
};

export const UNDELIVERABLE_MESSAGE = "This email address can't receive mail. Please check it.";
