// The kind of browser and device that sent a pass (SPEC-195, TASK-299): the
// browser's family and the device's class, in the fixed vocabulary of the
// contract's Checkpoint, read from the request's User-Agent and the client
// hints that browsers send by themselves (Sec-CH-UA, Sec-CH-UA-Mobile and
// Sec-CH-UA-Platform; the server asks for no other with Accept-CH). What this
// returns is only ever a word of the vocabulary, never anything of the
// request's text, so that nothing of that text can be stored; and nothing here
// refuses a pass, since a request can name any browser (SPEC-200). Every
// pattern below takes time in proportion to the header's length.

export const BROWSERS = Object.freeze(["chrome", "safari", "firefox", "edge", "other", "unknown"]);
export const DEVICES = Object.freeze(["phone", "tablet", "desktop", "unknown"]);

// A brand of Sec-CH-UA, as its structured list gives it: "name";v="version".
const BRAND = /"([^"\\]{1,100})"\s*;\s*v="[^"\\]{0,100}"/g;
// Chromium adds a brand that means nothing, such as "Not_A Brand" or
// "Not)A;Brand", so that no server matches the list whole (GREASE).
const GREASE = /^Not.A.Brand$/;
// The platforms of Sec-CH-UA-Platform that run on a desktop.
const DESKTOPS = ["Windows", "macOS", "Linux", "Chrome OS", "ChromeOS"];

function brands(hint) {
  if (typeof hint !== "string" || hint.length > 1000) return [];
  return [...hint.matchAll(BRAND)].map((match) => match[1].trim()).filter((name) => name && !GREASE.test(name));
}

// Edge and Chrome name themselves; a browser that adds a brand of its own,
// such as Opera, Brave or Samsung Internet, is another; and Chromium alone, as
// Chromium and Chrome for Testing send it, is of Chrome's family, with the
// brand HeadlessChrome that Chromium without a head adds, as its User-Agent's
// HeadlessChrome is (BUG-609).
const CHROMIUM = ["Chromium", "HeadlessChrome"];
function browserOfBrands(list) {
  if (list.includes("Microsoft Edge")) return "edge";
  if (list.includes("Google Chrome")) return "chrome";
  return list.some((name) => !CHROMIUM.includes(name)) ? "other" : "chrome";
}

// Safari and Firefox send no client hints, so the User-Agent tells them. The
// tokens of Edge and of the other browsers of Chrome's engine come first,
// since their User-Agent names Chrome and Safari too; a User-Agent in the
// browsers' form ("Mozilla/") that names none of the four is another browser,
// and any other text tells nothing.
function browserOfAgent(agent) {
  if (/\bEdg(?:e|A|iOS)?\/\d/.test(agent)) return "edge";
  if (/\b(?:OPR|OPT|OPiOS|Opera|SamsungBrowser|YaBrowser|UCBrowser|Whale|Vivaldi|DuckDuckGo|Brave)\/\d/.test(agent)) return "other";
  if (/\b(?:Firefox|FxiOS)\/\d/.test(agent)) return "firefox";
  if (/\b(?:Chrome|CriOS|HeadlessChrome|Chromium)\/\d/.test(agent)) return "chrome";
  if (/\bVersion\/\d/.test(agent) && /\bSafari\/\d/.test(agent) && !/\bAndroid\b/.test(agent)) return "safari";
  return /^Mozilla\/\d/.test(agent) ? "other" : "unknown";
}

// Sec-CH-UA-Mobile is ?1 on a phone; ?0 on a desktop and on a tablet, which
// Android names as its platform. Any other answer leaves it to the User-Agent.
function deviceOfHints(mobile, platform) {
  const named = typeof platform === "string" && /^"[^"\\]{0,100}"$/.test(platform.trim()) ? platform.trim().slice(1, -1) : null;
  if (mobile === "?1") return "phone";
  if (mobile !== "?0") return null;
  if (named === "Android") return "tablet";
  return DESKTOPS.includes(named) ? "desktop" : null;
}

// An iPad's Safari names a Mac by default, and is then a desktop, as the
// request names it.
function deviceOfAgent(agent) {
  if (/\biPad\b/.test(agent)) return "tablet";
  if (/\b(?:iPhone|iPod)\b/.test(agent)) return "phone";
  if (/\bAndroid\b/.test(agent)) return /\bMobile\b/.test(agent) ? "phone" : "tablet";
  if (/\b(?:Windows Phone|IEMobile)\b/.test(agent)) return "phone";
  if (/\b(?:Windows NT|Macintosh|X11|CrOS|Linux)\b/.test(agent)) return "desktop";
  if (/\bMobile\b/.test(agent)) return "phone";
  return /\bTablet\b/.test(agent) ? "tablet" : "unknown";
}

// The kind that a request's headers name: { browser, device }, two words of
// the vocabulary. No User-Agent and no hints, or text that names neither, is
// unknown.
export function clientKind(headers) {
  const agent = String(headers.get("User-Agent") ?? "").trim();
  const named = brands(headers.get("Sec-CH-UA"));
  const browser = named.length ? browserOfBrands(named) : agent ? browserOfAgent(agent) : "unknown";
  const device = deviceOfHints(String(headers.get("Sec-CH-UA-Mobile") ?? "").trim(), headers.get("Sec-CH-UA-Platform"))
    ?? (agent ? deviceOfAgent(agent) : "unknown");
  return { browser, device };
}
