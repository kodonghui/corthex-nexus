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
