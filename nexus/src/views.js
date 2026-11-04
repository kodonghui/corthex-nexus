import {words} from "../ui/messages.js";
const URL_PATTERN=/^\/code\/[a-z0-9][a-z0-9-]{0,63}\.[0-9a-f]{8}\.(?:js|css|woff2)$/;
export function createViews(code,entries){
  for(const value of Object.values(entries).flat())if(!URL_PATTERN.test(value))throw new Error("Invalid bundled view URL");
  const link=(rel,href,extra="")=>`<link rel="${rel}" href="${href}"${extra}>`;
  return{code,template(payload){
    const lang=payload.lang==="ko"?"ko":"en",picture=payload.view==="picture",editor=picture&&payload.data?.picture?(payload.data.stage==="05-erd"?"erd":"excalidraw"):null;
    const styles=[entries["view-css"],...(editor&&entries[editor+"-css"]?[entries[editor+"-css"]]:[])];
    const preloads=[entries["view-js"],...(editor?entries[editor+"-"+lang+"-preload"]||entries[editor+"-preload"]||[]:[])];
    const loading=words(picture?"Loading the view":"Loading the overview",lang),reload=lang==="ko"?"다시 불러오기":"Load again";
    return`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"><title>NEXUS</title>${styles.filter(Boolean).map(h=>link("stylesheet",h,' data-nexus-css="'+(h===entries["view-css"]?"view":"editor")+'"')).join("")}${[...new Set(preloads)].map(h=>link("modulepreload",h)).join("")}${editor==="excalidraw"?(entries["font-preload"]||[]).map(h=>link("preload",h,' as="font" type="font/woff2" crossorigin')).join(""):""}</head><body><div id="view"><main class="content"><p>${loading}</p><a href="">${reload}</a></main></div><script id="view-data" type="application/json">__CORTHEX_VIEW_DATA__</script><script type="module" src="${entries["view-js"]}"></script></body></html>`;
  }};
}
