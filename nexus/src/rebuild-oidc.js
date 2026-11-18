import { createHash, createPublicKey, verify } from "node:crypto";
import { safeEqual } from "./rebuild-auth.js";
import { RebuildProblem, sha256 } from "./rebuild-http.js";

function httpsEndpoint(value) {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Invalid OIDC endpoint");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Invalid OIDC endpoint");
  return url;
}

async function jsonResponse(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body || []) {
    size += chunk.byteLength;
    if (size > 128 * 1024) throw new Error("OIDC response exceeds its limit");
    chunks.push(chunk);
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
}

const formValue = (input) => new URLSearchParams({ "": input }).toString().slice(1);
const jwtPart = (part) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(part, "base64url")));

// The issuer, client and application origin are deployment settings. Neither
// browser requests nor repository content can select an upstream endpoint.
export class RebuildOIDC {
  #issuer;
  #clientId;
  #clientSecret;
  #callback;
  #fetch;
  #now;
  #timeout;
  #metadata;
  #metadataUntil = 0;

  constructor({ issuer, clientId, clientSecret, origin, fetchImpl = fetch, now = Date.now, timeout = 8000 }) {
    const parsed = httpsEndpoint(issuer);
    if (parsed.search || !clientId || typeof clientId !== "string" || clientId.length > 255) throw new Error("Invalid OIDC settings");
    this.#issuer = issuer;
    this.#clientId = clientId;
    this.#clientSecret = clientSecret;
    this.#callback = new URL("/api/v2/auth/callback", origin).href;
    this.#fetch = fetchImpl;
    this.#now = now;
    this.#timeout = timeout;
  }

  async #request(url, signal, init = {}) {
    const response = await this.#fetch(url, { ...init, redirect: "error", signal });
    if (init.method === "POST" && [400, 401, 403].includes(response.status)) {
      await response.body?.cancel();
      throw new RebuildProblem("sign_in_required");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("OIDC upstream refused");
    }
    const value = await jsonResponse(response);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid OIDC response");
    return value;
  }

  async #discovery(signal) {
    if (this.#metadata && this.#metadataUntil > this.#now()) return this.#metadata;
    const document = await this.#request(`${this.#issuer.replace(/\/$/, "")}/.well-known/openid-configuration`, signal);
    if (document.issuer !== this.#issuer || !document.id_token_signing_alg_values_supported?.includes("RS256") ||
        (document.code_challenge_methods_supported && !document.code_challenge_methods_supported.includes("S256"))) {
      throw new Error("Incompatible OIDC metadata");
    }
    const methods = document.token_endpoint_auth_methods_supported || ["client_secret_basic"];
    const method = this.#clientSecret ? (methods.includes("client_secret_basic") ? "client_secret_basic" : "client_secret_post") : "none";
    if (!methods.includes(method)) throw new Error("Incompatible OIDC client authentication");
    this.#metadata = { authorize: httpsEndpoint(document.authorization_endpoint).href,
      token: httpsEndpoint(document.token_endpoint).href, jwks: httpsEndpoint(document.jwks_uri).href, method };
    this.#metadataUntil = this.#now() + 10 * 60 * 1000;
    return this.#metadata;
  }

  async #deadline(operation) {
    const signal = AbortSignal.timeout(this.#timeout);
    try { return await operation(signal); }
    catch (error) {
      if (signal.aborted || error?.name === "TimeoutError") throw new RebuildProblem("upstream_timeout");
      if (error instanceof RebuildProblem) throw error;
      throw new RebuildProblem("authentication_unavailable");
    }
  }

  authorize({ state, nonce, verifier }) {
    return this.#deadline(async (signal) => {
      const discovery = await this.#discovery(signal);
      const url = new URL(discovery.authorize);
      const fields = { client_id: this.#clientId, redirect_uri: this.#callback, response_type: "code", scope: "openid",
        state, nonce, code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url") };
      for (const [name, value] of Object.entries(fields)) url.searchParams.set(name, value);
      if (url.href.length > 2048) throw new Error("OIDC authorization URL is too long");
      return url.href;
    });
  }

  complete({ code, verifier, nonceHash }) {
    return this.#deadline(async (signal) => {
      const discovery = await this.#discovery(signal);
      const body = new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: this.#callback });
      const headers = { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" };
      if (discovery.method === "client_secret_basic") {
        headers.Authorization = `Basic ${Buffer.from(`${formValue(this.#clientId)}:${formValue(this.#clientSecret)}`).toString("base64")}`;
      } else {
        body.set("client_id", this.#clientId);
        if (discovery.method === "client_secret_post") body.set("client_secret", this.#clientSecret);
      }
      const tokens = await this.#request(discovery.token, signal, { method: "POST", headers, body });
      const jwt = tokens.id_token;
      if (typeof jwt !== "string" || jwt.length > 16384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt)) {
        throw new RebuildProblem("sign_in_required");
      }
      const [rawHeader, rawClaims, rawSignature] = jwt.split(".");
      let header, claims;
      try { header = jwtPart(rawHeader); claims = jwtPart(rawClaims); }
      catch { throw new RebuildProblem("sign_in_required"); }
      if (header?.alg !== "RS256" || header.crit !== undefined || typeof header.kid !== "string" || header.kid.length > 256) {
        throw new RebuildProblem("sign_in_required");
      }
      const document = await this.#request(discovery.jwks, signal);
      const keys = (Array.isArray(document.keys) ? document.keys : []).filter((key) => key?.kid === header.kid &&
        key.kty === "RSA" && !key.d && (key.use === undefined || key.use === "sig") && (key.alg === undefined || key.alg === "RS256") &&
        (key.key_ops === undefined || key.key_ops.includes("verify")));
      let verified = false;
      try {
        verified = keys.length === 1 && verify("RSA-SHA256", Buffer.from(`${rawHeader}.${rawClaims}`),
          createPublicKey({ key: keys[0], format: "jwk" }), Buffer.from(rawSignature, "base64url"));
      } catch { /* Reject a malformed public key as a sign-in failure. */ }
      const audience = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
      const now = Math.floor(this.#now() / 1000);
      if (!verified || claims?.iss !== this.#issuer || !audience.includes(this.#clientId) ||
          (claims.azp !== undefined && claims.azp !== this.#clientId) || (audience.length > 1 && claims.azp !== this.#clientId) ||
          !Number.isSafeInteger(claims.exp) || claims.exp <= now || !Number.isSafeInteger(claims.iat) || claims.iat > now + 60 || claims.iat >= claims.exp ||
          typeof claims.sub !== "string" || claims.sub.length < 1 || claims.sub.length > 255 ||
          typeof claims.nonce !== "string" || !safeEqual(sha256(claims.nonce), nonceHash)) {
        throw new RebuildProblem("sign_in_required");
      }
      return { issuer: this.#issuer, subject: claims.sub };
    });
  }
}
