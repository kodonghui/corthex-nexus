/**
 * TASK-287: the folds of the workspace's columns (SPEC-210, SCR-111#folded) in a browser. With
 * nothing kept, the server's columns by the window's width: the talk a column from 1,440 pixels,
 * folded to "Talk ({n})" with "My turn {n}" from 1,280 to 1,439, and the panel of rule 16 from
 * 1,024 to 1,279, with nothing written to the browser's storage; the page's code, held, then the
 * kept folds applied in one step (SCR-111#loading). Folding the talk and the list and showing them
 * again, at the layout table's widths, with the focus where a press leaves it and nothing sent to
 * the server; the rail, whose stages open; the folds kept through the page loaded again, at every
 * width from 1,280 and in another project; an item picked in the picture or in the list, an
 * address with #talk= or #item=, and Stage record, which show a folded talk's column for as long
 * as they are open, the kept fold unchanged; the phone's tabs whatever is folded, and a wider
 * window that shows the folds as they were; storage that cannot be read or written, and storage
 * that cannot be written, where a fold lasts for the visit; the keyboard, and the names and states
 * that a screen reader reads, from Chrome's accessibility tree rather than a screen reader. Then
 * SCR-111#folded in each setting, with stage 12's page checks (./page-checks.mjs), and the item
 * with its narrowed talk and a refused comment at 1,152 and 1,280 pixels with each fold (TC-1720
 * to TC-1722). Node 24 built-ins only; an owned headless Chrome over CDP. Requires
 * NEXUS_QA_TALK=1, the opt-in view-server, NEXUS_CHROME and NEXUS_QA_ORIGIN. Synthetic loopback
 * fixture only. The page's reads reach the fixture server; the suite holds the page's code once
 * and answers the comments of TC-1721 itself, which the report lists as held and mocked.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {label,labels,codeMessage} from '../src/draw/words.js';
import {stagePath,stageName} from '../src/draw/stages.js';
import {words} from '../ui/messages.js';
import {FOLD_KEYS} from '../ui/folds.js';
import {SIDEWAYS,OUTSIDE,HITS} from './page-checks.mjs';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_TALK!=='1')throw Error('Use only the opt-in synthetic talk fixture');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,project='qa-talk',part='sample',other='qa-views';
const page=(stage,lang,hash='',name=project)=>stagePath(name,part,stage)+'?lang='+lang+hash;
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'folds-');
const {folder}=browser;
const report={schema:'nexus-folds-browser-regression/1',scope:'synthetic loopback fixture only',evidence:'page measurement, Chrome\'s accessibility tree and screenshots; reads reach the fixture server, and the suite holds the page\'s code once and answers the comments of TC-1721 itself (held, mocked), as each test says',
 startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],blockedExternalOrigins:[],posts:[],requests:[],runtimeExceptions:[],console:[]};
const budget=Number(process.env.NEXUS_QA_FOLDS_BUDGET_MS)||300000,softDeadline=Date.now()+budget;
let ws,session,seq=0,held=null,responses=[],closing=false,codeEntry,qa;
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
// A wait that outlives a navigation of the page's own, such as a stage that the rail opens.
const NAVIGATED=/navigated or closed|Execution context was destroyed|Cannot find context/;
async function waitFor(expression,timeout=10000){const stop=Date.now()+timeout;while(Date.now()<stop){let ok=false;try{ok=await evaluate(expression);}catch(error){if(!NAVIGATED.test(String(error)))throw error;}if(ok)return;await sleep(25);}throw Error('Page wait timed out: '+expression);}
async function paint(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function setting({width,theme='light',touch=width<1024}){
 await command('Emulation.setDeviceMetricsOverride',{width,height:width<1024?844:900,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
 await command('Emulation.setTouchEmulationEnabled',touch?{enabled:true,maxTouchPoints:1}:{enabled:false});
}
// No reading runs, no item loads, nothing is being sent, a picture shown is drawn, and the fonts
// that the code adds are in.
// The words of a button that is sent, which show over its own words kept unseen (BUG-606).
const SENDING=JSON.stringify([codeMessage('Sending','en'),codeMessage('Sending','ko')]);
const SETTLED=`(()=>{const q=s=>document.querySelector(s),shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});
 if(['.stage .upd','.side .tupd'].some(s=>(q(s)?.textContent||'')!==''))return false;
 if(q('.side .item .sk')&&shown(q('.side .item')))return false;
 if([...document.querySelectorAll('.side button')].some(b=>${SENDING}.includes((b.querySelector('.keep > :not(.was)')||b).textContent.trim())))return false;
 const pf=q('.pf');if(shown(pf)&&!q('.pf > .cv.drawn, .pf .empty-p, .pf .fnote .msg.warn'))return false;
 const fonts=q('link[data-nexus-css="fonts"]');if(fonts&&(!fonts.sheet||document.fonts.status!=='loaded'))return false;
 return true;})()`;
async function settled(){await waitFor(SETTLED,15000);await paint();}
// Navigation returns once the page is parsed; its held code may not have run yet.
async function open(route,{ready=true}={}){
 const url=origin+route,[base,fragment='']=url.split('#');await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url});
 await waitFor(`location.href.split('#')[0]===${JSON.stringify(base)}&&${JSON.stringify(fragment)}.split('&').filter(Boolean).every(p=>('&'+location.hash.slice(1)+'&').includes('&'+p+'&'))&&document.readyState!=='loading'&&!!document.getElementById('view-data')`,15000);
 if(ready){await waitFor(`document.documentElement.dataset.nxCode==='ready'`,15000);await settled();}
 await paint();
}
// The page loaded again, as the browser's button loads it.
async function reload(){
 await evaluate('window.__nxBefore=1');await command('Page.reload',{});
 await waitFor(`!window.__nxBefore&&document.readyState==='complete'&&document.documentElement.dataset.nxCode==='ready'`,15000);await settled();
}
// The browser's storage of the fixture's origin, emptied, then holding the folds named, which a
// page of the origin writes as the page's code would: the fixture's receipts, for whose JSON Chrome
// asks /favicon.ico itself, which the page checks leave out.
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
async function test(name,fn){
 const startedAt=new Date().toISOString();
 try{const evidence=await fn();report.tests.push({name,verdict:'works',startedAt,finishedAt:new Date().toISOString(),...evidence});console.log('PASS '+name);}
 catch(error){let screenshot;try{screenshot=await shot(name+'-failure');}catch{}report.tests.push({name,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),error:String(error),screenshot});console.error('FAIL '+name+': '+error);}
 finally{try{await release();}catch{}held=null;responses=[];}
 await out('results.json',report);
}
async function release(){const active=held;held=null;if(!active)return;for(const id of active.requests){try{await command('Fetch.continueRequest',{requestId:id});}catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;}}}
const problem=(status,code,extra={})=>({status,headers:[{name:'Content-Type',value:'application/problem+json'}],body:JSON.stringify({type:'about:blank',title:'Synthetic refusal',status,code,traceId:'tr_qa_'+code,...extra})});
async function onPaused(event){
 const url=new URL(event.request.url),method=event.request.method,where=url.pathname+url.search;
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 report.requests.push({method,path:where,body:event.request.postData||null});
 if(method==='POST')report.posts.push({path:url.pathname,at:new Date().toISOString()});
 const rule=responses.find(r=>r.method===method&&r.pattern.test(where));
 if(rule){
  responses.splice(responses.indexOf(rule),1);
  report.interceptions.push({path:where,method,action:'mocked '+rule.status,at:new Date().toISOString()});
  await command('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:rule.status,responseHeaders:rule.headers,body:Buffer.from(rule.body||'').toString('base64')});return;
 }
 if(held&&held.pattern.test(where)){held.requests.push(event.requestId);report.interceptions.push({path:where,method,action:'held',at:new Date().toISOString()});return;}
 try{await command('Fetch.continueRequest',{requestId:event.requestId});}
 catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;report.interceptions.push({path:where,method,action:'dropped by the page',at:new Date().toISOString()});}
}
// The mouse and the keyboard, as a person uses them.
async function clickAt(x,y){for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});}
async function click(selector){
 const at=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}));if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'No control to click: '+selector);await clickAt(at.x,at.y);await paint();
}
// A table of the picture, picked as a person picks it: a press at its middle. The board's links
// are drawn under the picture's own drawing, which takes the press.
async function pick(id){
 const at=await evaluate(`(()=>{const r=document.querySelector('.pf svg.board a[href="#item=${id}"] rect')?.getBoundingClientRect(),f=document.querySelector('.pf').getBoundingClientRect();if(!r||!r.width)return null;const x=r.x+r.width/2,y=r.y+r.height/2;return x>f.left&&x<f.right&&y>f.top&&y<f.bottom?{x,y}:null;})()`);
 assert(at,'No table to pick in sight: '+id);await clickAt(at.x,at.y);await paint();
}
const KEYS={Escape:[27,'Escape',''],Enter:[13,'Enter','\r'],Tab:[9,'Tab',''],' ':[32,'Space',' ']};
async function key(name,{draw=true}={}){
 const [code,named,text]=KEYS[name];
 await command('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:named,windowsVirtualKeyCode:code,...(text?{text}:{})});
 await command('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:named,windowsVirtualKeyCode:code});
 if(draw)await paint();
}
// Tab, as many times as it takes the focus to a control, up to a limit: how many, or null.
async function tabTo(expression,limit){for(let n=1;n<=limit;n++){await key('Tab',{draw:false});if(await evaluate(expression))return n;}return null;}
async function type(selector,text){await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await command('Input.insertText',{text});await paint();}
// What a screen reader reads of an element: Chrome's accessibility tree, its role, name and state.
async function ax(selector){
 const {root}=await command('DOM.getDocument',{depth:0});
 const {nodeIds}=await command('DOM.querySelectorAll',{nodeId:root.nodeId,selector});
 const nodes=[];
 for(const nodeId of nodeIds){
  const {nodes:[node]}=await command('Accessibility.getPartialAXTree',{nodeId,fetchRelatives:false});
  nodes.push({role:node.role?.value??null,name:node.name?.value??null,ignored:Boolean(node.ignored),expanded:node.properties?.find(p=>p.name==='expanded')?.value?.value??null});
 }
 return nodes;
}

// What the workspace shows of its folds.
function foldsView(keys){
 const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():null;
 const shown=e=>Boolean(e&&e.checkVisibility({visibilityProperty:true})),box=e=>{const r=e.getBoundingClientRect();return[r.left,r.top,r.width,r.height].map(Math.round);};
 const width=e=>shown(e)?Math.round(e.getBoundingClientRect().width):null,sr=e=>txt([...(e?.querySelectorAll('.sr')||[])].find(shown));
 const ws=q('.ws'),side=q('aside.side'),tbtn=q('.stage [data-nx-fold="talk"]'),foldS=q('.rail [data-nx-act="fold-stages"]'),foldT=q('.side [data-nx-act="fold-talk"]');
 let kept;try{kept={stages:localStorage.getItem(keys.stages),talk:localStorage.getItem(keys.talk)};}catch(error){kept={error:error.name};}
 const active=document.activeElement;
 return{W:document.documentElement.clientWidth,
  ws:{stages:ws?.dataset.nxStages||null,talk:ws?.dataset.nxTalk||null,open:ws?.dataset.nxOpen||null,tab:ws?.dataset.nxTab||null},
  rail:width(q('nav.rail')),stage:width(q('main.stage')),side:width(side),sideRight:shown(side)?Math.round(side.getBoundingClientRect().right):null,
  tbtn:{shown:shown(tbtn),text:txt(tbtn?.querySelector(':scope > span:not(.mt)')),mine:txt(tbtn?.querySelector(':scope > .mt')),expanded:tbtn?.getAttribute('aria-expanded')??null,title:tbtn?.title??null},
  foldS:{shown:shown(foldS),expanded:foldS?.getAttribute('aria-expanded')??null,title:foldS?.title??null,name:sr(foldS),disabled:Boolean(foldS?.disabled),wait:foldS?.dataset.nxWait||null},
  foldT:{shown:shown(foldT),expanded:foldT?.getAttribute('aria-expanded')??null,title:foldT?.title??null,name:sr(foldT),disabled:Boolean(foldT?.disabled)},
  tabs:all('.tabs .tab').filter(shown).map(t=>({tab:t.dataset.nxTab,first:txt(t.querySelector('.tl2 > span:first-child'))||txt(t),mine:txt(t.querySelector('.mt')),box:box(t),lines:t.querySelector('.tl2')?box(t.querySelector('.tl2')):null})),
  kept,hash:location.hash,item:shown(q('.side .item'))?txt(q('.side .item .ih .id')):null,
  active:active?.dataset?.nxFocus||active?.dataset?.nxAct||active?.id||active?.tagName||null,
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
}
const view=()=>evaluate(`(${foldsView})(${JSON.stringify(FOLD_KEYS)})`);
// The rail of a folded list: 13 stages, each 44 pixels high inside its 56, the current one with
// the accent's bar, the shapes and the marks of my turn, the names and counts for screen readers.
const RAIL=`(()=>{const rail=document.querySelector('nav.rail'),rows=[...rail.querySelectorAll('.row')],r=rail.getBoundingClientRect(),shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});
 const on=rail.querySelector('.row[aria-current="page"]'),cs=on&&getComputedStyle(on),top=rail.querySelector('.ftop');
 return{rows:rows.length,heights:[...new Set(rows.map(e=>Math.round(e.getBoundingClientRect().height)))],
  inside:rows.every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left-0.5&&b.right<=r.right+0.5;})&&rail.scrollWidth<=rail.clientWidth,
  current:on&&{path:new URL(on.href).pathname,bar:parseFloat(cs.borderLeftWidth)>0&&!/^(transparent|rgba\\(0, 0, 0, 0\\))$/.test(cs.borderLeftColor)},
  shapes:rows.filter(e=>shown(e.querySelector('svg'))).length,marks:rows.filter(e=>shown(e.querySelector('.cnt'))).map(e=>new URL(e.href).pathname.split('/').pop()),
  counts:rows.filter(e=>shown(e.querySelector('.n'))).length,names:rows.filter(e=>(e.querySelector('.name')?.getBoundingClientRect().width||0)>1).length,
  control:shown(top)&&top.getBoundingClientRect().bottom<=rows[0].getBoundingClientRect().top+0.5};})()`;
// What the layout table of SCR-111 gives a window from 1,024 pixels: the list or the rail, the
// stage, and the side, a column from 1,280 pixels and the panel of rule 16 under it.
function expected(W,{stages=null,talk=null,open=false}={}){
 const rail=stages==='folded'?56:248,column=W>=1280&&(open||talk==='shown'||W>=1440&&talk!=='folded'),panel=W<1280&&open;
 return{rail,side:column||panel?400:null,stage:W-rail-(column?400:0),button:W<1280||!column};
}
function layoutIs(v,e,what){
 assert(v.rail===e.rail&&v.side===e.side&&v.stage===e.stage&&v.tbtn.shown===e.button&&v.overflow===0&&(e.side===null||v.sideRight===v.W),what+': '+JSON.stringify({W:v.W,expected:e,rail:v.rail,stage:v.stage,side:v.side,sideRight:v.sideRight,button:v.tbtn.shown,ws:v.ws,overflow:v.overflow}));
}
// "Talk ({n})" with "My turn {n}": seven open entries of stage 02, three of them in my turn.
function talkButton(v,lang,n='7'){
 assert(v.tbtn.text===label('Tabs',4,lang,{n})&&v.tbtn.mine===label('The talk',1,lang,{n:'3'})&&v.tbtn.title===label('The folds',3,lang),'"Talk ('+n+')" with "My turn 3": '+JSON.stringify(v.tbtn));
}
// The requests since a mark: a fold sends nothing, and no request names one.
function nothingSent(mark,what){const sent=report.requests.slice(mark).filter(r=>r.method!=='GET'||/fold/i.test(r.path+(r.body||'')));assert(!sent.length,what+' sent: '+JSON.stringify(sent));return report.requests.length-mark;}
const itemReady=id=>waitFor(`document.querySelector('.side .item .ih .id')?.textContent===${JSON.stringify(id)}&&!document.querySelector('.side .item .sk')&&!!document.querySelector('.side .item :is(.fields,.src,.msg)')`,15000).then(settled);
const entryOpen=(id,where='.side')=>waitFor(`document.querySelector(${JSON.stringify(where+' li[data-nx-entry="'+id+'"] > .hd .ref')})?.getAttribute('aria-expanded')==='true'`,15000).then(settled);
// The page's code: each change of .ws's folds in the code's steps, from a page that starts.
const STEPS=`new MutationObserver((list,self)=>{const ws=document.querySelector('.ws');if(!ws)return;self.disconnect();window.__foldSteps=[];
 new MutationObserver(records=>{const names=records.map(m=>m.attributeName).filter(n=>n==='data-nx-stages'||n==='data-nx-talk');if(names.length)window.__foldSteps.push(names);}).observe(ws,{attributes:true});}).observe(document,{childList:true,subtree:true});`;
// A browser that keeps no storage for the page, and one whose storage reads but takes nothing.
const NO_STORAGE=`Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Synthetic: no storage for this page','SecurityError');}});`;
const READ_ONLY=`Storage.prototype.setItem=function(){throw new DOMException('Synthetic: the storage is full','QuotaExceededError');};`;

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json();qa=fixture.talk;
 assert(qa?.project===project&&qa.part===part&&/^nc_/.test(qa.question||''),'The origin is not the opt-in synthetic talk fixture');
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),entries=JSON.parse(metadataBytes).entries;
 assert(/^\/code\/page\.[a-f0-9]{8}\.js$/.test(entries['page-js']||''),'Content-hashed page code is required');
 codeEntry=new RegExp('^'+entries['page-js'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
 report.preflight={fixture:{project,question:qa.question},build:{entries:{'page-js':entries['page-js']},sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
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
 const mine=lang=>label('The talk',1,lang,{n:'3'});

 // A first visit, nothing kept: the talk a column at 1,440 pixels and folded to "Talk (7)" with
 // "My turn 3" at 1,439 and 1,280, the panel's button at 1,152 and 1,024; the list shown; nothing
 // on .ws and nothing in the storage (SPEC-210, TC-1769).
 for(const [lang,theme]of[['en','light'],['ko','dark']]){
  await test(`first-visit-${lang}-${theme}`,async()=>{
   await fresh();const seen=[],screenshots=[],mark=report.requests.length;
   for(const width of[1440,1439,1280,1152,1024]){
    await setting({width,theme});await open(page('02-prd',lang));
    const v=await view(),e=expected(v.W);
    assert(v.W===width&&!v.ws.stages&&!v.ws.talk&&v.kept.stages===null&&v.kept.talk===null,'A first visit keeps nothing and leaves nothing on .ws: '+JSON.stringify({W:v.W,ws:v.ws,kept:v.kept}));
    layoutIs(v,e,'The columns of a first visit at '+width);talkButton(v,lang);
    assert(v.tbtn.expanded===(e.button?'false':null),'"Talk (7)" says that the talk is not shown, while it shows: '+JSON.stringify(v.tbtn));
    assert(v.foldS.shown&&!v.foldS.disabled&&v.foldS.expanded==='true'&&v.foldS.title===label('The folds',0,lang)&&v.foldS.name===label('The folds',0,lang),'The list\'s control, named for what it does: '+JSON.stringify(v.foldS));
    assert(v.foldT.shown===(width>=1440)&&(width<1440||v.foldT.expanded==='true'&&v.foldT.name===label('The folds',2,lang)&&v.foldT.title===label('The folds',2,lang)),'The talk\'s control in its head, from 1,440 on a first visit: '+JSON.stringify(v.foldT));
    seen.push({width,rail:v.rail,stage:v.stage,side:v.side,button:v.tbtn.shown});
    if(width===1440||width===1280)screenshots.push(await shot(`first-visit-${width}-${lang}-${theme}`));
   }
   nothingSent(mark,'A first visit');
   return{evidence:'fixture pages and reads',seen,screenshots};
  });
 }

 // SCR-111#loading: the server draws the columns of a first visit, the list's control waiting for
 // the code; the code, held by the suite, then applies what the browser keeps in one step.
 await test('loading-then-kept-1280-en-light',async()=>{
  await fresh({stages:'folded',talk:'shown'});await setting({width:1280});
  const steps=(await command('Page.addScriptToEvaluateOnNewDocument',{source:STEPS})).identifier;
  try{
   held={pattern:codeEntry,requests:[]};
   await open(page('02-prd','en'),{ready:false});
   const stop=Date.now()+5000;while(!held.requests.length&&Date.now()<stop)await sleep(25);
   assert(held.requests.length===1,'The suite holds the page\'s code');
   await paint();
   let v=await view();
   assert(!v.ws.stages&&!v.ws.talk&&v.foldS.disabled&&v.foldS.wait==='folds','Before the code: nothing on .ws, the list\'s control waiting: '+JSON.stringify({ws:v.ws,foldS:v.foldS}));
   layoutIs(v,expected(1280),'The server\'s columns, as on a first visit');
   const loadingShot=await shot('loading-1280-en-light');
   await release();await waitFor(`document.documentElement.dataset.nxCode==='ready'`,15000);await settled();
   v=await view();
   layoutIs(v,expected(1280,{stages:'folded',talk:'shown'}),'The kept folds, once the code runs');
   const applied=await evaluate('window.__foldSteps||null');
   assert(JSON.stringify(applied)==='[["data-nx-stages","data-nx-talk"]]'&&!v.foldS.disabled&&v.foldS.expanded==='false','Both folds in one step, the control working: '+JSON.stringify({applied,foldS:v.foldS}));
   return{evidence:'fixture page and reads; the page\'s code held by the suite, then released (held)',applied,screenshots:[loadingShot,await shot('loading-kept-1280-en-light')]};
  }finally{await command('Page.removeScriptToEvaluateOnNewDocument',{identifier:steps});}
 });

 // TC-1496: at 1,440 pixels the talk folds and the stage takes its 400 pixels, "Talk (7)" with
 // "My turn 3" in its place and the focus on it; pressed, the column again, the focus on its
 // heading. The list folds to its rail and back, the focus on its control, whose name and state
 // change; a stage of the rail opens, folded as kept. Nothing is sent of the folds.
 for(const [lang,theme]of[['en','light'],['ko','dark']]){
  await test(`fold-and-show-1440-${lang}-${theme}`,async()=>{
   await fresh();await setting({width:1440,theme});await open(page('02-prd',lang));
   const mark=report.requests.length;
   await click('.side [data-nx-act="fold-talk"]');
   let v=await view();
   layoutIs(v,expected(1440,{talk:'folded'}),'The talk folded');talkButton(v,lang);
   assert(v.stage===792+400&&v.tbtn.expanded==='false'&&v.active==='talk'&&v.ws.talk==='folded'&&v.kept.talk==='folded'&&v.kept.stages===null,'The stage takes the talk\'s width, the focus on "Talk (7)", kept: '+JSON.stringify({stage:v.stage,tbtn:v.tbtn,active:v.active,ws:v.ws,kept:v.kept}));
   const foldedShot=await shot(`talk-folded-1440-${lang}-${theme}`);
   await click('.stage [data-nx-fold="talk"]');
   v=await view();
   layoutIs(v,expected(1440,{talk:'shown'}),'"Talk (7)" shows the column again');
   assert(v.active==='talk-h'&&v.ws.talk==='shown'&&v.kept.talk==='shown'&&v.foldT.expanded==='true'&&v.tbtn.expanded===null,'The focus on the talk\'s heading, kept shown: '+JSON.stringify({active:v.active,ws:v.ws,kept:v.kept}));
   await click('.rail [data-nx-act="fold-stages"]');
   v=await view();
   layoutIs(v,expected(1440,{stages:'folded',talk:'shown'}),'The list folded to its rail');
   assert(v.foldS.expanded==='false'&&v.foldS.title===label('The folds',1,lang)&&v.foldS.name===label('The folds',1,lang)&&v.active==='fold-stages'&&v.ws.stages==='folded'&&v.kept.stages==='folded','Its control says what it does now, the focus on it: '+JSON.stringify({foldS:v.foldS,active:v.active,kept:v.kept}));
   const rail=await evaluate(RAIL);
   assert(rail.rows===13&&JSON.stringify(rail.heights)==='[44]'&&rail.inside&&rail.shapes===13&&rail.current?.path===stagePath(project,part,'02-prd')&&rail.current.bar&&JSON.stringify(rail.marks)==='["02-prd","05-erd"]'&&!rail.counts&&!rail.names&&rail.control,'The rail: 13 stages of 44 pixels, the current one marked, my turn\'s marks, the control at its top: '+JSON.stringify(rail));
   await click('.side [data-nx-act="fold-talk"]');
   v=await view();layoutIs(v,expected(1440,{stages:'folded',talk:'folded'}),'Both folded');
   const bothShot=await shot(`both-folded-1440-${lang}-${theme}`);
   await click('.rail .row[href$="/05-erd"]');
   await waitFor(`location.pathname===${JSON.stringify(stagePath(project,part,'05-erd'))}&&document.readyState==='complete'&&document.documentElement.dataset.nxCode==='ready'`,15000);await settled();
   // The rail's links carry no ?lang=, so the stage opens in the fixture server's language.
   v=await view();layoutIs(v,expected(1440,{stages:'folded',talk:'folded'}),'The stage that the rail opened, folded as kept');talkButton(v,await evaluate('document.documentElement.lang'),'4');
   await click('.rail [data-nx-act="fold-stages"]');
   v=await view();layoutIs(v,expected(1440,{talk:'folded'}),'The list shown again');
   assert(v.foldS.expanded==='true'&&v.kept.stages==='shown','Kept shown: '+JSON.stringify({foldS:v.foldS,kept:v.kept}));
   const requests=nothingSent(mark,'Folding and showing');
   return{evidence:'fixture pages and reads; no write',rail,requests,screenshots:[foldedShot,bothShot,await shot(`rail-stage-05-1440-${lang}-${theme}`)]};
  });
 }

 // TC-1497 and TC-1769: both folded hold through the page loaded again and at every width from
 // 1,024; at 1,280 the talk shown is kept, through the reload and at 1,439 and 1,440; in another
 // project the folds are the same, since they are the device's.
 await test('kept-through-reload-en-light',async()=>{
  await fresh();await setting({width:1440});await open(page('02-prd','en'));
  await click('.rail [data-nx-act="fold-stages"]');await click('.side [data-nx-act="fold-talk"]');
  await reload();
  let v=await view();
  layoutIs(v,expected(1440,{stages:'folded',talk:'folded'}),'Both folded through the reload');
  assert(v.ws.stages==='folded'&&v.ws.talk==='folded'&&v.foldS.expanded==='false'&&v.tbtn.expanded==='false','Their states: '+JSON.stringify({ws:v.ws,foldS:v.foldS.expanded,tbtn:v.tbtn.expanded}));
  const reloadShot=await shot('both-folded-reloaded-1440-en-light'),widths=[];
  for(const width of[1439,1280,1152,1024]){await setting({width});await paint();v=await view();layoutIs(v,expected(width,{stages:'folded',talk:'folded'}),'Both folded at '+width);widths.push([width,v.rail,v.stage]);}
  await setting({width:1280});await open(page('02-prd','en'));
  await click('.stage [data-nx-fold="talk"]');
  v=await view();layoutIs(v,expected(1280,{stages:'folded',talk:'shown'}),'The talk shown at 1,280');
  assert(v.kept.talk==='shown','Kept shown');
  await reload();
  v=await view();layoutIs(v,expected(1280,{stages:'folded',talk:'shown'}),'Shown through the reload at 1,280');
  for(const width of[1439,1440]){await setting({width});await paint();v=await view();layoutIs(v,expected(width,{stages:'folded',talk:'shown'}),'Shown at '+width);widths.push([width,v.rail,v.stage,v.side]);}
  await open(page('05-erd','en','',other));
  v=await view();layoutIs(v,expected(1440,{stages:'folded',talk:'shown'}),'Another project, as kept');
  await click('.side [data-nx-act="fold-talk"]');
  await open(page('02-prd','en'));
  v=await view();layoutIs(v,expected(1440,{stages:'folded',talk:'folded'}),'Back in the first project, folded as in the other');
  return{evidence:'fixture pages and reads, two projects',widths,screenshots:[reloadShot,await shot('kept-other-project-1440-en-light')]};
 });

 // TC-1769 at 1,280 in Korean: each kept value of the talk, shown and folded, through the reload.
 await test('kept-at-1280-ko-dark',async()=>{
  await fresh();await setting({width:1280,theme:'dark'});await open(page('02-prd','ko'));
  let v=await view();layoutIs(v,expected(1280),'A first visit, folded by the width');
  await click('.stage [data-nx-fold="talk"]');
  v=await view();layoutIs(v,expected(1280,{talk:'shown'}),'Shown');assert(v.kept.talk==='shown'&&v.active==='talk-h','Kept shown, the focus on the heading: '+JSON.stringify({kept:v.kept,active:v.active}));
  await reload();v=await view();layoutIs(v,expected(1280,{talk:'shown'}),'Shown through the reload');
  const shownShot=await shot('kept-shown-1280-ko-dark');
  await click('.side [data-nx-act="fold-talk"]');
  v=await view();layoutIs(v,expected(1280,{talk:'folded'}),'Folded');assert(v.kept.talk==='folded'&&v.active==='talk','Kept folded, the focus on "Talk (7)": '+JSON.stringify({kept:v.kept,active:v.active}));
  await reload();v=await view();layoutIs(v,expected(1280,{talk:'folded'}),'Folded through the reload');
  await setting({width:1440,theme:'dark'});await paint();v=await view();layoutIs(v,expected(1440,{talk:'folded'}),'Folded as kept at 1,440');
  return{evidence:'fixture pages and reads',screenshots:[shownShot,await shot('kept-folded-1440-ko-dark')]};
 });

 // TC-1498: with the talk folded, an item picked in the picture shows the column with the item;
 // Close, and the back button, fold it again, the kept fold unchanged; a row of the list too, with
 // Escape. At 1,280 a first visit's folded talk does the same and keeps nothing.
 for(const [width,lang,theme,kept]of[[1440,'en','light','folded'],[1280,'ko','dark',null]]){
  await test(`item-in-folded-talk-${width}-${lang}-${theme}`,async()=>{
   await fresh({talk:kept});await setting({width,theme});await open(page('05-erd',lang));
   let v=await view();layoutIs(v,expected(width,{talk:kept}),'The talk folded');
   await pick('TBL-001');await itemReady('TBL-001');
   v=await view();layoutIs(v,expected(width,{talk:kept,open:true}),'The item picked in the picture shows the column');
   assert(v.item==='TBL-001'&&v.hash==='#item=TBL-001'&&v.ws.open==='talk'&&v.kept.talk===kept,'With the item, the kept fold unchanged: '+JSON.stringify({item:v.item,hash:v.hash,ws:v.ws,kept:v.kept}));
   const pickedShot=await shot(`picked-${width}-${lang}-${theme}`);
   await click('.side .item [data-nx-act="item-close"]');await waitFor(`location.hash===''&&!document.querySelector('.ws').dataset.nxOpen`);await settled();
   v=await view();layoutIs(v,expected(width,{talk:kept}),'Close folds the column again');
   assert(v.kept.talk===kept&&v.active!=='BODY','The kept fold unchanged, the focus on the page: '+JSON.stringify({kept:v.kept,active:v.active}));
   await pick('TBL-002');await itemReady('TBL-002');
   v=await view();layoutIs(v,expected(width,{talk:kept,open:true}),'Another item');
   await evaluate('history.back()');await waitFor(`location.hash===''&&!document.querySelector('.ws').dataset.nxOpen`);await settled();
   v=await view();layoutIs(v,expected(width,{talk:kept}),'The back button folds it again');
   const afterBack=v.active;
   await open(page('02-prd',lang));
   await click('.stage .li[data-nx-item="REQ-002"]');await itemReady('REQ-002');
   v=await view();layoutIs(v,expected(width,{talk:kept,open:true}),'A row of the list shows the column with its item');
   await key('Escape');await waitFor(`location.hash===''&&!document.querySelector('.ws').dataset.nxOpen`);await settled();
   v=await view();layoutIs(v,expected(width,{talk:kept}),'Escape folds it again');
   assert(v.kept.talk===kept,'The kept fold unchanged: '+JSON.stringify(v.kept));
   return{evidence:'fixture pages and reads',afterBack,screenshot:pickedShot};
  });
 }

 // SCR-111's actions: an address with #talk= shows the folded talk's column with its entry; Escape
 // folds the entry, then the column, the focus on "Talk (7)"; a link's #talk= and the back button,
 // which leaves the focus there too; #item= and Escape. Nothing kept changes.
 await test('addresses-in-folded-talk-1280-en-light',async()=>{
  await fresh();await setting({width:1280});
  await open(page('02-prd','en','#talk='+qa.question));await entryOpen(qa.question,'.side .talk');
  let v=await view();layoutIs(v,expected(1280,{open:true}),'#talk= shows the column with its entry');
  assert(v.ws.open==='talk'&&v.kept.talk===null,'Shown for the entry, nothing kept: '+JSON.stringify({ws:v.ws,kept:v.kept}));
  const entryShot=await shot('talk-entry-1280-en-light');
  await key('Escape');await waitFor(`location.hash===''`);await settled();
  v=await view();layoutIs(v,expected(1280,{open:true}),'Escape folds the entry first');
  assert(v.active==='talk:'+qa.question,'The focus on the entry\'s press: '+v.active);
  await key('Escape');
  v=await view();layoutIs(v,expected(1280),'Escape again folds the column');
  assert(v.active==='talk'&&v.kept.talk===null,'The focus on "Talk (7)", nothing kept: '+JSON.stringify({active:v.active,kept:v.kept}));
  await evaluate(`location.hash=${JSON.stringify('#talk='+qa.question)}`);await entryOpen(qa.question,'.side .talk');
  v=await view();layoutIs(v,expected(1280,{open:true}),'A link\'s #talk=');
  await evaluate('history.back()');await waitFor(`location.hash===''&&!document.querySelector('.ws').dataset.nxOpen`);await settled();
  v=await view();layoutIs(v,expected(1280),'The back button folds it again');
  assert(v.active==='talk','The focus, which was in the column, on "Talk (7)": '+v.active);
  await open(page('02-prd','en','#item=REQ-002'));await itemReady('REQ-002');
  v=await view();layoutIs(v,expected(1280,{open:true}),'#item= shows the column with its item');
  assert(v.item==='REQ-002','The item: '+v.item);
  await key('Escape');await waitFor(`location.hash===''&&!document.querySelector('.ws').dataset.nxOpen`);await settled();
  v=await view();layoutIs(v,expected(1280),'Escape closes the item and folds the column');
  assert(v.kept.talk===null&&v.kept.stages===null,'Nothing kept: '+JSON.stringify(v.kept));
  return{evidence:'fixture pages and reads',screenshot:entryShot};
 });

 // Stage record opens in the side (SCR-112, SCR-113), so with the talk folded it shows the column
 // for as long as it is open, as an item does; Escape closes it and folds the column again, the
 // focus back on Stage record and the kept fold unchanged.
 for(const [width,lang,theme,kept]of[[1280,'ko','dark',null],[1440,'en','light','folded']]){
  await test(`record-in-folded-talk-${width}-${lang}-${theme}`,async()=>{
   await fresh({talk:kept});await setting({width,theme});await open(page('02-prd',lang));
   let v=await view();layoutIs(v,expected(width,{talk:kept}),'The talk folded');
   await click('.stage [data-nx-act="record"]');await waitFor(`document.activeElement?.id==='rec-h'`);await settled();
   v=await view();layoutIs(v,expected(width,{talk:kept,open:true}),'Stage record shows the column');
   assert(v.ws.open==='record'&&v.kept.talk===kept,'The record in the side, the kept fold unchanged: '+JSON.stringify({ws:v.ws,kept:v.kept}));
   // The stage's open checkpoint request whole, above the words box, in the column (TASK-300).
   const request=await evaluate(`(()=>{const rq=document.querySelector('.side .rec .rq'),a=rq?.querySelector('.look a'),r=rq?.getBoundingClientRect(),s=document.querySelector('.side')?.getBoundingClientRect(),w=document.querySelector('.side .rec #cp-words')?.getBoundingClientRect();return rq&&{look:a?.getAttribute('href')||null,inside:r.left>=s.left-1&&r.right<=s.right+1,above:!!w&&r.bottom<=w.top};})()`);
   assert(request?.look==='#item=REQ-001'&&request.inside&&request.above,'The request whole in the column, above the words box: '+JSON.stringify(request));
   const recordShot=await shot(`record-${width}-${lang}-${theme}`);
   await key('Escape');await waitFor(`!document.querySelector('.ws').dataset.nxOpen`);await settled();
   v=await view();layoutIs(v,expected(width,{talk:kept}),'Escape folds it again');
   assert(v.active==='record'&&v.kept.talk===kept,'The focus on Stage record, the kept fold unchanged: '+JSON.stringify({active:v.active,kept:v.kept}));
   return{evidence:'fixture page',screenshot:recordShot};
  });
 }

 // TC-1499: at 390 pixels the tabs show whatever is folded, "Talk 7" over "My turn 3" inside the
 // Talk tab's 44 pixels; the sheet of stages is the whole list; a wider window shows the folds
 // as they were, and 320 pixels nothing wider than the page.
 for(const [lang,theme]of[['en','light'],['ko','dark']]){
  await test(`phone-tabs-${lang}-${theme}`,async()=>{
   await fresh({stages:'folded',talk:'folded'});await setting({width:390,theme});await open(page('02-prd',lang));
   let v=await view();
   const tabOf=v=>v.tabs.find(t=>t.tab==='talk'),inside=t=>!!t&&t.box[3]===44&&!!t.lines&&t.lines[1]>=t.box[1]&&t.lines[1]+t.lines[3]<=t.box[1]+t.box[3]&&t.lines[2]<=t.box[2];
   let talkTab=tabOf(v);
   assert(v.ws.stages==='folded'&&v.ws.talk==='folded'&&v.tabs.length===2&&v.tabs[0].tab==='stage'&&talkTab.first===label('Tabs',2,lang,{n:'7'})&&talkTab.mine===mine(lang)&&inside(talkTab),'The tabs, "Talk 7" over "My turn 3" inside the Talk tab: '+JSON.stringify({ws:v.ws,tabs:v.tabs}));
   assert(v.rail===null&&v.side===null&&v.stage===v.W&&!v.foldS.shown&&!v.foldT.shown&&!v.tbtn.shown&&v.overflow===0,'The stage the whole width, no control of the folds: '+JSON.stringify({rail:v.rail,side:v.side,stage:v.stage,W:v.W,foldS:v.foldS.shown,foldT:v.foldT.shown,tbtn:v.tbtn.shown,overflow:v.overflow}));
   const phoneShot=await shot(`phone-390-${lang}-${theme}`);
   await click('a.ttl.only-ph');await paint();
   const sheet=await evaluate(`(()=>{const rail=document.querySelector('nav.rail'),rows=[...rail.querySelectorAll('.row')];return{shown:rail.checkVisibility(),rows:rows.length,names:rows.filter(e=>(e.querySelector('.name')?.getBoundingClientRect().width||0)>1).length,control:document.querySelector('.rail .ftop').checkVisibility()};})()`);
   assert(sheet.shown&&sheet.rows===13&&sheet.names===13&&!sheet.control,'The sheet of stages, the whole list: '+JSON.stringify(sheet));
   await click('.rail .close');
   await click('.tabs .tab[data-nx-tab="talk"]');await settled();
   v=await view();assert(v.side===v.W&&v.ws.tab==='talk','The Talk tab shows the talk: '+JSON.stringify({side:v.side,tab:v.ws.tab}));
   await click('.tabs .tab[data-nx-tab="stage"]');
   for(const width of[1440,1152]){await setting({width,theme});await paint();v=await view();layoutIs(v,expected(width,{stages:'folded',talk:'folded'}),'A wider window shows the folds as they were, at '+width);}
   await setting({width:390,theme});await paint();v=await view();
   assert(v.tabs.length===2&&v.rail===null&&v.side===null,'The tabs again at 390: '+JSON.stringify({tabs:v.tabs.length,rail:v.rail,side:v.side}));
   await setting({width:320,theme});await paint();v=await view();talkTab=tabOf(v);
   assert(v.overflow===0&&inside(talkTab),'Nothing wider than the page at 320, the two lines inside the tab: '+JSON.stringify({overflow:v.overflow,tab:talkTab}));
   return{evidence:'fixture page and reads; touch emulated',sheet,screenshots:[phoneShot,await shot(`phone-320-${lang}-${theme}`)]};
  });
 }

 // TC-1769: without the browser's storage the columns show as on a first visit, and a fold lasts
 // for the visit; with storage that reads but takes nothing, the kept value holds and a fold lasts
 // for the visit, the storage keeping what it held. The page throws nothing.
 await test('no-storage-en-light',async()=>{
  const thrown=report.runtimeExceptions.length;
  await fresh();
  let script=(await command('Page.addScriptToEvaluateOnNewDocument',{source:NO_STORAGE})).identifier,v;
  try{
   await setting({width:1280});await open(page('02-prd','en'));
   v=await view();assert(v.kept.error==='SecurityError','The page has no storage: '+JSON.stringify(v.kept));
   layoutIs(v,expected(1280),'As on a first visit at 1,280');
   await setting({width:1440});await open(page('02-prd','en'));
   v=await view();layoutIs(v,expected(1440),'As on a first visit at 1,440');
   await click('.side [data-nx-act="fold-talk"]');await click('.rail [data-nx-act="fold-stages"]');
   v=await view();layoutIs(v,expected(1440,{stages:'folded',talk:'folded'}),'The folds hold on the page');
   assert(v.foldS.expanded==='false'&&v.tbtn.expanded==='false','Their states: '+JSON.stringify({foldS:v.foldS.expanded,tbtn:v.tbtn.expanded}));
   await reload();v=await view();layoutIs(v,expected(1440),'And are gone with the visit');
  }finally{await command('Page.removeScriptToEvaluateOnNewDocument',{identifier:script});}
  await fresh({talk:'shown'});
  script=(await command('Page.addScriptToEvaluateOnNewDocument',{source:READ_ONLY})).identifier;
  try{
   await setting({width:1280});await open(page('02-prd','en'));
   v=await view();layoutIs(v,expected(1280,{talk:'shown'}),'The kept value, read');
   await click('.side [data-nx-act="fold-talk"]');
   v=await view();layoutIs(v,expected(1280,{talk:'folded'}),'A fold for the visit');
   assert(v.kept.talk==='shown','The storage keeps what it held: '+JSON.stringify(v.kept));
   await reload();v=await view();layoutIs(v,expected(1280,{talk:'shown'}),'The kept value again after the reload');
  }finally{await command('Page.removeScriptToEvaluateOnNewDocument',{identifier:script});}
  assert(report.runtimeExceptions.length===thrown,'The page threw: '+JSON.stringify(report.runtimeExceptions.slice(thrown)));
  return{evidence:'fixture pages and reads; the page\'s storage refused, then made read-only, by a script of the suite (mocked)'};
 });

 // TC-1778 in part, and SCR-111's actions: the keyboard reaches both controls and works them; the
 // accessibility tree names each for what it does and says its state; the rail's stages are links
 // named with their state, number, name and entries in my turn. Not a screen reader.
 await test('keyboard-and-names-1440-en-light',async()=>{
  await fresh();await setting({width:1440});await open(page('02-prd','en'));
  await evaluate('document.activeElement?.blur()');
  const toList=await tabTo(`document.activeElement?.dataset?.nxAct==='fold-stages'`,40);
  assert(toList,'The keyboard reaches the list\'s control');
  let [node]=await ax('.rail [data-nx-act="fold-stages"]');
  assert(node.role==='button'&&node.name===labels('The folds','en')[0]&&node.expanded===true,'Its name and state: '+JSON.stringify(node));
  await key('Enter');
  let v=await view();layoutIs(v,expected(1440,{stages:'folded'}),'Enter folds the list');
  [node]=await ax('.rail [data-nx-act="fold-stages"]');
  assert(v.active==='fold-stages'&&node.name===labels('The folds','en')[1]&&node.expanded===false,'The focus stays, the name and state change: '+JSON.stringify({active:v.active,node}));
  const rows=await ax('.rail .row'),current=rows[1];
  assert(rows.length===13&&rows.every(r=>r.role==='link'&&!r.ignored)&&current.name.includes('02')&&current.name.includes(stageName('02-prd','en'))&&current.name.includes(mine('en'))&&rows[0].name.includes(stageName('01-domain','en')),'The rail\'s stages, named: '+JSON.stringify(rows.slice(0,3)));
  const railShot=await shot('rail-focus-1440-en-light');
  await key(' ');
  v=await view();layoutIs(v,expected(1440,{stages:'shown'}),'Space shows it again');
  [node]=await ax('.rail [data-nx-act="fold-stages"]');
  assert(node.name===labels('The folds','en')[0]&&node.expanded===true,'Named again for folding: '+JSON.stringify(node));
  await evaluate(`document.getElementById('talk-h').focus()`);
  const toTalk=await tabTo(`document.activeElement?.dataset?.nxAct==='fold-talk'`,10);
  assert(toTalk,'The keyboard reaches the talk\'s control');
  [node]=await ax('.side [data-nx-act="fold-talk"]');
  assert(node.role==='button'&&node.name===labels('The folds','en')[2]&&node.expanded===true,'Its name and state: '+JSON.stringify(node));
  await key('Enter');
  v=await view();layoutIs(v,expected(1440,{talk:'folded'}),'Enter folds the talk');
  [node]=await ax('.stage [data-nx-fold="talk"]');
  assert(v.active==='talk'&&node.role==='button'&&node.name.includes(label('Tabs',4,'en',{n:'7'}))&&node.name.includes(mine('en'))&&node.expanded===false,'The focus on "Talk (7)", a button that says my turn and that the talk is folded: '+JSON.stringify({active:v.active,node}));
  // Space presses "Talk (7)" as it presses a button, without scrolling what holds it (BUG-605: the
  // browser agent's walk, FL-118/B1-7, found that it scrolled the stage and showed nothing).
  const scrolled=`(()=>{let n=scrollY;for(let e=document.querySelector('.stage [data-nx-fold="talk"]');e;e=e.parentElement)n+=e.scrollTop;return n;})()`;
  const before=await evaluate(scrolled);
  await key(' ');
  v=await view();layoutIs(v,expected(1440,{talk:'shown'}),'Space on "Talk (7)" shows it');
  const after=await evaluate(scrolled);
  assert(v.active==='talk-h'&&after===before,'The focus on the talk\'s heading, nothing scrolled: '+JSON.stringify({active:v.active,before,after}));
  // And Enter, once the talk is folded again from its own control.
  const again=await tabTo(`document.activeElement?.dataset?.nxAct==='fold-talk'`,10);
  assert(again,'The keyboard reaches the talk\'s control again');
  await key('Enter');
  v=await view();layoutIs(v,expected(1440,{talk:'folded'}),'Enter folds the talk again');
  await key('Enter');
  v=await view();layoutIs(v,expected(1440,{talk:'shown'}),'Enter on "Talk (7)" shows it');
  assert(v.active==='talk-h','The focus on the talk\'s heading: '+v.active);
  return{evidence:'fixture page and reads; Chrome\'s accessibility tree, not a screen reader',tabs:{toList,toTalk,again},names:{list:labels('The folds','en').slice(0,2),row:current.name},screenshot:railShot};
 });

 // TC-1712: SCR-111#folded in each setting, a list's stage and a picture's, at 390 with both
 // folded, at 1,152 with the list folded, at 1,280 with each fold and at 1,440 with both, in both
 // themes and languages, with stage 12's page checks and a frame of each.
 const SETTINGS=[
  {name:'390-both',width:390,stage:'02-prd',kept:{stages:'folded',talk:'folded'}},
  {name:'1152-list',width:1152,stage:'05-erd',kept:{stages:'folded'}},
  {name:'1280-list',width:1280,stage:'02-prd',kept:{stages:'folded',talk:'shown'}},
  {name:'1280-talk',width:1280,stage:'05-erd',kept:{talk:'folded'}},
  {name:'1280-both',width:1280,stage:'02-prd',kept:{stages:'folded',talk:'folded'}},
  {name:'1440-both',width:1440,stage:'05-erd',kept:{stages:'folded',talk:'folded'}},
 ];
 for(const s of SETTINGS)for(const [theme,lang]of[['light','en'],['dark','ko'],['dark','en'],['light','ko']]){
  await test(`folded@${s.name}-${theme}-${lang}`,async()=>{
   await fresh(s.kept);const since=report.console.length;await setting({width:s.width,theme});await open(page(s.stage,lang));
   const v=await view();
   if(s.width>=1024)layoutIs(v,expected(s.width,s.kept),'SCR-111#folded');
   else assert(v.tabs.length===2&&v.tabs[1].mine===mine(lang)&&v.rail===null&&v.side===null,'The tabs, whatever is folded: '+JSON.stringify(v.tabs));
   if(s.width>=1024&&s.width<1440||s.kept.talk==='folded')talkButton(v,lang,s.stage==='02-prd'?'7':'4');
   const sideways=await evaluate(SIDEWAYS),outside=await evaluate(OUTSIDE),screenshot=await shot(`folded-${s.name}-${theme}-${lang}`);
   const hits=s.width<1024?await evaluate(HITS):null,errors=report.console.slice(since).filter(e=>e.level==='error'&&!(e.url&&new URL(e.url).pathname==='/favicon.ico'));
   assert(sideways.scrollWidth<=sideways.width&&sideways.bodyWidth<=sideways.width,'The page scrolls sideways: '+JSON.stringify(sideways));
   assert(!outside.length,'Elements outside the page: '+JSON.stringify(outside));
   assert(!errors.length,'Console errors: '+JSON.stringify(errors));
   assert(!hits||!hits.missed.some(m=>!m.inline),'Hit areas under 44 pixels (rule 14): '+JSON.stringify(hits&&hits.missed.filter(m=>!m.inline)));
   return{evidence:'fixture page and reads; page checks',checks:{sideways,outside:outside.length,hits:hits&&{probed:hits.probed,covered:hits.covered,alike:hits.alike,missed:hits.missed.length}},screenshot};
  });
 }

 // TC-1720 to TC-1722 at 1,152 and 1,280 pixels with each fold: an entry on an item, opened at its
 // address, selects the item, whose panel shows "Talk on REQ-002" with the entry open beside the
 // stage; a comment that the suite refuses with checkpoint_requested keeps its words under the
 // message; Close folds what the item showed, unless the talk is kept shown.
 const SIDES=[[1152,{stages:'folded'}],[1280,{}],[1280,{stages:'folded'}],[1280,{stages:'folded',talk:'shown'}]];
 for(const [lang,theme]of[['en','light'],['ko','dark']])for(const [width,kept]of SIDES){
  const folds=Object.entries(kept).map(([name,value])=>name+'-'+value).join('-')||'first-visit';
  await test(`sides-${width}-${folds}-${lang}-${theme}`,async()=>{
   await fresh(kept);await setting({width,theme});
   await open(page('02-prd',lang,`#talk=${qa.question}&item=REQ-002`));await itemReady('REQ-002');await entryOpen(qa.question,'.side .item');
   let v=await view();layoutIs(v,expected(width,{...kept,open:true}),'The item and its talk beside the stage');
   const seen=await evaluate(`({itk:document.getElementById('itk-h')?.textContent,label:document.querySelector('.side .item > .box .lab')?.textContent})`);
   assert(v.item==='REQ-002'&&seen.itk===label('Narrowed',0,lang,{id:'REQ-002'})&&seen.label===words('Comment on',lang,{id:'REQ-002'}),'"Talk on REQ-002" with the entry open, and its box: '+JSON.stringify({item:v.item,...seen}));
   const narrowedShot=await shot(`sides-narrowed-${width}-${folds}-${lang}-${theme}`);
   const text=lang==='ko'?'합성 의견: 요청으로 거절됨':'Synthetic comment refused as a request';
   await type('.side .item > .box textarea',text);
   responses.push({method:'POST',pattern:new RegExp('^/api/spaces/'+project+'/comments$'),...problem(409,'checkpoint_requested')});
   await click('.side .item [data-nx-act="leave"]');await settled();
   const note=await evaluate(`(()=>{const m=document.querySelector('.side .item > .box .bnote .msg'),t=e=>e?e.textContent.replace(/\\s+/g,' ').trim():null;return m&&{tone:m.classList[1],text:t(m.querySelector('.t')),trace:t(m.querySelector('.tid')),acts:[...m.querySelectorAll('button')].map(b=>b.dataset.nxAct),words:document.querySelector('.side .item > .box textarea').value};})()`);
   v=await view();
   assert(note?.tone==='err'&&note.text===codeMessage('checkpoint_requested',lang)&&note.trace&&note.acts.includes('leave')&&note.words===text&&v.overflow===0,'checkpoint_requested above the box, the words kept, with Try again: '+JSON.stringify(note));
   const errorShot=await shot(`sides-error-${width}-${folds}-${lang}-${theme}`);
   await evaluate(`(()=>{const t=document.querySelector('.side .item > .box textarea');t.value='';t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
   await click('.side .item [data-nx-act="item-close"]');await waitFor(`!document.querySelector('.side .item')?.checkVisibility()&&!/item=/.test(location.hash)`);await settled();
   v=await view();layoutIs(v,expected(width,kept),'Close folds what the item showed, as kept');
   // Folded, the focus on "Talk ({n})"; kept shown, the whole talk at the entry, the focus on it.
   assert(v.active===(kept.talk==='shown'?'talk:'+qa.question:'talk'),'The focus after Close: '+v.active);
   return{evidence:'fixture page and reads; one comment refused checkpoint_requested by the suite (mocked)',screenshots:[narrowedShot,errorShot]};
  });
 }

 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.blockedExternalOrigins.length,'The page asked another origin: '+report.blockedExternalOrigins.join());
 assert(!report.runtimeExceptions.length,'The page threw: '+JSON.stringify(report.runtimeExceptions));
 assert(report.posts.length===report.interceptions.filter(i=>i.method==='POST'&&i.action.startsWith('mocked')).length,'A write reached the fixture: '+JSON.stringify(report.posts));
 const expectedTests=2+1+2+1+1+2+1+2+2+1+1+SETTINGS.length*4+SIDES.length*2;
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
