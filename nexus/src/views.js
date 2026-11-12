import {words} from "../ui/messages.js";
import {picturePreview} from "./preview.js";
import {drawBody,pageKind,pageTitle} from "./draw/page.js";
import {esc} from "./draw/html.js";
import {PICTURE_STAGES} from "./draw/stage.js";
const URL_PATTERN=/^\/code\/[a-z0-9][a-z0-9-]{0,63}\.[0-9a-f]{8}\.(?:js|css|woff2)$/;
export function createViews(code,entries){
  for(const value of Object.values(entries).flat())if(!URL_PATTERN.test(value))throw new Error("Invalid bundled view URL");
  // The views' stylesheets go into their pages, so that a page reads before its code.
  const sheet=name=>{
    const file=code[entries[name]?.slice(6)],text=file?(typeof file.body==="string"?file.body:new TextDecoder().decode(file.body)):"";
    if(text&&(!file.type.startsWith("text/css")||/<\/style\b/i.test(text)))throw new Error("Unsafe critical stylesheet");
    return text;
  };
  const css=sheet("view-css"),pageCSS=sheet("page-css");
  const link=(rel,href,extra="")=>`<link rel="${rel}" href="${href}"${extra}>`;
  // An editor's code, style and fonts, which the page's code adds once it lays the editor over
  // the picture (SCR-112#loading).
  const editorAssets=(editor,lang)=>{
    if(!editor)return"";
    const deferred=[...new Set(entries[editor+"-"+lang+"-preload"]||entries[editor+"-preload"]||[])];
    return`<template id="nexus-editor-assets">${deferred.map(h=>link("modulepreload",h)).join("")}${entries[editor+"-css"]?link("stylesheet",entries[editor+"-css"],' data-nexus-css="editor"'):""}${editor==="excalidraw"?(entries["font-preload"]||[]).map(h=>link("preload",h,' as="font" type="font/woff2" crossorigin')).join(""):""}</template>`;
  };
  return{code,refusalCSS:css,hints(payload){
    // Only immutable public bundle names; never project names or page data.
    if(payload.view!=="picture"||!payload.data?.picture)return"";
    return entries["view-js"]?`<${entries["view-js"]}>; rel=preload; as=script; crossorigin`:"";
  },template(payload){
    const lang=payload.lang==="ko"?"ko":"en",picture=payload.view==="picture",editor=picture&&payload.data?.picture?(payload.data.stage==="05-erd"?"erd":"excalidraw"):null;
    const loading=words(picture?"Loading the view":"Loading the overview",lang),reload=lang==="ko"?"다시 불러오기":"Load again";
    const initial=picture?picturePreview(payload.data,lang):"";
    return`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"><title>NEXUS</title>${css?`<style data-nexus-css="view">${css}</style>`:""}${entries["fonts-css"]?`<template id="nexus-font-assets">${link("stylesheet",entries["fonts-css"],' data-nexus-css="fonts"')}</template>`:""}${entries["view-js"]?link("modulepreload",entries["view-js"]):""}${editorAssets(editor,lang)}</head><body><div id="view" class="view">${initial||`<main class="content"><p>${loading}</p><a href="">${reload}</a></main>`}</div><script id="view-data" type="application/json">__CORTHEX_VIEW_DATA__</script><script type="module" src="${entries["view-js"]}"></script></body></html>`;
  },page(payload){
    // The redesign's pages (stage 08's rule 15): the server draws their reading parts
    // with the view's own functions, so that a page reads before its code runs and
    // nothing moves when the code runs; the code comes from API-104.
    const kind=pageKind(payload),lang=payload.lang,script=entries["page-js"];
    const stage=kind==="stage"?payload.data?.stage:"",editor=PICTURE_STAGES.includes(stage)&&payload.picture?.picture?(stage==="05-erd"?"erd":"excalidraw"):null;
    const fonts=entries["fonts-css"]?`<template id="nexus-font-assets">${link("stylesheet",entries["fonts-css"],' data-nexus-css="fonts"')}</template>`:"";
    return`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"><title>${esc(pageTitle(payload))}</title>${pageCSS?`<style data-nexus-css="page">${pageCSS}</style>`:""}${fonts}${(entries["page-preload"]||[]).map(h=>link("modulepreload",h)).join("")}${editorAssets(editor,lang)}</head><body class="nx" data-nx-page="${kind}">${drawBody(payload)}<script id="view-data" type="application/json">__CORTHEX_VIEW_DATA__</script>${script?`<script type="module" src="${script}"></script>`:""}</body></html>`;
  }};
}
