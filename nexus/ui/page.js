// The code of the redesign's pages (stage 08's rule 15). The server drew every reading
// part from the page's data with ../src/draw/page.js; this code draws them again from
// the same data with the same functions and replaces only a part whose drawing differs,
// so that nothing moves when it runs. Then it adds what the parts do: the first page's
// answers, reading again, order and fragments (./home.js, TASK-273), and a stage's filters,
// search, grouping, next 200, addresses and record (./stage.js, TASK-274); the picture, the
// talk, the item and the search join with their screens (TASK-275 to TASK-277).
import {drawParts,pageKind} from "../src/draw/page.js";
import {clock,day} from "../src/draw/html.js";
import {localizeLoop} from "../src/draw/loop.js";
import {startHome} from "./home.js";
import {startStage} from "./stage.js";
import {markup} from "./reconcile.js";
import "./page.css";

const root=document.documentElement;
function drawPage(payload){
  const parts=drawParts(payload);let redrawn=0;
  for(const element of document.querySelectorAll("[data-nx-part]")){
    const html=parts[element.dataset.nxPart];
    if(typeof html!=="string")throw new Error("The page holds a part that the view does not draw");
    if(markup(element.innerHTML)!==markup(html)){element.innerHTML=html;redrawn++;}
  }
  return redrawn;
}
// The server wrote each time in UTC; the code writes it in the browser's time zone
// (rule 2), in the same digits, so that nothing moves: a time, or a day where only its
// date shows, such as a checkpoint's. The loop's times say how long ago, and the mark of a
// long wait shows, as of the browser's clock (rules 19 and 20).
function localTimes(scope,lang){
  for(const element of scope.querySelectorAll("time[datetime]")){
    const value=element.getAttribute("datetime"),text=element.hasAttribute("data-nx-day")?day(value,true):clock(value,true);
    if(element.textContent!==text)element.textContent=text;
  }
  localizeLoop(scope,lang);
}
// data-nx-code ends the wait of the bar of rule 15 (page.css): running and ready keep it
// hidden, and failed shows it, since the page then stays as the server drew it.
root.dataset.nxCode="running";
try{
  const payload=JSON.parse(document.getElementById("view-data").textContent),localize=scope=>localTimes(scope,payload.lang);
  root.dataset.nxRedrawn=String(drawPage(payload));
  if(pageKind(payload)==="home")startHome(document.querySelector('[data-nx-part="home"]'),payload,{localize});
  else startStage(payload,{localize});
  localize(document.body);
  // A page that comes back into view works out how long ago again (rule 19), whether or not
  // it reads its data again.
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")localize(document.body);});
  // IBM Plex (font-display: swap) joins after the first paint, as on 0.2's views.
  const fonts=document.getElementById("nexus-font-assets");
  if(fonts){fonts.remove();requestAnimationFrame(()=>requestAnimationFrame(()=>document.head.append(fonts.content.cloneNode(true))));}
  root.dataset.nxCode="ready";
}catch(error){root.dataset.nxCode="failed";throw error;}
