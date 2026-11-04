// Only this entry point selects header-only Access verification. It cannot be
// enabled by a request, an environment flag or the Worker entry point.
import { createServer } from "node:http";
import { once } from "node:events";
import { handle } from "./app.js";
import { AccessVerifier } from "./access.js";
import { problemResponse } from "./problem.js";
import { codeVariants, compressedCode } from "./code-compression.js";

function bodyStream(incoming, onBytes, onEnd) {
  let data, end, error;
  return new ReadableStream({
    start(controller) {
      data = (chunk) => { onBytes(chunk.length); controller.enqueue(chunk); if (controller.desiredSize <= 0) incoming.pause(); };
      end = () => { onEnd(); controller.close(); };
      error = () => controller.error(new Error("request body could not be read"));
      incoming.on("data", data).once("end", end).once("error", error);
    },
    pull() { incoming.resume(); },
    cancel() {
      incoming.removeListener("data", data).removeListener("end", end).removeListener("error", error);
      incoming.on("error", () => {});
      incoming.resume();
    },
  });
}

export function publicOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch { throw new Error("NEXUS_ORIGIN must be the public HTTPS origin"); }
}

export function createNodeServer({ env, origin, template, views = {}, verifier = new AccessVerifier({ requireContext: false }), onMetric } = {}) {
  const canonical = publicOrigin(origin);
  const variants = codeVariants(views.code);
  const server = createServer({ maxHeaderSize: 32768, requestTimeout: 30000, headersTimeout: 15000 }, async (incoming, outgoing) => {
    const started = performance.now();
    const cpuStart = onMetric ? process.cpuUsage() : null;
    let receivedBytes = 0;
    let bodyEnded = incoming.method === "GET" || incoming.method === "HEAD" ? started : null;
    let request;
    try {
      const headers = new Headers();
      for (let i = 0; i < incoming.rawHeaders.length; i += 2) headers.append(incoming.rawHeaders[i], incoming.rawHeaders[i + 1]);
      // Forwarded/Host headers never select the origin or the certificate URL.
      const target = incoming.url;
      if (!target?.startsWith("/") || target.startsWith("//")) throw new Error("invalid request target");
      const reads = incoming.method !== "GET" && incoming.method !== "HEAD";
      request = new Request(canonical + target, { method: incoming.method, headers, ...(reads ? { body: bodyStream(incoming, (size) => { receivedBytes += size; }, () => { bodyEnded = performance.now(); }), duplex: "half" } : {}) });
      const response = await handle(request, env, {}, template, views, verifier);
      if (request.body && !request.body.locked) await request.body.cancel();
      const completed = performance.now(), processing = completed - started;
      const cpu = cpuStart ? process.cpuUsage(cpuStart) : { user: 0, system: 0 };
      const encoded = compressedCode(request, response, variants);
      const responseHeaders = new Headers(response.headers);
      if (encoded) {
        if (encoded.encoding) responseHeaders.set("Content-Encoding", encoded.encoding);
        responseHeaders.set("Content-Length", String(encoded.body.length));
        responseHeaders.set("Vary", [responseHeaders.get("Vary"), "Accept-Encoding"].filter(Boolean).join(", "));
        await response.body?.cancel();
      }
      outgoing.writeHead(response.status, Object.fromEntries(responseHeaders));
      if (encoded && request.method !== "HEAD") outgoing.write(encoded.body);
      else if (!encoded && response.body) {
        for await (const chunk of response.body) {
          if (!outgoing.write(chunk)) await once(outgoing, "drain");
        }
      }
      outgoing.end();
      // Metrics contain numbers only: never URLs, identities, request headers,
      // tokens, stored text or exception messages.
      onMetric?.({ status: response.status, request_bytes: receivedBytes, processing_ms: processing,
        body_complete: bodyEnded === null ? 0 : 1, body_receive_ms: bodyEnded === null ? processing : bodyEnded - started,
        after_body_ms: bodyEnded === null ? 0 : completed - bodyEnded,
        cpu_user_ms: cpu.user / 1000, cpu_system_ms: cpu.system / 1000, rss_bytes: process.memoryUsage().rss });
    } catch {
      if (!outgoing.headersSent && !outgoing.destroyed) {
        const response = problemResponse(request || new Request(canonical), new Error());
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } else outgoing.destroy();
    } finally { incoming.resume(); }
  });
  server.keepAliveTimeout = 5000;
  // Deliberately no caller-controlled bind address.
  server.start = (port = 0) => new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { server.removeListener("error", reject); resolve(server.address()); });
  });
  return server;
}
