// Stage 12's page checks (TASK-278), which the walk of the redesign's states runs on each state
// and the folds' suite on the workspace's folds (TASK-287): each an expression that the page
// evaluates and that returns what it measured.
// Sideways: neither the page nor its body is wider than the window.
export const SIDEWAYS=`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth})`;
// Outside: an element shown, larger than a pixel, whose box leaves the window's sides, unless a
// box that clips it, inside the window, holds it, as the picture's frame and a scrolling row do.
export const OUTSIDE=`(()=>{const w=innerWidth,found=[];
 const name=e=>e.tagName.toLowerCase()+(typeof e.className==='string'&&e.className.trim()?'.'+e.className.trim().split(/\\s+/).join('.'):'');
 const clipped=e=>{for(let p=e.parentElement;p&&p!==document.body&&p!==document.documentElement;p=p.parentElement){if(getComputedStyle(p).overflowX!=='visible'){const r=p.getBoundingClientRect();if(r.left>=-1&&r.right<=w+1)return true;}}return false;};
 for(const e of document.body.querySelectorAll('*')){
  if(e.closest('svg')&&e.tagName.toLowerCase()!=='svg')continue;
  const r=e.getBoundingClientRect();if(r.width<=1||r.height<=1||(r.left>=-1&&r.right<=w+1))continue;
  if(!e.checkVisibility({visibilityProperty:true,opacityProperty:true})||clipped(e))continue;
  found.push({element:name(e),box:[r.left,r.top,r.width,r.height].map(Math.round)});if(found.length>=8)break;
 }
 return found;})()`;
// Rule 14 at 390 pixels: each control that a finger can select, shown and enabled, outside a
// picture's SVG, takes a press 21 pixels above, below, left and right of its centre, where the
// point is in the window; what the press hits is the control, inside it, or the label that
// gives it the press. A box that is ticked with its words is pressed on its label, so the label's
// box is probed. A control that something else covers at its centre, as a sheet covers the page
// behind it, cannot be selected now and is counted apart, and the scrim behind a sheet, whose
// press is all the window outside the sheet, is not probed. A link inside a line of text is told
// apart, as WCAG 2.5.8 leaves it out; any other miss fails the state. Controls of one kind, the
// same element with the same classes and role, as the rows of a list are, share their box's
// rules, so six of each kind are probed on a page and the rest are counted as alike.
export const HITS=`(()=>{const sel='button,a[href],[role=tab],input:not([type=hidden]),select,textarea,summary',found=[],kinds={};let total=0,covered=0,alike=0;
 const name=e=>(e.getAttribute('aria-label')||e.textContent||e.getAttribute('placeholder')||e.name||e.className||e.tagName).replace(/\\s+/g,' ').trim().slice(0,40);
 const inline=e=>{if(e.tagName!=='A'||getComputedStyle(e).display!=='inline')return false;const p=e.parentElement;return!!p&&[...p.childNodes].some(n=>n!==e&&n.nodeType===3&&n.textContent.trim());};
 const takes=(e,hit)=>!!hit&&(hit===e||e.contains(hit)||hit.closest('label')?.control===e);
 const tag=hit=>hit?hit.tagName.toLowerCase()+(typeof hit.className==='string'&&hit.className?'.'+hit.className.trim().split(/\\s+/)[0]:''):null;
 for(const e of document.querySelectorAll(sel)){
  if(e.closest('svg,[inert],[hidden]')||e.matches('.scrim')||e.disabled||e.getAttribute('aria-disabled')==='true'||!e.checkVisibility({visibilityProperty:true,opacityProperty:true}))continue;
  const r0=e.getBoundingClientRect();if(r0.width<2||r0.height<2)continue;
  const kind=e.tagName+(typeof e.className==='string'?'.'+e.className.trim().split(/\\s+/).sort().join('.'):'')+'/'+(e.getAttribute('role')||'');
  if((kinds[kind]=(kinds[kind]||0)+1)>6){alike++;continue;}
  const box=(e.type==='checkbox'||e.type==='radio')&&e.closest('label')?.control===e?e.closest('label'):e;
  box.scrollIntoView({block:'center',inline:'nearest'});
  const r=box.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
  if(!takes(e,document.elementFromPoint(x,y))){covered++;continue;}
  total++;
  const misses=[[0,-21],[0,21],[-21,0],[21,0]].filter(([dx,dy])=>{const px=x+dx,py=y+dy;if(px<0||py<0||px>=innerWidth||py>=innerHeight)return false;return!takes(e,document.elementFromPoint(px,py));})
   .map(([dx,dy])=>[dx,dy,tag(document.elementFromPoint(x+dx,y+dy))]);
  if(misses.length)found.push({control:e.tagName.toLowerCase()+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\\s+/).join('.'):''),name:name(e),box:[r.x,r.y,r.width,r.height].map(Math.round),inline:inline(e),misses});
 }
 scrollTo(0,0);for(const s of document.querySelectorAll('.list,.side,.rail,.turns,.dp .dpb'))s.scrollTop=0;
 return{probed:total,covered,alike,missed:found};})()`;
