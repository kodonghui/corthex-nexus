// Node transport only. Access and route checks run before selecting these bytes.
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

export function codeVariants(code = {}) {
  const variants = new Map();
  for (const [name, file] of Object.entries(code)) {
    if (!/^(?:text\/javascript|text\/css)(?:;|$)/.test(file.type) ||
        !(typeof file.body === "string" || ArrayBuffer.isView(file.body))) continue;
    const bytes = typeof file.body === "string" ? Buffer.from(file.body) : Buffer.from(file.body.buffer, file.body.byteOffset, file.body.byteLength);
    if (bytes.length < 1024) continue;
    variants.set(name, {
      identity: bytes,
      br: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }),
      gzip: gzipSync(bytes, { level: 9 }),
    });
  }
  return variants;
}

export function acceptedCoding(header) {
  const qualities = new Map();
  for (const part of String(header || "").split(",")) {
    const [name, ...params] = part.trim().toLowerCase().split(";");
    let quality = 1;
    for (const parameter of params) {
      const match = /^\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)\s*$/.exec(parameter);
      if (match) quality = Number(match[1]); else quality = 0;
    }
    qualities.set(name, quality);
  }
  const quality = (name) => qualities.get(name) ?? qualities.get("*") ?? 0;
  if ((qualities.get("identity") ?? 0) > Math.max(quality("br"), quality("gzip"))) return null;
  if (quality("br") > 0 && quality("br") >= quality("gzip")) return "br";
  return quality("gzip") > 0 ? "gzip" : null;
}

export function compressedCode(request, response, variants) {
  if (response.status !== 200 || !["GET", "HEAD"].includes(request.method)) return null;
  const match = /^\/code\/([^/]+)$/.exec(new URL(request.url).pathname);
  if (!match) return null;
  const file = variants.get(decodeURIComponent(match[1]));
  const encoding = acceptedCoding(request.headers.get("Accept-Encoding"));
  if (!file) return null;
  return { encoding, body: file[encoding || "identity"] };
}
