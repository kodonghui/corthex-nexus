import {words} from "../ui/messages.js";
import {picturePreview} from "./preview.js";
const URL_PATTERN=/^\/code\/[a-z0-9][a-z0-9-]{0,63}\.[0-9a-f]{8}\.(?:js|css|woff2)$/;
export function createViews(code,entries){
  for(const value of Object.values(entries).flat())if(!URL_PATTERN.test(value))throw new Error("Invalid bundled view URL");
  const cssFile=code[entries["view-css"]?.slice(6)],css=cssFile?(typeof cssFile.body==="string"?cssFile.body:new TextDecoder().decode(cssFile.body)):"";
  if(css&&(!cssFile.type.startsWith("text/css")||/<\/style\b/i.test(css)))throw new Error("Unsafe critical stylesheet");
  const link=(rel,href,extra="")=>`<link rel="${rel}" href="${href}"${extra}>`;
  return{code,hints(payload){
    // Only immutable public bundle names; never project names or page data.
    if(payload.view!=="picture"||!payload.data?.picture)return"";
    return entries["view-js"]?`<${entries["view-js"]}>; rel=preload; as=script; crossorigin`:"";
  },template(payload){
    const lang=payload.lang==="ko"?"ko":"en",picture=payload.view==="picture",editor=picture&&payload.data?.picture?(payload.data.stage==="05-erd"?"erd":"excalidraw"):null;
    const deferred=[...new Set(editor?entries[editor+"-"+lang+"-preload"]||entries[editor+"-preload"]||[]:[])];
    const editorAssets=editor?`<template id="nexus-editor-assets">${deferred.map(h=>link("modulepreload",h)).join("")}${entries[editor+"-css"]?link("stylesheet",entries[editor+"-css"],' data-nexus-css="editor"'):""}${editor==="excalidraw"?(entries["font-preload"]||[]).map(h=>link("preload",h,' as="font" type="font/woff2" crossorigin')).join(""):""}</template>`:"";
    const loading=words(picture?"Loading the view":"Loading the overview",lang),reload=lang==="ko"?"다시 불러오기":"Load again";
    const initial=picture?picturePreview(payload.data,lang):"";
    return`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"><title>NEXUS</title>${css?`<style data-nexus-css="view">${css}</style>`:""}${entries["view-js"]?link("modulepreload",entries["view-js"]):""}${editorAssets}</head><body><div id="view" class="view">${initial||`<main class="content"><p>${loading}</p><a href="">${reload}</a></main>`}</div><script id="view-data" type="application/json">__CORTHEX_VIEW_DATA__</script><script type="module" src="${entries["view-js"]}"></script></body></html>`;
  }};
}
