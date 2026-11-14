// The loop's two times and the mark of a long wait (stage 08's rules 19 and 20, SPEC-188,
// SPEC-189), as the server draws them when it serves a page and the view's code works them
// out again: when the server last stored the project's snapshot, with its commit; when the
// agent last read its agent to-do; each as a time with how long ago; and the mark while an
// entry has waited unread for more than 24 hours. The server draws how long ago and the mark
// as of base, the time of the page's data, so that the code's first drawing is the same;
// the code then writes them as of the browser's clock, also whenever the page comes back
// into view (../../ui/page.js).
import {esc,time} from "./html.js";
import {icon} from "./icons.js";
import {label,labels} from "./words.js";

const MINUTE=60000,HOUR=60*MINUTE,DAY=24*HOUR;
const ms=value=>typeof value==="number"?value:typeof value==="string"&&value?Date.parse(value):NaN;
// How long ago a time was, as of now, rounded down: "just now" under a minute, then minutes
// under an hour, hours under 24 and days. A time after now, as from a clock behind the
// server's, is "just now". Nothing for a time that is not one.
export function agoWords(value,now,lang){
  const then=ms(value),at=ms(now);
  if(!Number.isFinite(then)||!Number.isFinite(at))return"";
  const gone=Math.max(0,at-then);
  if(gone<MINUTE)return label("How long ago",0,lang);
  if(gone<HOUR)return label("How long ago",1,lang,{n:Math.floor(gone/MINUTE)});
  if(gone<DAY)return label("How long ago",2,lang,{n:Math.floor(gone/HOUR)});
  return label("How long ago",3,lang,{n:Math.floor(gone/DAY)});
}
// Whether the oldest unread entry, waiting since since, has waited more than 24 hours by now.
export function waitedLong(since,now){
  const then=ms(since),at=ms(now);
  return Number.isFinite(then)&&Number.isFinite(at)&&at-then>DAY;
}
// Words with places for HTML, such as "Pushed {time}": the words escaped, each place filled.
export function placed(text,fills){
  return String(text).split(/(\{[a-z]+\})/).map(part=>Object.hasOwn(fills,part.slice(1,-1))&&/^\{[a-z]+\}$/.test(part)?fills[part.slice(1,-1)]:esc(part)).join("");
}
// A time of the loop: the date and time, which the code writes in the browser's time zone,
// and how long ago, in brackets, which the code works out again.
export function loopTime(value,base,lang){
  const ago=agoWords(value,base,lang);
  if(!ago)return time(value);
  return placed(label("A time of the loop",0,lang),{date:time(value),ago:`<span data-nx-ago="${esc(value)}">${esc(ago)}</span>`});
}
// The last push: the first 7 characters of the commit, or "No commit", and "Pushed {time}".
export function lastPush(commit,pushedAt,base,lang){
  const named=commit?`<span class="mono">${esc(String(commit).slice(0,7))}</span>`:esc(label("The last push",1,lang));
  return`${named} · ${pushed(pushedAt,base,lang)}`;
}
export const pushed=(pushedAt,base,lang)=>placed(label("The last push",0,lang),{time:loopTime(pushedAt,base,lang)});
// The agent's last read: "Read by the agent {time}", "Not read by the agent yet" before the
// first read, or, for a project without a space, "No agent to-do yet".
export function lastRead(space,readAt,base,lang){
  if(!space)return esc(label("The agent's last read",2,lang));
  if(!readAt)return esc(label("The agent's last read",1,lang));
  return placed(label("The agent's last read",0,lang),{time:loopTime(readAt,base,lang)});
}
// The mark of a long wait, with its line on what it means. It is drawn, hidden or not,
// wherever an entry waits unread, so that the code can show it once 24 hours have passed.
export function longWait(since,base,lang){
  if(!since)return"";
  const [mark,meaning]=labels("The mark of a long wait",lang);
  return`<div class="m24w" data-nx-since="${esc(since)}"${waitedLong(since,base)?"":" hidden"}><span class="m24">${icon("i-warn")}<span>${esc(mark)}</span></span><span class="m24l">${esc(meaning)}</span></div>`;
}
// The mark alone, a shape with its words for screen readers, where the folded list of stages
// keeps it (SCR-111#folded): a button that opens the project's data (SCR-130), whose name
// says the mark and where it leads. It waits for the code, which opens the panel (rule 15).
export function longWaitShape(since,base,lang,code=false){
  if(!since)return"";
  const name=`${labels("The mark of a long wait",lang)[0]}, ${label("The workspace's head",0,lang)}`;
  return`<button class="fmk" type="button" data-nx-act="data" data-nx-focus="fmk" aria-haspopup="dialog" data-nx-since="${esc(since)}"${waitedLong(since,base)?"":" hidden"}${code?"":' disabled data-nx-wait="data"'}>${icon("i-warn")}<span class="sr">${esc(name)}</span></button>`;
}
// The code's step: how long ago and the marks, as of now, in a part of the page.
export function localizeLoop(scope,lang,now=Date.now()){
  for(const element of scope.querySelectorAll("[data-nx-ago]")){
    const text=agoWords(element.getAttribute("data-nx-ago"),now,lang);
    if(text&&element.textContent!==text)element.textContent=text;
  }
  for(const element of scope.querySelectorAll("[data-nx-since]")){
    const hide=!waitedLong(element.getAttribute("data-nx-since"),now);
    if(element.hidden!==hide)element.hidden=hide;
  }
}
