// Per-response transport metadata only. No cross-request or project cache.
// Kept dependency-free so the same handler still works in the Worker.
const bodies=new WeakMap();
export function rememberHTML(response,body){if(typeof body==="string")bodies.set(response,body);return response;}
export function takeHTML(response){const body=bodies.get(response);bodies.delete(response);return body;}
