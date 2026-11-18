import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { RebuildProblem, sha256 } from "./rebuild-http.js";

export const OWNER_COOKIE = "nexus_session";
export const AUTH_COOKIE = "nexus_auth";
export const OWNER_IDLE = 30 * 60 * 1000;
export const OWNER_LIFETIME = 8 * 60 * 60 * 1000;
export const AUTH_LIFETIME = 5 * 60 * 1000;
export const iso = (ms) => new Date(ms).toISOString();
export const randomToken = () => randomBytes(32).toString("base64url");
export const resourceId = (kind) => `${kind}_${randomBytes(18).toString("base64url")}`;

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionCookie(name, token, lifetime) {
  return `${name}=${token}; Path=/; Max-Age=${Math.floor(lifetime / 1000)}; HttpOnly; Secure; SameSite=Lax`;
}

export function cookieToken(request, name) {
  const matches = (request.headers.get("Cookie") || "").split(";").map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${name}=`)).map((entry) => entry.slice(name.length + 1));
  if (!matches.length) return null;
  if (matches.length !== 1 || !tokenPattern.test(matches[0])) throw new RebuildProblem("invalid_input");
  return matches[0];
}

export function bearerToken(request) {
  const auth = request.headers.get("Authorization");
  if (auth === null) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(auth);
  if (!match) throw new RebuildProblem("invalid_input");
  return match[1];
}

export function csrfToken(session) {
  return createHmac("sha256", Buffer.from(session, "base64url")).update("nexus.owner.csrf/1").digest("base64url");
}

export function requireOrigin(request, origin, error = "operation_forbidden") {
  const site = request.headers.get("Sec-Fetch-Site");
  if (request.headers.get("Origin") !== origin || (site && site !== "same-origin" && site !== "none")) throw new RebuildProblem(error);
}

export function requireCSRF(request, session, origin) {
  const given = request.headers.get("X-CSRF-Token");
  if (given === null || given.length < 32 || given.length > 128) throw new RebuildProblem("invalid_input");
  requireOrigin(request, origin);
  if (!safeEqual(session.csrf_hash, sha256(given))) throw new RebuildProblem("operation_forbidden");
}

export function safeReturnPath(path, origin) {
  if (typeof path !== "string" || path.length > 1024 || !/^\/[^/]/u.test(path) || /[\\\p{C}\s]/u.test(path)) throw new RebuildProblem("invalid_input");
  try {
    const target = new URL(path, origin);
    const decoded = decodeURIComponent(target.pathname);
    if (target.origin !== origin || !/^\/[^/]/u.test(decoded) || /[\\\p{C}]/u.test(decoded) || decoded.startsWith("/api/")) throw new Error();
    const result = target.pathname + target.search + target.hash;
    if (result.length > 1024) throw new Error();
    return result;
  } catch { throw new RebuildProblem("invalid_input"); }
}

export function protectVerifier(key, stateHash, verifier) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(stateHash));
  const content = Buffer.concat([cipher.update(verifier, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), content]).toString("base64url");
}

export function unprotectVerifier(key, stateHash, protectedValue) {
  const bytes = Buffer.from(protectedValue, "base64url");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    decipher.setAAD(Buffer.from(stateHash));
    const verifier = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
    if (!tokenPattern.test(verifier)) throw new Error();
    return verifier;
  } catch { throw new RebuildProblem("authentication_unavailable"); }
}
