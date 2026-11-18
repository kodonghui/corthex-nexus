import { canonicalJSON, RebuildProblem, sha256 } from "./rebuild-http.js";
import { partPattern, tracePattern } from "./rebuild-contract.js";

export const parserVersion = "nexus.review/1";
export const snapshotLimit = 20 * 1024 * 1024;
const fileLimit = 2 * 1024 * 1024;
const representation = {
  "01-domain": "diagram", "02-prd": "list", "03-user-flow": "diagram", "04-functional-spec": "list",
  "05-erd": "diagram", "06-api": "contract", "07-sitemap": "diagram", "08-screen-states": "screens",
  "09-mockup": "html", "10-wbs": "list", "11-development": "evidence", "12-qa": "evidence", "13-presentation": "evidence",
};
const kinds = {
  CTX: "context", REQ: "requirement", FL: "flow", SPEC: "behavior", TBL: "table", API: "operation",
  SCR: "screen", TASK: "task", TC: "test", BUG: "bug", REL: "release", PR: "change",
};
const short = (text, length) => Array.from(String(text)).slice(0, length).join("");
const lexicographic = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function rows(line) {
  return line.trim().startsWith("|") ? line.trim().slice(1).replace(/\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim().replaceAll("\\|", "|")) : [];
}
function safePath(path) {
  return path.isWellFormed() && !/[\\\p{C}]/u.test(path) && path.split("/").every((part) => part && ![".", "..", ".git"].includes(part.toLowerCase()));
}

export function previewDigest(project, input) {
  const { consent_id, ...snapshot } = input;
  return sha256(canonicalJSON({ format: "nexus.preview/1", project_id: project, snapshot }));
}

