/**
 * TASK-312: the project's data (SCR-130, SPEC-201 to SPEC-203) and the first page's bar after a
 * removal (SCR-110#removed), in a browser. In stage 12's eight settings, 390 and 1,440 pixels in
 * light English, dark Korean, dark English and light Korean: SCR-130#loading, #normal and the
 * export, whose file the browser saves under the reply's name with the bytes that the server wrote
 * (TC-1463, TC-1471, TC-1472, TC-1723, TC-1724); #empty (TC-1725); #removal and #removal-ready
 * with the name in another letter case, one letter short and with spaces at its ends, the removal
 * and the first page that says so once (TC-1467, TC-1468, TC-1470, TC-1707, TC-1726, TC-1727);
 * #stale, as the agent writes and its hub pushes while the confirmation is open (TC-1728); and
 * #error, #permission and #gone, by read, export and removal (TC-1729 to TC-1731), each with
 * stage 12's page checks (./page-checks.mjs) and a frame. Then the other codes of those states at
 * two settings, the limits of the confirmation with a long name (rule 1, rule 12) and the panel's
 * addresses (TC-1764, TC-1473). Node 24 built-ins only; an owned headless Chrome over CDP. Requires
 * NEXUS_QA_DATA=1, the opt-in view-server, NEXUS_CHROME and NEXUS_QA_ORIGIN. Synthetic loopback
 * fixture only: the page's requests reach the fixture server, which refuses or fails them for
 * real where a cookie of the suite chooses a sign-in or a failing database; the agent's comment,
 * its hub's push and another tab's removal go through the fixture as theirs would; the suite
 * holds requests where a test names it, dispatches visibilitychange where a test says so, and
 * answers a request in the server's place only where a test says "mocked" or "relayed", the
 * second with the answer that the server gave the suite for the same request from another site
 * or with another method.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {label,labels,codeMessage} from '../src/draw/words.js';
import {stagePath} from '../src/draw/stages.js';
import {clock,count} from '../src/draw/html.js';
import {agoWords,waitedLong} from '../src/draw/loop.js';
import {KINDS,OPEN_LISTS} from '../src/draw/data.js';
import {SIDEWAYS,OUTSIDE,HITS} from './page-checks.mjs';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_DATA!=='1')throw Error('Use only the opt-in synthetic data fixture');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,HOUR=3600000;
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'data-');
const {folder}=browser,downloads=path.join(folder,'downloads');
await fs.mkdir(downloads,{recursive:true});
const report={schema:'nexus-data-browser-regression/1',scope:'synthetic loopback fixture only',evidence:'page measurement, saved files and screenshots; the page\'s requests reach the fixture server, which refuses or fails them for real where the suite\'s cookie chooses a sign-in or a failing database; the agent\'s comment, its hub\'s push and another tab\'s removal go through the fixture; the suite holds requests (held), dispatches visibilitychange (dispatched event) and answers a request in the server\'s place only in the tests that say so (mocked, or relayed with the server\'s own answer)',
 startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],answered:[],blockedExternalOrigins:[],requests:[],downloads:[],acts:[],runtimeExceptions:[],console:[]};
const budget=Number(process.env.NEXUS_QA_DATA_BUDGET_MS)||540000,softDeadline=Date.now()+budget;
let ws,session,seq=0,held=null,closing=false,qa;
const pending=new Map(),inflight=new Map(),heldIds=new Set(),answers=[],sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
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
// The page's own requests to the API that have not ended, which the suite waits out.
async function idle(timeout=10000){const stop=Date.now()+timeout;while(Date.now()<stop){if(![...inflight.values()].some(r=>!r.held))break;await sleep(25);}assert(![...inflight.values()].some(r=>!r.held),'Requests still running: '+JSON.stringify([...inflight.values()]));await paint();await paint();}
// A workspace or first page that rests: no reading runs, a picture shown is drawn and the fonts are in.
const RESTS=`(()=>{const q=s=>document.querySelector(s),shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});
 if(q('.home'))return(q('.home .upd')?.textContent||'')==='';
 if(['.stage .upd','.side .tupd'].some(s=>(q(s)?.textContent||'')!==''))return false;
 const pf=q('.pf');if(shown(pf)&&!q('.pf > .cv.drawn, .pf .empty-p, .pf .fnote .msg.warn'))return false;
 const fonts=q('link[data-nexus-css="fonts"]');if(fonts&&(!fonts.sheet||document.fonts.status!=='loaded'))return false;
 return true;})()`;
async function settled(){await waitFor(RESTS,15000);await idle();}
// While a page loads, its document may not hold its root element yet, so the waits read the code's
// mark through it with ?.
// A page at route, as a person would open it, its code run; where is the address that it leads
// to, for an address that the server leads on.
async function open(route,{where}={}){
 const url=origin+route,[base]=(where?origin+where:url).split('#');
 await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url});
 await waitFor(`location.href.split('#')[0]===${JSON.stringify(base)}&&document.readyState!=='loading'&&!!document.getElementById('view-data')&&document.documentElement?.dataset.nxCode==='ready'`,15000);
 await settled();
}
const cookie=(name,value)=>value===null?command('Network.deleteCookies',{name,url:origin}):command('Network.setCookie',{name,value,url:origin,path:'/'});
async function cookiesOff(){for(const name of['nexus-qa-access','nexus-qa-fail','nexus-qa-space','nexus-qa-lang'])await cookie(name,null);}
async function shot(name){const image=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(folder,name+'.png'),Buffer.from(image.data,'base64'));return name+'.png';}
// NEXUS_QA_DATA_ONLY, a pattern of test names, runs those alone, while a test is being written;
// the suite then counts itself unfinished.
const only=process.env.NEXUS_QA_DATA_ONLY?new RegExp(process.env.NEXUS_QA_DATA_ONLY):null;
async function test(name,fn){
 if(only&&!only.test(name))return;
 const startedAt=new Date().toISOString();
 try{const evidence=await fn();report.tests.push({name,verdict:'works',startedAt,finishedAt:new Date().toISOString(),...evidence});console.log('PASS '+name);}
 catch(error){let screenshot;try{screenshot=await shot(name.replace(/[^a-z0-9-]+/gi,'-')+'-failure');}catch{}report.tests.push({name,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),error:String(error),screenshot});console.error('FAIL '+name+': '+error);}
 finally{try{await release();}catch{}answers.length=0;try{await cookiesOff();}catch{}}
 await out('results.json',report);
}
async function release(){const hold=held;held=null;if(!hold)return;for(const id of hold.requests){try{await command('Fetch.continueRequest',{requestId:id});}catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;}}heldIds.clear();for(const r of inflight.values())r.held=false;}
// The page's request that matches, held until release() (held), and the page's next request that
// matches, answered in the server's place: {status, headers, body} (mocked, or relayed), or
// failed as a connection that the server refused (mocked).
function hold(method,pattern){held={method,pattern,requests:[]};}
function answer(method,pattern,reply,kind){answers.push({method,pattern,reply,kind});}
async function onPaused(event){
 const url=new URL(event.request.url),method=event.request.method,where=url.pathname+url.search;
 if(url.origin!==origin&&!['about:','data:','blob:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(url.pathname.startsWith('/api/'))report.requests.push({method,path:where,body:event.request.postData??null,networkId:event.networkId||null,at:new Date().toISOString()});
 const given=answers.findIndex(a=>a.method===method&&a.pattern.test(where));
 if(given>=0){
  const {reply,kind}=answers.splice(given,1)[0];report.answered.push({method,path:where,kind,status:reply.status??null,failed:reply.fail??null,at:new Date().toISOString()});
  if(reply.fail){await command('Fetch.failRequest',{requestId:event.requestId,errorReason:reply.fail});return;}
  await command('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:reply.status,responseHeaders:Object.entries(reply.headers||{}).map(([name,value])=>({name,value})),body:Buffer.from(reply.body||'').toString('base64')});return;
 }
 if(held&&held.method===method&&held.pattern.test(where)){held.requests.push(event.requestId);if(event.networkId){heldIds.add(event.networkId);const r=inflight.get(event.networkId);if(r)r.held=true;}report.interceptions.push({path:where,method,action:'held',at:new Date().toISOString()});return;}
 try{await command('Fetch.continueRequest',{requestId:event.requestId});}
 catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;report.interceptions.push({path:where,method,action:'dropped by the page',at:new Date().toISOString()});}
}
async function clickAt(x,y){for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});}
async function click(selector){
 const at=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}));if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'No control to click: '+selector);await paint();
 // Measured again two frames on, as a press that lands while the panel scrolls misses.
 const again=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}));const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await clickAt(again.x,again.y);await paint();
}
async function key(name,code,keyCode){for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:name,code,windowsVirtualKeyCode:keyCode});await paint();}
// What the user types in the field of the confirmation: pressed, what it holds selected, then
// typed over it; no request goes while the user types.
async function type(text){
 await click('#dp-name');
 await evaluate(`document.getElementById('dp-name').select()`);
 const before=report.requests.length;
 await command('Input.insertText',{text});
 await paint();
 assert(report.requests.length===before,'The page sent a request while the user typed: '+JSON.stringify(report.requests.slice(before)));
}
async function visible(){await evaluate(`document.dispatchEvent(new Event('visibilitychange'))`);await sleep(50);await idle();}
async function act(body){
 const answer=await fetch(origin+'/__qa/data',{method:'POST',body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 assert(answer.ok,'The fixture\'s act failed: '+JSON.stringify(body)+' '+answer.status);
 const value=await answer.json();report.acts.push({...body,at:new Date().toISOString()});return value;
}
async function data(route,init={}){const answer=await fetch(origin+route,{...init,signal:AbortSignal.timeout(10000)});return{status:answer.status,headers:Object.fromEntries(answer.headers),text:await answer.text()};}
async function api(route){const reply=await data(route);assert(reply.status===200,route+': '+reply.status+' '+reply.text);return JSON.parse(reply.text);}
// The server's own answer to the request that the page makes, sent by the suite from another site
// or with another method, which the page then gets in its place (relayed).
async function relayed(route,init){const reply=await data(route,init);return{status:reply.status,headers:{'Content-Type':reply.headers['content-type'],'Cache-Control':'no-store'},body:reply.text};}

// What the page shows of the panel, its address, the focus and the page behind it.
function dataView(){
 const q=s=>document.querySelector(s),txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():null,shown=e=>Boolean(e&&e.checkVisibility({visibilityProperty:true}));
 const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:Math.round(r.left*10)/10,top:Math.round(r.top*10)/10,right:Math.round(r.right*10)/10,bottom:Math.round(r.bottom*10)/10,width:Math.round(r.width*10)/10,height:Math.round(r.height*10)/10};};
 const words=e=>{if(!e)return null;const c=e.cloneNode(true);for(const x of c.querySelectorAll('.sr,.was'))x.remove();return c.textContent.replace(/\s+/g,' ').trim();};
 // A button whose words fit inside it, wrapped where they must (rule 1): the shown words' own boxes,
 // line by line, inside the button's box, since its hit area and its screen-reader words reach
 // outside it on purpose.
 const fits=e=>{const b=e.getBoundingClientRect(),walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n,ok=true;while((n=walk.nextNode())){if(!n.textContent.trim()||n.parentElement.closest('.sr,.was'))continue;const range=document.createRange();range.selectNodeContents(n);for(const q of range.getClientRects())if(q.width&&(q.left<b.left-0.5||q.right>b.right+0.5||q.top<b.top-0.5||q.bottom>b.bottom+0.5))ok=false;}return ok;};
 // How much room the shown words keep above their first line and below their last inside the
 // button's box (BUG-613), in pixels.
 const room=e=>{const b=e.getBoundingClientRect(),walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),lines=[];let n;while((n=walk.nextNode())){if(!n.textContent.trim()||n.parentElement.closest('.sr,.was'))continue;const range=document.createRange();range.selectNodeContents(n);for(const q of range.getClientRects())if(q.width)lines.push(q);}if(!lines.length)return null;return Math.round(Math.min(Math.min(...lines.map(q=>q.top))-b.top,b.bottom-Math.max(...lines.map(q=>q.bottom)))*10)/10;};
 const button=e=>e?{words:words(e),sr:txt(e.querySelector(':scope > .sr')),off:e.getAttribute('aria-disabled')==='true'||e.disabled,box:rect(e),shown:shown(e),fits:fits(e),room:room(e)}:null;
 const message=m=>({tone:['info','warn','err'].find(c=>m.classList.contains(c))||null,role:m.getAttribute('role'),icon:m.querySelector('svg use')?.getAttribute('href')||null,text:txt(m.querySelector('.t')),trace:txt(m.querySelector('.tid')),
  controls:[...m.querySelectorAll('.row > button, .row > a')].map(b=>({words:txt(b),act:b.dataset.nxAct||null,href:b.getAttribute('href'),box:rect(b)}))});
 const ws=q('.ws'),dp=q('.dpw .dp'),active=document.activeElement;
 // The focused control inside the panel's body, which scrolls alone, in sight there (BUG-612).
 const inSight=e=>{const body=e?.closest?.('.dp .dpb');if(!body)return null;const r=e.getBoundingClientRect(),o=body.getBoundingClientRect();return r.top>=o.top-0.5&&r.bottom<=o.bottom+0.5;};
 const out={href:location.href,path:location.pathname,hash:location.hash,state:history.state,open:ws?.dataset.nxData||null,
  focus:active?(active.id||active.dataset?.nxFocus||(typeof active.className==='string'?active.className:'')||active.tagName):null,focusInSight:inSight(active),
  sheet:innerWidth<1024?shown(q('.rail')):null,
  inert:Object.fromEntries(['.tb','.bars','.rail','.tabs','.stage','.side'].map(s=>[s,Boolean(q(s)?.inert)])),
  bars:[...document.querySelectorAll('.bars .bar')].filter(shown).map(b=>({text:txt(b.querySelector('.t')),act:b.querySelector('button')?.dataset.nxAct||null})),
  item:q('.side #item-h')?txt(q('.side #item-h')):null,
  viewport:{width:innerWidth,height:innerHeight},panel:null};
 if(!shown(dp))return out;
 const dpw=q('.dpw'),stage=q('.ws > .stage'),body=dp.querySelector('.dpb'),field=q('#dp-name'),foot=dp.querySelector('.rmft');
 out.panel={role:dp.getAttribute('role'),modal:dp.getAttribute('aria-modal'),labelledBy:dp.getAttribute('aria-labelledby'),
  heading:txt(q('#dp-h')),project:txt(dp.querySelector('.dph .clip')),close:{sr:txt(dp.querySelector('[data-nx-act="data-close"] .sr')),box:rect(dp.querySelector('[data-nx-act="data-close"]'))},
  box:rect(dp),stage:rect(stage),position:getComputedStyle(dpw).position,wrapBottom:rect(dpw).bottom,bodyScrolls:body?getComputedStyle(body).overflowY:null,
  skeleton:shown(dp.querySelector('.dsk')),loadingWords:txt(dp.querySelector('.dpb > p.sr[role="status"]')),
  rows:[...dp.querySelectorAll('.drow')].map(r=>({key:r.dataset.nxKey,name:txt(r.querySelector('.dk')),value:txt(r.querySelector('.dv')),nameBox:rect(r.querySelector('.dk')),valueBox:rect(r.querySelector('.dv')),
   agos:[...r.querySelectorAll('[data-nx-ago]')].map(e=>({value:e.dataset.nxAgo,text:txt(e)})),times:[...r.querySelectorAll('time[datetime]')].map(e=>({value:e.getAttribute('datetime'),text:txt(e)}))})),
  mark:(()=>{const m=dp.querySelector('.dmark .m24w');return m?{shown:shown(m),since:m.dataset.nxSince,words:txt(m.querySelector('.m24 > span')),line:txt(m.querySelector('.m24l'))}:null;})(),
  countsHeading:txt(dp.querySelector('[data-nx-key="ch"]')),
  counts:[...dp.querySelectorAll('.dcnts .dcnt')].map(r=>({name:txt(r.querySelector('span')),count:txt(r.querySelector('b')),nameBox:rect(r.querySelector('span')),countBox:rect(r.querySelector('b')),box:rect(r)})),
  noSpace:txt(dp.querySelector('[data-nx-key="nosp"]')),
  acts:[...dp.querySelectorAll('.dact')].map(a=>({line:txt(a.querySelector('.dl')),lineBox:rect(a.querySelector('.dl')),button:button(a.querySelector('button'))})),
  file:txt(dp.querySelector('[data-nx-key="file"]')),
  messages:[...dp.querySelectorAll('.msg')].filter(shown).map(message),
  confirm:null};
 if(q('#rm-h')){
  const li=[...dp.querySelectorAll('.rml > li')];
  out.panel.confirm={heading:txt(q('#rm-h')),headingWhole:q('#rm-h').scrollWidth<=q('#rm-h').clientWidth+1,deletes:txt(dp.querySelector('[data-nx-key="del"]')),
   list:li.map(e=>({text:txt(e.firstChild),kinds:txt(e.querySelector('.rmc'))})),
   groups:[...dp.querySelectorAll('.idgs .idg')].map(g=>({title:txt(g.querySelector('h4')),ids:[...g.querySelectorAll('.idl > .mono')].map(txt),more:txt(g.querySelector('.idl > .mu')),moreLines:g.querySelector('.idl > .mu')?.getClientRects().length??null,box:rect(g)})),
   first:button(dp.querySelector('[data-nx-focus="data-export-first"]')),back:txt(dp.querySelector('[data-nx-key="back"]')),
   label:txt(dp.querySelector('label[for="dp-name"]')),labelWhole:dp.querySelector('label[for="dp-name"]').scrollWidth<=dp.querySelector('label[for="dp-name"]').clientWidth+1,
   field:field?{value:field.value,autocomplete:field.getAttribute('autocomplete'),autocapitalize:field.getAttribute('autocapitalize'),autocorrect:field.getAttribute('autocorrect'),spellcheck:field.getAttribute('spellcheck'),box:rect(field.closest('.rmf')||field)}:null,
   cancel:button(dp.querySelector('[data-nx-act="data-cancel"]')),go:button(dp.querySelector('[data-nx-act="data-confirm"]')),
   note:[...dp.querySelectorAll('.rnote .msg')].map(message),foot:rect(foot),bodyBottom:rect(body).bottom,inBody:Boolean(foot&&body.contains(foot))};
 }
 return out;
}
const view=()=>evaluate(`(${dataView})()`);
// The first page: its bar after a removal and its cards.
const homeView=()=>evaluate(`(()=>{const txt=e=>e?e.textContent.replace(/\\s+/g,' ').trim():null,shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});
 const bar=[...document.querySelectorAll('.home .bar')].find(b=>b.querySelector('[data-nx-act="removed-close"]'));
 return{path:location.pathname,bar:bar&&shown(bar)?{text:txt(bar.querySelector('.t')),project:txt(bar.querySelector('.pn')),role:bar.getAttribute('role'),close:txt(bar.querySelector('[data-nx-act="removed-close"]'))}:null,
  cards:[...document.querySelectorAll('.home .pcard [data-nx-focus^="open:"]')].map(e=>e.dataset.nxFocus.slice(5)),
  focus:document.activeElement===document.querySelector('.home')?'home':document.activeElement?.dataset?.nxFocus||document.activeElement?.tagName,
  stored:(()=>{try{return sessionStorage.getItem('nexus0.3:removed');}catch{return'unavailable';}})()};})()`);

// The words that the page should show, in UTC, which the suite sets.
const when=(value,lang,ago)=>label('A time of the loop',0,lang,{date:clock(value),ago});
const agos=(value,lang,from,to)=>[...new Set([agoWords(value,from,lang),agoWords(value,to,lang)])];
const oneOf=(actual,build,value,lang,from,to)=>agos(value,lang,from,to).some(ago=>build(ago)===actual);
const exportFile=(project,at)=>`nexus-${project}-${String(at).slice(0,10)}.json`;
function checksPass(checks,errors,what){
 assert(checks.sideways.scrollWidth<=checks.sideways.width&&checks.sideways.bodyWidth<=checks.sideways.width,what+': the page scrolls sideways: '+JSON.stringify(checks.sideways));
 assert(!checks.outside.length,what+': elements outside the page: '+JSON.stringify(checks.outside));
 assert(!errors.length,what+': console errors: '+JSON.stringify(errors));
 assert(!checks.hits||!checks.hits.missed.some(m=>!m.inline),what+': hit areas under 44 pixels (rule 14): '+JSON.stringify(checks.hits&&checks.hits.missed.filter(m=>!m.inline)));
}
async function pageChecks(width){const sideways=await evaluate(SIDEWAYS),outside=await evaluate(OUTSIDE),hits=width<1024?await evaluate(HITS):null;await paint();return{sideways,outside,hits};}
const summary=checks=>({sideways:checks.sideways,outside:checks.outside.length,hits:checks.hits&&{probed:checks.hits.probed,covered:checks.hits.covered,alike:checks.hits.alike,missed:checks.hits.missed.length}});
// Console errors that the state did not cause: a refusal's or failure's own line, which Chrome
// writes for a request that the server answered with its status, is the state's.
const consoleErrors=(since,allowed=[])=>report.console.slice(since).filter(e=>e.level==='error'&&!(e.url&&new URL(e.url).pathname==='/favicon.ico')&&!allowed.some(re=>re.test(e.text)));
const REFUSED=[/Failed to load resource: the server responded with a status of (4\d\d|5\d\d)/];
async function checked(s,what,{allowed=[]}={},since){const checks=await pageChecks(s.width);checksPass(checks,consoleErrors(since,allowed),what);return summary(checks);}

// The panel's layout (SCR-130's table): a sheet under 1,024 pixels, up to 85 per cent of the
// height, and from 1,024 over the stage's column, as wide as it up to 640 pixels and centred.
function layoutHolds(v,s,what){
 const p=v.panel,box=p.box;
 if(s.width<1024){
  assert(p.position==='fixed'&&box.left<=0.5&&Math.abs(box.right-v.viewport.width)<=0.5&&Math.abs(p.wrapBottom-v.viewport.height)<=0.5&&box.height<=v.viewport.height*0.85+1,what+': a sheet at the window\'s bottom, as wide as it, up to 85 per cent of its height (TC-1472): '+JSON.stringify({box,position:p.position,viewport:v.viewport}));
  for(const row of p.rows)assert(row.nameBox.bottom<=row.valueBox.top+0.5,what+': the time\'s name over its value under 1,024 pixels: '+JSON.stringify(row));
  for(const a of p.acts)assert(a.lineBox.bottom<=a.button.box.top+0.5&&a.button.box.height>=44&&a.button.box.width>=box.width-64,what+': each act a block, its line, then its button across the width, 44 pixels high: '+JSON.stringify(a));
 }else{
  const stage=p.stage,centre=(stage.left+stage.right)/2;
  assert(box.left>=stage.left-0.5&&box.right<=stage.right+0.5&&Math.abs((box.left+box.right)/2-centre)<=1&&Math.abs(box.width-Math.min(640,stage.width))<=1&&Math.abs(box.top-stage.top)<=1,what+': over the stage\'s column, from its top, as wide as it up to 640 pixels and centred: '+JSON.stringify({box,stage}));
  for(const row of p.rows)assert(Math.abs(row.nameBox.width-176)<=0.5&&row.nameBox.right<=row.valueBox.left+0.5,what+': each time a row, its name in a column of 176 pixels: '+JSON.stringify(row));
  for(const a of p.acts)assert(a.lineBox.right<=a.button.box.left+0.5&&a.lineBox.top<a.button.box.bottom&&a.button.box.top<a.lineBox.bottom,what+': each act a row, its line left and its button right: '+JSON.stringify(a));
 }
 for(const c of p.counts)assert(c.nameBox.right<=c.countBox.left+0.5&&Math.abs(c.countBox.right-c.box.right)<=24,what+': each count a row, its name left and its count right: '+JSON.stringify(c));
}
// The head of the panel, the same in every state, and the page behind it waiting (SCR-130's table).
function headHolds(v,project,lang,what){
 assert(v.panel&&v.open==='open','The panel is open: '+what+' '+JSON.stringify({open:v.open}));
 const p=v.panel;
 assert(p.role==='dialog'&&p.modal==='true'&&p.labelledBy==='dp-h'&&p.heading===labels("The project's data",lang)[0]&&p.project===project&&p.close.sr===labels('Top bar',lang)[5],what+': the head, "Project data", the project\'s name and Close: '+JSON.stringify({heading:p.heading,project:p.project,close:p.close}));
 const behind=Object.entries(v.inert).filter(([s,inert])=>!inert&&!(s==='.tabs'&&v.viewport.width>=1024));
 assert(!behind.length,what+': the page behind the panel waits until it closes: '+JSON.stringify(v.inert));
}
// SCR-130#normal or #empty: the two times, the counts and the acts, as API-177 answers, as of
// from..to; the mark of a long wait where an entry has waited unread for more than 24 hours.
function normalHolds(v,answer,lang,from,to,what,{file=null}={}){
 const p=v.panel,words=labels("The project's data",lang);
 assert(!p.confirm&&!p.skeleton,what+': the data, not the confirmation or the grey lines');
 const [push,read]=p.rows;
 const commit=answer.commit?label('The head',2,lang,{commit:String(answer.commit).slice(0,7)}):label('The last push',1,lang);
 assert(p.rows.length===2&&push.name===words[1]&&oneOf(push.value,ago=>`${when(answer.pushed_at,lang,ago)} · ${commit}`,answer.pushed_at,lang,from,to),what+': "Last push", its time with how long ago and the commit: '+JSON.stringify(push));
 let readWords;
 if(!answer.space)readWords=()=>label("The agent's last read",2,lang);
 else if(!answer.read_at)readWords=()=>words[5];
 else readWords=ago=>`${when(answer.read_at,lang,ago)} · ${answer.read_session?label("The project's data",3,lang,{label:answer.read_session}):words[4]}`;
 const readOk=answer.space&&answer.read_at?oneOf(read.value,readWords,answer.read_at,lang,from,to):read.value===readWords();
 assert(read.name===words[2]&&readOk,what+': "Last read by the agent", its time with how long ago and the session\'s label, or why there is none: '+JSON.stringify(read));
 for(const t of[...push.times,...read.times])assert(t.text===clock(t.value),what+': a time in the browser\'s time zone: '+JSON.stringify(t));
 const long=answer.space&&answer.unread_since&&[from,to].map(at=>waitedLong(answer.unread_since,at));
 if(long&&long[0]===long[1])assert(Boolean(p.mark?.shown)===long[0]&&(!long[0]||p.mark.words===labels('The mark of a long wait',lang)[0]&&p.mark.line===labels('The mark of a long wait',lang)[1]),what+': the mark of a long wait '+(long[0]?'with its line':'not shown')+': '+JSON.stringify(p.mark));
 if(!answer.space)assert(!p.mark,what+': no mark without a space: '+JSON.stringify(p.mark));
 const deletes=answer.removal.deletes;
 assert(p.countsHeading===words[6]&&JSON.stringify(p.counts.map(c=>[c.name,c.count]))===JSON.stringify(KINDS.map(([kind,index])=>[words[index],count(deletes[kind])])),what+': a row for each kind with its count: '+JSON.stringify(p.counts.map(c=>[c.name,c.count])));
 assert(p.noSpace===(answer.space?null:label('No space',0,lang)),what+': why every count is 0 without a space: '+JSON.stringify(p.noSpace));
 const ex=labels('The export',lang),rm=labels('The removal',lang);
 assert(JSON.stringify(p.acts.map(a=>[a.line,a.button.words,a.button.off]))===JSON.stringify([[ex[1],ex[0],false],[rm[1],rm[0],false]]),what+': the two acts with their lines, working: '+JSON.stringify(p.acts.map(a=>[a.line,a.button.words,a.button.off])));
 assert(p.file===(file?label('The export',3,lang,{file}):null),what+': which file the browser has: '+JSON.stringify(p.file));
}
// SCR-130#removal and #removal-ready: the confirmation, as API-177 answers.
function confirmationHolds(v,answer,project,lang,what,{ready=false,stale=false}={}){
 const c=v.panel.confirm,words=labels("The removal's confirmation",lang),kinds=labels("The project's data",lang),d=answer.removal.deletes;
 assert(c,what+': the confirmation shows');
 const title=label("The removal's confirmation",0,lang,{project});
 assert(c.heading===title&&c.deletes===words[1],what+': the heading and "This deletes:": '+JSON.stringify([c.heading,c.deletes]));
 const list=[{text:label("The removal's confirmation",2,lang,{n:count(d.pictures),m:count(d.discrepancies)}),kinds:null}];
 if(d.space)list.push({text:words[3],kinds:KINDS.map(([kind,index])=>`${kinds[index]} ${count(d[kind])}`).join(' · ')});
 assert(JSON.stringify(c.list)===JSON.stringify(list),what+': the snapshot, with its pictures and discrepancies, and the space, with its counts: '+JSON.stringify(c.list));
 const groups=d.space?OPEN_LISTS.map(([key,index])=>{const l=answer.removal.open[key];return l.total?{title:`${words[index]} ${count(l.total)}`,ids:l.ids,more:l.ids.length<l.total?label('The list',9,lang,{n:count(l.ids.length),total:count(l.total)}):null}:null;}).filter(Boolean):[];
 assert(JSON.stringify(c.groups.map(({title,ids,more})=>({title,ids,more})))===JSON.stringify(groups),what+': by ID the open comments, proposals, pending reflections and checkpoints not yet recorded, up to 20 of each: '+JSON.stringify(c.groups));
 assert(c.first?.words===words[8]&&!c.first.off&&c.back===words[9],what+': "Export first" and how a removed project comes back: '+JSON.stringify([c.first,c.back]));
 assert(c.label===label("The removal's confirmation",10,lang,{project}),what+': the field\'s label: '+c.label);
 assert(c.field&&c.field.autocomplete==='off'&&c.field.autocapitalize==='none'&&c.field.autocorrect==='off'&&c.field.spellcheck==='false',what+': the field turns off capitals, corrections and suggestions: '+JSON.stringify(c.field));
 assert(c.cancel.fits&&c.go.fits&&c.first.fits,what+': the buttons\' words inside them: '+JSON.stringify([c.cancel,c.go,c.first]));
 assert(c.cancel.words===words[12]&&!c.cancel.off&&c.go.words===title&&c.go.off===!ready&&c.go.sr===(ready?null:words[11]),what+': Cancel, and the removal\'s button '+(ready?'working':'off, with its words for screen readers')+': '+JSON.stringify([c.cancel,c.go]));
 const staleWords=label('The removal changed',0,lang),said=v.panel.messages.find(m=>m.text===staleWords);
 assert(Boolean(said)===stale&&(!said||said.tone==='warn'),what+': "What this removal deletes changed…" '+(stale?'above the lists':'not shown')+': '+JSON.stringify(v.panel.messages));
 assert(!c.inBody&&Math.abs(c.foot.bottom-v.panel.box.bottom)<=24&&c.foot.top>=c.bodyBottom-0.5,what+': the field and the buttons at the panel\'s bottom, under what scrolls: '+JSON.stringify({foot:c.foot,box:v.panel.box,bodyBottom:c.bodyBottom}));
 if(v.viewport.width<1024)assert(c.cancel.box.height>=44&&c.go.box.height>=44&&c.cancel.box.width>=v.panel.box.width-64&&c.go.box.width>=v.panel.box.width-64&&c.field.box.height>=44,what+': each button across the sheet, 44 pixels high, and the field 44 pixels high: '+JSON.stringify([c.cancel.box,c.go.box,c.field.box]));
 else{
  assert(c.cancel.box.right<=c.go.box.left+0.5&&Math.abs(c.cancel.box.top-c.go.box.top)<=1,what+': Cancel left of the removal\'s button: '+JSON.stringify([c.cancel.box,c.go.box]));
  if(c.groups.length>=2)assert(Math.abs(c.groups[0].box.top-c.groups[1].box.top)<=1&&c.groups[0].box.right<=c.groups[1].box.left+0.5,what+': the lists two by two: '+JSON.stringify(c.groups.map(g=>g.box)));
 }
}
// A message of the panel: its tone, words, trace, icon and what the user can do.
function messageHolds(m,{tone,text,trace=true,retry=false,signIn=false,home=false,here=null,lock=false},lang,what){
 assert(m,what+': a message shows');
 const buttons=labels('Page buttons',lang),controls=[];
 if(retry)controls.push(buttons[0]);if(signIn)controls.push(buttons[2]);if(here)controls.push(buttons[3]);if(home)controls.push(labels('Top bar',lang)[1]);
 assert(m.tone===tone&&m.role===(tone==='err'?'alert':'status')&&m.text===text,what+': the message\'s tone and words: '+JSON.stringify(m));
 assert(trace?/[0-9a-f]{16}/.test(m.trace||''):m.trace===null,what+': '+(trace?'the trace ID':'no trace ID')+': '+JSON.stringify(m.trace));
 assert(JSON.stringify(m.controls.map(c=>c.words))===JSON.stringify(controls),what+': what the user can do: '+JSON.stringify(m.controls));
 if(lock)assert(/i-lock$/.test(m.icon||''),what+': the lock\'s shape: '+m.icon);
 if(here)assert(m.controls.find(c=>c.words===buttons[3])?.href===here,what+': a link to the page at the server\'s own address: '+JSON.stringify(m.controls));
 if(home)assert(m.controls.find(c=>c.words===labels('Top bar',lang)[1])?.href==='/',what+': a link to all projects: '+JSON.stringify(m.controls));
}
const traceOf=reply=>JSON.parse(reply.body).traceId;

// The browser's downloads: each begun, with the name that the page gave, and its file once done.
const begun=new Map();
async function saved(since,timeout=10000){
 const stop=Date.now()+timeout;
 while(Date.now()<stop){const done=report.downloads.slice(since).find(d=>d.state==='completed');if(done)return done;const failed=report.downloads.slice(since).find(d=>d.state==='canceled');assert(!failed,'The download was cancelled: '+JSON.stringify(failed));await sleep(25);}
 throw new CheckFailure('No file was saved in time');
}
// The export that the browser saved: its name, its bytes the server's, and what it holds.
async function savedExport(since,project,lang,what){
 const done=await saved(since);
 const bytes=await fs.readFile(path.join(downloads,done.guid));
 const sent=[...report.requests].reverse().find(r=>r.method==='GET'&&r.path===`/api/spaces/${project}/export`);
 assert(sent?.networkId,what+': the page asked for the export');
 const body=await command('Network.getResponseBody',{requestId:sent.networkId});
 const server=body.base64Encoded?Buffer.from(body.body,'base64'):Buffer.from(body.body,'utf8');
 assert(bytes.equals(server),what+': the saved file holds the bytes that the server wrote: '+JSON.stringify({saved:bytes.length,server:server.length}));
 const file=JSON.parse(bytes.toString('utf8')),name=exportFile(project,file.exported_at);
 assert(done.suggestedFilename===name,what+': the browser saves it under the reply\'s name: '+JSON.stringify({saved:done.suggestedFilename,name}));
 const found=new Set();(function walk(value){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')for(const [k,m]of Object.entries(value)){found.add(k);walk(m);}})(file);
 const never=['snapshot','pictures','picture','discrepancies','claim','claims','claimed_at','session','read_session','write','write_id','sub','common_name','email','identity'].filter(k=>found.has(k));
 assert(file.format===1&&file.project===project&&!never.length&&!bytes.toString('utf8').includes('qa-fixture'),what+': one JSON file of the project, with no snapshot, picture, claim, session label or identity (SPEC-201): '+JSON.stringify({format:file.format,project:file.project,never}));
 return{name,file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex').slice(0,16)};
}

const SETTINGS=[[390,'light','en'],[390,'dark','ko'],[390,'dark','en'],[390,'light','ko'],[1440,'light','en'],[1440,'dark','ko'],[1440,'dark','en'],[1440,'light','ko']].map(([width,theme,lang])=>({width,theme,lang,tag:`${width}-${theme}-${lang}`}));
const TWO=[SETTINGS[4],SETTINGS[1]];
// The limits also in dark Korean at 1,440, where "23개 중 20개" broke across lines (BUG-613).
const LIMITS=[...TWO,SETTINGS[5]];

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json();qa=fixture.data;
 assert(qa?.project==='qa-data'&&qa.bare==='qa-data-bare'&&/^ne_/.test(qa.edit||'')&&qa.checkpoints?.length===3,'The origin is not the opt-in synthetic data fixture');
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url));
 report.preflight={fixture:{project:qa.project,bare:qa.bare,long:qa.long,start:qa.start},build:{sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
 const browserEnv={...process.env};for(const name of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(name))delete browserEnv[name];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-features=BackForwardCache','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],browserEnv);
 const endpoint=await browser.endpoint();
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);return;}
  if(m.method==='Browser.downloadWillBegin'){begun.set(m.params.guid,m.params.suggestedFilename);report.downloads.push({guid:m.params.guid,suggestedFilename:m.params.suggestedFilename,url:m.params.url.slice(0,5),state:'begun',at:new Date().toISOString()});return;}
  if(m.method==='Browser.downloadProgress'){if(['completed','canceled'].includes(m.params.state))report.downloads.push({guid:m.params.guid,suggestedFilename:begun.get(m.params.guid)||null,state:m.params.state,bytes:m.params.receivedBytes,at:new Date().toISOString()});return;}
  if(m.sessionId!==session)return;
  if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error)+' ('+m.params.request.method+' '+new URL(m.params.request.url).pathname+')';});
  else if(m.method==='Network.requestWillBeSent'){const url=new URL(m.params.request.url);if(url.origin===origin&&url.pathname.startsWith('/api/'))inflight.set(m.params.requestId,{method:m.params.request.method,path:url.pathname,held:heldIds.has(m.params.requestId)});}
  else if(m.method==='Network.loadingFinished'||m.method==='Network.loadingFailed')inflight.delete(m.params.requestId);
  else if(m.method==='Runtime.exceptionThrown'){const text=m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text;report.runtimeExceptions.push({at:new Date().toISOString(),text});report.console.push({kind:'exception',level:'error',text:String(text)});}
  else if(m.method==='Runtime.consoleAPICalled'&&['error','warning','assert'].includes(m.params.type))report.console.push({kind:'console',level:m.params.type==='warning'?'warning':'error',text:m.params.args.map(a=>a.value??a.description??'').join(' ')});
  else if(m.method==='Log.entryAdded'&&['error','warning'].includes(m.params.entry.level))report.console.push({kind:'log',source:m.params.entry.source,level:m.params.entry.level,text:m.params.entry.text,url:m.params.entry.url||null});
 };
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 await command('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Log.enable');await command('DOM.enable');
 await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await command('Emulation.setTimezoneOverride',{timezoneId:'UTC'});

 const page=(name,lang,stage='04-functional-spec',part=qa.part,hash='')=>stagePath(name,part,stage)+'?lang='+lang+hash;
 const DATA=name=>new RegExp('^/api/spaces/'+name+'/data$'),EXPORT=name=>new RegExp('^/api/spaces/'+name+'/export$'),REMOVE=name=>new RegExp('^/api/snapshots/'+name+'$');
 const reads=name=>report.requests.filter(r=>r.method==='GET'&&r.path===`/api/spaces/${name}/data`).length;
 // "Project data": in the workspace's head, which under 1,024 pixels is in the sheet of stages.
 // The panel reads its data once as it opens.
 async function openPanel(s,{held:holdRead=false}={}){
  const name=await evaluate(`JSON.parse(document.getElementById('view-data').textContent).data.project.name`);
  if(s.width<1024){await evaluate(`location.hash='#stages'`);await waitFor(`!!document.querySelector('.rail .pdl')?.checkVisibility()`);await paint();}
  if(holdRead)hold('GET',DATA(name));
  const before=reads(name);
  await click('.rail .pdl');
  await waitFor(`!!document.querySelector('.ws[data-nx-data] .dp')&&document.activeElement?.id==='dp-h'`);
  if(!holdRead)await idle();else await waitFor(`true`);
  await sleep(100);
  assert(reads(name)===before+1,'The panel reads its data once as it opens: '+(reads(name)-before));
 }
 async function closeWith(how,s){
  if(how==='close')await click('.dp [data-nx-act="data-close"]');else await key('Escape','Escape',27);
  await waitFor(`!document.querySelector('.ws[data-nx-data]')`);await idle();
 }
 const seedName=(what,s)=>`qa-data-r-${what}-${s.tag}`;

 // SCR-130#loading, #normal and the export (TC-1463, TC-1471, TC-1472, TC-1723, TC-1724), with the
 // address, the focus, the scrim, Close and Escape.
 for(const s of SETTINGS)await test(`normal@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,name=qa.project;
  await open(page(name,lang));
  await openPanel(s,{held:true});
  let v=await view();
  headHolds(v,name,lang,'SCR-130#loading');
  assert(v.panel.skeleton&&v.panel.loadingWords===labels("The project's data",lang)[13]&&v.panel.acts.every(a=>a.button.off)&&v.focus==='dp-h'&&v.hash==='#data'&&v.state?.nexusData==='#data',
   'SCR-130#loading: grey lines with their words for screen readers, the acts off, the focus on the heading and the address with data: '+JSON.stringify({skeleton:v.panel.skeleton,words:v.panel.loadingWords,acts:v.panel.acts,focus:v.focus,hash:v.hash,state:v.state}));
  const loading=await checked(s,'SCR-130#loading',{},since);const loadingShot=await shot(`loading-${s.tag}`);
  const from=Date.now();await release();await idle();const to=Date.now();
  const answer=await api(`/api/spaces/${name}/data`);
  v=await view();headHolds(v,name,lang,'SCR-130#normal');normalHolds(v,answer,lang,from,to,'SCR-130#normal');layoutHolds(v,s,'SCR-130#normal');
  const d=answer.removal.deletes;
  assert(d.comments===12&&d.proposals===2&&d.checkpoints===3&&answer.read_session==='qa-fixture'&&answer.commit,'TC-1471: 12 comments, 2 proposals and 3 checkpoints passed in NEXUS, the commit and the session\'s label: '+JSON.stringify({d,read_session:answer.read_session,commit:answer.commit}));
  const normal=await checked(s,'SCR-130#normal',{},since);const normalShot=await shot(`normal-${s.tag}`);
  // The scrim waits with the page behind it: a press beside the panel changes nothing.
  if(s.width>=1024){await clickAt(8,v.viewport.height-8);await paint();const still=await view();assert(still.open==='open'&&still.hash==='#data','A press on the scrim leaves the panel open: '+JSON.stringify({open:still.open,hash:still.hash}));}
  // Export: "Preparing the file…" while it runs, then the file, and the panel reads again.
  hold('GET',EXPORT(name));const before=report.downloads.length;
  await click('.dp [data-nx-act="data-export"]');await waitFor(`!!document.querySelector('.dp [data-nx-act="data-export"] .keep')`);
  v=await view();const busy=v.panel.acts[0].button;
  assert(busy.words===labels('The export',lang)[2]&&busy.off&&!v.panel.acts[1].button.off,'SCR-130#loading: while the export runs its button says "Preparing the file…" and is off, the rest as it was: '+JSON.stringify(v.panel.acts));
  const exportingShot=await shot(`exporting-${s.tag}`);
  const readsBefore=reads(name);await release();
  const file=await savedExport(before,name,lang,'The export');
  await waitFor(`!!document.querySelector('.dp [data-nx-key="file"]')`);await idle();
  assert(reads(name)>readsBefore,'The panel reads its data again after an export');
  const head=file.file;
  assert(JSON.stringify(['comments','replies','decisions','proposals','edits','checkpoints'].map(k=>head.counts[k]))===JSON.stringify(KINDS.map(([k])=>d[k]))&&head.comments.length===12&&head.proposals.length===2&&head.checkpoints.length===3,'TC-1463: the file holds what the panel counts: '+JSON.stringify(head.counts));
  v=await view();normalHolds(v,await api(`/api/spaces/${name}/data`),lang,from,Date.now(),'After the export',{file:file.name});
  const exported=await checked(s,'After the export',{},since);const exportedShot=await shot(`exported-${s.tag}`);
  // Close: the address loses data, the focus returns to "Project data"; again, with Escape. Under
  // 1,024 pixels the sheet of stages closed when the panel opened from it, and stays closed: the
  // focus goes to the stage's name in the top bar, which opens it (BUG-611).
  const back=s.width<1024?'ttl only-ph':'data';
  await closeWith('close',s);v=await view();
  assert(v.hash===''&&!v.sheet&&v.focus===back&&Object.values(v.inert).every(i=>!i),'Close: the address loses data, the page behind works again, and the focus returns to "Project data", or under 1,024 pixels to the stage\'s name: '+JSON.stringify({hash:v.hash,sheet:v.sheet,focus:v.focus,inert:v.inert}));
  await openPanel(s);await closeWith('escape',s);v=await view();
  assert(v.hash===''&&!v.sheet&&v.focus===back,'Escape closes the panel as Close does: '+JSON.stringify({hash:v.hash,sheet:v.sheet,focus:v.focus}));
  return{evidence:'fixture page and reads; the read and the export held by the suite (held); the saved file compared with the bytes of the page\'s own reply',file:{name:file.name,bytes:file.bytes,sha256:file.sha256},checks:{loading,normal,exported},screenshots:[loadingShot,normalShot,exportingShot,exportedShot]};
 });

 // SCR-130#empty (TC-1725): a project with a snapshot and no space, its export and its confirmation.
 for(const s of SETTINGS)await test(`empty@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,name=qa.bare;
  await open(page(name,lang,'02-prd','_'));
  const from=Date.now();await openPanel(s);const to=Date.now();
  const answer=await api(`/api/spaces/${name}/data`);
  assert(answer.space===false&&answer.commit===null,'The fixture\'s project has no space and no commit: '+JSON.stringify(answer));
  let v=await view();headHolds(v,name,lang,'SCR-130#empty');normalHolds(v,answer,lang,from,to,'SCR-130#empty');layoutHolds(v,s,'SCR-130#empty');
  const empty=await checked(s,'SCR-130#empty',{},since);const emptyShot=await shot(`empty-${s.tag}`);
  const before=report.downloads.length;await click('.dp [data-nx-act="data-export"]');
  const file=await savedExport(before,name,lang,'The export without a space');
  assert(file.file.space===false&&Object.values(file.file.counts).every(n=>n===0)&&!file.file.comments.length,'Its head says that it holds no entries: '+JSON.stringify(file.file.counts));
  await click('.dp [data-nx-act="data-remove"]');await waitFor(`document.activeElement?.id==='rm-h'`);await idle();
  v=await view();confirmationHolds(v,await api(`/api/spaces/${name}/data`),name,lang,'SCR-130#removal without a space');
  assert(v.panel.confirm.list.length===1&&!v.panel.confirm.groups.length,'A project without a space lists the snapshot only');
  const removal=await checked(s,'SCR-130#removal without a space',{},since);const removalShot=await shot(`empty-removal-${s.tag}`);
  await click('.dp [data-nx-act="data-cancel"]');v=await view();
  assert(!v.panel.confirm&&v.focus==='data-remove','Cancel: the data again, the focus on "Remove this project": '+JSON.stringify({focus:v.focus}));
  await closeWith('close',s);
  return{evidence:'fixture page and reads; the saved file of a project without a space',file:{name:file.name,bytes:file.bytes},checks:{empty,removal},screenshots:[emptyShot,removalShot]};
 });

 // SCR-130#removal and #removal-ready, the removal and SCR-110#removed (TC-1467, TC-1468,
 // TC-1470, TC-1707, TC-1726, TC-1727), on a project seeded for each setting.
 for(const s of SETTINGS)await test(`removal@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,name=seedName('x',s);
  // The first page that the removal leads to has no query: the fixture takes its language from a cookie.
  await cookie('nexus-qa-lang',lang);
  const seeded=await act({act:'seed',name});
  await open(page(name,lang));const from=Date.now();await openPanel(s);
  let answer=await api(`/api/spaces/${name}/data`),v=await view();
  normalHolds(v,answer,lang,from,Date.now(),'A project never read');
  const readsBefore=reads(name);
  await click('.dp [data-nx-act="data-remove"]');await waitFor(`document.activeElement?.id==='rm-h'`);await idle();
  assert(reads(name)>readsBefore,'The panel reads its data again as the confirmation opens');
  answer=await api(`/api/spaces/${name}/data`);v=await view();headHolds(v,name,lang,'SCR-130#removal');confirmationHolds(v,answer,name,lang,'SCR-130#removal');
  const groups=v.panel.confirm.groups;
  assert(JSON.stringify(groups[0].ids)===JSON.stringify([...seeded.comments].sort())&&groups.at(-1).ids.join()===seeded.edit,'TC-1467: the 3 comments and the reflection by ID: '+JSON.stringify(groups));
  const removal=await checked(s,'SCR-130#removal',{},since);const removalShot=await shot(`removal-${s.tag}`);
  // TC-1470 and TC-1776's first two: another letter case, then a letter short, leave it off.
  await type(name.toUpperCase());v=await view();assert(v.panel.confirm.go.off&&v.panel.confirm.field.value===name.toUpperCase(),'Another letter case leaves the button off: '+JSON.stringify(v.panel.confirm.go));
  await type(name.slice(0,-1));v=await view();assert(v.panel.confirm.go.off,'A letter short leaves the button off');
  assert(!report.requests.some(r=>r.path.includes(name.toUpperCase())||(r.body||'').includes(name.toUpperCase())),'The typed name is never sent');
  await type(`  ${name}  `);v=await view();headHolds(v,name,lang,'SCR-130#removal-ready');confirmationHolds(v,answer,name,lang,'SCR-130#removal-ready',{ready:true});
  const ready=await checked(s,'SCR-130#removal-ready',{},since);const readyShot=await shot(`removal-ready-${s.tag}`);
  hold('DELETE',REMOVE(name));
  await click('.dp [data-nx-act="data-confirm"]');await waitFor(`!!document.querySelector('.dp [data-nx-act="data-confirm"] .keep')`);
  v=await view();const words=labels("The removal's confirmation",lang);
  assert(v.panel.confirm.go.words===words[13]&&v.panel.confirm.go.off&&v.panel.confirm.cancel.off,'While the removal runs: "Removing…", and it and Cancel off: '+JSON.stringify([v.panel.confirm.go,v.panel.confirm.cancel]));
  const removingShot=await shot(`removing-${s.tag}`);
  const sent=report.requests.filter(r=>r.method==='DELETE'&&r.path===`/api/snapshots/${name}`);
  assert(sent.length===1&&sent[0].body===null,'One removal, with no body: '+JSON.stringify(sent));
  await release();
  await waitFor(`location.pathname==='/'&&document.documentElement?.dataset.nxCode==='ready'`,15000);await settled();
  const held=await act({act:'held',name});
  assert(Object.values(held).every(n=>n===0),'TC-1468: the server holds nothing of the project: '+JSON.stringify(held));
  let home=await homeView();
  assert(home.bar&&home.bar.text===label('A project was removed',0,lang,{project:name})&&home.bar.project===name&&home.bar.role==='status'&&home.bar.close===labels('Top bar',lang)[5]&&!home.cards.includes(name)&&home.stored===null,
   'SCR-110#removed: the bar names the removed project, with Close, and the project has no card: '+JSON.stringify(home));
  const removed=await checked(s,'SCR-110#removed',{},since);const removedShot=await shot(`removed-${s.tag}`);
  await click('.home [data-nx-act="removed-close"]');home=await homeView();
  assert(!home.bar&&home.focus==='home','Close: the bar goes, the focus on the page: '+JSON.stringify(home));
  await open('/?lang='+lang);home=await homeView();
  assert(!home.bar&&!home.cards.includes(name),'The first page loaded again says nothing, and the missing card tells (TC-1777): '+JSON.stringify(home));
  return{evidence:'fixture page, reads and removal; the removal held by the suite (held); the server\'s rows counted through the fixture',seeded,held,checks:{removal,ready,removed},screenshots:[removalShot,readyShot,removingShot,removedShot]};
 });

 // SCR-130#stale (TC-1728): the agent's comment while the confirmation is open, read again as the
 // page comes back into view and just before the removal, and its hub's push.
 for(const s of SETTINGS)await test(`stale@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,name=seedName('s',s);
  await act({act:'seed',name});await open(page(name,lang));await openPanel(s);
  await click('.dp [data-nx-act="data-remove"]');await waitFor(`document.activeElement?.id==='rm-h'`);await idle();
  await type(name);let v=await view();assert(!v.panel.confirm.go.off,'The name typed turns the button on');
  const first=await act({act:'comment',name});await visible();
  let answer=await api(`/api/spaces/${name}/data`);v=await view();
  confirmationHolds(v,answer,name,lang,'SCR-130#stale',{stale:true});
  assert(v.panel.confirm.groups[0].ids.includes(first.id)&&v.panel.confirm.field.value==='','SCR-130#stale: the lists as they are now, the typed name emptied: '+JSON.stringify({ids:v.panel.confirm.groups[0].ids,value:v.panel.confirm.field.value}));
  const stale=await checked(s,'SCR-130#stale',{},since);const staleShot=await shot(`stale-${s.tag}`);
  // Just before the removal: the page reads again, finds the change and removes nothing.
  await type(name);const second=await act({act:'comment',name});
  await click('.dp [data-nx-act="data-confirm"]');await idle();
  answer=await api(`/api/spaces/${name}/data`);v=await view();
  confirmationHolds(v,answer,name,lang,'SCR-130#stale, found as the removal starts',{stale:true});
  const held=await act({act:'held',name});
  assert(!report.requests.some(r=>r.method==='DELETE'&&r.path===`/api/snapshots/${name}`)&&held.snapshots===1&&held.comments===5&&v.panel.confirm.groups[0].ids.includes(second.id)&&v.panel.confirm.field.value===''&&v.panel.confirm.go.off,'Nothing is removed when what it deletes changed, and the typed name is emptied: '+JSON.stringify({held,value:v.panel.confirm.field.value}));
  // A newer push: SCR-111#stale's bar, and the data with the newer push's time and commit.
  const pushed=await act({act:'push',name});await visible();
  await click('.dp [data-nx-act="data-cancel"]');v=await view();
  assert(v.focus==='data-remove'&&!v.panel.confirm,'Cancel: the confirmation closes and the focus returns to "Remove this project": '+v.focus);
  answer=await api(`/api/spaces/${name}/data`);
  assert(answer.commit===pushed.commit,'The fixture pushed again');
  assert(v.bars.some(b=>b.act==='load'),'SCR-111#stale\'s bar: '+JSON.stringify(v.bars));
  normalHolds(v,answer,lang,Date.now()-60000,Date.now(),'The newer push in the panel');
  await click('.dp [data-nx-act="data-remove"]');await waitFor(`document.activeElement?.id==='rm-h'`);await idle();v=await view();
  assert(v.panel.confirm.field.value===''&&v.panel.confirm.go.off,'The typed name is forgotten when the confirmation closes');
  const pushShot=await shot(`stale-push-${s.tag}`);
  await closeWith('escape',s);
  return{evidence:'fixture page and reads; the agent\'s comments and its hub\'s push through the fixture; visibilitychange dispatched (dispatched event)',held,checks:{stale},screenshots:[staleShot,pushShot]};
 });

 // SCR-130#error (TC-1729): the read, the export and the removal on a database that fails.
 for(const s of SETTINGS)await test(`error@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,name=qa.project;
  await open(page(name,lang));
  await cookie('nexus-qa-space','broken');await openPanel(s);await cookie('nexus-qa-space',null);
  let v=await view();headHolds(v,name,lang,'SCR-130#error, the read');
  messageHolds(v.panel.messages[0],{tone:'err',text:codeMessage('internal',lang),retry:true},lang,'SCR-130#error, the read');
  assert(v.panel.acts.every(a=>a.button.off)&&!v.panel.rows.length,'The acts off while no data came');
  const read=await checked(s,'SCR-130#error, the read',{allowed:REFUSED},since);const readShot=await shot(`error-read-${s.tag}`);
  await click('.dp [data-nx-act="data-read"]');await idle();v=await view();
  assert(!v.panel.messages.length&&v.panel.rows.length===2,'Try again reads the data: '+JSON.stringify(v.panel.messages));
  await cookie('nexus-qa-fail','export');const before=report.downloads.length;
  await click('.dp [data-nx-act="data-export"]');await idle();await cookie('nexus-qa-fail',null);v=await view();
  messageHolds(v.panel.messages.at(-1),{tone:'err',text:`${label('The export failed',0,lang)} ${codeMessage('internal',lang)}`,retry:true},lang,'SCR-130#error, the export');
  assert(report.downloads.length===before&&v.panel.rows.length===2,'No file is saved, and the data stays');
  const exported=await checked(s,'SCR-130#error, the export',{allowed:REFUSED},since);const exportShot=await shot(`error-export-${s.tag}`);
  await click('.dp [data-nx-act="data-remove"]');await waitFor(`document.activeElement?.id==='rm-h'`);await idle();
  await type(name);await cookie('nexus-qa-fail','delete');
  await click('.dp [data-nx-act="data-confirm"]');await idle();await cookie('nexus-qa-fail',null);v=await view();
  messageHolds(v.panel.confirm.note[0],{tone:'err',text:codeMessage('internal',lang),retry:true},lang,'SCR-130#error, the removal');
  const held=await act({act:'held',name});
  assert(v.panel.confirm.field.value===name&&!v.panel.confirm.go.off&&held.snapshots===1&&held.comments===12,'The typed name kept, the button working again, nothing removed: '+JSON.stringify({value:v.panel.confirm.field.value,go:v.panel.confirm.go,held}));
  const removal=await checked(s,'SCR-130#error, the removal',{allowed:REFUSED},since);const removalShot=await shot(`error-remove-${s.tag}`);
  await click('.dp [data-nx-act="data-cancel"]');await closeWith('close',s);
  return{evidence:'fixture page; the fixture\'s failing database for the read, the export and the removal (real failures of the server)',checks:{read,exported,removal},screenshots:[readShot,exportShot,removalShot]};
 });

 // SCR-130#permission (TC-1730): the read without Access's assertion, and the export and the
 // removal under the service token, each refused for real.
 for(const s of SETTINGS)await test(`permission@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,name=qa.project;
  await open(page(name,lang));await openPanel(s);
  await cookie('nexus-qa-access','none');await visible();await cookie('nexus-qa-access',null);
  let v=await view();
  messageHolds(v.panel.messages[0],{tone:'warn',text:codeMessage('access_missing',lang),lock:true},lang,'SCR-130#permission, the read');
  assert(v.panel.rows.length===2,'The panel keeps what it showed');
  const read=await checked(s,'SCR-130#permission, the read',{allowed:REFUSED},since);const readShot=await shot(`permission-read-${s.tag}`);
  await cookie('nexus-qa-access','agent');const before=report.downloads.length;
  await click('.dp [data-nx-act="data-export"]');await idle();await cookie('nexus-qa-access',null);v=await view();
  messageHolds(v.panel.messages.at(-1),{tone:'warn',text:codeMessage('user_only',lang),lock:true},lang,'SCR-130#permission, the export');
  assert(report.downloads.length===before,'No file is saved');
  const exported=await checked(s,'SCR-130#permission, the export',{allowed:REFUSED},since);const exportShot=await shot(`permission-export-${s.tag}`);
  await click('.dp [data-nx-act="data-remove"]');await waitFor(`document.activeElement?.id==='rm-h'`);await idle();
  await type(name);await cookie('nexus-qa-access','agent');
  await click('.dp [data-nx-act="data-confirm"]');await idle();await cookie('nexus-qa-access',null);v=await view();
  messageHolds(v.panel.confirm.note[0],{tone:'warn',text:codeMessage('user_only',lang),lock:true},lang,'SCR-130#permission, the removal');
  const held=await act({act:'held',name});
  assert(held.snapshots===1&&held.comments===12,'Nothing is removed: '+JSON.stringify(held));
  const removal=await checked(s,'SCR-130#permission, the removal',{allowed:REFUSED},since);const removalShot=await shot(`permission-remove-${s.tag}`);
  await click('.dp [data-nx-act="data-cancel"]');await closeWith('close',s);
  return{evidence:'fixture page; the requests sent without Access\'s assertion and under the service token, which the server refuses (real refusals)',checks:{read,exported,removal},screenshots:[readShot,exportShot,removalShot]};
 });

 // SCR-130#gone (TC-1731): another tab's removal, found by the read, the export and the removal.
 for(const s of SETTINGS)await test(`gone@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,shots=[],checks={};
  const gone=codeMessage('project_not_found',lang);
  for(const [what,why] of[['read',''],['export',` ${label('The export failed',1,lang)}`],['remove',` ${label('Nothing to remove',0,lang)}`]]){
   const name=seedName('g-'+what,s);await act({act:'seed',name});await open(page(name,lang));await openPanel(s);
   if(what==='remove'){await click('.dp [data-nx-act="data-remove"]');await waitFor(`document.activeElement?.id==='rm-h'`);await idle();await type(name);}
   await act({act:'remove',name});const before=report.downloads.length;
   if(what==='read')await visible();
   else{await click(what==='export'?'.dp [data-nx-act="data-export"]':'.dp [data-nx-act="data-confirm"]');await idle();}
   const v=await view();headHolds(v,name,lang,'SCR-130#gone, '+what);
   messageHolds(v.panel.messages[0],{tone:'err',text:gone+why,trace:false,home:true},lang,'SCR-130#gone, '+what);
   assert(v.panel.acts.every(a=>a.button.off)&&!v.panel.confirm&&report.downloads.length===before,'The two acts off, no confirmation and no file: '+JSON.stringify(v.panel.acts));
   checks[what]=await checked(s,'SCR-130#gone, '+what,{allowed:REFUSED},since);shots.push(await shot(`gone-${what}-${s.tag}`));
  }
  await click('.dp .msg a[href="/"]');await waitFor(`location.pathname==='/'&&document.documentElement?.dataset.nxCode==='ready'`,15000);
  return{evidence:'fixture page and reads; another tab\'s removal through the fixture; visibilitychange dispatched (dispatched event)',checks,screenshots:shots};
 });

 // The other codes of SCR-130#error and #permission, at two settings: the read refused with
 // another method (relayed), for another Access application (real) and busy (mocked).
 for(const s of TWO)await test(`read-codes@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,name=qa.project,shots=[];
  await open(page(name,lang));
  const wrong=await relayed(`/api/spaces/${name}/data`,{method:'PUT'});assert(wrong.status===405,'The server refuses another method: '+wrong.status);
  answer('GET',DATA(name),wrong,'relayed');await openPanel(s);let v=await view();
  messageHolds(v.panel.messages[0],{tone:'err',text:codeMessage('method_not_allowed',lang),retry:true},lang,'SCR-130#error, method_not_allowed');
  assert(v.panel.messages[0].trace.includes(traceOf(wrong)),'The server\'s trace ID');
  shots.push(await shot(`read-405-${s.tag}`));
  answer('GET',DATA(name),{status:429,headers:{'Content-Type':'application/problem+json'},body:JSON.stringify({code:'busy',status:429,title:'Busy',traceId:'0123456789abcdef'})},'mocked');
  await click('.dp [data-nx-act="data-read"]');await idle();v=await view();
  messageHolds(v.panel.messages[0],{tone:'err',text:codeMessage('Busy',lang),trace:false,retry:true},lang,'SCR-130#error, busy (rule 8)');
  await click('.dp [data-nx-act="data-read"]');await idle();
  await cookie('nexus-qa-access','other');await visible();await cookie('nexus-qa-access',null);v=await view();
  messageHolds(v.panel.messages[0],{tone:'warn',text:codeMessage('access_other_app',lang),lock:true},lang,'SCR-130#permission, access_other_app');
  const checks=await checked(s,'SCR-130#permission, access_other_app',{allowed:REFUSED},since);shots.push(await shot(`read-other-app-${s.tag}`));
  await closeWith('close',s);
  return{evidence:'fixture page; the server\'s answer to the same read with another method (relayed), busy answered by the suite (mocked) and a sign-in for another application refused by the server (real)',checks,screenshots:shots};
 });
 // The export's other failures: a reply cut on its way and one that is not the file (mocked),
 // another site (relayed) and no connection (mocked); no file is saved for any.
 for(const s of TWO)await test(`export-codes@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,name=qa.project,shots=[];
  await open(page(name,lang));await openPanel(s);
  const whole=await data(`/api/spaces/${name}/export`),other=await data(`/api/spaces/${qa.bare}/export`);
  const headers={'Content-Type':whole.headers['content-type'],'Content-Disposition':whole.headers['content-disposition'],'Cache-Control':'no-store'};
  const failed=`${label('The export failed',0,lang)} ${codeMessage('internal',lang)}`,before=report.downloads.length;
  answer('GET',EXPORT(name),{status:200,headers,body:whole.text.slice(0,Math.floor(whole.text.length/2))},'mocked');
  await click('.dp [data-nx-act="data-export"]');await idle();let v=await view();
  messageHolds(v.panel.messages.at(-1),{tone:'err',text:failed,trace:false,retry:true},lang,'A reply cut on its way');shots.push(await shot(`export-cut-${s.tag}`));
  answer('GET',EXPORT(name),{status:200,headers,body:other.text},'mocked');
  await click('.dp [data-nx-act="data-export"]');await idle();v=await view();
  messageHolds(v.panel.messages.at(-1),{tone:'err',text:failed,trace:false,retry:true},lang,'A reply that is not the file');
  const cross=await relayed(`/api/spaces/${name}/export`,{headers:{'Sec-Fetch-Site':'cross-site'}});assert(cross.status===403&&JSON.parse(cross.body).code==='cross_site','The server refuses another site: '+cross.body);
  answer('GET',EXPORT(name),cross,'relayed');
  await click('.dp [data-nx-act="data-export"]');await idle();v=await view();
  const here=await evaluate('location.origin+location.pathname+location.hash');
  messageHolds(v.panel.messages.at(-1),{tone:'err',text:codeMessage('cross_site',lang),here},lang,'SCR-130#error, cross_site on the export');shots.push(await shot(`export-cross-site-${s.tag}`));
  answer('GET',EXPORT(name),{fail:'ConnectionRefused'},'mocked');
  await click('.dp [data-nx-act="data-export"]');await idle();v=await view();
  messageHolds(v.panel.messages.at(-1),{tone:'err',text:`${label('The export failed',0,lang)} ${codeMessage('No connection',lang)}`,trace:false,retry:true},lang,'No connection (rule 8)');
  assert(report.downloads.length===before,'No file is saved: '+JSON.stringify(report.downloads.slice(before)));
  const checks=await checked(s,'The export\'s failures',{allowed:[...REFUSED,/net::ERR_CONNECTION_REFUSED/]},since);shots.push(await shot(`export-offline-${s.tag}`));
  await closeWith('close',s);
  return{evidence:'fixture page; replies cut, of another project and refused (mocked), the server\'s own refusal of another site (relayed)',checks,screenshots:shots};
 });
 // The removal's other refusals: another site (relayed), a sign-in of neither kind (real) and a
 // sign-in that expired (mocked), after which "Sign in again" comes back to the panel without the name.
 for(const s of TWO)await test(`remove-codes@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,name=qa.project,shots=[];
  await open(page(name,lang));await openPanel(s);
  await click('.dp [data-nx-act="data-remove"]');await waitFor(`document.activeElement?.id==='rm-h'`);await idle();await type(name);
  const cross=await relayed(`/api/snapshots/${name}`,{method:'DELETE',headers:{'Sec-Fetch-Site':'cross-site'}});assert(cross.status===403&&JSON.parse(cross.body).code==='cross_site','The server refuses another site: '+cross.body);
  answer('DELETE',REMOVE(name),cross,'relayed');
  await click('.dp [data-nx-act="data-confirm"]');await idle();let v=await view();
  const here=await evaluate('location.origin+location.pathname+location.hash');
  messageHolds(v.panel.confirm.note[0],{tone:'err',text:codeMessage('cross_site',lang),here},lang,'SCR-130#error, cross_site on the removal');shots.push(await shot(`remove-cross-site-${s.tag}`));
  await cookie('nexus-qa-access','neither');await click('.dp [data-nx-act="data-confirm"]');await idle();await cookie('nexus-qa-access',null);v=await view();
  messageHolds(v.panel.confirm.note[0],{tone:'warn',text:codeMessage('no_kind',lang),lock:true},lang,'SCR-130#permission, no_kind');
  const checks=await checked(s,'SCR-130#permission, no_kind',{allowed:REFUSED},since);shots.push(await shot(`remove-no-kind-${s.tag}`));
  let held=await act({act:'held',name});assert(held.snapshots===1&&held.comments===12,'Nothing is removed: '+JSON.stringify(held));
  answer('GET',DATA(name),{status:302,headers:{Location:'https://nexus-test.cloudflareaccess.com/cdn-cgi/access/login/qa'},body:''},'mocked');
  await click('.dp [data-nx-act="data-confirm"]');await idle();v=await view();
  messageHolds(v.panel.confirm.note[0],{tone:'warn',text:codeMessage('Sign-in expired',lang),trace:false,signIn:true},lang,'SCR-130#permission, a sign-in that expired (rule 7)');
  shots.push(await shot(`remove-sign-in-${s.tag}`));
  const where=v.href;
  await click('.dp .rnote [data-nx-act="sign-in"]');
  await waitFor(`document.readyState==='complete'&&document.documentElement?.dataset.nxCode==='ready'&&!!document.querySelector('.ws[data-nx-data] .dp')`,15000);await settled();v=await view();
  assert(v.href===where&&v.panel&&!v.panel.confirm,'Sign in again comes back to the same address with the panel, and the typed name is not kept: '+JSON.stringify({href:v.href,where,confirm:Boolean(v.panel?.confirm)}));
  held=await act({act:'held',name});assert(held.snapshots===1,'Nothing is removed');
  await closeWith('close',s);
  return{evidence:'fixture page; the server\'s own refusal of another site (relayed), a sign-in of neither kind refused by the server (real) and Access\'s redirect for a sign-in that expired (mocked)',checks,screenshots:shots};
 });

 // The limits (rule 1, rule 12): a long name breaks rather than widen the panel, and the
 // confirmation lists 20 of the 23 open comments with "20 of 23".
 for(const s of LIMITS)await test(`limits@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,name=qa.long;
  await open(page(name,lang));await openPanel(s);
  // "Remove this project" sits under the 23 counts and the acts' lines: pressed, it scrolls the
  // panel's body down to it, and the confirmation then opens at its heading (BUG-612).
  await click('.dp [data-nx-act="data-remove"]');await waitFor(`document.activeElement?.id==='rm-h'`);await idle();
  const answer=await api(`/api/spaces/${name}/data`);let v=await view();confirmationHolds(v,answer,name,lang,'The confirmation\'s limits');
  const comments=v.panel.confirm.groups[0];
  assert(comments.ids.length===20&&comments.more===label('The list',9,lang,{n:count(20),total:count(23)})&&comments.moreLines===1&&v.panel.confirm.headingWhole&&v.panel.confirm.labelWhole,'20 IDs with "20 of 23" on one line (BUG-613), and the long name wraps: '+JSON.stringify({comments,heading:v.panel.confirm.headingWhole,label:v.panel.confirm.labelWhole}));
  assert(v.focusInSight===true,'The confirmation opens with its focused heading in sight (BUG-612): '+JSON.stringify({focus:v.focus,inSight:v.focusInSight}));
  assert(v.panel.confirm.go.room>=6&&v.panel.confirm.cancel.room>=6,'The removal\'s button keeps room around its wrapped words (BUG-613): '+JSON.stringify({go:v.panel.confirm.go,cancel:v.panel.confirm.cancel}));
  const opened=await shot(`limits-${s.tag}`),checks=await checked(s,'The confirmation\'s limits',{},since);
  // Cancel returns the focus to "Remove this project", in sight again (BUG-612).
  await evaluate(`document.querySelector('.dp .dpb').scrollTop=0`);await paint();
  await click('.dp [data-nx-act="data-cancel"]');await waitFor(`document.activeElement?.dataset.nxFocus==='data-remove'`);await idle();
  v=await view();
  assert(v.focusInSight===true,'Cancel returns the focus to "Remove this project", in sight: '+JSON.stringify({focus:v.focus,inSight:v.focusInSight}));
  return{evidence:'fixture page and reads',checks,screenshots:[opened,await shot(`limits-cancel-${s.tag}`)]};
 });

 // TC-1764: the panel's addresses. /p/{project}#data leads to the current stage with the panel;
 // beside item the panel opens over the item; Close keeps the rest; the back button closes it.
 for(const s of TWO)await test(`addresses@${s.tag}`,async()=>{
  const since=report.console.length;await setting(s);const lang=s.lang,name=qa.project;
  const current=await data(`/p/${name}`,{redirect:'manual'}),led=new URL(current.headers.location,origin).pathname;
  // A redirect leaves no query, so the fixture takes the page's language from its cookie.
  await cookie('nexus-qa-lang',lang);
  await open(`/p/${name}#data`,{where:led});await idle();
  let v=await view();headHolds(v,name,lang,'/p/{project}#data');
  assert(v.path===led&&v.hash==='#data'&&v.focus==='dp-h','/p/{project}#data leads to the current stage with the panel open: '+JSON.stringify({path:v.path,hash:v.hash,focus:v.focus}));
  await closeWith('close',s);v=await view();
  assert(v.hash===''&&!v.panel,'Close: the address loses data: '+v.hash);
  await open(page(name,lang,'05-erd',qa.part,'#item=TBL-001&data'));await idle();v=await view();
  headHolds(v,name,lang,'#item={id}&data');
  const itemShot=await shot(`address-item-${s.tag}`);
  await closeWith('escape',s);v=await view();
  assert(v.hash==='#item=TBL-001'&&(s.width<1024||v.item),'Escape: the address loses data and keeps the item: '+JSON.stringify({hash:v.hash,item:v.item}));
  await openPanel(s);v=await view();
  assert(v.hash==='#item=TBL-001&data','"Project data" beside the item: '+v.hash);
  // BUG-611: Close keeps the rest of the address, also where the phone's sheet of stages opened the
  // panel: the sheet closed with the choice and stays closed, and the item is still open.
  await closeWith('close',s);v=await view();
  assert(v.hash==='#item=TBL-001'&&!v.sheet&&Boolean(v.item)&&v.focus===(s.width<1024?'ttl only-ph':'data'),'Close keeps the item in the address, and the sheet of stages stays closed: '+JSON.stringify({hash:v.hash,sheet:v.sheet,item:v.item,focus:v.focus}));
  await openPanel(s);
  const history=await command('Page.getNavigationHistory');
  await command('Page.navigateToHistoryEntry',{entryId:history.entries[history.currentIndex-1].id});
  await waitFor(`!document.querySelector('.ws[data-nx-data]')`);await idle();v=await view();
  assert(v.hash==='#item=TBL-001'&&!v.panel&&!v.sheet,'The browser\'s back button closes the panel and keeps the rest, without the sheet of stages: '+JSON.stringify({hash:v.hash,sheet:v.sheet}));
  const checks=await checked(s,'The addresses',{},since);
  // TC-1473: a project that the server does not hold, opened with #data: the server's 404, the
  // message page of SCR-111#error with a link to the first page, and no panel.
  const unknown=`/p/qa-data-unknown-${s.tag}`,before=report.console.length,reply=await data(unknown,{redirect:'manual',headers:{Accept:'text/html'}});
  assert(reply.status===404,'TC-1473: a project that the server does not hold answers 404: '+reply.status);
  await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url:origin+unknown+'#data'});
  await waitFor(`location.pathname===${JSON.stringify(unknown)}&&document.readyState==='complete'`,15000);await idle();
  const missing=await evaluate(`(()=>({home:[...document.querySelectorAll('a[href="/"]')].filter(a=>a.checkVisibility({visibilityProperty:true})).map(a=>a.textContent.replace(/\\s+/g,' ').trim()),panel:!!document.querySelector('.dp'),hash:location.hash,said:document.body.innerText.includes(${JSON.stringify(lang==='ko'?'이 프로젝트는 서버에 없습니다.':'This project is not on the server.')})}))()`);
  assert(missing.home.length>0&&!missing.panel&&missing.hash==='#data'&&missing.said,'TC-1473: the message page says so and links to the first page, with no panel: '+JSON.stringify(missing));
  const unknownChecks=await checked(s,'TC-1473',{allowed:REFUSED},before);const unknownShot=await shot(`address-unknown-${s.tag}`);
  return{evidence:'fixture page and reads; the browser\'s back button through CDP\'s history; the server\'s own 404 for a project that it does not hold',checks:{...checks,unknown:unknownChecks},screenshots:[itemShot,unknownShot]};
 });

 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.blockedExternalOrigins.length,'The page asked another origin: '+report.blockedExternalOrigins.join());
 assert(!report.runtimeExceptions.length,'The page threw: '+JSON.stringify(report.runtimeExceptions));
 const writes=report.requests.filter(r=>!['GET','HEAD','DELETE'].includes(r.method));
 assert(!writes.length,'The page wrote: '+JSON.stringify(writes));
 const expectedTests=SETTINGS.length*7+TWO.length*4+LIMITS.length;
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
