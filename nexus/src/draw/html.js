// Text into HTML for the server's first drawing and the view's: every value is
// escaped, `_` too, so that no project text can repeat the page's data marker
// (__CORTHEX_VIEW_DATA__) before the server fills it (stage 08's rule 1).
export const esc=value=>String(value??"").replace(/[&<>"'_]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","_":"&#95;"}[ch]));
// A path on this server from its segments, each encoded; never another origin.
export const path=(...segments)=>"/"+segments.map(segment=>encodeURIComponent(String(segment))).join("/");
// Counts over 999 show as 999+ (rule 12).
export const count=value=>Number(value)>999?"999+":String(Math.max(0,Math.trunc(Number(value)||0)));
// The fixed width of a number's digits keeps a count's box the same when it changes.
export const two=value=>String(value).padStart(2,"0");
// A time as "2026-11-08 17:30" (stage 09's frames). The server knows no browser's time
// zone, so its drawing writes UTC, and the view's code writes the same element's text in
// the browser's time zone (rule 2) without moving it: the digits keep their widths.
export function clock(value,local=false){
  const date=new Date(typeof value==="string"&&value?value:NaN);
  if(Number.isNaN(date.valueOf()))return String(value??"");
  const parts=local?[date.getFullYear(),date.getMonth()+1,date.getDate(),date.getHours(),date.getMinutes()]:[date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate(),date.getUTCHours(),date.getUTCMinutes()];
  return `${parts[0]}-${two(parts[1])}-${two(parts[2])} ${two(parts[3])}:${two(parts[4])}`;
}
export const time=value=>`<time datetime="${esc(value)}">${esc(clock(value))}</time>`;
// Words that hold a time: the label's {time} becomes a <time> element.
export const timed=(text,value)=>String(text).split("{time}").map(esc).join(time(value));