function parseArtifact(stage, files) {
  const items = new Map();
  const diagnostics = [];
  const graph = { nodes: [], edges: [] };
  const nodeKeys = new Set();
  const edgeKeys = new Set();
  const warn = (message) => { if (diagnostics.length < 50) diagnostics.push(short(message, 500)); };
  const add = (id, title, path, line, fields = {}) => {
    if (!tracePattern.test(id) || id.length > 80) return;
    if (items.has(id)) return;
    items.set(id, { id, title: short(title || id, 500), kind: kinds[id.split("-", 1)[0]] || "source",
      removed: false, fields, path, line });
  };
  function node(id, label, kind, itemId = null, properties = []) {
    if (nodeKeys.has(id)) return;
    if (nodeKeys.size === 10000) throw new RebuildProblem("payload_too_large");
    nodeKeys.add(id);
    graph.nodes.push({ id, label: short(label || id, 500), kind, item_id: itemId, properties });
  }
  function edge(from, to, label) {
    const key = [from, to, label].join("\0");
    if (edgeKeys.has(key)) return;
    if (edgeKeys.size === 20000) throw new RebuildProblem("payload_too_large");
    edgeKeys.add(key);
    graph.edges.push({ from, to, label: short(label, 300) });
  }

  const tables = new Map();
  const relations = [];
  for (const file of files) {
    const { path, media_type, content_utf8: source } = file;
    if (stage === "06-api" && media_type === "application/json") {
      let document;
      try { document = JSON.parse(source); } catch { warn(`Invalid OpenAPI JSON at ${path}`); continue; }
      for (const [route, operations] of Object.entries(document?.paths || {})) {
        for (const [method, op] of Object.entries(operations || {})) {
          if (!/^(get|post|put|patch|delete|head|options|trace)$/.test(method)) continue;
          const id = op?.["x-corthex"]?.id;
          if (typeof id !== "string") continue;
          const fields = { method: method.toUpperCase(), path: route };
          for (const [status, response] of Object.entries(op.responses || {}).slice(0, 90)) fields[`HTTP ${status}`] = short(response?.description || "", 1000);
          const marker = source.indexOf(JSON.stringify(id));
          add(id, op.summary || op.operationId || `${method.toUpperCase()} ${route}`, path,
            marker < 0 ? null : source.slice(0, marker).split("\n").length, fields);
        }
      }
      continue;
    }

    if (!["text/markdown", "text/plain", "application/sql", "application/yaml"].includes(media_type)) continue;
    const lines = source.split(/\r?\n/);
    const fileId = /(?:^|\/)([A-Z]+-\d{3,7})(?:\.ko)?\.[^.]+$/.exec(path)?.[1];
    const authored = lines.findIndex((line) => /^#{1,6}\s/.test(line));
    if (fileId) add(fileId, authored === -1 ? fileId : lines[authored].replace(/^#+\s*/, ""), path, authored === -1 ? 1 : authored + 1);
    const flowNodes = new Map();
    const flowEdges = [];
    const sitemapParents = [];
    let table = null;
    let diagram = false;
    let screenItem = fileId;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cells = rows(line);
      const trace = /^(?:#{1,6}\s+|--\s+)?([A-Z]+-[0-9]{3,7}(?:#[A-Za-z0-9_-]+)?)(?![\d#-])(?:\s+(.*))?$/.exec(line.trim());
      const rowTrace = /^([A-Z]+-[0-9]{3,7}(?:#[A-Za-z0-9_-]+)?)(?:\s+(.+))?$/.exec(cells[0] || "");
      if (trace) add(trace[1], trace[2]?.replace(/^[:–—-]\s*/, ""), path, i + 1);
      if (rowTrace) add(rowTrace[1], rowTrace[2] || cells[1], path, i + 1, { source_row: short(line.trim(), 32768) });

      if (stage === "01-domain" && cells.length === 2 && cells[1].includes("→")) {
        let previous = null;
        for (const entry of cells[1].split("→").map((text) => text.trim()).filter(Boolean)) {
          const id = `event_${sha256(`${cells[0]}\0${entry}`).slice(0, 28)}`;
          node(id, entry, "event", null, [{ label: "Lane", value: short(cells[0], 1000) }]);
          if (previous) edge(previous, id, "");
          previous = id;
        }
      }
      if (stage === "01-domain" && rowTrace?.[1].startsWith("CTX-")) {
        node(rowTrace[1], rowTrace[2] || rowTrace[1], "context", rowTrace[1]);
        const neighbor = /^(CTX-\d{3,7})$/.exec(cells[1] || "")?.[1];
        if (neighbor) edge(rowTrace[1], neighbor, cells[2] || "");
      }

      if (stage === "03-user-flow") {
        if (/^\s*```mermaid\s*$/.test(line)) { diagram = true; continue; }
        if (/^\s*```\s*$/.test(line)) diagram = false;
        if (!diagram || !line.includes("--")) continue;
        const transition = /^\s*(.+?)\s+--(?:>|\s+([^>]+?)\s+-->)\s+(.+?)\s*$/.exec(line);
        if (!transition) continue;
        const endpoints = [transition[1], transition[3]].map((entry) => {
          const named = /^([A-Za-z][\w-]*)(.*)$/.exec(entry);
          if (!named) return null;
          const [, key, shape] = named;
          const text = shape.replace(/^[\[\](){}"' ]+|[\[\](){}"' ]+$/g, "").replace(/<br\s*\/?>/gi, " · ");
          if (text || !flowNodes.has(key)) flowNodes.set(key, text || key);
          return key;
        });
        if (endpoints.every(Boolean)) flowEdges.push([...endpoints, transition[2] || ""]);
      }

      if (stage === "05-erd") {
        const definition = /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)/i.exec(line);
        if (definition) {
          const name = definition[1];
          const preceding = /^--\s+(TBL-\d{3,7})\b/.exec(lines[i - 1] || "")?.[1];
          table = { id: preceding || `table_${sha256(name).slice(0, 20)}`, name, item: preceding || null };
          tables.set(name, table);
          if (preceding) add(preceding, name, path, i + 1);
        }
        if (table) {
          for (const reference of line.matchAll(/\bREFERENCES\s+["`]?(\w+)/gi)) relations.push([table.name, reference[1], "foreign key"]);
        }
      }

      if (stage === "07-sitemap" && media_type === "application/yaml") {
        const entry = /^(\s*)- id:\s*(SCR-\d{3,7})\s*$/.exec(line);
        if (entry) {
          const [, indent, id] = entry;
          const children = lines.slice(i + 1, i + 9);
          const name = children.map((value) => /^\s+name:\s*(.+)$/.exec(value)?.[1]).find(Boolean) || id;
          const addr = children.map((value) => /^\s+path:\s*(.+)$/.exec(value)?.[1]).find(Boolean) || "";
          while (sitemapParents.length && sitemapParents.at(-1).indent >= indent.length) sitemapParents.pop();
          node(id, name, "screen", id, [{ label: "Path", value: short(addr, 1000) }]);
          if (sitemapParents.length) edge(sitemapParents.at(-1).id, id, "");
          sitemapParents.push({ indent: indent.length, id });
          add(id, name, path, i + 1, { path: addr });
        }
      }

      if (stage === "08-screen-states") {
        if (trace?.[1].startsWith("SCR-")) screenItem = trace[1].split("#")[0];
        if (screenItem && /^[a-z][a-z0-9_-]{1,63}$/.test(cells[0] || "") && cells.length >= 3 &&
            !["state", "action", "error", "status"].includes(cells[0])) {
          add(`${screenItem}#${cells[0]}`, `${cells[0]} · ${cells[1]}`, path, i + 1, { source_row: short(line.trim(), 32768) });
        }
      }
    }
    const flowId = (id) => `flow_${sha256(`${path}:\0${id}`).slice(0, 28)}`;
    for (const [key, text] of flowNodes) node(flowId(key), text, "step", fileId || null);
    for (const [from, to, label] of flowEdges) edge(flowId(from), flowId(to), label);
  }
  for (const value of tables.values()) node(value.id, value.name, "table", value.item);
  for (const [from, to, label] of relations) {
    if (tables.has(from) && tables.has(to)) edge(tables.get(from).id, tables.get(to).id, label);
    else warn(`Missing table in relationship ${from} → ${to}`);
  }
  graph.edges = graph.edges.filter(({ from, to }) => nodeKeys.has(from) && nodeKeys.has(to));
  const mode = representation[stage];
  const first = mode === "html" ? files.find((item) => item.media_type === "text/html" && /(?:^|\/)index\.html$/.test(item.path))
    || files.find((item) => item.media_type === "text/html") : files.find((item) => !item.path.endsWith(".ko.md")) || files[0];
  if (!files.length) return { items: [], graph, diagnostics: [], representation: "missing", sourcePath: null };
  const understood = mode === "html" ? first : mode === "evidence" || items.size || graph.nodes.length;
  if (!understood) warn("No supported review items were found in these source files.");
  return { items: [...items.values()], graph, diagnostics, representation: understood ? mode : "unsupported", sourcePath: (first || files[0]).path };
}

export function prepareArtifacts(artifacts) {
  let fileCount = 0, itemCount = 0;
  const stageIds = new Set();
  const parts = new Set();
  const fileDigests = new Map();
  return artifacts.map(({ part, stage, source_files }) => {
    const stageId = `${part}\0${stage}`;
    if (!partPattern.test(part) || !part.trim() || stageIds.has(stageId)) throw new RebuildProblem("invalid_input");
    stageIds.add(stageId);
    parts.add(part);
    if (parts.size > 20) throw new RebuildProblem("payload_too_large");
    const paths = new Set();
    const files = [...source_files].sort((a, b) => lexicographic(a.path, b.path));
    for (const file of files) {
      if (++fileCount > 1000 || Buffer.byteLength(file.content_utf8) > fileLimit) throw new RebuildProblem("payload_too_large");
      if (!safePath(file.path) || !file.content_utf8.isWellFormed() || paths.has(file.path) || sha256(file.content_utf8) !== file.sha256 ||
          (fileDigests.has(file.path) && fileDigests.get(file.path) !== file.sha256)) throw new RebuildProblem("invalid_input");
      paths.add(file.path);
      fileDigests.set(file.path, file.sha256);
    }
    const manifest = files.map(({ path, media_type, sha256 }) => ({ path, media_type, sha256 }));
    // A translation remains in the source envelope. When its matching
    // original is present, review identities and locations come from that file.
    const canonicalFiles = files.filter(({ path }) => !path.endsWith(".ko.md") || !paths.has(path.slice(0, -6) + ".md"));
    const parsed = parseArtifact(stage, canonicalFiles);
    itemCount += parsed.items.length;
    if (itemCount > 10000) throw new RebuildProblem("payload_too_large");
    const attachments = parsed.representation === "html"
      ? manifest.filter(({ path }) => path !== parsed.sourcePath).map(({ path, sha256 }) => ({ path, sha256 })) : [];
    const envelope = { version: "nexus.content/1", parser_contract: `${parserVersion}:${stage}`, source_files: manifest, attachments };
    return { part, stage, files, manifest: attachments, ...parsed, contentVersion: sha256(canonicalJSON(envelope)) };
  });
}
