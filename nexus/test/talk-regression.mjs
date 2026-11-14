/**
 * TASK-276: the talk in a stage's side (SCR-114) in a browser. Its eight states: its turns,
 * groups and entries at 1,440 pixels in both themes and languages, before and after the page's
 * code runs; an entry opened by its press and by the address's talk=, comment= and proposal=
 * (SPEC-154), selecting its item in the list, read on 200 at a time until its row is drawn, or
 * in the picture, and back with the browser's back button or All talk of the stage, at 390,
 * 1,152, 1,280 and 1,440 pixels (SPEC-209); the closed talk, an entry whose item is gone and a
 * comment that is not on the server; a page of the closed talk on its way when an item is
 * selected (BUG-620); an open entry whose project was removed, which the page reads once
 * (BUG-619); a stage and an item without talk; a reply, Mark answered,
 * As recommended, Accept, Dismiss and dismissing a reflection, each answer in its place
 * (choice 19) with the focus where the press was (rule 3), and since TASK-302 a checkpoint
 * request's Stage record, which opens the record and passes nothing itself; the box on the stage as
 * a whole and on the selected item; an entry that fails to open, a reply that fails and is tried
 * again with the same write ID, a reading again that fails, and checkpoint_requested (rules 4
 * to 6); refusals and a sign-in that expired, with the words kept (rule 7); a reply of the agent
 * after the entry opened, a comment closed and a proposal answered meanwhile in another tab, and
 * a reflection that changed (SCR-114#stale); words, "This settles it" and write IDs kept across
 * the page loaded again (rule 5); the panel from 1,024 to 1,279 pixels with Escape (rule 10);
 * and the Talk tab at 390 and 320 pixels with its hit areas (rule 14). From 1,024 pixels the
 * talk narrowed to an item is the item's panel's "Talk on {id}" (SCR-115, TASK-277), which the
 * suite reads as the narrowed talk. Node 24 built-ins only;
 * an owned headless Chrome over CDP. Requires NEXUS_QA_TALK=1, the opt-in view-server,
 * NEXUS_CHROME and NEXUS_QA_ORIGIN. Synthetic loopback fixture only. The page's reads and
 * writes reach the fixture server, except those that a test answers or fails itself, which
 * the report lists as mocked or failed; the suite's own "other tab" write goes to the fixture
 * through /api, as the page's do.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {label,labels,codeMessage} from '../src/draw/words.js';
import {stagePath} from '../src/draw/stages.js';
import {words} from '../ui/messages.js';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_TALK!=='1')throw Error('Use only the opt-in synthetic talk fixture');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,project='qa-talk',part='sample';
const page=(stage,lang,hash='')=>stagePath(project,part,stage)+'?lang='+lang+hash;
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'talk-');
const {folder,profile}=browser;
const report={schema:'nexus-talk-browser-regression/1',scope:'synthetic loopback fixture only',evidence:'page measurement and screenshots; reads and writes either reach the fixture server (real) or are answered or failed by the suite (mocked), as each test says',
 startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],blockedExternalOrigins:[],posts:[],reads:[],otherTab:[],runtimeExceptions:[]};
const softDeadline=Date.now()+165000;
let ws,session,seq=0,held=null,failing=[],responses=[],closing=false;
const pending=new Map(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const out=(name,value)=>fs.writeFile(path.join(folder,name),JSON.stringify(value,null,2));
class CheckFailure extends Error{}
function assert(ok,message){if(!ok)throw new CheckFailure(message);}
function command(method,params={},scoped=true,timeout=10000){
 if(!closing&&Date.now()>softDeadline)return Promise.reject(Error('165s work budget reached; preserving time for owned cleanup'));
 const id=++seq;
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},timeout);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params,...(scoped?{sessionId:session}:{})}));});
}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
// A wait that outlives a navigation of the page's own, such as an address that leads to another stage.
const NAVIGATED=/navigated or closed|Execution context was destroyed|Cannot find context/;
async function waitFor(expression,timeout=10000){const stop=Date.now()+timeout;while(Date.now()<stop){let ok=false;try{ok=await evaluate(expression);}catch(error){if(!NAVIGATED.test(String(error)))throw error;}if(ok)return;await sleep(25);}throw Error('Page wait timed out: '+expression);}
async function paint(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function setting({width,height=width<1024?844:900,theme='light',touch=false}){
 await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
 await command('Emulation.setTouchEmulationEnabled',touch?{enabled:true,maxTouchPoints:1}:{enabled:false});
}
// No reading runs in the talk or the stage, no entry is loading and nothing is being sent.
// The words of a button that is sent, which show over its own words kept unseen (BUG-606).
const SENDING=JSON.stringify([codeMessage('Sending','en'),codeMessage('Sending','ko')]);
async function settled(){await waitFor(`(document.querySelector('.side .tupd')?.textContent||'')===''&&(document.querySelector('.stage .upd')?.textContent||'')===''&&!document.querySelector('.side .sk')&&![...document.querySelectorAll('.side button')].some(b=>${SENDING}.includes((b.querySelector('.keep > :not(.was)')||b).textContent.trim()))`);await paint();}
// Navigation returns once the page is parsed; its held code may not have run yet.
async function open(route,{ready=true}={}){
 const url=origin+route;await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url});
 await waitFor(`location.href===${JSON.stringify(url)}&&document.readyState!=='loading'&&!!document.getElementById('view-data')`);
 if(ready){await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await settled();}
 await paint();
}
async function shot(name){const image=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(folder,name+'.png'),Buffer.from(image.data,'base64'));return name+'.png';}
async function test(name,fn){
 const startedAt=new Date().toISOString();
 try{const evidence=await fn();report.tests.push({name,verdict:'works',startedAt,finishedAt:new Date().toISOString(),...evidence});console.log('PASS '+name);}
 catch(error){let screenshot;try{screenshot=await shot(name+'-failure');}catch{}report.tests.push({name,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),error:String(error),screenshot});console.error('FAIL '+name+': '+error);}
 finally{held=null;failing=[];responses=[];}
 await out('results.json',report);
}
async function release(){const active=held;held=null;if(!active)return;for(const id of active.requests)await command('Fetch.continueRequest',{requestId:id});}
const problem=(status,code,extra={})=>({status,headers:[{name:'Content-Type',value:'application/problem+json'}],body:JSON.stringify({type:'about:blank',title:'Synthetic refusal',status,code,traceId:'tr_qa_'+code,...extra})});
// Access's answer to a sign-in that expired, as the page's reads and writes meet it.
const signedOut={status:401,headers:[{name:'Content-Type',value:'text/plain'}],body:'Synthetic sign-in'};
async function onPaused(event){
 const url=new URL(event.request.url),method=event.request.method,where=url.pathname+url.search,headers=Object.fromEntries(Object.entries(event.request.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(method==='POST')report.posts.push({path:url.pathname,write:headers['idempotency-key']||null,body:event.request.postData||null,at:new Date().toISOString()});
 if(method==='GET'&&url.pathname.startsWith('/api/'))report.reads.push(where);
 if(failing.some(pattern=>pattern.test(where))){report.interceptions.push({path:where,method,action:'failed',at:new Date().toISOString()});await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'ConnectionRefused'});return;}
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
// A write of another tab, to the fixture server through /api, as the page's go.
let otherSerial=0;
async function otherTab(pathname,body={}){
 const write='nw_'+(++otherSerial).toString(32).padStart(12,'0');
 const response=await fetch(origin+pathname,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Idempotency-Key':JSON.stringify(write)},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 report.otherTab.push({path:pathname,status:response.status});
 assert(response.ok,'The other tab\'s write failed: '+pathname+' '+response.status);return response.json();
}
// The mouse and the keyboard, as a person uses them.
async function clickAt(x,y){for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});}
async function click(selector){
 const at=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}));if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'No control to click: '+selector);await clickAt(at.x,at.y);await paint();
}
async function press(key){const code={Escape:27,Tab:9}[key];for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:code});await paint();}
async function type(selector,text){await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await command('Input.insertText',{text});await paint();}
// A write that the page sent, then its follow-up readings.
async function posted(before,pattern){const stop=Date.now()+10000;while(Date.now()<stop){const hit=report.posts.slice(before).find(p=>pattern.test(p.path));if(hit){await settled();return hit;}await sleep(25);}throw new CheckFailure('No write to '+pattern);}
// The message above the talk's box, where a comment that failed says why.
const boxNote=()=>evaluate(`(()=>{const m=document.querySelector('.side :is(.talk,.item) > .box .bnote .msg'),t=e=>e?e.textContent.replace(/\\s+/g,' ').trim():null;return m&&{tone:m.classList[1],text:t(m.querySelector('.t')),trace:t(m.querySelector('.tid')),acts:[...m.querySelectorAll('button')].map(b=>b.dataset.nxAct)};})()`);
// A box emptied as a person empties it, so that the browser keeps no words of a test.
async function clearBox(selector){await evaluate(`(()=>{const t=document.querySelector(${JSON.stringify(selector)});t.value='';t.dispatchEvent(new Event('input',{bubbles:true}));})()`);await paint();}
// An entry's press inside the talk's scrolled view, and a list's selected row inside the list's.
const inSight=id=>evaluate(`(()=>{const e=document.querySelector('li[data-nx-entry="${id}"] > .hd .ref'),b=document.querySelector('.side .talk > .body,.side .item > .ib2')?.getBoundingClientRect(),r=e?.getBoundingClientRect();return!!r&&!!b&&r.height>0&&r.top>=b.top-1&&r.bottom<=b.bottom+1;})()`);
const rowShown=id=>`(()=>{const r=document.querySelector('.stage .li[aria-current="true"]'),l=document.querySelector('.lw > .list');if(!r||!l||r.querySelector('.id')?.textContent.trim()!==${JSON.stringify(id)})return false;const a=r.getBoundingClientRect(),b=l.getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom+1;})()`;
// The talk reads again when the page comes back into view (SPEC-150), as after another tab.
const backInView=()=>evaluate(`document.dispatchEvent(new Event('visibilitychange'))`);

// What the talk shows: its head, turns, notes, groups and entries, and the box.
function talkState(){
 const q=s=>document.querySelector(s),all=(s,root=document)=>[...root.querySelectorAll(s)],txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():null;
 // A line's own words, without the mark of what the agent has not read, which nrd lists
 // (SPEC-189, TASK-298).
 const bare=e=>{if(!e)return null;const c=e.cloneNode(true);c.querySelectorAll('.nrd').forEach(n=>n.remove());return txt(c);};
 const entry=li=>({id:li.dataset.nxEntry,cls:li.className,chip:txt(li.querySelector(':scope > .hd .kind')),place:txt(li.querySelector(':scope > .hd .ref')),open:li.querySelector(':scope > .hd .ref')?.getAttribute('aria-expanded')==='true',
  acts:all(':scope > .acts > button',li).map(b=>({act:b.dataset.nxAct,text:txt(b)})),waits:all(':scope > .wt',li).map(bare),nrd:all(':scope > :is(.wt,.rst) .nrd',li).map(txt),after:txt(li.querySelector(':scope > .after')),record:!!li.querySelector(':scope > .after [data-nx-act="record"]'),
  reps:txt(li.querySelector(':scope > .reps')),change:txt(li.querySelector(':scope > .chg')),rst:bare(li.querySelector(':scope > .rst')),msgs:all(':scope .msg',li).map(m=>({tone:m.classList[1],text:txt(m.querySelector('.t')),act:m.querySelector('button')?.dataset.nxAct||null})),
  box:!!li.querySelector(':scope > .rbox'),reply:li.querySelector(':scope > .rbox textarea')?.value??null,
  look:(a=>a&&{label:txt(li.querySelector(':scope > .look > .mu')),href:a.getAttribute('href'),text:txt(a),act:a.dataset.nxAct||null,item:a.dataset.nxItem||null,target:a.getAttribute('target'),rel:a.getAttribute('rel')})(li.querySelector(':scope > .look a'))});
 const active=document.activeElement,side=q('.side'),sideBox=side?.getBoundingClientRect();
 return{hash:location.hash,path:location.pathname,tab:q('.ws')?.dataset.nxTab||null,open:q('.ws')?.dataset.nxOpen||null,redrawn:document.documentElement.dataset.nxRedrawn||null,
  side:side&&side.checkVisibility()?[sideBox.left,sideBox.width].map(Math.round):null,talk:!!q('.side .talk'),item:!!q('.side .item'),record:!!q('.side .rec'),
  heading:txt(q('#talk-h')||q('#itk-h')),whole:!!q('.side [data-nx-act="whole"]'),turns:all('.talk .turns > *').map(e=>({text:txt(e),link:e.tagName==='A'})),
  groups:all('.side .body > .tg').map(txt),closed:q('.side [data-nx-act="closed"]')?.getAttribute('aria-expanded')??null,
  lists:Object.fromEntries(['mine','agent','apart','closed'].map(key=>[key,all('.side ol[data-nx-key="l-'+key+'"] > li').map(entry)])),
  notes:all('.side .tnotes .msg').map(m=>({tone:m.classList[1],text:txt(m.querySelector('.t')),trace:txt(m.querySelector('.tid')),act:m.querySelector('button')?.dataset.nxAct||null})),
  label:txt(q('.side :is(.talk,.item) > .box .lab')),text:q('#talk-text')?.value??null,leave:q('.side [data-nx-act="leave"]')?.getAttribute('aria-disabled')??null,
  waits:all('[data-nx-wait="talk"]').length,disabled:all('.side :is(.talk,.item) button:disabled, .side :is(.talk,.item) textarea:disabled').length,selected:txt(q('.stage .li[aria-current="true"] .id')),
  active:active?.dataset?.nxFocus||active?.id||active?.tagName||null,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
}
const state=()=>evaluate(`(${talkState})()`);
const one=(list,id)=>list.find(e=>e.id===id);
// An entry in whichever turn or group holds it now.
const anywhere=(s,id)=>['mine','agent','apart','closed'].map(key=>one(s.lists[key],id)).find(Boolean);

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json(),qa=fixture.talk;
 assert(qa?.project===project&&qa.part===part&&['answered','decided','question','recommended','checkpoint','claimed','settled','open','apart'].every(key=>/^nc_/.test(qa[key]||''))&&['accept','dismiss','stale'].every(key=>/^np_/.test(qa[key]||''))&&/^ne_/.test(qa.edit||''),'The origin is not the opt-in synthetic talk fixture');
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),entries=JSON.parse(metadataBytes).entries;
 assert(/^\/code\/page\.[a-f0-9]{8}\.js$/.test(entries['page-js']||''),'Content-hashed page code is required');
 report.preflight={fixture:qa,build:{entries:{'page-js':entries['page-js']},sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
 const browserEnv={...process.env};for(const key of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(key))delete browserEnv[key];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],browserEnv);
 const endpoint=await browser.endpoint();
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);}else if(m.sessionId===session){if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error)+' ('+m.params.request.method+' '+new URL(m.params.request.url).pathname+')';});if(m.method==='Runtime.exceptionThrown')report.runtimeExceptions.push({at:new Date().toISOString(),text:m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text});}};
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await command('Emulation.setTimezoneOverride',{timezoneId:'UTC'});

 // #loading, then #normal: the server's talk, its controls waiting while the page's code is
 // held; then the code's, which draws nothing again; the turns' counts, which lead to their
 // groups; each kind of entry with its answers; the agent's turn with its taken, settled and
 // waiting entries; the entry apart; and the closed talk, folded (TC-1796).
 for(const [lang,theme]of[['en','light'],['ko','dark']]){
  await test(`loading-and-normal-1440-${lang}-${theme}`,async()=>{
   await setting({width:1440,theme});
   held={pattern:/^\/code\/page\./,requests:[]};await open(page('02-prd',lang),{ready:false});
   const before=await state(),lookFirst=JSON.stringify({label:labels('A checkpoint request, whole',lang)[0],href:'#item=REQ-001',text:'REQ-001',act:'look',item:'REQ-001',target:null,rel:null});
   assert(before.talk&&before.waits>=14&&before.waits===before.disabled&&before.lists.mine.length===3,'#loading: the server\'s talk, its controls waiting: '+JSON.stringify({waits:before.waits,disabled:before.disabled,mine:before.lists.mine.length}));
   // The thing to look at first is in the page as the server draws it (SCR-114's revision, TASK-300).
   assert(JSON.stringify(one(before.lists.mine,qa.checkpoint)?.look)===lookFirst,'#loading: the request\'s Look at first as the server drew it: '+JSON.stringify(one(before.lists.mine,qa.checkpoint)?.look));
   const loadingShot=await shot(`loading-1440-${lang}-${theme}`);
   await release();await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await settled();
   const s=await state(),kinds=labels("An entry's kind",lang),answers=labels('Answers',lang),turns=labels('The talk',lang);
   assert(s.redrawn==='0'&&s.waits===0&&s.disabled===0,'The code draws nothing again and no control waits: '+JSON.stringify({redrawn:s.redrawn,waits:s.waits,disabled:s.disabled}));
   assert(s.heading===turns[0]&&JSON.stringify(s.turns)===JSON.stringify([{text:label('The talk',1,lang,{n:'3'}),link:true},{text:label('The talk',2,lang,{n:'3'}),link:true}]),'The head and the turns\' counts: '+JSON.stringify({heading:s.heading,turns:s.turns}));
   assert(JSON.stringify(s.groups)===JSON.stringify([label('My turn',0,lang,{n:'3'}),label('The talk',3,lang,{n:'3'}),label('The talk',4,lang,{n:'1'}),label('The talk',5,lang,{n:'2'})])&&s.closed==='false','The groups in order, the closed talk folded: '+JSON.stringify(s.groups));
   const [checkpoint,question,recommended]=s.lists.mine,whole=label("An entry's place",0,lang);
   // The talk passes no checkpoint: a request's entry offers the stage record, first (TASK-302).
   assert(checkpoint.id===qa.checkpoint&&checkpoint.chip===kinds[3]&&checkpoint.place===whole&&JSON.stringify(checkpoint.acts.map(a=>[a.act,a.text]))===JSON.stringify([['record',labels('The head',lang)[4]],['reply-open',answers[3]]]),'A checkpoint request first, with Stage record and Reply: '+JSON.stringify(checkpoint));
   assert(JSON.stringify(checkpoint.look)===lookFirst&&!question.look&&!recommended.look,'Look at first, a link to the item\'s place, on the request alone: '+JSON.stringify({checkpoint:checkpoint.look,question:question.look,recommended:recommended.look}));
   assert(question.id===qa.question&&question.chip===kinds[1]&&question.place==='REQ-002'&&question.reps.includes('Synthetic detail: the provider allows two retries.')&&JSON.stringify(question.acts.map(a=>a.act))==='["reply-open"]','A question with its last reply and Reply: '+JSON.stringify(question));
   assert(recommended.id===qa.recommended&&recommended.chip===kinds[2]&&JSON.stringify(recommended.acts.map(a=>[a.act,a.text]))===JSON.stringify([['recommended',answers[2]],['reply-open',answers[3]]]),'A recommendation with As recommended and Reply: '+JSON.stringify(recommended));
   const [claimed,settledOne,waiting]=s.lists.agent,taken=label('Waiting',1,lang,{time:'\u0000'}).split('\u0000'),since=label('Waiting',0,lang,{time:'\u0000'}).split('\u0000');
   assert(claimed.id===qa.claimed&&claimed.waits.length===1&&claimed.waits[0].startsWith(taken[0])&&claimed.waits[0].endsWith(taken[1])&&!claimed.acts.length,'Taken by the agent, with its time and no answers: '+JSON.stringify(claimed));
   assert(settledOne.id===qa.settled&&settledOne.waits[0].startsWith(since[0])&&settledOne.waits[1]===label("The talk's entries",1,lang),'Waiting since, and settled: '+JSON.stringify(settledOne));
   assert(waiting.id===qa.open&&waiting.waits.length===1&&s.lists.apart.length===1&&s.lists.apart[0].id===qa.apart&&/\bapart\b/.test(s.lists.apart[0].cls),'Waiting, and the entry apart: '+JSON.stringify({waiting,apart:s.lists.apart}));
   assert(s.label===labels('The box',lang)[0]&&s.leave==='true'&&s.overflow===0,'The box on the stage as a whole, Leave unavailable while it is empty: '+JSON.stringify({label:s.label,leave:s.leave,overflow:s.overflow}));
   const normalShot=await shot(`normal-1440-${lang}-${theme}`);
   // A turn's count leads to its group.
   await click('.talk .turns a[data-nx-turn="agent"]');
   // (+0: CDP gives -0 back as no value.)
   const top=await evaluate(`Math.round(document.getElementById('t-agent').getBoundingClientRect().top-document.querySelector('.talk > .body').getBoundingClientRect().top)+0`);
   assert(Math.abs(top)<=2,'The agent\'s turn count leads to its group: '+top);
   return{evidence:'fixture page; the page\'s code held, then released (held)',screenshots:[loadingShot,normalShot]};
  });
 }

 // Addresses: talk= of a closed comment unfolds the closed talk with it open and its decision's
 // link; 0.2's comment= opens the entry; talk= of a comment not on the server says so above
 // the talk; an entry apart opens without an item and says that its item is gone; proposal= of
 // another stage's entry opens that stage's talk (SPEC-154, SCR-114#gone, TC-1797).
 await test('addresses-closed-and-gone-1440-en',async()=>{
  await setting({width:1440});
  await open(page('02-prd','en','#talk='+qa.decided));
  // The entry's thread reads after the item's panel and the talk narrowed to it.
  await waitFor(`!!document.getElementById('th-${qa.decided}')`);await settled();
  let s=await state();
  const [decided,answered]=s.lists.closed;
  assert(s.closed==='true'&&decided?.id===qa.decided&&decided.open&&decided.chip===label("The talk's entries",3,'en')&&answered?.id===qa.answered&&answered.chip===label("The talk's entries",2,'en'),'The closed talk unfolds, newest first, with the entry open: '+JSON.stringify(s.lists.closed));
  const link=await evaluate(`document.querySelector('li[data-nx-entry="${qa.decided}"] .dec .lnk')?.getAttribute('href')`);
  assert(link==='https://example.com/qa/decision'&&decided.reps.includes('Synthetic decision'),'A decision with its link: '+JSON.stringify({link,reps:decided.reps}));
  await open(page('02-prd','en','#comment='+qa.question));
  s=await state();
  assert(one(s.lists.mine,qa.question)?.open&&one(s.lists.mine,qa.question).box,'0.2\'s comment= opens the entry: '+JSON.stringify(one(s.lists.mine,qa.question)));
  await open(page('02-prd','en','#talk=nc_000000000000'));
  s=await state();
  assert(s.notes.length===1&&s.notes[0].tone==='warn'&&s.notes[0].text===codeMessage('comment_not_found','en')&&s.lists.mine.length===3,'A comment not on the server, above the stage\'s talk: '+JSON.stringify(s.notes));
  await open(page('02-prd','en','#talk='+qa.apart));
  s=await state();
  const apart=one(s.lists.apart,qa.apart);
  assert(apart?.open&&apart.msgs.some(m=>m.text===label('An item that the talk selects',0,'en',{id:'REQ-999'}))&&!/item=/.test(s.hash)&&s.heading===labels('The talk','en')[0],'An entry apart opens on the stage\'s talk and says its item is gone: '+JSON.stringify({apart,hash:s.hash}));
  const goneShot=await shot('apart-1440-en');
  // The page leads to the proposal's stage at once, so that the suite waits for that page only.
  await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url:origin+page('02-prd','en','#proposal='+qa.accept)});
  await waitFor(`location.pathname.endsWith('/05-erd')&&document.documentElement.dataset.nxCode==='ready'`);await settled();
  s=await state();
  assert(s.hash==='#talk='+qa.accept&&one(s.lists.mine,qa.accept)?.open&&one(s.lists.mine,qa.accept).change.includes('CREATE UNIQUE INDEX orders_reference ON orders(reference);'),'Another stage\'s proposal opens in that stage\'s talk, with its change: '+JSON.stringify({path:s.path,hash:s.hash}));
  return{evidence:'fixture pages and reads',screenshot:goneShot};
 });

 // A page of the closed talk on its way when an item is selected (BUG-620): the stage's closed
 // talk, unfolded, is held (a delay that the suite makes) while REQ-001 is selected in the list,
 // then let go. The item's closed talk keeps its own count, and unfolded, it reads and lists the
 // item's own closed entry, not the stage's.
 await test('closed-talk-on-its-way-across-items-1440-en',async()=>{
  await setting({width:1440});
  await open(page('02-prd','en'));
  held={pattern:new RegExp('^/api/spaces/'+project+'/talk/'+part+'/02-prd\\?closed=1$'),requests:[]};
  await click('.side [data-nx-act="closed"]');
  for(const stop=Date.now()+10000;!held.requests.length&&Date.now()<stop;)await sleep(25);
  assert(held.requests.length===1,'The stage\'s closed talk is read, and held');
  await click('.stage .li[data-nx-item="REQ-001"]');
  await waitFor(`(${talkState})().heading===${JSON.stringify(label('Narrowed',0,'en',{id:'REQ-001'}))}`);await settled();
  await release();await sleep(500);await settled();
  let s=await state();
  const folded={closed:s.closed,groups:s.groups};
  assert(s.closed==='false'&&s.groups.includes(label('The talk',5,'en',{n:'1'})),'The item\'s closed talk, folded, with its own count: '+JSON.stringify(folded));
  const mark=report.reads.length;
  await click('.side [data-nx-act="closed"]');await settled();
  s=await state();
  const read=report.reads.slice(mark).filter(r=>/[?&]item=REQ-001(?:&|$)/.test(r)&&/[?&]closed=1(?:&|$)/.test(r)),shown=s.lists.closed.map(e=>e.id);
  assert(read.length===1&&s.closed==='true'&&JSON.stringify(shown)===JSON.stringify([qa.answered]),'Unfolded, the item\'s own closed talk is read and listed: '+JSON.stringify({read,closed:s.closed,shown}));
  return{evidence:'fixture page and reads; the stage\'s closed talk held by the suite (a delay that it makes)',seen:{folded,read,shown},screenshot:await shot('closed-across-items-1440-en')};
 });

 // An open entry whose project another tab removed (BUG-619): back in view, the talk and the
 // entry read again and the server answers space_not_found (mocked, each time the page asks).
 // The entry says so in its place, and the page asks for it once and for the talk twice, then
 // no more; a press that opens it again asks once more, and again no more.
 await test('an-entry-whose-project-was-removed-1440-en',async()=>{
  await setting({width:1440});
  await open(page('02-prd','en'));
  const ref=`li[data-nx-entry="${qa.recommended}"] > .hd .ref`,expanded=on=>waitFor(`document.querySelector(${JSON.stringify(ref)})?.getAttribute('aria-expanded')==='${on}'`);
  await click(ref);await expanded(true);await settled();
  const talkRead=new RegExp('^/api/spaces/'+project+'/talk/'+part+'/02-prd(?:\\?|$)'),threadRead=new RegExp('^/api/spaces/'+project+'/comments/'+qa.recommended+'$');
  for(let n=0;n<40;n++)responses.push({method:'GET',pattern:talkRead,...problem(404,'space_not_found')},{method:'GET',pattern:threadRead,...problem(404,'space_not_found')});
  const asked=since=>{const reads=report.reads.slice(since);return{talk:reads.filter(r=>talkRead.test(r)).length,thread:reads.filter(r=>threadRead.test(r)).length};};
  let mark=report.reads.length;
  await backInView();await sleep(2000);
  const back=asked(mark);
  assert(back.thread===1&&back.talk===2,'Back in view, the page asks for the entry once and for the talk twice, then no more: '+JSON.stringify(back));
  await settled();
  const s=await state(),entry=anywhere(s,qa.recommended);
  assert(entry?.open&&entry.msgs.some(m=>m.tone==='warn'&&m.text===codeMessage('space_not_found','en')),'The entry says so in its place: '+JSON.stringify(entry?.msgs));
  const goneShot=await shot('removed-1440-en');
  mark=report.reads.length;
  await click(ref);await expanded(false);await click(ref);await expanded(true);await sleep(1000);
  const pressed=asked(mark);
  assert(pressed.thread===1&&pressed.talk===1,'A press that opens it again asks once more, then no more: '+JSON.stringify(pressed));
  return{evidence:'fixture page; the talk\'s and the entry\'s readings answered space_not_found by the suite (mocked)',seen:{back,pressed,notes:s.notes},screenshot:goneShot};
 });

 // From 1,024 to 1,279 pixels the talk is a panel: Talk ({n}) opens it with the focus on its
 // heading, Close folds it with the focus back; an address opens it with its entry; Escape folds
 // the entry, then the panel (rule 10, SPEC-210, TC-1798).
 await test('panel-1152-en',async()=>{
  await setting({width:1152,height:800});
  await open(page('02-prd','en'));
  let s=await state();
  assert(!s.side&&s.tab==='stage','The panel waits: '+JSON.stringify({side:s.side,tab:s.tab}));
  await click('.stage [data-nx-act="talk"]');await settled();
  s=await state();
  assert(s.open==='talk'&&s.side&&s.side[1]===400&&s.active==='talk-h','Talk opens the panel, the focus on its heading: '+JSON.stringify({open:s.open,side:s.side,active:s.active}));
  const panelShot=await shot('panel-1152-en');
  await click('.talk [data-nx-act="talk-close"]');
  s=await state();
  assert(!s.side&&!s.open&&s.active==='talk','Close folds it, the focus back on Talk: '+JSON.stringify({side:s.side,open:s.open,active:s.active}));
  await open(page('02-prd','en','#talk='+qa.question));
  s=await state();
  assert(s.open==='talk'&&s.side&&one(s.lists.mine,qa.question)?.open,'An address opens the panel with its entry: '+JSON.stringify({open:s.open,side:s.side}));
  await press('Escape');await settled();
  s=await state();
  assert(s.open==='talk'&&!one(s.lists.mine,qa.question)?.open&&s.hash===''&&s.active==='talk:'+qa.question,'Escape folds the entry first, the focus on its press: '+JSON.stringify({open:s.open,hash:s.hash,active:s.active}));
  await press('Escape');
  s=await state();
  assert(!s.side&&!s.open&&s.active==='talk','Escape again folds the panel: '+JSON.stringify({side:s.side,open:s.open,active:s.active}));
  return{evidence:'fixture page and reads',screenshot:panelShot};
 });

 // Under 1,024 pixels the talk is a tab: its answers 44 pixels high, each entry's press with a
 // 44-pixel band, the box's Leave beside its words; Reply opens the entry with the focus in its
 // box; nothing wider than the page (rules 14 and 16, TC-1799).
 for(const [width,lang]of[[390,'ko'],[320,'en']]){
  await test(`talk-tab-${width}-${lang}`,async()=>{
   await setting({width,touch:true});
   await open(page('02-prd',lang));
   await click('.tabs .tab[data-nx-tab="talk"]');
   let s=await state();
   assert(s.tab==='talk'&&s.side&&s.side[0]===0&&s.side[1]===width&&s.overflow===0,'The Talk tab, the page\'s width: '+JSON.stringify({tab:s.tab,side:s.side,overflow:s.overflow}));
   // Each entry's press keeps the width of what it names, its author and time on a line of
   // their own where the line cannot hold all three, and a band of 44 pixels in the talk's view.
   const sizes=await evaluate(`(()=>{const all=s=>[...document.querySelectorAll(s)].filter(e=>e.checkVisibility());const h=e=>Math.round(e.getBoundingClientRect().height),body=document.querySelector('.talk > .body').getBoundingClientRect();
    const band=b=>{const r=b.getBoundingClientRect(),x=r.left+Math.min(r.width/2,20),hit=y=>document.elementFromPoint(x,y)?.closest('.ref')===b;return r.top-22>body.top&&r.bottom+22<body.bottom?hit(r.top+r.height/2-21)&&hit(r.top+r.height/2+21):null;};
    return{acts:all('.talk .te > .acts > .btn').map(h),refs:all('.talk .te > .hd .ref').map(e=>Math.round(e.getBoundingClientRect().width)),bands:all('.talk .te > .hd .ref').map(band).filter(v=>v!==null),leave:h(document.querySelector('.side [data-nx-act="leave"]')),fold:h(document.querySelector('.talk .tg.fold'))};})()`);
   assert(sizes.acts.length>=5&&sizes.acts.every(n=>n>=44)&&sizes.refs.every(n=>n>=44)&&sizes.leave>=44&&sizes.fold>=44&&sizes.bands.length>=2&&sizes.bands.every(Boolean),'Hit areas of 44 pixels: '+JSON.stringify(sizes));
   const tabShot=await shot(`talk-tab-${width}-${lang}`);
   await click(`li[data-nx-entry="${qa.question}"] [data-nx-act="reply-open"]`);await settled();
   s=await state();
   const shown=await evaluate(`(()=>{const r=document.getElementById('rp-${qa.question}').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})()`);
   assert(s.hash===`#talk=${qa.question}&item=REQ-002`&&s.active===qa.question+':text'&&shown&&!one(s.lists.mine,qa.question).acts.length&&s.overflow===0,'Reply opens the entry with the focus in its box, in sight: '+JSON.stringify({hash:s.hash,active:s.active,shown,acts:one(s.lists.mine,qa.question)?.acts}));
   return{evidence:'fixture page and reads; touch emulated',screenshots:[tabShot,await shot(`reply-${width}-${lang}`)]};
  });
 }

 // An entry that cannot load says so with Try again; a reply that fails keeps its words and
 // tries again with the same write ID; a reading again that fails says so above the talk with
 // Try again (rules 4 to 6, SCR-114#error, TC-1800).
 await test('errors-and-one-write-id-1440-en',async()=>{
  await setting({width:1440});
  await open(page('02-prd','en'));
  responses.push({method:'GET',pattern:new RegExp('^/api/spaces/'+project+'/comments/'+qa.settled+'$'),...problem(500,'internal')});
  await click(`li[data-nx-entry="${qa.settled}"] .ref`);await settled();
  let s=await state(),entry=one(s.lists.agent,qa.settled);
  assert(entry.open&&entry.msgs.some(m=>m.tone==='err'&&m.text===words('Could not load','en').split(' Or: ')[0]&&m.act==='reload-entry'),'Could not load this comment, with Try again: '+JSON.stringify(entry));
  await click(`li[data-nx-entry="${qa.settled}"] [data-nx-act="reload-entry"]`);await settled();
  entry=one((await state()).lists.agent,qa.settled);
  assert(entry.reps.includes('Synthetic: that settles it.')&&entry.reps.includes(words('Settles it','en')),'Try again loads the replies, the one that settles it marked: '+JSON.stringify(entry.reps));
  failing=[/\/comments\/[^/]+\/replies$/];
  await type('#rp-'+qa.settled,'Synthetic reply that fails once');
  const before=report.posts.length;
  await click(`li[data-nx-entry="${qa.settled}"] [data-nx-act="reply"]`);await settled();
  entry=one((await state()).lists.agent,qa.settled);
  const first=report.posts.slice(before).find(p=>p.path.endsWith('/replies'));
  assert(first&&entry.msgs.some(m=>m.tone==='err'&&m.text===codeMessage('No connection','en')&&m.act==='reply')&&entry.reply==='Synthetic reply that fails once','The reply fails, its words kept, with Try again: '+JSON.stringify({first,entry}));
  failing=[];
  responses.push({method:'GET',pattern:new RegExp('^/api/spaces/'+project+'/talk/'+part+'/02-prd$'),...problem(500,'internal')});
  const retry=report.posts.length;
  await click(`li[data-nx-entry="${qa.settled}"] .msg [data-nx-act="reply"]`);
  const second=await posted(retry,/\/replies$/);
  s=await state();entry=one(s.lists.agent,qa.settled);
  assert(second.write===first.write&&entry.reps.includes('Synthetic reply that fails once')&&entry.reply==='','Try again sends the same write ID once more: '+JSON.stringify({first:first.write,second:second.write}));
  assert(s.notes.some(n=>n.tone==='err'&&n.text===codeMessage('Could not update','en')&&n.act==='read-talk'),'The reading after it fails, above the talk: '+JSON.stringify(s.notes));
  const errorShot=await shot('error-1440-en');
  await click('.side .tnotes [data-nx-act="read-talk"]');await settled();
  s=await state();
  assert(!s.notes.length,'Try again reads the talk: '+JSON.stringify(s.notes));
  return{evidence:'fixture page and writes; one reading of the comment and of the talk answered 500 and one reply failed by the suite (mocked)',screenshot:errorShot};
 });

 // #permission: a comment refused keeps its words under the code's message, without Try again;
 // a reading again refused says so above the talk with its trace ID; a sign-in that expired
 // says "Sign in again", and the browser keeps the words, so that the page loaded again holds
 // them (rule 7, TC-1801).
 await test('permission-and-sign-in-1440-ko-dark',async()=>{
  await setting({width:1440,theme:'dark'});
  await open(page('02-prd','ko'));
  const text='합성 의견: 권한이 없는 쓰기';
  await type('#talk-text',text);
  responses.push({method:'POST',pattern:new RegExp('^/api/spaces/'+project+'/comments$'),...problem(403,'no_kind')});
  await click('.side [data-nx-act="leave"]');await settled();
  let note=await boxNote(),s=await state();
  assert(note?.tone==='warn'&&note.text===codeMessage('no_kind','ko')&&note.trace===codeMessage('Trace ID','ko',{traceId:'tr_qa_no_kind'})&&!note.acts.length&&s.text===text,'no_kind above the box, the words kept, without Try again: '+JSON.stringify({note,text:s.text}));
  responses.push({method:'GET',pattern:new RegExp('^/api/spaces/'+project+'/talk/'+part+'/02-prd$'),...problem(403,'access_missing')});
  await backInView();await settled();
  s=await state();
  assert(s.notes.some(n=>n.tone==='warn'&&n.text===codeMessage('access_missing','ko')&&n.trace===codeMessage('Trace ID','ko',{traceId:'tr_qa_access_missing'})),'A reading again refused, above the talk with its trace ID: '+JSON.stringify(s.notes));
  responses.push({method:'POST',pattern:new RegExp('^/api/spaces/'+project+'/comments$'),...signedOut});
  await click('.side [data-nx-act="leave"]');await settled();
  note=await boxNote();s=await state();
  assert(note?.tone==='warn'&&note.text===codeMessage('Sign-in expired','ko')&&note.acts.join()==='sign-in'&&s.text===text,'A sign-in that expired: Sign in again, the words kept: '+JSON.stringify({note,text:s.text}));
  const refusedShot=await shot('permission-1440-ko-dark');
  await open(page('02-prd','ko'));
  s=await state();
  assert(s.text===text,'The page loaded again holds the words: '+JSON.stringify(s.text));
  await clearBox('#talk-text');
  return{evidence:'fixture page; a comment refused no_kind, a reading refused access_missing and a comment answered 401 by the suite (mocked)',screenshot:refusedShot};
 });

 // #empty: a stage without talk, and an item without comments with the box on it (TC-1802).
 await test('empty-1440-en-ko',async()=>{
  const empty=()=>evaluate(`document.querySelector('.side .empty-t p')?.textContent.trim()??null`);
  await setting({width:1440});
  await open(page('01-domain','en'));
  let s=await state(),said=await empty();
  assert(said===label('No talk',0,'en')&&!s.lists.mine.length&&!s.lists.agent.length&&s.closed===null&&s.label===labels('The box','en')[0]&&JSON.stringify(s.turns.map(t=>t.text))===JSON.stringify([label('The talk',1,'en',{n:'0'}),label('The talk',2,'en',{n:'0'})]),'No talk on the stage yet: '+JSON.stringify({said,label:s.label,turns:s.turns}));
  const stageShot=await shot('empty-1440-en');
  await setting({width:1440,theme:'dark'});
  await open(page('02-prd','ko','#item=REQ-100'));
  await waitFor(rowShown('REQ-100'));await settled();
  s=await state();said=await empty();
  assert(said===label('No talk',1,'ko',{id:'REQ-100'})&&s.heading===label('Narrowed',0,'ko',{id:'REQ-100'})&&s.label===words('Comment on','ko',{id:'REQ-100'})&&s.whole&&s.selected==='REQ-100','No comments on the item yet, the box on it: '+JSON.stringify({said,heading:s.heading,label:s.label,selected:s.selected}));
  return{evidence:'fixture pages',screenshots:[stageShot,await shot('empty-item-1440-ko-dark')]};
 });

 // The revision's #narrowed and #error at 390, 1,152, 1,280 and 1,440 pixels, in English with
 // the light theme and in Korean with the dark one: an entry picked in the stage's whole talk
 // selects its item, and the talk narrows to it with the entry open and in sight; the browser's
 // back button returns to the whole talk at the entry with the focus on it, and so does All
 // talk of the stage; checkpoint_requested, if it ever came to the box, keeps the words under
 // its message (SPEC-209, TC-1720, TC-1721; the folds suite runs them with each fold, TASK-287).
 for(const width of[390,1152,1280,1440])for(const [lang,theme]of[['en','light'],['ko','dark']]){
  await test(`narrowed-and-error-${width}-${lang}-${theme}`,async()=>{
   await setting({width,theme,touch:width<1024});
   await open(page('02-prd',lang));
   // From 1,024 to 1,439 pixels Talk ({n}) shows the talk: the panel, and from 1,280 a first
   // visit's folded column, which the browser then keeps shown (SPEC-210).
   if(width<1024)await click('.tabs .tab[data-nx-tab="talk"]');
   else if(width<1440&&!await evaluate(`document.querySelector('aside.side').checkVisibility()`)){await click('.stage [data-nx-act="talk"]');await settled();}
   await click(`li[data-nx-entry="${qa.question}"] .ref`);await waitFor(rowShown('REQ-002')+'||'+(width<1024));await settled();
   let s=await state();
   assert(s.hash===`#talk=${qa.question}&item=REQ-002`&&s.heading===label('Narrowed',0,lang,{id:'REQ-002'})&&s.whole&&s.selected==='REQ-002'&&one(s.lists.mine,qa.question)?.open&&await inSight(qa.question)&&s.label===words('Comment on',lang,{id:'REQ-002'})&&s.side&&s.overflow===0,'Narrowed from the entry, its item selected: '+JSON.stringify({hash:s.hash,heading:s.heading,selected:s.selected,label:s.label,side:s.side,overflow:s.overflow}));
   const narrowedShot=await shot(`narrowed-${width}-${lang}-${theme}`);
   await evaluate('history.back()');
   await waitFor(`location.hash===''&&document.getElementById('talk-h')?.textContent===${JSON.stringify(labels('The talk',lang)[0])}`);await settled();
   s=await state();
   assert(!s.selected&&!one(s.lists.mine,qa.question)?.open&&await inSight(qa.question)&&s.active==='talk:'+qa.question&&s.side,'The back button: the whole talk at the entry, the focus on it: '+JSON.stringify({selected:s.selected,active:s.active,side:s.side}));
   await click(`li[data-nx-entry="${qa.question}"] .ref`);await settled();
   await click('.side [data-nx-act="whole"]');
   await waitFor(`location.hash===''`);await settled();
   s=await state();
   assert(!s.selected&&s.heading===labels('The talk',lang)[0]&&await inSight(qa.question)&&s.active==='talk:'+qa.question,'All talk of the stage: the same: '+JSON.stringify({heading:s.heading,active:s.active}));
   const text=lang==='ko'?'합성 의견: 요청으로 거절됨':'Synthetic comment refused as a request';
   await type('#talk-text',text);
   responses.push({method:'POST',pattern:new RegExp('^/api/spaces/'+project+'/comments$'),...problem(409,'checkpoint_requested')});
   await click('.side [data-nx-act="leave"]');await settled();
   const note=await boxNote();s=await state();
   assert(note?.tone==='err'&&note.text===codeMessage('checkpoint_requested',lang)&&note.acts.includes('leave')&&s.text===text&&s.overflow===0,'checkpoint_requested above the box, the words kept, with Try again: '+JSON.stringify({note,text:s.text,overflow:s.overflow}));
   const errorShot=await shot(`error-${width}-${lang}-${theme}`);
   await clearBox('#talk-text');
   return{evidence:'fixture page and reads; one comment refused checkpoint_requested by the suite (mocked)',screenshots:[narrowedShot,errorShot]};
  });
 }

 // A reply, then Mark answered: the entry selects its item, its reply shows, the focus stays on
 // Reply, and once answered it folds into the closed talk with the focus on the talk's heading;
 // All talk of the stage. The box leaves a comment on the stage as a whole, and on the selected
 // item (SPEC-127, SPEC-209, API-118 to API-120, TC-1803).
 await test('reply-mark-answered-and-box-1440-en',async()=>{
  await setting({width:1440});
  await open(page('02-prd','en'));
  const mark=report.reads.length;
  await click(`li[data-nx-entry="${qa.open}"] .ref`);await waitFor(rowShown('REQ-240'));await settled();
  let s=await state(),entry=one(s.lists.agent,qa.open);
  const listReads=report.reads.slice(mark).filter(p=>p.startsWith(`/api/spaces/${project}/stages/${part}/02-prd`));
  assert(s.hash===`#talk=${qa.open}&item=REQ-240`&&s.heading===label('Narrowed',0,'en',{id:'REQ-240'})&&s.whole&&s.selected==='REQ-240'&&entry.open&&entry.reps===words('No replies','en')&&s.label===words('Comment on','en',{id:'REQ-240'})&&listReads.some(p=>/[?&]after=200(?:&|$)/.test(p)),'The entry opens on its item, past the first 200, its row read on to, selected and in sight: '+JSON.stringify({hash:s.hash,heading:s.heading,selected:s.selected,entry,label:s.label,listReads}));
  const pickedShot=await shot('picked-1440-en');
  // The browser's back button: the stage's whole talk at the entry, nothing selected.
  await evaluate('history.back()');
  await waitFor(`location.hash===''&&document.getElementById('talk-h')?.textContent===${JSON.stringify(labels('The talk','en')[0])}`);await settled();
  s=await state();
  assert(!s.selected&&!one(s.lists.agent,qa.open)?.open&&await inSight(qa.open)&&s.active==='talk:'+qa.open,'The back button: the whole talk at the entry, the focus on it: '+JSON.stringify({selected:s.selected,active:s.active}));
  await click(`li[data-nx-entry="${qa.open}"] .ref`);await waitFor(rowShown('REQ-240'));await settled();
  await type('#rp-'+qa.open,'Synthetic reply from the browser');
  let before=report.posts.length;
  await click(`li[data-nx-entry="${qa.open}"] [data-nx-act="reply"]`);
  const replied=await posted(before,new RegExp('/comments/'+qa.open+'/replies$'));
  s=await state();entry=one(s.lists.agent,qa.open);
  assert(JSON.parse(replied.body).text==='Synthetic reply from the browser'&&entry.reps.includes('Synthetic reply from the browser')&&entry.reply===''&&s.active===qa.open+':reply','The reply shows, the box empties and the focus stays on Reply: '+JSON.stringify({entry,active:s.active}));
  before=report.posts.length;
  await click(`li[data-nx-entry="${qa.open}"] [data-nx-act="answered"]`);
  await posted(before,new RegExp('/comments/'+qa.open+'/answered$'));
  s=await state();
  assert(!one(s.lists.agent,qa.open)&&s.groups.includes(label('The talk',5,'en',{n:'1'}))&&s.hash==='#item=REQ-240'&&s.item&&s.active==='itk-h','Answered, it folds into the item\'s closed talk, the focus on its heading: '+JSON.stringify({groups:s.groups,hash:s.hash,active:s.active}));
  await click('.side [data-nx-act="whole"]');await settled();
  s=await state();
  assert(s.hash===''&&s.heading===labels('The talk','en')[0]&&s.groups.includes(label('The talk',5,'en',{n:'3'})),'All talk of the stage: '+JSON.stringify({hash:s.hash,heading:s.heading,groups:s.groups}));
  await type('#talk-text','Synthetic comment on the stage as a whole');
  before=report.posts.length;
  await click('.side [data-nx-act="leave"]');
  const left=await posted(before,/\/comments$/);
  s=await state();
  const added=s.lists.agent.find(e=>e.place===label("An entry's place",0,'en')&&e.waits.length);
  assert(JSON.parse(left.body).item===''&&added&&s.text===''&&s.active==='leave','A comment on the stage as a whole joins the agent\'s turn: '+JSON.stringify({body:left.body,added,active:s.active}));
  await evaluate(`location.hash='#item=REQ-002'`);await waitFor(`document.getElementById('itk-h')?.textContent===${JSON.stringify(label('Narrowed',0,'en',{id:'REQ-002'}))}`);await settled();
  await type('#talk-text','Synthetic comment on the item');
  before=report.posts.length;
  await click('.side [data-nx-act="leave"]');
  const onItem=await posted(before,/\/comments$/);
  s=await state();
  assert(JSON.parse(onItem.body).item==='REQ-002'&&s.label===words('Comment on','en',{id:'REQ-002'})&&s.lists.agent.some(e=>e.place==='REQ-002'),'A comment on the selected item: '+JSON.stringify({body:onItem.body,label:s.label}));
  return{evidence:'fixture page and writes',screenshots:[pickedShot,await shot('box-1440-en')]};
 });

 // Rule 22's item, pressed on the request's entry and in the stage's record (TASK-300): the item
 // that this stage holds opens in its panel beside the stage as a step of the browser's history,
 // #item=, its row selected and the focus on the panel's heading; the browser's Back closes it.
 // In the record the link is the same, and the record gives way to the item's panel.
 await test('look-at-first-1440-en',async()=>{
  const lang='en',seen={};await setting({width:1440,theme:'light'});await open(page('02-prd',lang));
  await click(`li[data-nx-entry="${qa.checkpoint}"] > .look a`);
  await waitFor(`location.hash==='#item=REQ-001'&&document.activeElement?.id==='item-h'`);await settled();
  let s=await state();seen.entry={hash:s.hash,item:s.item,selected:s.selected,active:s.active};
  assert(s.item&&s.selected==='REQ-001'&&s.active==='item-h'&&s.overflow===0,'The entry\'s link opens the item\'s panel, its row selected: '+JSON.stringify(seen.entry));
  const itemShot=await shot('look-item-1440-en');
  await evaluate('history.back()');await waitFor(`location.hash===''&&!document.querySelector('.side .item')`);await settled();
  s=await state();seen.back={hash:s.hash,item:s.item,talk:s.talk,active:s.active};
  assert(!s.item&&s.talk&&s.active==='item:REQ-001','Back closes the item, the focus on its row (SCR-115\'s actions, BUG-616): '+JSON.stringify(seen.back));
  // In the record, by the keyboard: the record gives way to the item's panel.
  await click('.stage [data-nx-act="record"]');await waitFor(`!!document.querySelector('.side .rec .rq .look a')`);await settled();
  seen.record=await evaluate(`(()=>{const a=document.querySelector('.side .rec .rq .look a');return{href:a.getAttribute('href'),act:a.dataset.nxAct,text:a.textContent};})()`);
  assert(seen.record.href==='#item=REQ-001'&&seen.record.act==='look'&&seen.record.text==='REQ-001','The record shows the same link: '+JSON.stringify(seen.record));
  await evaluate(`document.querySelector('.side .rec .rq .look a').focus()`);
  for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
  await waitFor(`location.hash==='#item=REQ-001'&&document.activeElement?.id==='item-h'`);await settled();
  s=await state();seen.fromRecord={hash:s.hash,record:s.record,open:s.open,item:s.item,active:s.active};
  assert(!s.record&&s.open!=='record'&&s.item&&s.selected==='REQ-001'&&s.active==='item-h','The record gives way to the item\'s panel: '+JSON.stringify(seen.fromRecord));
  await evaluate('history.back()');await waitFor(`location.hash===''&&!document.querySelector('.side .item')`);await settled();
  s=await state();seen.backFromRecord={hash:s.hash,item:s.item,active:s.active};
  assert(!s.item&&s.active==='item:REQ-001','Back from the item that the record opened: the focus on its row (BUG-616): '+JSON.stringify(seen.backFromRecord));
  // On a phone the item came over the Talk tab, which comes back to the front with Back: its
  // heading takes the focus, as the item's row is not in sight there (BUG-616).
  await setting({width:390,touch:true});await open(page('02-prd',lang));
  await click('.tabs .tab[data-nx-tab="talk"]');await waitFor(`!!document.querySelector('li[data-nx-entry="${qa.checkpoint}"] > .look a')?.checkVisibility()`);await settled();
  await click(`li[data-nx-entry="${qa.checkpoint}"] > .look a`);
  await waitFor(`location.hash==='#item=REQ-001'&&document.activeElement?.id==='item-h'`);await settled();
  await evaluate('history.back()');await waitFor(`location.hash===''&&!document.querySelector('.side .item')`);await settled();
  s=await state();seen.phone={hash:s.hash,item:s.item,active:s.active};
  assert(!s.item&&s.active==='talk-h','Back on a phone: the focus on the talk\'s heading, not on the page (BUG-616): '+JSON.stringify(seen.phone));
  return{evidence:'fixture page and reads',seen,screenshot:itemShot};
 });

 // As recommended answers in place, the focus on the answer; a checkpoint request's Stage record
 // opens the record, where the pass is, and the request stays open (TASK-302); Reply opens the
 // question with the focus in its box and Escape folds it (API-159, choice 19, rule 10, TC-1804).
 await test('answers-in-place-1440-ko-dark',async()=>{
  await setting({width:1440,theme:'dark'});
  await open(page('02-prd','ko'));
  let before=report.posts.length;
  await click(`li[data-nx-entry="${qa.recommended}"] [data-nx-act="recommended"]`);
  await posted(before,new RegExp('/comments/'+qa.recommended+'/recommended$'));
  let s=await state(),entry=one(s.lists.mine,qa.recommended);
  assert(entry.after===label('Answered',2,'ko')&&!entry.acts.length&&s.active===qa.recommended+':after','As recommended, answered in its place: '+JSON.stringify({entry,active:s.active}));
  const answeredShot=await shot('answers-1440-ko-dark');
  before=report.posts.length;
  await click(`li[data-nx-entry="${qa.checkpoint}"] [data-nx-act="record"]`);await settled();
  s=await state();
  assert(s.record&&!s.talk&&report.posts.length===before,'Stage record opens the record in the side and sends nothing: '+JSON.stringify({record:s.record,talk:s.talk,posts:report.posts.slice(before)}));
  await click('.side .rec [data-nx-act="close"]');await settled();
  await click(`li[data-nx-entry="${qa.question}"] [data-nx-act="reply-open"]`);await settled();
  s=await state();
  assert(s.hash===`#talk=${qa.question}&item=REQ-002`&&s.active===qa.question+':text','Reply opens the question with the focus in its box: '+JSON.stringify({hash:s.hash,active:s.active}));
  await press('Escape');await settled();
  s=await state();
  assert(s.hash==='#item=REQ-002'&&!one(s.lists.mine,qa.question)?.open&&s.active==='talk:'+qa.question,'Escape folds it, the focus on its press: '+JSON.stringify({hash:s.hash,active:s.active}));
  return{evidence:'fixture page and writes',screenshot:answeredShot};
 });

 // #stale on a comment: the agent's reply that came after the entry opened says "New" once the
 // talk reads again; Mark answered on a comment that another tab closed meanwhile folds it, and
 // "This comment was already closed." stays above the talk (TC-1805).
 await test('stale-comment-1440-en',async()=>{
  await setting({width:1440});
  await open(page('02-prd','en'));
  await click(`li[data-nx-entry="${qa.claimed}"] .ref`);await settled();
  let entry=one((await state()).lists.agent,qa.claimed);
  assert(entry?.open&&entry.reps===words('No replies','en'),'The entry opens without replies: '+JSON.stringify(entry));
  const replied=await fetch(origin+'/__qa/agent-reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({comment:qa.claimed,text:'Synthetic reply that came after the entry opened'}),signal:AbortSignal.timeout(10000)});
  report.otherTab.push({path:'/__qa/agent-reply',status:replied.status});
  assert(replied.ok,'The agent\'s reply failed: '+replied.status);
  await backInView();
  await waitFor(`!!document.querySelector('li[data-nx-entry="${qa.claimed}"] .newt')`);await settled();
  entry=anywhere(await state(),qa.claimed);
  assert(entry?.open&&entry.reps.includes('Synthetic reply that came after the entry opened')&&entry.reps.includes(words('New reply','en')),'The reply that came after the entry opened says New: '+JSON.stringify(entry));
  const newShot=await shot('stale-new-1440-en');
  await otherTab(`/api/spaces/${project}/comments/${qa.claimed}/answered`);
  const before=report.posts.length;
  await click(`li[data-nx-entry="${qa.claimed}"] [data-nx-act="answered"]`);
  await posted(before,new RegExp('/comments/'+qa.claimed+'/answered$'));
  const s=await state();
  const emptied=await evaluate(`!!document.querySelector('.side .empty-t')`);
  assert(!one(s.lists.agent,qa.claimed)&&!one(s.lists.mine,qa.claimed)&&s.notes.some(n=>n.tone==='info'&&n.text===words('Already closed','en'))&&s.hash==='#item=REQ-003'&&s.item&&s.active==='itk-h'&&s.groups.includes(label('The talk',5,'en',{n:'1'}))&&!emptied,'Closed meanwhile: it folds into the closed talk, and the talk says so: '+JSON.stringify({notes:s.notes,hash:s.hash,active:s.active,groups:s.groups,emptied}));
  return{evidence:'fixture page and writes; one other-tab write, and one reply as the agent through the fixture',screenshots:[newShot,await shot('stale-closed-1440-en')]};
 });

 // On the ERD: Accept and Dismiss in place, a proposal that another tab dismissed meanwhile
 // (SCR-114#stale), and a reflection that waits for the user, dismissed with a note above the
 // talk (API-124, API-125, API-127, TC-1806).
 await test('proposals-and-reflection-1440-en',async()=>{
  await setting({width:1440});
  await open(page('05-erd','en'));
  let s=await state(),reflection=one(s.lists.agent,qa.edit);
  assert(s.lists.mine.length===3&&reflection&&reflection.rst===words('Reflection needs user','en')&&!reflection.nrd.length&&!reflection.waits.length&&reflection.acts[0]?.act==='dismiss-edit','Three proposals, and the reflection with how it stands and Dismiss: '+JSON.stringify(reflection));
  // Only a person's own sign-in answers a proposal: user_only keeps the entry and its answers
  // (SCR-114#permission).
  responses.push({method:'POST',pattern:new RegExp('^/api/spaces/'+project+'/proposals/'+qa.accept+'/accept$'),...problem(403,'user_only')});
  await click(`li[data-nx-entry="${qa.accept}"] [data-nx-act="accept"]`);await settled();
  let refused=one((await state()).lists.mine,qa.accept);
  assert(refused.msgs.some(m=>m.tone==='warn'&&m.text===codeMessage('user_only','en'))&&refused.acts.some(a=>a.act==='accept')&&!/\banswered\b/.test(refused.cls),'user_only, the answers kept: '+JSON.stringify(refused));
  await otherTab(`/api/spaces/${project}/proposals/${qa.stale}/dismiss`);
  let before=report.posts.length;
  await click(`li[data-nx-entry="${qa.stale}"] [data-nx-act="accept"]`);
  await posted(before,new RegExp('/proposals/'+qa.stale+'/accept$'));
  s=await state();let entry=one(s.lists.mine,qa.stale);
  assert(entry.after.includes(label('Answered',1,'en'))&&entry.msgs.some(m=>m.tone==='info'&&m.text===codeMessage('proposal_not_open','en',{state:labels('Proposal states','en')[2]})),'A proposal dismissed meanwhile says so, in its place: '+JSON.stringify(entry));
  // On a pictured stage the entry selects its table in the picture, outlined (SPEC-209).
  await click(`li[data-nx-entry="${qa.accept}"] .ref`);await waitFor(`!!document.querySelector('.pf svg.mks .mk-sel')`);await settled();
  s=await state();
  assert(s.hash===`#talk=${qa.accept}&item=TBL-001`&&s.heading===label('Narrowed',0,'en',{id:'TBL-001'}),'The proposal selects its table in the picture: '+JSON.stringify({hash:s.hash,heading:s.heading}));
  before=report.posts.length;
  await click(`li[data-nx-entry="${qa.accept}"] [data-nx-act="accept"]`);
  await posted(before,new RegExp('/proposals/'+qa.accept+'/accept$'));
  s=await state();entry=one(s.lists.mine,qa.accept);
  // The reflection it starts waits for the agent, which has not read it yet (SPEC-189, TC-1719).
  assert(entry.after===label('Answered',0,'en')&&entry.rst===words('Reflection pending','en')&&JSON.stringify(entry.nrd)===JSON.stringify([label('Not read, on an entry',0,'en')])&&s.active===qa.accept+':after','Accept, in place, with its reflection pending and not read by the agent yet: '+JSON.stringify({entry,active:s.active}));
  await click('.side [data-nx-act="whole"]');await settled();
  before=report.posts.length;
  await click(`li[data-nx-entry="${qa.dismiss}"] [data-nx-act="dismiss"]`);
  await posted(before,new RegExp('/proposals/'+qa.dismiss+'/dismiss$'));
  entry=one((await state()).lists.mine,qa.dismiss);
  assert(entry.after===label('Answered',1,'en'),'Dismiss, in place: '+JSON.stringify(entry));
  // A reflection that changed meanwhile: its state above the talk, which reads again.
  responses.push({method:'POST',pattern:new RegExp('^/api/spaces/'+project+'/edits/'+qa.edit+'/dismiss$'),...problem(409,'edit_state',{state:'merged'})});
  await click(`li[data-nx-entry="${qa.edit}"] [data-nx-act="dismiss-edit"]`);await settled();
  s=await state();
  assert(s.notes.some(n=>n.tone==='info'&&n.text===codeMessage('edit_state','en',{state:'merged'}))&&one(s.lists.agent,qa.edit),'A reflection that changed meanwhile, above the talk: '+JSON.stringify(s.notes));
  before=report.posts.length;
  await click(`li[data-nx-entry="${qa.edit}"] [data-nx-act="dismiss-edit"]`);
  await posted(before,new RegExp('/edits/'+qa.edit+'/dismiss$'));
  s=await state();
  assert(!one(s.lists.agent,qa.edit)&&s.notes.some(n=>n.tone==='info'&&n.text===words('Reflection dismissed','en'))&&s.active==='talk-h','The reflection leaves, a note says so: '+JSON.stringify({notes:s.notes,active:s.active}));
  return{evidence:'fixture page and writes; one other-tab write; an Accept refused user_only and a dismissal refused edit_state by the suite (mocked)',screenshot:await shot('proposals-1440-en')};
 });

 // Rule 5: a comment on the stage as a whole, a reply that settles and Mark answered, each
 // failed once, keep their words, "This settles it" and write IDs in the browser; the page
 // loaded again holds them, and each sends its first write ID (TC-1807).
 await test('kept-across-a-reload-1440-en',async()=>{
  await setting({width:1440});
  await open(page('02-prd','en'));
  failing=[/\/comments$/,/\/replies$/,/\/answered$/];
  const text='Synthetic comment kept across a reload',said='Synthetic reply kept across a reload',first=pattern=>report.posts.slice(before).find(p=>pattern.test(p.path));
  let before=report.posts.length;
  await type('#talk-text',text);
  await click('.side [data-nx-act="leave"]');await settled();
  const leave=first(/\/comments$/);
  await click(`li[data-nx-entry="${qa.question}"] [data-nx-act="reply-open"]`);await settled();
  await type('#rp-'+qa.question,said);
  await click(`li[data-nx-entry="${qa.question}"] input[name="settles"]`);
  await click(`li[data-nx-entry="${qa.question}"] [data-nx-act="reply"]`);await settled();
  const reply=first(/\/replies$/);
  await click('.side [data-nx-act="whole"]');await waitFor(`location.hash===''`);await settled();
  await click(`li[data-nx-entry="${qa.settled}"] .ref`);await settled();
  await click(`li[data-nx-entry="${qa.settled}"] [data-nx-act="answered"]`);await settled();
  const answered=first(/\/answered$/);
  assert(leave&&reply&&answered&&JSON.parse(reply.body).settles===true,'Three writes failed once: '+JSON.stringify({leave,reply,answered}));
  failing=[];
  await open(page('02-prd','en'));
  let s=await state();
  assert(s.text===text,'The stage\'s box holds its words: '+JSON.stringify(s.text));
  before=report.posts.length;
  await click('.side [data-nx-act="leave"]');
  const leaveAgain=await posted(before,/\/comments$/);
  await click(`li[data-nx-entry="${qa.question}"] [data-nx-act="reply-open"]`);await settled();
  const kept=await evaluate(`(()=>{const li=document.querySelector('li[data-nx-entry="${qa.question}"]');return{text:li.querySelector('textarea[name="reply"]').value,settles:li.querySelector('input[name="settles"]').checked};})()`);
  assert(kept.text===said&&kept.settles,'The reply\'s words and This settles it are kept: '+JSON.stringify(kept));
  before=report.posts.length;
  await click(`li[data-nx-entry="${qa.question}"] [data-nx-act="reply"]`);
  const replyAgain=await posted(before,/\/replies$/);
  await click('.side [data-nx-act="whole"]');await waitFor(`location.hash===''`);await settled();
  await click(`li[data-nx-entry="${qa.settled}"] .ref`);await settled();
  before=report.posts.length;
  await click(`li[data-nx-entry="${qa.settled}"] [data-nx-act="answered"]`);
  const answeredAgain=await posted(before,/\/answered$/);
  s=await state();
  assert(leaveAgain.write===leave.write&&replyAgain.write===reply.write&&answeredAgain.write===answered.write&&JSON.parse(replyAgain.body).settles===true&&JSON.parse(leaveAgain.body).text===text,'Each sends its first write ID: '+JSON.stringify({leave:[leave.write,leaveAgain.write],reply:[reply.write,replyAgain.write],answered:[answered.write,answeredAgain.write]}));
  return{evidence:'fixture page and writes; three writes failed once by the suite (mocked), then sent to the fixture server after the page loaded again',screenshot:await shot('kept-1440-en')};
 });

 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.blockedExternalOrigins.length,'The page asked another origin: '+report.blockedExternalOrigins.join());
 assert(!report.runtimeExceptions.length,'The page threw: '+JSON.stringify(report.runtimeExceptions));
 const expected=2+1+1+1+1+2+1+1+1+8+1+1+1+1+1+1;
 report.status=report.tests.length===expected&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 closing=true;
 try{if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();await browser.stop();report.browserExited=true;}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
