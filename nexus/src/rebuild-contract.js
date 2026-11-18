import { readFileSync } from "node:fs";
import { RebuildProblem, strictQuery } from "./rebuild-http.js";

const contract = JSON.parse(readFileSync(new URL("../../docs/06-api/sources/rebuild/openapi.json", import.meta.url), "utf8"));
export const schemas = contract.components.schemas;
export const stageKeys = schemas.StageSummary.properties.stage.enum;
export const publicSample = contract.paths["/api/v2/sample"].get.responses["200"].content["application/json"].examples.success.value;
export const idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/;
export const tracePattern = /^[A-Z]+-[0-9]{3,7}(?:#[A-Za-z0-9_-]{1,64})?$/;
export const digestPattern = /^[a-f0-9]{64}$/;
export const commitPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
export const partPattern = /^[^/\\?#%\p{C}]{1,80}$/u;
export const previewPolicy = schemas.Preview.properties.csp.const;

// Compile exact path and method registrations from the approved contract.
export function rebuildRoutes(handlers) {
  return Object.entries(contract.paths).flatMap(([path, operations]) => {
    const names = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => name);
    const expression = new RegExp("^" + path.replace(/\{\w+\}/g, "([^/]+)") + "$");
    const methods = Object.fromEntries(Object.entries(operations).filter(([, op]) => Object.hasOwn(handlers, op.operationId))
      .map(([method, op]) => [method.toUpperCase(), { handle: handlers[op.operationId],
        queries: op.parameters.filter((param) => param.in === "query").map(({ name }) => name) }]));
    return Object.keys(methods).length ? [{ match: (path) => expression.exec(path), names, methods }] : [];
  });
}

export function routeRequest(routes, request, url) {
  for (const template of routes) {
    const matched = template.match(url.pathname);
    if (!matched) continue;
    const op = Object.hasOwn(template.methods, request.method) && template.methods[request.method];
    if (!op) throw new RebuildProblem("method_not_allowed", { Allow: Object.keys(template.methods).join(", ") });
    const ids = {};
    for (let i = 0; i < template.names.length; i++) {
      const name = template.names[i];
      let value;
      try { value = decodeURIComponent(matched[i + 1]); } catch { throw new RebuildProblem("invalid_input"); }
      const valid = name === "stage" ? stageKeys.includes(value) :
        (name === "part" ? partPattern : name === "itemId" ? tracePattern : idPattern).test(value);
      if (!valid) throw new RebuildProblem("invalid_input");
      ids[name] = value;
    }
    strictQuery(url.searchParams, op.queries);
    return { op, ids };
  }
  throw new RebuildProblem("not_found");
}
