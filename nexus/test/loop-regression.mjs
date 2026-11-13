/**
 * TASK-298: the loop's two times and the marks of what the agent has not read, in a browser
 * (stage 08's rules 19, 20 and 23, SPEC-188, SPEC-189). On the first page (SCR-110#normal): each
 * card's last push with its commit or "No commit" and the agent's last read, "Not read by the
 * agent yet" or "No agent to-do yet", each time with how long ago, and the mark of a long wait
 * with its line; the agent to-do's lines and "{n} not read yet". In the workspace (SCR-111#normal
 * and #folded, SCR-114#normal): the head's two times and the mark, the folded rail's mark, which
 * does nothing, and the talk's "Not read by the agent yet" on the entries that wait unread, not on
 * those read or taken. Each at its widths, in both themes and languages, with stage 12's page
 * checks (./page-checks.mjs) and a frame of each. Then the server's drawing before the code runs,
 * in Seoul's time zone, and the code's, with the same boxes (SCR-110#loading, SCR-111#loading);
 * the page shown again an hour and a day later, by a clock that the suite moves (TC-1416); and
 * the agent's read, after which the page that reads again drops the marks (TC-1418). Node 24
 * built-ins only; an owned headless Chrome over CDP. Requires NEXUS_QA_LOOP=1, the opt-in
 * view-server, NEXUS_CHROME and NEXUS_QA_ORIGIN. Synthetic loopback fixture only: the page's reads
 * reach the fixture server, the suite holds the page's code and its fonts in the loading tests,
 * moves the page's clock and dispatches visibilitychange where a test says so, and the agent's
 * reads go to the fixture as a session's would.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {label,labels} from '../src/draw/words.js';
import {stagePath} from '../src/draw/stages.js';
import {clock,day,count} from '../src/draw/html.js';
import {agoWords,waitedLong} from '../src/draw/loop.js';
import {FOLD_KEYS} from '../ui/folds.js';
import {SIDEWAYS,OUTSIDE,HITS} from './page-checks.mjs';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_LOOP!=='1')throw Error('Use only the opt-in synthetic loop fixture');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,HOUR=3600000;
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'loop-');
const {folder}=browser;
const report={schema:'nexus-loop-browser-regression/1',scope:'synthetic loopback fixture only',evidence:'page measurement and screenshots; the page\'s reads reach the fixture server; the suite holds the page\'s code and fonts in the loading tests (held), moves the page\'s clock and dispatches visibilitychange in the tests that say so (mocked clock, dispatched event), and sends the agent\'s reads through the fixture as a session\'s',
 startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],blockedExternalOrigins:[],posts:[],agentReads:[],runtimeExceptions:[],console:[]};
const budget=Number(process.env.NEXUS_QA_LOOP_BUDGET_MS)||300000,softDeadline=Date.now()+budget;
let ws,session,seq=0,held=null,fonts=null,closing=false,codeEntry,qa,zone='UTC',requests=0;
const pending=new Map(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const out=(name,value)=>fs.writeFile(path.join(folder,name),JSON.stringify(value,null,2));
class CheckFailure extends Error{}
function assert(ok,message){if(!ok)throw new CheckFailure(message);}
function command(method,params={},scoped=true,timeout=15000){
 if(!closing&&Date.now()>softDeadline)return Promise.reject(Error(Math.round(budget/1000)+'s work budget reached; preserving time for owned cleanup'));
 const id=++seq;
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},timeout);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params,...(scoped?{sessionId:session}:{})}));});
}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
const NAVIGATED=/navigated or closed|Execution context was destroyed|Cannot find context/;
async function waitFor(expression,timeout=10000){const stop=Date.now()+timeout;while(Date.now()<stop){let ok=false;try{ok=await evaluate(expression);}catch(error){if(!NAVIGATED.test(String(error)))throw error;}if(ok)return;await sleep(25);}throw Error('Page wait timed out: '+expression);}
async function paint(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function setting({width,theme='light',touch=width<1024}){
 await command('Emulation.setDeviceMetricsOverride',{width,height:width<1024?844:900,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
 await command('Emulation.setTouchEmulationEnabled',touch?{enabled:true,maxTouchPoints:1}:{enabled:false});
}
async function timeZone(id){if(id===zone)return;await command('Emulation.setTimezoneOverride',{timezoneId:id});zone=id;}
// A workspace that rests: no reading runs, a picture shown is drawn, and, unless the suite holds
// them, the fonts that the code adds are in. The first page rests when no reading runs.
const RESTS=withFonts=>`(()=>{const q=s=>document.querySelector(s),shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});
 if(q('.home'))return(q('.home .upd')?.textContent||'')==='';
 if(['.stage .upd','.side .tupd'].some(s=>(q(s)?.textContent||'')!==''))return false;
 const pf=q('.pf');if(shown(pf)&&!q('.pf > .cv.drawn, .pf .empty-p, .pf .fnote .msg.warn'))return false;
 ${withFonts?`const fonts=q('link[data-nexus-css="fonts"]');if(fonts&&(!fonts.sheet||document.fonts.status!=='loaded'))return false;`:''}
 return true;})()`;
async function settled(){await waitFor(RESTS(!fonts),15000);await paint();}
// Navigation returns once the page is parsed; its held code may not have run yet.
async function open(route,{ready=true}={}){
 const url=origin+route,[base,fragment='']=url.split('#');await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url});
 await waitFor(`location.href.split('#')[0]===${JSON.stringify(base)}&&${JSON.stringify(fragment)}.split('&').filter(Boolean).every(p=>('&'+location.hash.slice(1)+'&').includes('&'+p+'&'))&&document.readyState!=='loading'&&!!document.getElementById('view-data')`,15000);
 if(ready){await waitFor(`document.documentElement.dataset.nxCode==='ready'`,15000);await settled();}
 await paint();
}
// The browser's storage of the fixture's origin, emptied, then holding the folds named, which a
// page of the origin writes as the page's code would.
async function fresh(kept={}){
 await command('Page.navigate',{url:'about:blank'});
 await command('Storage.clearDataForOrigin',{origin,storageTypes:'local_storage'});
 const entries=Object.entries(kept).filter(([,value])=>value);
 if(!entries.length)return;
 await command('Page.navigate',{url:origin+'/__qa/receipts'});
 await waitFor(`location.origin===${JSON.stringify(origin)}&&document.readyState==='complete'`);
 await evaluate(`(()=>{${entries.map(([name,value])=>`localStorage.setItem(${JSON.stringify(FOLD_KEYS[name])},${JSON.stringify(value)});`).join('')}})()`);
}
async function shot(name){const image=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(folder,name+'.png'),Buffer.from(image.data,'base64'));return name+'.png';}
async function fullShot(name){
 // Beyond the viewport the whole page fits, so Chrome lays it out again without its scrollbar, at the
 // window's width; the content's width, measured beside the scrollbar, is narrower, and a clip of
 // it would cut the page's right edge.
 const {cssContentSize}=await command('Page.getLayoutMetrics');
 const width=Math.max(Math.ceil(cssContentSize.width),await evaluate('innerWidth'));
 const image=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.min(6000,Math.ceil(cssContentSize.height)),scale:1}});
 await fs.writeFile(path.join(folder,name+'.png'),Buffer.from(image.data,'base64'));return name+'.png';
}
async function test(name,fn){
 const startedAt=new Date().toISOString();
 try{const evidence=await fn();report.tests.push({name,verdict:'works',startedAt,finishedAt:new Date().toISOString(),...evidence});console.log('PASS '+name);}
 catch(error){let screenshot;try{screenshot=await shot(name+'-failure');}catch{}report.tests.push({name,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),error:String(error),screenshot});console.error('FAIL '+name+': '+error);}
 finally{try{await release();}catch{}try{await timeZone('UTC');}catch{}}
 await out('results.json',report);
}
async function releaseOne(hold){if(!hold)return;for(const id of hold.requests){try{await command('Fetch.continueRequest',{requestId:id});}catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;}}}
async function release(){const code=held,font=fonts;held=null;fonts=null;await releaseOne(code);await releaseOne(font);}
async function releaseCode(){const code=held;held=null;await releaseOne(code);}
async function onPaused(event){
 const url=new URL(event.request.url),method=event.request.method,where=url.pathname+url.search;
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 requests++;if(method==='POST')report.posts.push({path:url.pathname,at:new Date().toISOString()});
 for(const hold of[held,fonts])if(hold&&hold.pattern.test(where)){hold.requests.push(event.requestId);report.interceptions.push({path:where,method,action:'held',at:new Date().toISOString()});return;}
 try{await command('Fetch.continueRequest',{requestId:event.requestId});}
 catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;report.interceptions.push({path:where,method,action:'dropped by the page',at:new Date().toISOString()});}
}
async function clickAt(x,y){for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});}
async function click(selector){
 const at=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}));if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'No control to click: '+selector);await clickAt(at.x,at.y);await paint();
}
// What a screen reader reads of an element: Chrome's accessibility tree, its role and name.
async function ax(selector){
 const {root}=await command('DOM.getDocument',{depth:0});
 const {nodeIds}=await command('DOM.querySelectorAll',{nodeId:root.nodeId,selector});
 const nodes=[];
 for(const nodeId of nodeIds){const {nodes:[node]}=await command('Accessibility.getPartialAXTree',{nodeId,fetchRelatives:false});nodes.push({role:node.role?.value??null,name:node.name?.value??null,ignored:Boolean(node.ignored),focusable:Boolean(node.properties?.find(p=>p.name==='focusable')?.value?.value)});}
 return nodes;
}
// The page's clock moved by the hours given, from now on, as a page left open would find it:
// Date as the page's code reads it, the browser's own clock untouched; then the page shown again.
async function later(hours){
 await evaluate(`(()=>{if(!window.__nxClock){const Real=Date;window.__nxClock={offset:0};window.Date=class extends Real{constructor(...a){super(...(a.length?a:[Real.now()+window.__nxClock.offset]));}static now(){return Real.now()+window.__nxClock.offset;}};}window.__nxClock.offset=${hours*HOUR};})()`);
 await evaluate(`document.dispatchEvent(new Event('visibilitychange'))`);
}
async function agentRead(name){
 const answer=await fetch(origin+'/__qa/agent-read'+(name?'?project='+encodeURIComponent(name):''),{method:'POST',signal:AbortSignal.timeout(10000)});
 assert(answer.ok,'The agent\'s read failed: '+answer.status);
 const {read_at:readAt}=await answer.json();report.agentReads.push({project:name||qa.project,read_at:readAt});return readAt;
}
async function data(route){const answer=await fetch(origin+route,{signal:AbortSignal.timeout(10000)});assert(answer.ok,route+': '+answer.status);return answer.json();}

// What a page shows of the loop (rules 19 and 20): each place that holds the times, with its
// lines, its times and how long ago, its mark, and where they stand in their box.
function loopView(){
 const txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():null,shown=e=>Boolean(e&&e.checkVisibility({visibilityProperty:true}));
 const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const round=r=>[r.left,r.top,r.width,r.height].map(v=>Math.round(v*10)/10);
 const probe=document.createElement('span');probe.style.display='none';document.body.append(probe);
 const token=name=>{probe.style.color=`var(${name})`;return getComputedStyle(probe).color;};
 const warn=token('--nx-color-warn'),warnBg=token('--nx-color-warn-bg');probe.remove();
 const whole=e=>!e||e.scrollWidth<=e.clientWidth+1;
 const mark=(w,box)=>{
  if(!w)return null;
  const pill=w.querySelector('.m24'),words=pill?.querySelector(':scope > span'),line=w.querySelector('.m24l'),out={shown:shown(w),hidden:w.hidden,since:w.dataset.nxSince||null,words:txt(words),line:txt(line)};
  if(out.shown){const cs=getComputedStyle(pill),r=rect(w);out.box=round(r);out.inside=r.left>=box.left-0.5&&r.right<=box.right+0.5;out.whole=whole(words)&&whole(line);out.tokens=cs.color===warn&&cs.backgroundColor===warnBg;out.shape=shown(pill.querySelector('svg'));}
  return out;
 };
 // scope holds the lines and the mark; frame is the box that they stay inside.
 const place=(scope,frame,name)=>{
  if(!scope)return null;
  const loop=scope.querySelector('.loop'),lines=loop?[...loop.children]:[],box=rect(frame),m=scope.querySelector('.m24w');
  const boxes=lines.map(rect);
  return{name,shown:shown(scope),lines:lines.map(txt),
   agos:[...scope.querySelectorAll('[data-nx-ago]')].map(e=>({value:e.dataset.nxAgo,text:txt(e)})),
   times:[...scope.querySelectorAll('.loop time[datetime]')].map(e=>({value:e.getAttribute('datetime'),text:txt(e)})),
   mark:mark(m,box),boxes:boxes.map(round),
   inside:shown(scope)?boxes.every(b=>b.left>=box.left-0.5&&b.right<=box.right+0.5)&&lines.every(whole):null,
   apart:boxes.every((b,i)=>i===0||b.top>=boxes[i-1].bottom-0.5),
   under:!m||!shown(m)||!boxes.length||rect(m).top>=boxes[boxes.length-1].bottom-0.5};
 };
 const q=s=>document.querySelector(s);
 const cards=[...document.querySelectorAll('.home .pcard')].map(card=>place(card.querySelector('.ptimes'),card,card.querySelector('[data-nx-focus^="open:"]')?.dataset.nxFocus.slice(5)));
 const todo=[...document.querySelectorAll('.home .pj')].map(pj=>({...place(pj,pj,pj.querySelector('[data-nx-focus^="todo:"]')?.dataset.nxFocus.split(':')[1]),unread:txt(pj.querySelector('h3 .nr')),title:txt(pj.querySelector('h3 > span:first-child'))}));
 const rail=q('nav.rail'),proj=q('.rail .proj'),fmk=q('.rail .fmk');
 const head=proj?{...place(proj,rail,'head'),name:txt(proj.querySelector('#rail-name'))}:null;
 let flag=null;
 if(fmk){
  flag={shown:shown(fmk),hidden:fmk.hidden,since:fmk.dataset.nxSince||null,name:txt(fmk.querySelector('.sr')),tag:fmk.tagName.toLowerCase(),tabIndex:fmk.tabIndex,role:fmk.getAttribute('role'),interactive:fmk.matches('[tabindex],[role]')||Boolean(fmk.closest('a,button,[role="button"]'))};
  if(flag.shown){const r=rect(fmk),top=q('.rail .ftop'),row=q('.rail .row');flag.box=round(r);flag.color=getComputedStyle(fmk).color===warn;flag.order=(!top||rect(top).bottom<=r.top+0.5)&&(!row||r.bottom<=rect(row).top+0.5);flag.inside=r.left>=rect(rail).left-0.5&&r.right<=rect(rail).right+0.5;}
 }
 const entries=[...document.querySelectorAll('.side li.te[data-nx-entry]')].filter(shown).map(li=>{
  const nrd=li.querySelector('.nrd'),r=rect(li);
  return{id:li.dataset.nxEntry,group:li.closest('ol.tl')?.dataset.nxKey||null,mark:shown(nrd)?txt(nrd):null,wait:txt(li.querySelector('.wt:not([data-nx-key="settled"])')),reflection:txt(li.querySelector('.rst')),
   placed:!nrd||!shown(nrd)||(()=>{const b=rect(nrd);return b.left>=r.left-0.5&&b.right<=r.right+0.5&&whole(nrd);})()};
 });
 const times=[...document.querySelectorAll('main time[datetime], .home time[datetime], .rail time[datetime], .side time[datetime]')].filter((e,i,all)=>all.indexOf(e)===i).map(e=>({value:e.getAttribute('datetime'),text:txt(e),day:e.hasAttribute('data-nx-day')}));
 const ws=q('.ws');
 return{code:document.documentElement.dataset.nxCode||null,redrawn:document.documentElement.dataset.nxRedrawn??null,now:Date.now(),
  cards,todo,head,flag,entries,times,ws:ws?{stages:ws.dataset.nxStages||null,talk:ws.dataset.nxTalk||null,open:ws.dataset.nxOpen||null}:null,
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
}
const view=()=>evaluate(`(${loopView})()`);

// The words that the page should show, as the server and the code draw them.
const zones={UTC:value=>clock(value),'Asia/Seoul':value=>clock(new Date(Date.parse(value)+9*HOUR).toISOString())};
const zoneDay={UTC:value=>day(value),'Asia/Seoul':value=>day(new Date(Date.parse(value)+9*HOUR).toISOString())};
const when=(value,lang,ago,inZone)=>label('A time of the loop',0,lang,{date:zones[inZone](value),ago});
const pushWords=(value,lang,ago,inZone)=>label('The last push',0,lang,{time:when(value,lang,ago,inZone)});
const pushLine=(commit,value,lang,ago,inZone)=>`${commit?String(commit).slice(0,7):label('The last push',1,lang)} · ${pushWords(value,lang,ago,inZone)}`;
const readLine=(space,readAt,lang,ago,inZone)=>!space?label("The agent's last read",2,lang):!readAt?label("The agent's last read",1,lang):label("The agent's last read",0,lang,{time:when(readAt,lang,ago,inZone)});
// How long ago, as of any moment from..to: the words that the page may show.
const agos=(value,lang,from,to)=>[...new Set([agoWords(value,from,lang),agoWords(value,to,lang)])];
// A line with one time, as of from..to: whether the page's line is one of those it may show.
const oneOf=(actual,build,value,lang,from,to)=>agos(value,lang,from,to).some(ago=>build(ago)===actual);
function agosHold(place,lang,from,to,what){
 const wrong=place.agos.filter(a=>!agos(a.value,lang,from,to).includes(a.text));
 assert(!wrong.length,what+': how long ago, as of '+new Date(from).toISOString()+'..'+new Date(to).toISOString()+': '+JSON.stringify(wrong));
}
function timesIn(v,inZone,what){
 const wrong=v.times.filter(t=>t.text!==(t.day?zoneDay:zones)[inZone](t.value));
 assert(!wrong.length,what+': times in '+inZone+': '+JSON.stringify(wrong.slice(0,4)));
}
// A place of the loop (a card, a project of the agent to-do or the workspace's head): its two
// lines, its times and its mark, as the data says, as of from..to, inside its box. drawn: a place
// that the page holds but does not show yet, whose words and hidden mark are checked alone.
function placeHolds(place,{commit,pushedAt,push=true,space,readAt,since},lang,from,to,inZone,what,drawn=false){
 assert(place&&(drawn||place.shown),what+': not shown');
 const [first,second]=place.lines;
 const pushOk=push?oneOf(first,ago=>pushLine(commit,pushedAt,lang,ago,inZone),pushedAt,lang,from,to):oneOf(first,ago=>pushWords(pushedAt,lang,ago,inZone),pushedAt,lang,from,to);
 const readOk=space&&readAt?oneOf(second,ago=>readLine(space,readAt,lang,ago,inZone),readAt,lang,from,to):second===readLine(space,readAt,lang,null,inZone);
 assert(place.lines.length===2&&pushOk&&readOk,what+': the two lines: '+JSON.stringify(place.lines));
 agosHold(place,lang,from,to,what);
 if(!drawn)assert(place.inside&&place.apart&&place.under,what+': the lines on lines of their own, whole and inside their box, the mark under them: '+JSON.stringify({inside:place.inside,apart:place.apart,under:place.under,boxes:place.boxes}));
 const [words,line]=labels('The mark of a long wait',lang);
 if(!since){assert(place.mark===null,what+': no mark without an entry that waits unread: '+JSON.stringify(place.mark));return'none';}
 const long=[from,to].map(at=>waitedLong(since,at));
 assert(place.mark&&place.mark.since===since&&place.mark.words===words&&place.mark.line===line,what+': the mark\'s words and line: '+JSON.stringify(place.mark));
 if(long[0]===long[1])assert((drawn||place.mark.shown===long[0])&&place.mark.hidden===!long[0],what+': the mark '+(long[0]?'shows':'is hidden')+': '+JSON.stringify(place.mark));
 if(drawn)return place.mark.hidden?'hidden':'drawn';
 if(place.mark.shown)assert(place.mark.inside&&place.mark.whole&&place.mark.tokens&&place.mark.shape,what+': the mark, a shape and words in the warning\'s colours, whole inside its box: '+JSON.stringify(place.mark));
 return place.mark.shown?'shown':'hidden';
}
function checksPass(checks,errors,what){
 assert(checks.sideways.scrollWidth<=checks.sideways.width&&checks.sideways.bodyWidth<=checks.sideways.width,what+': the page scrolls sideways: '+JSON.stringify(checks.sideways));
 assert(!checks.outside.length,what+': elements outside the page: '+JSON.stringify(checks.outside));
 assert(!errors.length,what+': console errors: '+JSON.stringify(errors));
 assert(!checks.hits||!checks.hits.missed.some(m=>!m.inline),what+': hit areas under 44 pixels (rule 14): '+JSON.stringify(checks.hits&&checks.hits.missed.filter(m=>!m.inline)));
}
async function pageChecks(width){
 const sideways=await evaluate(SIDEWAYS),outside=await evaluate(OUTSIDE),hits=width<1024?await evaluate(HITS):null;
 return{sideways,outside,hits};
}
const summary=checks=>({sideways:checks.sideways,outside:checks.outside.length,hits:checks.hits&&{probed:checks.hits.probed,covered:checks.hits.covered,alike:checks.hits.alike,missed:checks.hits.missed.length}});
const consoleErrors=since=>report.console.slice(since).filter(e=>e.level==='error'&&!(e.url&&new URL(e.url).pathname==='/favicon.ico'));

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json();qa=fixture.loop;
 assert(qa?.project==='qa-loop'&&qa.part==='sample'&&/^nc_/.test(qa.unread||'')&&/^ne_/.test(qa.edit||''),'The origin is not the opt-in synthetic loop fixture');
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),entries=JSON.parse(metadataBytes).entries;
 assert(/^\/code\/page\.[a-f0-9]{8}\.js$/.test(entries['page-js']||''),'Content-hashed page code is required');
 codeEntry=new RegExp('^'+entries['page-js'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
 const FONTS=/^\/code\/fonts\.[a-f0-9]{8}\.css$/;
 report.preflight={fixture:{project:qa.project,fresh:qa.fresh_project,old:qa.old,start:qa.start},build:{entries:{'page-js':entries['page-js']},sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
 const browserEnv={...process.env};for(const name of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(name))delete browserEnv[name];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-features=BackForwardCache','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],browserEnv);
 const endpoint=await browser.endpoint();
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);return;}
  if(m.sessionId!==session)return;
  if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error)+' ('+m.params.request.method+' '+new URL(m.params.request.url).pathname+')';});
  else if(m.method==='Runtime.exceptionThrown'){const text=m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text;report.runtimeExceptions.push({at:new Date().toISOString(),text});report.console.push({kind:'exception',level:'error',text:String(text)});}
  else if(m.method==='Runtime.consoleAPICalled'&&['error','warning','assert'].includes(m.params.type))report.console.push({kind:'console',level:m.params.type==='warning'?'warning':'error',text:m.params.args.map(a=>a.value??a.description??'').join(' ')});
  else if(m.method==='Log.entryAdded'&&['error','warning'].includes(m.params.entry.level))report.console.push({kind:'log',source:m.params.entry.source,level:m.params.entry.level,text:m.params.entry.text,url:m.params.entry.url||null});
 };
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Log.enable');await command('DOM.enable');await command('Accessibility.enable');
 await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await command('Emulation.setTimezoneOverride',{timezoneId:'UTC'});

 // The data that the pages draw, as the fixture's server gives it.
 const home=await data('/api/home'),agentOf=new Map(home.agent.map(row=>[row.project,row])),cardOf=new Map(home.projects.map(card=>[card.name,card]));
 const stageOf=async name=>(await data(`/api/spaces/${name}/stages/${qa.part}/05-erd`)).project;
 const shop=await stageOf(qa.project),fresh_=await stageOf(qa.fresh_project);
 const talk=await data(`/api/spaces/${qa.project}/talk/${qa.part}/05-erd`);
 const unreadIds=[...talk.agent.entries,...talk.reflections].filter(e=>e.unread).map(e=>e.id).sort();
 const claim=talk.agent.entries.find(e=>e.id===qa.taken)?.claim,claimed={id:qa.taken,at:claim?.claimed_at};
 assert(JSON.stringify(unreadIds)===JSON.stringify([qa.unread,qa.question,qa.edit].sort())&&claim?.claimed_at&&waitedLong(shop.unread_since,Date.now())&&!waitedLong(agentOf.get(qa.fresh_project)?.unread_since,Date.now()),'The fixture\'s entries and times are as the suite expects: '+JSON.stringify({unreadIds,shop,fresh:agentOf.get(qa.fresh_project)}));
 report.preflight.data={home:home.agent.map(({project,read_at,unread,unread_since})=>({project,read_at,unread,unread_since})),cards:home.projects.map(({name,commit,pushed_at})=>({name,commit,pushed_at}))};
 const page=(name,lang,hash='')=>stagePath(name,qa.part,'05-erd')+'?lang='+lang+hash;
 // The cards and the agent to-do of the first page, as of from..to, in the zone given.
 function firstPageHolds(v,lang,from,to,inZone,what,{agents=agentOf}={}){
  const names=[...cardOf.keys()].sort();
  assert(JSON.stringify(v.cards.map(c=>c.name).sort())===JSON.stringify(names),what+': a card for each project: '+JSON.stringify(v.cards.map(c=>c.name)));
  const marks={};
  for(const c of v.cards){
   const card=cardOf.get(c.name),agent=agents.get(c.name);
   marks['card:'+c.name]=placeHolds(c,{commit:card.commit,pushedAt:card.pushed_at,space:Boolean(agent),readAt:agent?.read_at??null,since:agent?.unread_since??null},lang,from,to,inZone,what+', the card of '+c.name);
  }
  const rows=[...agents.values()].filter(row=>['comments','discrepancies','reflections','checkpoints'].some(list=>Number(row[list]?.total)>0));
  assert(JSON.stringify(v.todo.map(p=>p.name).sort())===JSON.stringify(rows.map(r=>r.project).sort()),what+': the agent to-do\'s projects: '+JSON.stringify(v.todo.map(p=>p.name)));
  for(const p of v.todo){
   const agent=agents.get(p.name),card=cardOf.get(p.name);
   marks['todo:'+p.name]=placeHolds(p,{pushedAt:card.pushed_at,push:false,space:true,readAt:agent.read_at,since:agent.unread_since},lang,from,to,inZone,what+', the agent to-do of '+p.name);
   const unread=Number(agent.unread)>0?label('Not read, in the agent to-do',0,lang,{n:count(agent.unread)}):null;
   assert(p.unread===unread,what+': "{n} not read yet" beside '+p.name+': '+JSON.stringify(p.unread));
  }
  timesIn(v,inZone,what);
  return marks;
 }
 // The workspace's head, its rail's mark and its talk, by what shows.
 function workspaceHolds(v,{project,lang,from,to,inZone,head,flag,talkShown,unread=unreadIds,taken=project===shop?claimed:null,what}){
  const out={};
  if(head)out.head=placeHolds(v.head,{commit:project.commit,pushedAt:project.pushed_at,space:project.space,readAt:project.read_at,since:project.unread_since},lang,from,to,inZone,what+', the head',head==='drawn');
  else assert(!v.head?.shown,what+': the head is not shown: '+JSON.stringify(v.head));
  if(flag!==undefined){
   const long=project.unread_since&&waitedLong(project.unread_since,to);
   assert(v.flag?.shown===Boolean(flag&&long),what+': the folded rail\'s mark '+(flag&&long?'shows':'does not show')+': '+JSON.stringify(v.flag));
   if(v.flag?.shown)assert(v.flag.name===labels('The mark of a long wait',lang)[0]&&v.flag.tag==='span'&&v.flag.tabIndex<0&&!v.flag.role&&!v.flag.interactive&&v.flag.color&&v.flag.order&&v.flag.inside,what+': the rail\'s mark, words for screen readers, in the warning\'s colour, above the stages, which does nothing (rule 23): '+JSON.stringify(v.flag));
   out.flag=v.flag?.shown?'shown':'none';
  }
  if(talkShown){
   const mark=label('Not read, on an entry',0,lang),seen=v.entries.filter(e=>e.group==='l-agent');
   assert(seen.length,what+': the agent\'s turn shows: '+JSON.stringify(v.entries));
   const wrong=seen.filter(e=>(e.mark===mark)!==unread.includes(e.id)||!e.placed);
   assert(!wrong.length,what+': "Not read by the agent yet" on the entries that wait unread and on no other, inside its entry: '+JSON.stringify(wrong));
   assert(!v.entries.filter(e=>e.group!=='l-agent').some(e=>e.mark),what+': no mark outside the agent\'s turn: '+JSON.stringify(v.entries.filter(e=>e.mark&&e.group!=='l-agent')));
   out.marked=seen.filter(e=>e.mark).length;
   if(taken){const e=seen.find(e=>e.id===taken.id);assert(e&&!e.mark&&e.wait===label('Waiting',1,lang,{time:zones[inZone](taken.at)}),what+': the comment that a session took shows as taken, without the mark (TC-1419): '+JSON.stringify(e));}
  }
  timesIn(v,inZone,what);
  return out;
 }

 // SCR-110#normal (TC-1413 to TC-1415, TC-1417, TC-1420): the cards and the agent to-do at 390
 // and 1,440 pixels, in both themes and languages, with the page checks and a frame of each.
 const SETTINGS=[['light','en'],['dark','ko'],['dark','en'],['light','ko']];
 for(const width of[390,1440])for(const [theme,lang]of SETTINGS){
  await test(`first-page@${width}-${theme}-${lang}`,async()=>{
   await fresh();const since=report.console.length;await setting({width,theme});
   const from=Date.now();await open('/?lang='+lang);const v=await view(),to=Date.now();
   assert(v.code==='ready'&&v.redrawn==='0'&&v.overflow===0,'The page is the server\'s drawing, which the code drew again without a change: '+JSON.stringify({code:v.code,redrawn:v.redrawn,overflow:v.overflow}));
   const marks=firstPageHolds(v,lang,from,to,'UTC','SCR-110#normal');
   assert(marks['card:'+qa.project]==='shown'&&marks['todo:'+qa.project]==='shown'&&marks['card:'+qa.fresh_project]==='hidden'&&marks['card:'+qa.old]==='none','The mark on the project whose entry has waited unread for more than 24 hours, and on no other: '+JSON.stringify(marks));
   const checks=await pageChecks(width);checksPass(checks,consoleErrors(since),'SCR-110#normal');
   const screenshot=await fullShot(`first-page-${width}-${theme}-${lang}`);
   return{evidence:'fixture page and reads; page checks',marks,checks:summary(checks),screenshot};
  });
 }

 // SCR-110#loading (TC-1704): the server's drawing, held before the code runs, in Seoul's time
 // zone: the times as the server writes them, in UTC, with how long ago and the mark as of the
 // page's data; then the code's: the times in the browser's time zone, how long ago as of its
 // clock, the same boxes, and no part drawn again. The fonts wait too, so that the boxes compare.
 for(const [width,theme,lang]of[[390,'dark','ko'],[390,'light','en'],[1440,'light','en'],[1440,'dark','ko']]){
  await test(`first-page-loading@${width}-${theme}-${lang}`,async()=>{
   await fresh();const since=report.console.length;await setting({width,theme});await timeZone('Asia/Seoul');
   held={pattern:codeEntry,requests:[]};fonts={pattern:FONTS,requests:[]};
   const from=Date.now();await open('/?lang='+lang,{ready:false});
   for(const stop=Date.now()+10000;!held.requests.length&&Date.now()<stop;)await sleep(25);
   assert(held.requests.length===1,'The page asks for its code once, and the suite holds it');
   const before=await view(),served=Date.now();
   assert(before.code===null,'The code waits: '+before.code);
   firstPageHolds(before,lang,from,served,'UTC','SCR-110#loading, the server\'s drawing');
   const loading=await fullShot(`first-page-loading-${width}-${theme}-${lang}`);
   await releaseCode();await waitFor(`document.documentElement.dataset.nxCode==='ready'`,15000);await settled();
   const after=await view(),to=Date.now();
   assert(after.redrawn==='0','The code drew no part again: '+after.redrawn);
   firstPageHolds(after,lang,from,to,'Asia/Seoul','SCR-110#loading, the code\'s');
   // The boxes of each place whose words the code kept: only the time's digits changed.
   const moved=[];
   for(const kind of['cards','todo'])for(const place of after[kind]){
    const was=before[kind].find(p=>p.name===place.name);
    if(JSON.stringify(was.agos.map(a=>a.text))!==JSON.stringify(place.agos.map(a=>a.text)))continue;
    if(JSON.stringify(was.boxes)!==JSON.stringify(place.boxes))moved.push({kind,name:place.name,before:was.boxes,after:place.boxes});
   }
   assert(!moved.length,'Nothing moves when the code writes the times in the browser\'s time zone: '+JSON.stringify(moved));
   assert(!consoleErrors(since).length,'Console errors: '+JSON.stringify(consoleErrors(since)));
   return{evidence:'fixture page and reads; the page\'s code and fonts held by the suite (held); Seoul\'s time zone by CDP',screenshots:[loading,await fullShot(`first-page-code-${width}-${theme}-${lang}`)]};
  });
 }

 // TC-1416: the first page left open and shown again an hour later, then a day later, by the
 // page's clock that the suite moves: how long ago and the marks worked out again, as of then.
 await test('shown-again-first-page@1440-light-en',async()=>{
  await fresh();await setting({width:1440});const lang='en';
  let from=Date.now();await open('/?lang='+lang);let v=await view(),to=Date.now();
  firstPageHolds(v,lang,from,to,'UTC','Opened');
  const seen={opened:v.cards.map(c=>({name:c.name,agos:c.agos.map(a=>a.text)}))};
  for(const hours of[1,23.5]){
   from=Date.now()+hours*HOUR;await later(hours);await settled();v=await view();to=Date.now()+hours*HOUR;
   const marks=firstPageHolds(v,lang,from,to,'UTC',`Shown again ${hours} h later`);
   seen[hours]={marks,agos:v.cards.map(c=>({name:c.name,agos:c.agos.map(a=>a.text)}))};
  }
  assert(seen[1].marks['card:'+qa.fresh_project]==='hidden'&&seen[23.5].marks['card:'+qa.fresh_project]==='shown'&&seen[23.5].marks['todo:'+qa.fresh_project]==='shown','A day later the mark shows on the project whose entry then waits for more than 24 hours: '+JSON.stringify({one:seen[1].marks,day:seen[23.5].marks}));
  return{evidence:'fixture page and reads; the page\'s clock moved by the suite and visibilitychange dispatched (mocked clock, dispatched event)',seen,screenshot:await fullShot('shown-again-first-page-1440-light-en')};
 });

 // TC-1416 in the workspace: the head of a project that the agent never read, shown again a day
 // later, says how long ago as of then and shows the mark, which the folded rail shows too; the
 // talk marks its entry, as in a space that was never read (TC-1420).
 await test('shown-again-workspace@1440-dark-ko',async()=>{
  await fresh();await setting({width:1440,theme:'dark'});const lang='ko',unread=[qa.fresh];
  let from=Date.now();await open(page(qa.fresh_project,lang));let v=await view(),to=Date.now();
  const opened=workspaceHolds(v,{project:fresh_,lang,from,to,inZone:'UTC',head:true,flag:false,talkShown:true,unread,what:'Opened'});
  assert(opened.head==='hidden'&&opened.marked===1,'An hour after its comment, no mark yet, and the talk marks the comment: '+JSON.stringify(opened));
  from=Date.now()+23.5*HOUR;await later(23.5);await settled();v=await view();to=Date.now()+23.5*HOUR;
  const shown=workspaceHolds(v,{project:fresh_,lang,from,to,inZone:'UTC',head:true,flag:false,talkShown:true,unread,what:'Shown again a day later'});
  assert(shown.head==='shown','A day later the head shows the mark: '+JSON.stringify(shown));
  const headShot=await shot('shown-again-workspace-1440-dark-ko');
  await click('.rail [data-nx-act="fold-stages"]');await waitFor(`document.querySelector('.ws')?.dataset.nxStages==='folded'`);await paint();
  v=await view();
  const folded=workspaceHolds(v,{project:fresh_,lang,from,to:Date.now()+23.5*HOUR,inZone:'UTC',head:false,flag:true,talkShown:true,unread,what:'The list folded'});
  assert(folded.flag==='shown','The folded rail shows the mark: '+JSON.stringify(folded));
  const flagAx=await ax('.rail .fmk');
  assert(flagAx.every(n=>!['button','link'].includes(n.role)&&!n.focusable),'The rail\'s mark is no control: '+JSON.stringify(flagAx));
  return{evidence:'fixture page and reads; the page\'s clock moved by the suite and visibilitychange dispatched (mocked clock, dispatched event); Chrome\'s accessibility tree, not a screen reader',opened,shown,folded,flagAx,screenshots:[headShot,await shot('shown-again-workspace-folded-1440-dark-ko')]};
 });

 // SCR-111#normal and #folded, SCR-114#normal (TC-1711, TC-1712's mark, TC-1719, TC-1417, TC-1419,
 // TC-1420): the head's times and mark where the list shows, the rail's mark where it is folded,
 // and the talk's marks, at 390 pixels in the sheet of stages and the Talk tab, at 1,152 with the
 // list and folded, at 1,280 with each fold and at 1,440, in both themes and languages.
 const PLACES=[
  {name:'390',width:390},
  {name:'1152-list',width:1152,hash:'#talk'},
  {name:'1152-folded',width:1152,kept:{stages:'folded'},hash:'#talk'},
  {name:'1280-list-folded',width:1280,kept:{stages:'folded',talk:'shown'}},
  {name:'1280-talk-folded',width:1280,kept:{talk:'folded'},hash:'#talk'},
  {name:'1440',width:1440},
 ];
 for(const s of PLACES)for(const [theme,lang]of SETTINGS){
  await test(`workspace@${s.name}-${theme}-${lang}`,async()=>{
   await fresh(s.kept);const since=report.console.length;await setting({width:s.width,theme});
   const folded=s.kept?.stages==='folded',seen={},screenshots=[];
   if(s.width<1024){
    let from=Date.now();await open(page(qa.project,lang,'#stages'));let v=await view(),to=Date.now();
    seen.sheet=workspaceHolds(v,{project:shop,lang,from,to,inZone:'UTC',head:true,flag:false,talkShown:false,what:'The sheet of stages'});
    let checks=await pageChecks(s.width);checksPass(checks,consoleErrors(since),'The sheet of stages');seen.sheetChecks=summary(checks);
    screenshots.push(await shot(`workspace-${s.name}-stages-${theme}-${lang}`));
    from=Date.now();await open(page(qa.project,lang,'#talk'));v=await view();to=Date.now();
    seen.talk=workspaceHolds(v,{project:shop,lang,from,to,inZone:'UTC',head:false,talkShown:true,what:'The Talk tab'});
    checks=await pageChecks(s.width);checksPass(checks,consoleErrors(since),'The Talk tab');seen.talkChecks=summary(checks);
    screenshots.push(await shot(`workspace-${s.name}-talk-${theme}-${lang}`));
   }else{
    const from=Date.now();await open(page(qa.project,lang,s.hash||''));const v=await view(),to=Date.now();
    assert(v.redrawn==='0'&&(v.ws.stages||null)===(folded?'folded':null),'The workspace with its folds: '+JSON.stringify({redrawn:v.redrawn,ws:v.ws}));
    seen.place=workspaceHolds(v,{project:shop,lang,from,to,inZone:'UTC',head:!folded,flag:folded,talkShown:true,what:'SCR-111 at '+s.name});
    assert(!folded||seen.place.flag==='shown','The folded rail shows the mark: '+JSON.stringify(seen.place));
    if(folded){
     // The rail's mark does nothing when pressed: the page stays where it is and asks for nothing.
     const where=await evaluate('location.href'),asked=requests;
     await click('.rail .fmk');await sleep(150);
     assert(await evaluate('location.href')===where&&requests===asked,'A press on the rail\'s mark does nothing: '+JSON.stringify({where,asked,requests}));
    }
    const checks=await pageChecks(s.width);checksPass(checks,consoleErrors(since),'SCR-111 at '+s.name);seen.checks=summary(checks);
    screenshots.push(await shot(`workspace-${s.name}-${theme}-${lang}`));
   }
   return{evidence:'fixture page and reads; page checks',seen,screenshots};
  });
 }

 // SCR-111#loading (TC-1710): the server's drawing of the head, held before the code runs, in
 // Seoul's time zone, then the code's, with the same boxes and no part drawn again; with a kept
 // fold, the code folds the list when it runs and the rail shows the mark.
 for(const s of[{width:390,theme:'dark',lang:'ko',hash:'#stages'},{width:1152,theme:'light',lang:'en'},{width:1280,theme:'dark',lang:'en',kept:{stages:'folded',talk:'folded'}},{width:1440,theme:'light',lang:'ko'}]){
  const tag=`${s.width}-${s.theme}-${s.lang}`+(s.kept?'-folded':'');
  await test(`workspace-loading@${tag}`,async()=>{
   await fresh(s.kept);const since=report.console.length;await setting({width:s.width,theme:s.theme});await timeZone('Asia/Seoul');
   held={pattern:codeEntry,requests:[]};fonts={pattern:FONTS,requests:[]};
   const from=Date.now();await open(page(qa.project,s.lang,s.hash||''),{ready:false});
   for(const stop=Date.now()+10000;!held.requests.length&&Date.now()<stop;)await sleep(25);
   assert(held.requests.length===1,'The page asks for its code once, and the suite holds it');
   const before=await view(),served=Date.now();
   assert(before.code===null,'The code waits: '+before.code);
   // Under 1,024 pixels the head is in the sheet of stages, which #stages opens only once the code
   // ran, since Chrome sets the fragment's target when the page's module code has run (BUG-606):
   // the server's head is checked as drawn there, and as shown once the code ran.
   const sheet=s.width<1024?{shown:Boolean(before.head?.shown)}:null;
   const drawn=workspaceHolds(before,{project:shop,lang:s.lang,from,to:served,inZone:'UTC',head:s.width<1024?'drawn':true,flag:false,talkShown:s.width>=1440,what:'SCR-111#loading, the server\'s drawing'});
   const loading=await shot(`workspace-loading-${tag}`);
   await releaseCode();await waitFor(`document.documentElement.dataset.nxCode==='ready'`,15000);await settled();
   const after=await view(),to=Date.now(),folded=s.kept?.stages==='folded';
   assert(after.redrawn==='0','The code drew no part again: '+after.redrawn);
   const code=workspaceHolds(after,{project:shop,lang:s.lang,from,to,inZone:'Asia/Seoul',head:!folded,flag:s.width>=1024?folded:undefined,talkShown:s.width>=1440,what:'SCR-111#loading, the code\'s'});
   if(!folded&&!sheet&&JSON.stringify(before.head.agos.map(a=>a.text))===JSON.stringify(after.head.agos.map(a=>a.text)))
    assert(JSON.stringify(before.head.boxes)===JSON.stringify(after.head.boxes),'Nothing moves in the head when the code writes its times in the browser\'s time zone: '+JSON.stringify({before:before.head.boxes,after:after.head.boxes}));
   assert(!consoleErrors(since).length,'Console errors: '+JSON.stringify(consoleErrors(since)));
   return{evidence:'fixture page and reads; the page\'s code and fonts held by the suite (held); Seoul\'s time zone by CDP',drawn,code,sheet,screenshots:[loading,await shot(`workspace-code-${tag}`)]};
  });
 }

 // TC-1418, last, since the agent's reads change the fixture: the first page, open while the
 // agent reads qa-loop, reads again when it comes back into view and drops the count and the
 // mark, and says when the agent read; the workspace of qa-loop-new, open while the agent reads
 // it, drops the talk's mark and shows the read in its head; and qa-loop's workspace, loaded again,
 // marks nothing.
 await test('agent-reads@1440-light-en',async()=>{
  await fresh();await setting({width:1440});const lang='en';
  let from=Date.now();await open('/?lang='+lang);let v=await view(),to=Date.now();
  let marks=firstPageHolds(v,lang,from,to,'UTC','Before the read');
  assert(marks['todo:'+qa.project]==='shown','Before the read, the mark on '+qa.project);
  const readAt=await agentRead(qa.project);
  from=Date.now();await evaluate(`document.dispatchEvent(new Event('visibilitychange'))`);await settled();
  await waitFor(`![...document.querySelectorAll('.home .pj')].some(p=>p.querySelector('[data-nx-focus^="todo:${qa.project}:"]')&&p.querySelector('.nr'))`);await paint();
  v=await view();to=Date.now();
  const after=await data('/api/home'),agents=new Map(after.agent.map(row=>[row.project,row])),read=agents.get(qa.project);
  assert(read.read_at===readAt&&read.unread===0&&read.unread_since===null,'The server holds the read: '+JSON.stringify(read));
  marks=firstPageHolds(v,lang,from,to,'UTC','After the read',{agents});
  assert(marks['todo:'+qa.project]==='none'&&marks['card:'+qa.project]==='none','After the read, no mark on '+qa.project+': '+JSON.stringify(marks));
  const card=v.cards.find(c=>c.name===qa.project);
  assert(card.lines[1]===readLine(true,readAt,lang,agoWords(readAt,to,lang),'UTC'),'The card says when the agent read: '+JSON.stringify(card.lines));
  const firstShot=await fullShot('agent-reads-first-page-1440-light-en');
  // The workspace of a project that the agent never read, open while the agent reads it.
  from=Date.now();await open(page(qa.fresh_project,lang));v=await view();to=Date.now();
  workspaceHolds(v,{project:fresh_,lang,from,to,inZone:'UTC',head:true,talkShown:true,unread:[qa.fresh],what:'Before the read of '+qa.fresh_project});
  const freshRead=await agentRead(qa.fresh_project);
  from=Date.now();await evaluate(`document.dispatchEvent(new Event('visibilitychange'))`);
  await waitFor(`!document.querySelector('.side .nrd')&&!!document.querySelector('.rail .proj [data-nx-ago="${freshRead}"]')`,15000);await settled();
  v=await view();to=Date.now();
  const readProject={...fresh_,read_at:freshRead,unread_since:null};
  const shown=workspaceHolds(v,{project:readProject,lang,from,to,inZone:'UTC',head:true,talkShown:true,unread:[],what:'After the read of '+qa.fresh_project});
  const workspaceShot=await shot('agent-reads-workspace-1440-light-en');
  // qa-loop's workspace, loaded again: the head says when the agent read, and nothing is marked.
  from=Date.now();await open(page(qa.project,lang));v=await view();to=Date.now();
  workspaceHolds(v,{project:{...shop,read_at:readAt,unread_since:null},lang,from,to,inZone:'UTC',head:true,talkShown:true,unread:[],what:'Loaded again after the read'});
  return{evidence:'fixture page and reads; the agent\'s reads through the fixture, as a session\'s; visibilitychange dispatched (dispatched event)',reads:report.agentReads,shown,screenshots:[firstShot,workspaceShot,await shot('agent-reads-loaded-again-1440-light-en')]};
 });

 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.blockedExternalOrigins.length,'The page asked another origin: '+report.blockedExternalOrigins.join());
 assert(!report.runtimeExceptions.length,'The page threw: '+JSON.stringify(report.runtimeExceptions));
 assert(!report.posts.length,'The page wrote: '+JSON.stringify(report.posts));
 const expectedTests=8+4+2+PLACES.length*4+4+1;
 report.summary={runs:report.tests.length,expected:expectedTests,works:report.tests.filter(t=>t.verdict==='works').length};
 report.status=report.tests.length===expectedTests&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 closing=true;
 try{if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();await browser.stop();report.browserExited=true;}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,runs:report.tests.length,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
