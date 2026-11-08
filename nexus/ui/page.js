// The code of the redesign's pages (stage 08's rule 15). The server drew every reading
// part from the page's data with ../src/draw/page.js; this code draws them again from
// the same data with the same functions and replaces only a part whose drawing differs,
// so that nothing moves when it runs. The parts' behaviour joins with their screens
// (TASK-273 to TASK-277); until then their controls stay as the server drew them.
import {drawParts} from "../src/draw/page.js";
import "./page.css";

const root=document.documentElement;
// A part as the code compares it: the browser's reading of its markup, without what the
// person changed on it before the code ran, such as a <details> that they opened.
function markup(html){
  const template=document.createElement("template");template.innerHTML=html;
  for(const open of template.content.querySelectorAll("details[open]"))open.removeAttribute("open");
  return template.innerHTML;
}
function drawPage(payload){
  const parts=drawParts(payload);let redrawn=0;
  for(const element of document.querySelectorAll("[data-nx-part]")){
    const html=parts[element.dataset.nxPart];
    if(typeof html!=="string")throw new Error("The page holds a part that the view does not draw");
    if(markup(element.innerHTML)!==markup(html)){element.innerHTML=html;redrawn++;}
  }
  return redrawn;
}
// data-nx-code ends the wait of the bar of rule 15 (page.css): running and ready keep it
// hidden, and failed shows it, since the page then stays as the server drew it.
root.dataset.nxCode="running";
try{
  root.dataset.nxRedrawn=String(drawPage(JSON.parse(document.getElementById("view-data").textContent)));
  // IBM Plex (font-display: swap) joins after the first paint, as on 0.2's views.
  const fonts=document.getElementById("nexus-font-assets");
  if(fonts){fonts.remove();requestAnimationFrame(()=>requestAnimationFrame(()=>document.head.append(fonts.content.cloneNode(true))));}
  root.dataset.nxCode="ready";
}catch(error){root.dataset.nxCode="failed";throw error;}
