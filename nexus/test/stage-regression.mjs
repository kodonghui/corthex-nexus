/**
 * TASK-274: a stage in the workspace (SCR-111, SCR-113, and SCR-112's list until TASK-275
 * draws its picture) in a browser. Its states at 390, 1,152 and 1,440 pixels (rule 16) in
 * both themes and languages; the filters, the search in the stage, the grouping and the next
 * 200 (API-158); the addresses' #filter=left, on a pictured stage too, and #item=; reading
 * again and a newer push (rule 6); the stage record in the side, as a panel and as a sheet,
 * with the focus and Escape of rule 10; passing and withdrawing a checkpoint, with the words
 * kept and one write ID for every try (rules 4 and 5); times in the browser's time zone
 * (rule 2); and hit areas (rule 14). Node 24 built-ins only; an owned headless Chrome over
 * CDP. Requires NEXUS_QA_STAGE=1, the opt-in view-server, NEXUS_CHROME and NEXUS_QA_ORIGIN.
 * Synthetic loopback fixture only. The page's reads and writes reach the fixture server,
 * except those that a test answers itself, which the report lists as mocked; the suite's own
 * "other tab" writes go to the fixture through /api, as the page's do.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {label,labels,codeMessage} from '../src/draw/words.js';
import {stagePath} from '../src/draw/stages.js';
import {clock,day,count} from '../src/draw/html.js';
import {FOLD_KEYS} from '../ui/folds.js';
import {notReadWhy} from '../src/draw/stage.js';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_STAGE!=='1')throw Error('Use only the opt-in synthetic stage fixture');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,project='qa-stage',part='sample';
const page=(stage,lang,hash='')=>stagePath(project,part,stage)+'?lang='+lang+hash;
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'stage-');
const {folder,profile}=browser;
const report={schema:'nexus-stage-browser-regression/1',scope:'synthetic loopback fixture only',evidence:'page measurement and screenshots; reads and writes either reach the fixture server (real) or are answered by the suite (mocked), as each test says',
 startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],blockedExternalOrigins:[],posts:[],reads:[],otherTab:[],runtimeExceptions:[]};
const softDeadline=Date.now()+165000;
let ws,session,seq=0,held=null,failing=[],responses=[],closing=false,loads=0;
const pending=new Map(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const out=(name,value)=>fs.writeFile(path.join(folder,name),JSON.stringify(value,null,2));
class CheckFailure extends Error{}
function assert(ok,message){if(!ok)throw new CheckFailure(message);}
function command(method,params={},scoped=true,timeout=10000){
 if(!closing&&Date.now()>softDeadline)return Promise.reject(Error('165s work budget reached; preserving time for owned cleanup'));
 const id=++seq;
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},timeout);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params,...(scoped?{sessionId:typeof scoped==='string'?scoped:session}:{})}));});
}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
async function waitFor(expression,timeout=10000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await evaluate(expression))return;await sleep(25);}throw Error('Page wait timed out: '+expression);}
async function paint(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function setting({width,height=844,theme='light',touch=false}){
 await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
 await command('Emulation.setTouchEmulationEnabled',touch?{enabled:true,maxTouchPoints:1}:{enabled:false});
}
// No read runs, no more items are loading and the record sends nothing. (The talk's buttons of
// an empty box are unavailable at rest, so only the record's say that something is sent.)
const LOADING=JSON.stringify([labels('The list','en')[10],labels('The list','ko')[10]]);
async function settled(){await waitFor(`(document.querySelector('.stage .upd')?.textContent||'')===''&&!${LOADING}.includes(document.querySelector('.stage .more')?.textContent)&&!document.querySelector('.side .rec [aria-disabled="true"]')`);}
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
const expired={status:302,headers:[{name:'Location',value:origin+'/cdn-cgi/access/login/qa'}],body:''};
// The rules match a request's path with its query, so that a test can answer one page of
// the list (after=200) and let the others through.
async function onPaused(event){
 const url=new URL(event.request.url),method=event.request.method,where=url.pathname+url.search,headers=Object.fromEntries(Object.entries(event.request.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(method==='POST')report.posts.push({path:url.pathname,write:headers['idempotency-key']||null,body:event.request.postData||null,at:new Date().toISOString()});
 if(method==='GET'&&url.pathname.startsWith('/api/'))report.reads.push({path:where,at:new Date().toISOString()});
 if(failing.some(pattern=>pattern.test(where))){report.interceptions.push({path:where,method,action:'failed',at:new Date().toISOString()});await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'ConnectionRefused'});return;}
 const rule=responses.find(r=>r.method===method&&r.pattern.test(where));
 if(rule){
  if(rule.once)responses.splice(responses.indexOf(rule),1);
  report.interceptions.push({path:where,method,action:'mocked '+rule.status,at:new Date().toISOString()});
  await command('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:rule.status,responseHeaders:rule.headers,body:Buffer.from(rule.body||'').toString('base64')});return;
 }
 if(held&&held.pattern.test(where)&&(!held.method||held.method===method)){held.requests.push(event.requestId);report.interceptions.push({path:where,method,action:'held',at:new Date().toISOString()});return;}
 // A request that the page dropped while it was paused, as when a test navigates on before
 // the fonts that the page adds after its first paint have loaded, has no interception left
 // to continue: Chrome answers "Invalid InterceptionId", which is recorded, not a failure.
 try{await command('Fetch.continueRequest',{requestId:event.requestId});}
 catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;report.interceptions.push({path:where,method,action:'dropped by the page',at:new Date().toISOString()});}
}
// A tab that the page opens, as an address to look at first does (rule 22). While a test
// watches, the browser attaches the suite to each new tab paused, before the tab sends anything:
// the suite records the tab's requests with their headers and fails them, so that the address is
// never loaded, then lets it run. The tabs that were there already are left as they were.
let tabId=null,watching=false,opened=null;
async function onAttached({sessionId,targetInfo,waitingForDebugger}){
 if(!watching||!waitingForDebugger||targetInfo.type!=='page'){await command('Target.detachFromTarget',{sessionId},false);return;}
 opened={session:sessionId,target:targetInfo.targetId,opener:targetInfo.openerId??null,canAccessOpener:targetInfo.canAccessOpener??null,requests:[]};
 await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},sessionId);
 await command('Runtime.runIfWaitingForDebugger',{},sessionId);
}
async function onOpenedPaused(event){
 const headers=Object.fromEntries(Object.entries(event.request.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 opened.requests.push({url:event.request.url,method:event.request.method,referer:headers.referer??null,headers:Object.keys(headers).sort(),at:new Date().toISOString()});
 await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'},opened.session);
}
// A write of another tab or the agent's, to the fixture server through /api, as the page's go.
let otherSerial=0;
async function otherTab(pathname,body={}){
 const write='nw_'+(++otherSerial).toString(32).padStart(12,'0');
 const response=await fetch(origin+pathname,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Idempotency-Key':JSON.stringify(write)},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 report.otherTab.push({path:pathname,status:response.status});
 assert(response.ok,'The other tab\'s write failed: '+pathname+' '+response.status);return response.json();
}
async function serverGet(pathname){const response=await fetch(origin+pathname,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});return{status:response.status,data:await response.json()};}

// What the stage shows: its head, filters, list, notes and bars, and the record in the side.
const STATE=`(()=>{const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],txt=e=>e?e.textContent.replace(/\\s+/g,' ').trim():null,tone=(e,base)=>[...e.classList].find(c=>c!==base)||null;
 const head=q('.stage .shd'),bar=q('.stage .notes .bar'),more=q('.stage .more'),nolist=q('.stage .nolist'),rec=q('.side .rec'),button=b=>b&&{text:txt(b),disabled:b.disabled,wait:b.dataset.nxWait||null,aria:b.getAttribute('aria-disabled'),expanded:b.getAttribute('aria-expanded')};
 const msg=m=>m&&{tone:tone(m,'msg'),role:m.getAttribute('role'),text:txt(m.querySelector('.t')),trace:txt(m.querySelector('.tid')),retry:m.querySelector('[data-nx-act=pass],[data-nx-act=withdraw]')?.dataset.nxAct||null,signIn:!!m.querySelector('[data-nx-act=sign-in]')};
 return{code:document.documentElement.dataset.nxCode||null,
  head:head?{h1:txt(head.querySelector('h1')),state:txt(head.querySelector('.st')),meta:[...head.querySelectorAll('.meta > span')].map(txt),waiting:txt(head.querySelector('.meta > .wait')),counts:txt(head.querySelector('.cn')),record:button(head.querySelector('[data-nx-act=record]')),talk:txt(head.querySelector('[data-nx-act=talk] > span:not(.mt)')),talkMine:txt(head.querySelector('[data-nx-act=talk] > .mt'))}:null,
  chips:all('.stage .chip').map(b=>({filter:b.dataset.nxFilter,text:txt(b.firstElementChild),n:txt(b.querySelector('.n')),pressed:b.getAttribute('aria-pressed'),disabled:b.disabled,wait:b.dataset.nxWait||null})),
  find:(i=>i&&{disabled:i.disabled,wait:i.dataset.nxWait||null,value:i.value})(q('.stage input[name=q]')),
  group:txt(q('.stage .gm > summary')||q('.stage .gm')),groupWaits:all('.stage .gm [data-nx-act=group]').map(b=>b.dataset.nxWait||(b.disabled?'disabled':null)),
  rows:all('.stage .li').map(a=>a.dataset.nxItem),selected:all('.stage .li[aria-current=true]').map(a=>a.dataset.nxItem),
  groups:all('.stage .gh').map(txt),
  more:more?{text:txt(more),role:more.getAttribute('role'),button:txt(more.querySelector('button'))}:null,
  nolist:nolist?{key:nolist.dataset.nxKey,text:txt(nolist.querySelector('p')),button:button(nolist.querySelector('button')),act:nolist.querySelector('button')?.dataset.nxAct||null}:null,
  notice:bar?{tone:tone(bar,'bar'),text:txt(bar.querySelector('.t')),button:txt(bar.querySelector('button')),act:bar.querySelector('button')?.dataset.nxAct||null}:null,
  bars:all('.bars .bar').filter(b=>!b.hasAttribute('data-nx-codebar')).map(b=>({tone:tone(b,'bar'),text:txt(b.querySelector('.t')),act:b.querySelector('button')?.dataset.nxAct||null})),
  updating:txt(q('.stage .upd')),open:q('.ws')?.dataset.nxOpen||null,hash:location.hash,
  record:rec?{note:msg(rec.querySelector('.rnote .msg')),pass:msg(rec.querySelector('.pnote .msg')),words:rec.querySelector('#cp-words')?.value??null,invalid:rec.querySelector('#cp-words')?.getAttribute('aria-invalid')||null,
   left:txt(rec.querySelector('.left')),passButton:button(rec.querySelector('.r2 [data-nx-act=pass]')),list:[...rec.querySelectorAll('dl > dd')].map(txt),
   boxes:[...rec.querySelectorAll('.wbox')].map(w=>({warn:w.classList.contains('warn'),text:txt(w.querySelector('b')),words:txt(w.querySelector('.mu')),withdraw:w.querySelector('button')?.dataset.nxCheckpoint||null,button:button(w.querySelector('button')),
    seen:txt(w.querySelector('.cpk>.cpc')),answers:w.querySelector('.cpk>.cpq a')?.getAttribute('href')||null,
    kind:[...w.querySelectorAll('.cpk>span:not(.sep):not(.cpc):not(.cpq)')].map(txt),lineTops:[...w.querySelectorAll('.cpk>span:not(.sep)')].map(e=>Math.round(e.getBoundingClientRect().top))}))}:null,
  focus:document.activeElement?.dataset?.nxFocus||document.activeElement?.id||null};})()`;
const state=()=>evaluate(STATE);
// Where the workspace's regions are (rule 16) and how tall its rows and chips are.
const LAYOUT=`(()=>{const q=s=>document.querySelector(s),r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return[b.x,b.y,b.width,b.height].map(Math.round);},shown=e=>!!e&&e.checkVisibility({visibilityProperty:true})&&e.getBoundingClientRect().width>1;
 const side=q('.side'),li=q('.stage .li');
 return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,
  rail:shown(q('.rail')),tabs:shown(q('.tabs')),stage:r(q('.stage')),side:shown(side)?{box:r(side),position:getComputedStyle(side).position}:null,scrim:shown(q('.scrim')),
  h1:r(q('.shd h1')),talk:shown(q('.shd [data-nx-act=talk]')),record:r(q('.shd [data-nx-act=record]')),
  columns:li?getComputedStyle(li).gridTemplateColumns:null,rows:[...document.querySelectorAll('.stage .li')].slice(0,8).map(e=>Math.round(e.getBoundingClientRect().height)),
  chips:[...document.querySelectorAll('.stage .chip')].map(c=>Math.round(c.getBoundingClientRect().height)),
  inert:[...document.querySelectorAll('[inert]')].map(e=>e.getAttribute('data-nx-part')||e.className.split(' ')[0]||e.tagName)};})()`;
const layout=()=>evaluate(LAYOUT);
async function noSideways(where){const s=await layout();assert(s.scrollWidth<=s.width&&s.bodyWidth<=s.width,'The page scrolls sideways '+where+': '+JSON.stringify({width:s.width,scrollWidth:s.scrollWidth,bodyWidth:s.bodyWidth}));return s;}
// The boxes that must not move when the code runs (rule 15).
const BOXES=`[...document.querySelectorAll('.shd, .shd > *, .filters > *, .stage .li, .stage .gh, .stage .more, .rail .row')].slice(0,60).map(e=>{const b=e.getBoundingClientRect();return[b.x,b.y,b.width,b.height].map(v=>Math.round(v*10)/10).join(',');})`;
// A control by the keyboard: the focus on it, then Enter, as a person who tabs to it does.
async function key(name,code=name,keyCode=13,text){for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:name,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode,...(type==='keyDown'&&text?{text}:{})});}
async function press(selector){
 const found=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.scrollIntoView({block:'nearest'});e.focus();return document.activeElement===e;})()`);
 assert(found,'No control to focus: '+selector);await key('Enter','Enter',13,'\r');
}
// A control by the mouse, at its centre.
async function click(selector){
 const at=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'No control to click: '+selector);
 for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x:at.x,y:at.y,button:'left',clickCount:1});
}
async function clickAt(x,y){for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});}
// A control that shows, by the mouse at its centre: a pictured stage draws Stage record twice, in
// the head for the phone and in the picture's bar from 1,024 pixels (SCR-112).
async function clickShown(selector){
 const at=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}));if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'No control that shows: '+selector);await clickAt(at.x,at.y);
}
const RECORD='[data-nx-act="record"][data-nx-key="rec"]';
// Words typed into a field, as a person types them.
async function type(selector,text){
 await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});e.focus();e.select?.();return true;})()`);
 await command('Input.insertText',{text});
}
async function clearField(selector){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.select();return true;})()`);await key('Backspace','Backspace',8);}
const toEnd=()=>evaluate(`(()=>{const l=document.querySelector('.stage .lw > .list');l.scrollTop=l.scrollHeight;return l.scrollHeight>l.clientHeight;})()`);
const stageApi=stage=>new RegExp('^/api/spaces/'+project+'/stages/'+part+'/'+stage+'\\?');
const readsOf=(stage,since=0)=>report.reads.slice(since).filter(r=>stageApi(stage).test(r.path)).map(r=>r.path);
const chip=name=>`.stage .chip[data-nx-filter="${name}"]`;
const postsTo=(pathname,since=0)=>report.posts.slice(since).filter(post=>post.path===pathname);

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json(),qa=fixture.stage;
 assert(qa?.project===project&&qa.part===part&&qa.unrecorded==='qa-stage-unrecorded'&&/^nk_/.test(qa.checkpoint||'')&&['talk','asks','last','erd','request','erdRequest'].every(k=>/^nc_/.test(qa[k]||''))&&/^np_/.test(qa.proposal||'')&&/^https:\/\/preview\.example\.com\//.test(qa.address||'')&&qa.texts?.request&&qa.texts.erdRequest,'The origin is not the opt-in synthetic stage fixture');
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),entries=JSON.parse(metadataBytes).entries;
 assert(/^\/code\/page\.[a-f0-9]{8}\.js$/.test(entries['page-js']||''),'Content-hashed page code is required');
 report.preflight={fixture:qa,build:{entries:{'page-js':entries['page-js'],'page-css':entries['page-css']},sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
 const code=new RegExp('^'+entries['page-js'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'),fonts=/^\/code\/fonts\.[a-f0-9]{8}\.css$/;
 const api='/api/spaces/'+project,checkpoints=api+'/checkpoints',withdrawOf=id=>api+'/checkpoints/'+id+'/withdraw';
 // The server's own answers, which the page must show.
 const server=async(stage,query='filter=all&group=context')=>(await serverGet(api+'/stages/'+part+'/'+stage+'?'+query)).data;
 const first=await server('02-prd'),left=await server('02-prd','filter=left&group=context'),erdLeft=await server('05-erd','filter=left&group=context');
 assert(first.items.total===450&&first.items.entries.length===200&&left.items.total===3&&erdLeft.items.total===2,'The fixture holds 450 requirements, 3 left on 02 and 2 on 05');
 const waitingSince=first.record.checkpoints.find(cp=>cp.id===qa.checkpoint)?.passed_at;
 assert(waitingSince,'The fixture\'s checkpoint waits for its record');
 const browserEnv={...process.env};for(const key of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(key))delete browserEnv[key];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],browserEnv);
 const endpoint=await browser.endpoint();
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);}else if(m.sessionId===session){if(m.method==='Page.loadEventFired')loads++;if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error)+' ('+m.params.request.method+' '+new URL(m.params.request.url).pathname+')';});if(m.method==='Runtime.exceptionThrown')report.runtimeExceptions.push({at:new Date().toISOString(),text:m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text});}
  else if(!m.sessionId&&m.method==='Target.attachedToTarget')onAttached(m.params).catch(error=>{report.eventError=String(error)+' (a tab attached)';});
  else if(m.sessionId&&m.sessionId===opened?.session&&m.method==='Fetch.requestPaused')onOpenedPaused(m.params).catch(error=>{report.eventError=String(error)+' (the opened tab)';});};
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);tabId=tab.targetId;session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 // The times stay in the server's UTC here; one test shows them in another zone.
 await command('Emulation.setTimezoneOverride',{timezoneId:'UTC'});

 // The states at the three widths of rule 16, both themes at 390 and 1,440 and both languages
 // at each width. Loading holds the page's code; error and permission are answered by the
 // suite (mocked); empty, not read and no match are the fixture's own.
 for(const [width,lang,theme]of[[390,'en','light'],[390,'ko','dark'],[1440,'en','dark'],[1440,'ko','light'],[1152,'en','light'],[1152,'ko','dark']]){
  await test(`states-${lang}-${theme}-${width}`,async()=>{
   const tag=`${lang}-${theme}-${width}`,list=labels('The list',lang),head=labels('The head',lang),seen={},shots=[];await setting({width,theme});
   // SCR-113#loading: the head and the first 200 as the server drew them; the controls wait.
   held={pattern:code,requests:[]};failing=[fonts];await open(page('02-prd',lang),{ready:false});
   for(const stop=Date.now()+10000;!held.requests.length&&Date.now()<stop;)await sleep(25);
   assert(held.requests.length===1,'The page asks for its code once, and the suite holds it');
   seen.loading=await state();const before=await evaluate(BOXES);
   assert(seen.loading.code===null&&seen.loading.rows.length===200&&seen.loading.chips.every(c=>c.disabled&&c.wait==='list')&&seen.loading.find.wait==='list'&&seen.loading.groupWaits.every(w=>w==='list')&&seen.loading.head.record.wait==='record','#loading: the list and the record wait for the code: '+JSON.stringify({chips:seen.loading.chips,find:seen.loading.find,record:seen.loading.head?.record}));
   shots.push(await shot('loading-'+tag));
   await release();await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await settled();await paint();
   const after=await evaluate(BOXES);
   assert(JSON.stringify(after)===JSON.stringify(before),'Something moved when the code ran (rule 15)');
   // SCR-113#normal.
   seen.normal=await state();seen.layout=await layout();
   const n=seen.normal;
   assert(n.chips.map(c=>[c.text,c.n,c.pressed,c.disabled,c.wait].join('|')).join()===[[list[0],'450','true'],[list[1],'3','false'],[list[2],'1','false'],[list[3],'3','false']].map(c=>[...c,false,''].join('|')).join(),'#normal: the filters with their counts: '+JSON.stringify(n.chips));
   assert(!n.find.disabled&&!n.head.record.disabled&&!n.head.record.wait&&n.head.record.expanded==='false','#normal: the search and Stage record work');
   assert(JSON.stringify(n.rows)===JSON.stringify(first.items.entries.map(e=>e.id))&&n.groups.length===1&&n.groups[0].startsWith('CTX-001 Ordering')&&n.more?.text===label('The list',9,lang,{n:'200',total:'450'}),'#normal: the first 200 in their group, with 200 of 450: '+JSON.stringify({groups:n.groups,more:n.more,rows:n.rows.slice(0,3)}));
   assert(n.head.h1==='02 PRD'&&n.head.state?.length>0&&n.head.meta[0]===head[0].replace('{date}','2026-11-07')&&n.head.meta[1]?.startsWith(label('The head',2,lang,{commit:'aaaaaaa'}))&&n.head.waiting===codeMessage('Waiting for its record',lang,{date:day(waitingSince)}),'#normal: the head: '+JSON.stringify(n.head));
   assert(n.head.counts===`${label("The head's counts",5,lang,{n:'450'})} · Must 113 · Should 113 · Could 112 · Won't 112`,'#normal: the requirements by priority, MoSCoW\'s order: '+n.head.counts);
   const L=seen.layout;
   if(width>=1280)assert(L.rail&&L.side&&L.side.box[2]===400&&L.side.position!=='absolute'&&!L.talk&&!L.tabs&&L.columns?.startsWith('112px'),'From 1,280: the list of stages, the stage and the side, the ID 112 pixels: '+JSON.stringify(L));
   // Beside Talk ({n}) the comments that wait for the user, as the list of stages counts them (SPEC-210).
   else if(width>=1024){const mine=first.stages.find(s=>s.key==='02-prd').mine;assert(L.rail&&!L.side&&L.talk&&!L.tabs&&L.columns?.startsWith('112px')&&n.head.talk===label('Tabs',4,lang,{n:'3'})&&n.head.talkMine===(mine?label('The talk',1,lang,{n:String(mine)}):null),'From 1,024 to 1,279: the talk folds into Talk (3), with My turn: '+JSON.stringify({L,talk:n.head.talk,mine:n.head.talkMine,stage:mine}));}
   else assert(!L.rail&&!L.side&&L.tabs&&L.h1[2]<=1&&L.rows.every(h=>h>=44)&&L.chips.every(h=>h===44),'Under 1,024: the tabs, rows of 44 pixels at least and chips 44 high: '+JSON.stringify(L));
   if(width>=1024)assert(L.rows.every(h=>h>=36)&&L.chips.every(h=>h===28),'Rows of 36 pixels at least and chips 28 high: '+JSON.stringify(L));
   await noSideways('#normal');shots.push(await shot('normal-'+tag));
   // SCR-113#no-match: a search that matches nothing, then Show all.
   const t0=report.reads.length;await type('.stage input[name=q]','zzq');
   await waitFor(`document.querySelector('.stage .nolist')?.dataset.nxKey==='no-match'`);await settled();seen.noMatch=await state();
   assert(seen.noMatch.nolist.text===label('No match',2,lang,{q:'zzq'})&&seen.noMatch.nolist.button.text===list[7]&&readsOf('02-prd',t0).length===1,'#no-match: '+JSON.stringify({nolist:seen.noMatch.nolist,reads:readsOf('02-prd',t0)}));
   shots.push(await shot('no-match-'+tag));
   await click('.stage .nolist button[data-nx-act="show-all"]');await waitFor(`document.querySelectorAll('.stage .li').length===200`);await settled();
   seen.shown=await state();assert(seen.shown.find.value===''&&seen.shown.chips[0].pressed==='true','Show all clears the search: '+JSON.stringify(seen.shown.find));
   // SCR-113#error: a filter whose read fails, then Try again; the list stays meanwhile.
   responses=[{method:'GET',pattern:stageApi('02-prd'),once:true,...problem(500,'internal')}];
   await click(chip('talk'));await waitFor(`!!document.querySelector('.stage .notes .bar')`);await settled();seen.unread=await state();
   assert(seen.unread.notice?.tone==='err'&&seen.unread.notice.text===codeMessage('Could not update',lang)&&seen.unread.notice.act==='read'&&seen.unread.rows.length===200,'#error: a read that fails keeps the list: '+JSON.stringify(seen.unread.notice));
   shots.push(await shot('error-'+tag));
   await click('.stage .notes button[data-nx-act="read"]');await waitFor(`document.querySelectorAll('.stage .li').length===3`);await settled();
   seen.retried=await state();assert(!seen.retried.notice&&JSON.stringify(seen.retried.rows)===JSON.stringify((await server('02-prd','filter=talk&group=context')).items.entries.map(e=>e.id))&&seen.retried.chips[1].pressed==='true','Try again reads the pick: '+JSON.stringify(seen.retried.rows));
   // SCR-113#permission: a refusal's message with its trace ID, then a sign-in that expired.
   responses=[{method:'GET',pattern:stageApi('02-prd'),once:true,...problem(403,'access_missing')}];
   await click(chip('mine'));await waitFor(`document.querySelector('.stage .notes .bar')?.classList.contains('warn')`);await settled();seen.permission=await state();
   assert(seen.permission.notice.text===codeMessage('access_missing',lang)+' '+codeMessage('Trace ID',lang,{traceId:'tr_qa_access_missing'}),'#permission: '+JSON.stringify(seen.permission.notice));
   shots.push(await shot('permission-'+tag));
   responses=[{method:'GET',pattern:stageApi('02-prd'),once:true,...expired}];
   await click(chip('left'));await waitFor(`!!document.querySelector('.bars .bar.warn:not([data-nx-codebar])')`);await settled();seen.signIn=await state();
   assert(seen.signIn.bars.length===1&&seen.signIn.bars[0].text===codeMessage('Sign-in expired',lang)&&seen.signIn.bars[0].act==='sign-in','#permission: the sign-in bar (rule 7): '+JSON.stringify(seen.signIn.bars));
   await noSideways('with the bars');shots.push(await shot('sign-in-'+tag));
   // The next 200 that fail, then Try again (SCR-113#error's last row).
   await open(page('02-prd',lang));failing=[/[?&]after=200(?:&|$)/];
   assert(await toEnd(),'The list scrolls');await waitFor(`!!document.querySelector('.stage .more[role=alert]')`);seen.moreFailed=await state();
   assert(seen.moreFailed.more.text.startsWith(list[11])&&seen.moreFailed.more.button===labels('Page buttons',lang)[0]&&seen.moreFailed.rows.length===200,'Could not load more.: '+JSON.stringify(seen.moreFailed.more));
   shots.push(await shot('more-failed-'+tag));failing=[];
   await click('.stage .more button[data-nx-act="more"]');await waitFor(`document.querySelectorAll('.stage .li').length===400`);await settled();
   seen.more=await state();assert(seen.more.more?.text===label('The list',9,lang,{n:'400',total:'450'})&&new Set(seen.more.rows).size===400,'Try again loads the next 200: '+JSON.stringify(seen.more.more));
   // SCR-113#empty: a stage that the project reads with no items.
   await open(page('04-functional-spec',lang));seen.empty=await state();
   assert(seen.empty.nolist?.key==='empty'&&seen.empty.nolist.text===label('No items',0,lang)&&seen.empty.chips.every(c=>c.disabled&&!c.wait)&&seen.empty.find.disabled&&!seen.empty.head.record.disabled,'#empty: '+JSON.stringify({nolist:seen.empty.nolist,chips:seen.empty.chips}));
   await noSideways('#empty');shots.push(await shot('empty-'+tag));
   // SCR-113#not-read: a stage that the project does not read, with Stage record.
   await open(page('03-user-flow',lang));seen.notRead=await state();const why=notReadWhy('missing',lang);
   assert(seen.notRead.nolist?.key==='not-read'&&seen.notRead.nolist.text===codeMessage('Not read',lang,{why})&&seen.notRead.nolist.act==='record'&&!seen.notRead.nolist.button.disabled&&!seen.notRead.chips.length&&seen.notRead.head.meta.includes(label('Not read',0,lang,{why}))&&seen.notRead.head.counts==='','#not-read: '+JSON.stringify({nolist:seen.notRead.nolist,meta:seen.notRead.head.meta}));
   await noSideways('#not-read');shots.push(await shot('not-read-'+tag));
   // SCR-111#unrecorded: a project without recorded progress, its list of stages at 1,024 and wider.
   if(width>=1024){
    await open(stagePath(qa.unrecorded,part,'01-domain')+'?lang='+lang);
    seen.unrecorded=await evaluate(`({note:document.querySelector('.rail .unrec')?.textContent||null,states:[...document.querySelectorAll('.rail .row > .sr')].map(e=>e.textContent)})`);
    assert(seen.unrecorded.note===label('No progress',0,lang)&&seen.unrecorded.states.length===13,'#unrecorded: '+JSON.stringify(seen.unrecorded));
    shots.push(await shot('unrecorded-'+tag));
   }
   return{evidence:'fixture pages; the failed reads, the refusal and the expired sign-in are mocked',seen:{...seen,loading:{code:seen.loading.code,rows:seen.loading.rows.length}},screenshots:shots};
  });
 }

 // The filters (a pick made twice reads once), the search in the stage after the typing
 // pauses, the grouping, and the next 200 as the list's end comes into view, joining their
 // groups; Updating… while a read runs.
 await test('the-list-works-1440-en',async()=>{
  const lang='en',list=labels('The list',lang),seen={};await setting({width:1440,theme:'light'});await open(page('02-prd',lang));
  let mark=report.reads.length;
  await click(chip('talk'));await waitFor(`document.querySelectorAll('.stage .li').length===3`);await settled();
  await click(chip('talk'));await sleep(300);seen.twice=readsOf('02-prd',mark);
  assert(seen.twice.length===1&&/filter=talk/.test(seen.twice[0]),'A filter picked twice reads once: '+JSON.stringify(seen.twice));
  await click(chip('all'));await waitFor(`document.querySelectorAll('.stage .li').length===200`);await settled();
  // The search reads once when the typing pauses (250 milliseconds), by ID or words.
  mark=report.reads.length;await type('.stage input[name=q]','req-04');await type('.stage input[name=q]','req-045');
  await waitFor(`document.querySelectorAll('.stage .li').length===1`);await settled();seen.search=await state();seen.searchReads=readsOf('02-prd',mark);
  assert(seen.search.rows[0]==='REQ-045'&&seen.searchReads.length===1&&/q=req-045/.test(seen.searchReads[0]),'The search in the stage: '+JSON.stringify({rows:seen.search.rows,reads:seen.searchReads}));
  await clearField('.stage input[name=q]');await waitFor(`document.querySelectorAll('.stage .li').length===200`);await settled();
  // Updating… while a read is held.
  held={pattern:stageApi('02-prd'),method:'GET',requests:[]};await click(chip('mine'));
  await waitFor(`document.querySelector('.stage .upd').textContent===${JSON.stringify(codeMessage('Updating',lang))}`);seen.updating=await shot('updating-1440-en');
  await release();await waitFor(`document.querySelectorAll('.stage .li').length===1`);await settled();
  await click(chip('all'));await waitFor(`document.querySelectorAll('.stage .li').length===200`);await settled();
  // The next 200 as the list's end comes into view: the later pages join their groups.
  mark=report.reads.length;await toEnd();await waitFor(`document.querySelectorAll('.stage .li').length===400`);await settled();
  seen.page2=await state();
  assert(seen.page2.groups.length===2&&seen.page2.groups[0].endsWith('225')&&seen.page2.groups[1].startsWith('CTX-002 Payment')&&seen.page2.more.text==='400 of 450','The second page joins its groups: '+JSON.stringify({groups:seen.page2.groups,more:seen.page2.more}));
  await toEnd();await waitFor(`document.querySelectorAll('.stage .li').length===450`);await settled();seen.page3=await state();
  assert(!seen.page3.more&&seen.page3.groups.length===3&&seen.page3.groups[2].startsWith(list[8])&&new Set(seen.page3.rows).size===450,'All 450, the last group without a context: '+JSON.stringify({groups:seen.page3.groups,more:seen.page3.more}));
  const sequence=readsOf('02-prd',mark);
  assert(sequence.length===2&&/after=200/.test(sequence[0])&&/after=400/.test(sequence[1]),'Each 200 read once: '+JSON.stringify(sequence));
  // In the source's order: no groups, the IDs in their order.
  await click('.stage .gm > summary');await click('.stage .gm [data-nx-group="source"]');
  await waitFor(`!document.querySelector('.stage .gh')&&document.querySelectorAll('.stage .li').length===200`);await settled();seen.source=await state();
  assert(seen.source.rows.slice(0,3).join()==='REQ-001,REQ-002,REQ-003'&&seen.source.group===list[6]&&!(await evaluate(`document.querySelector('.stage .gm').open`)),'In the source\'s order: '+JSON.stringify({rows:seen.source.rows.slice(0,3),group:seen.source.group}));
  // A row opens its address (#item=), selected in the list; the talk waits for TASK-276.
  await click('.stage .li[data-nx-item="REQ-002"]');await waitFor(`location.hash==='#item=REQ-002'&&!!document.querySelector('.stage .li[aria-current=true]')`);seen.selected=await state();
  assert(seen.selected.selected.join()==='REQ-002','The row selected: '+JSON.stringify(seen.selected.selected));
  return{evidence:'fixture server; one held read',seen:{twice:seen.twice,search:seen.search.rows,searchReads:seen.searchReads,page2:seen.page2.groups,page3:seen.page3.groups,sequence,source:seen.source.rows.slice(0,3),selected:seen.selected.selected},screenshot:seen.updating};
 });

 // The first page's links: #filter=left opens what is left, on a pictured stage too; #item=
 // selects its row after as many pages as it takes (SCR-110, SCR-113's data).
 await test('addresses-filter-left-and-item-390-ko',async()=>{
  const lang='ko',seen={};await setting({width:390,theme:'dark'});
  await open(page('02-prd',lang,'#filter=left'));seen.left=await state();
  assert(seen.left.chips.find(c=>c.pressed==='true')?.filter==='left'&&JSON.stringify(seen.left.rows)===JSON.stringify(left.items.entries.map(e=>e.id)),'#filter=left on 02: '+JSON.stringify({rows:seen.left.rows,chips:seen.left.chips}));
  const leftShot=await shot('filter-left-390-ko');
  await click(chip('all'));await waitFor(`document.querySelectorAll('.stage .li').length===200`);await settled();
  seen.picked=await evaluate('location.hash');assert(seen.picked==='','A filter that the user picks takes the address\'s place: '+seen.picked);
  await open(stagePath(project,part,'05-erd')+'?lang='+lang+'#filter=left');seen.erd=await state();
  seen.erdLinks=await evaluate(`[...document.querySelectorAll('.stage .li')].map(a=>a.getAttribute('href'))`);
  assert(seen.erd.chips.find(c=>c.pressed==='true')?.filter==='left'&&JSON.stringify(seen.erd.rows)===JSON.stringify(erdLeft.items.entries.map(e=>e.id))&&seen.erdLinks.every(h=>h.startsWith('#view=list&item=')),'#filter=left on a pictured stage: '+JSON.stringify({rows:seen.erd.rows,links:seen.erdLinks}));
  seen.erdMarks=await evaluate(`[...document.querySelectorAll('.stage .li')].map(a=>[a.dataset.nxItem,[...a.querySelectorAll('.tagm')].map(t=>t.className.replace('tagm ','')).join('+')].join(':'))`);
  assert(seen.erdMarks.join()==='TBL-001:my,TBL-002:refl','My turn and a pending reflection marked: '+seen.erdMarks.join());
  const erdShot=await shot('filter-left-erd-390-ko');
  const mark=report.reads.length;await open(page('02-prd',lang,'#item=REQ-450'));
  await waitFor(`!!document.querySelector('.stage .li[aria-current=true]')`);await settled();seen.item=await state();
  seen.inView=await evaluate(`(()=>{const a=document.querySelector('.stage .li[aria-current=true]'),l=document.querySelector('.stage .lw > .list'),r=a.getBoundingClientRect(),b=l.getBoundingClientRect();return r.top>=b.top-1&&r.bottom<=b.bottom+1;})()`);
  const itemReads=readsOf('02-prd',mark);
  assert(seen.item.selected.join()==='REQ-450'&&seen.item.rows.length===450&&seen.inView&&itemReads.filter(p=>/after=/.test(p)).length===2,'#item=REQ-450 selected after two more pages, in view: '+JSON.stringify({selected:seen.item.selected,rows:seen.item.rows.length,inView:seen.inView,reads:itemReads}));
  const itemShot=await shot('item-390-ko');
  await evaluate(`location.hash='#item=REQ-002'`);await waitFor(`document.querySelector('.stage .li[aria-current=true]')?.dataset.nxItem==='REQ-002'`);
  // An ID that the stage does not hold: the pages end, nothing is selected (SCR-115#gone in TASK-277).
  await open(page('02-prd',lang,'#item=REQ-999'));await settled();seen.gone=await state();
  assert(!seen.gone.selected.length&&!report.runtimeExceptions.length,'An ID that the stage does not hold selects nothing: '+JSON.stringify(seen.gone.selected));
  await noSideways('390');
  return{evidence:'fixture server',seen:{left:seen.left.rows,erd:seen.erd.rows,erdLinks:seen.erdLinks,erdMarks:seen.erdMarks,item:seen.item.selected,itemReads},screenshots:[leftShot,erdShot,itemShot]};
 });

 // SCR-113#stale: a newer push found when the list reads again keeps the list as it is drawn,
 // with the bar and Load again (SCR-111#stale), against the fixture server.
 await test('a-newer-push-keeps-the-list-until-load-again-1440-ko',async()=>{
  const lang='ko',seen={};await setting({width:1440,theme:'dark'});await open(page('02-prd',lang));
  const was=await evaluate(`JSON.parse(document.getElementById('view-data').textContent).data.project.pushed_at`);
  const pushed=await (await fetch(origin+'/__qa/push-again',{method:'POST',signal:AbortSignal.timeout(10000)})).json();
  const now=(await server('02-prd')).project.pushed_at;
  assert(pushed.name===project&&now&&now!==was,'The fixture pushed the project again: '+JSON.stringify({pushed,was,now}));
  await click(chip('talk'));await waitFor(`!!document.querySelector('.bars .bar.info')`);await settled();seen.stale=await state();
  assert(seen.stale.bars[0]?.text===label('Pushed again',0,lang,{time:clock(now)})&&seen.stale.bars[0].act==='load'&&seen.stale.rows.length===200&&seen.stale.chips[0].pressed==='true','The bar, and the list as it was drawn: '+JSON.stringify({bars:seen.stale.bars,rows:seen.stale.rows.length,chips:seen.stale.chips.map(c=>c.pressed)}));
  const mark=report.reads.length;await toEnd();await sleep(300);
  assert(!readsOf('02-prd',mark).length,'No next 200 after a newer push: '+JSON.stringify(readsOf('02-prd',mark)));
  const staleShot=await shot('newer-push-1440-ko'),loaded=loads;
  await click('.bars button[data-nx-act="load"]');for(const stop=Date.now()+10000;loads===loaded&&Date.now()<stop;)await sleep(25);
  await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await settled();seen.loaded=await state();
  const after=await evaluate(`JSON.parse(document.getElementById('view-data').textContent).data.project.pushed_at`);
  assert(loads>loaded&&!seen.loaded.bars.length&&after===now,'Load again shows the newer push: '+JSON.stringify({after,now,bars:seen.loaded.bars}));
  return{evidence:'fixture server (a real push again)',seen:{bar:seen.stale.bars,was,now},screenshot:staleShot};
 });

 // The stage record: in the side from 1,280 pixels, a panel over the stage's right edge from
 // 1,024 and a sheet under 1,024, with the focus on its heading, Escape, Close and the scrim,
 // and the focus back on Stage record (rule 10); Talk ({n}) from 1,024 to 1,279.
 await test('the-stage-record-in-the-side-panel-and-sheet',async()=>{
  const seen={},shots=[];
  for(const [width,lang,theme]of[[1440,'en','light'],[1152,'ko','light'],[390,'en','dark']]){
   const tag=`${width}-${lang}`;await setting({width,theme});await open(page('02-prd',lang));
   await click('.shd [data-nx-act="record"]');await waitFor(`document.querySelector('.ws').dataset.nxOpen==='record'&&!!document.querySelector('.side .rec')`);await paint();
   const s=await state(),L=await layout();seen[tag]={focus:s.focus,expanded:s.head.record.expanded,side:L.side,inert:L.inert,scrim:L.scrim,list:s.record.list};
   assert(s.focus==='rec-h'&&s.head.record.expanded==='true','The focus on the record\'s heading: '+JSON.stringify(seen[tag]));
   assert(s.record.list[0]?.length>0&&s.record.list[1]==='Review the synthetic requirements'&&s.record.boxes.length===1&&s.record.boxes[0].withdraw===qa.checkpoint&&s.record.passButton.text===codeMessage('Pass again',lang),'The record: its state, next action and the checkpoint that waits: '+JSON.stringify(s.record));
   if(width>=1280)assert(L.side.position!=='absolute'&&L.side.box[2]===400&&!L.inert.length,'From 1,280, in the side: '+JSON.stringify(L.side));
   else if(width>=1024)assert(L.side.position==='absolute'&&L.side.box[2]===400&&L.side.box[0]+L.side.box[2]===width&&!L.inert.length,'From 1,024, a panel over the stage\'s right edge: '+JSON.stringify(L.side));
   else assert(L.side.position==='fixed'&&L.side.box[1]+L.side.box[3]===L.height&&L.side.box[3]<=Math.ceil(L.height*.85)&&L.scrim&&['top','bars','rail','tabs','stage'].every(name=>L.inert.some(i=>i===name||i==='tb'&&name==='top')),'Under 1,024, a sheet; the page behind waits: '+JSON.stringify({side:L.side,inert:L.inert,scrim:L.scrim}));
   await noSideways('with the record '+tag);shots.push(await shot('record-'+tag));
   if(width<1024){
    // The scrim closes the sheet.
    await clickAt(Math.round(width/2),40);await waitFor(`!document.querySelector('.ws').dataset.nxOpen`);
   }else if(width>=1280){await key('Escape','Escape',27);await waitFor(`!document.querySelector('.ws').dataset.nxOpen`);}
   else{await click('.side .rec [data-nx-act="close"]');await waitFor(`!document.querySelector('.ws').dataset.nxOpen`);}
   const closed=await state(),C=await layout();seen[tag].closed={focus:closed.focus,inert:C.inert,side:C.side};
   assert(closed.focus==='record'&&!C.inert.length&&(width>=1280||!C.side),'Closed, the focus back on Stage record: '+JSON.stringify(seen[tag].closed));
   if(width>=1024&&width<1280){
    // Talk ({n}) opens the side over the stage's right edge, and Escape folds it again, with
    // the focus back on Talk ({n}); the talk joins the side in TASK-276.
    await click('.shd [data-nx-act="talk"]');await waitFor(`document.querySelector('.ws').dataset.nxOpen==='talk'`);const T=await layout();
    assert(T.side?.position==='absolute'&&T.side.box[2]===400&&T.side.box[0]+T.side.box[2]===width,'Talk (3) opens the side: '+JSON.stringify(T.side));
    await key('Escape','Escape',27);await waitFor(`!document.querySelector('.ws').dataset.nxOpen`);
    const folded=await state();assert(folded.focus==='talk'&&!(await layout()).side,'Escape folds the talk: '+JSON.stringify(folded.focus));seen[tag].talk=T.side;
   }
  }
  return{evidence:'fixture pages',seen,screenshots:shots};
 });

 // The stage's open checkpoint request in the record (TASK-300, SPEC-139, SPEC-197, TC-1502, and
 // the record's part of TC-1713 and TC-1716): above the words box, under the pass's heading, the
 // request's last entry whole, "Look at first", "Commit {commit}" and what is left in the stage,
 // each on a line of its own, inside the side and with nothing cut; on the pictured 05 (SCR-112)
 // with an address of another origin, shown cut after 120 characters, and on 04 (SCR-113) with
 // a requirement of 02. At 390 pixels in the sheet; at 1,152 in the panel, with the list of
 // stages shown and folded; at 1,280 with the talk folded, as a first visit leaves it, and shown
 // with the list folded; at 1,440 in the side; each in light English, dark Korean, dark English
 // and light Korean, 24 settings on each of the two stages. Where the talk is
 // shown, the request's entry shows the same link (SCR-114). The counts and the commit are the
 // server's answers; the request's text is the one that the fixture sent.
 const REQUEST=`(()=>{const rq=document.querySelector('.side .rec .rq');if(!rq)return null;const q=s=>rq.querySelector(s),txt=e=>e?e.textContent.replace(/\\s+/g,' ').trim():null;
  const a=q('.look a'),words=document.querySelector('.side .rec #cp-words'),side=document.querySelector('.side'),tx=q('.tx'),r=rq.getBoundingClientRect(),b=side.getBoundingClientRect();
  return{chip:txt(q('.hd .kind')),who:txt(q('.hd .who')),text:tx?.textContent??null,textFits:!!tx&&tx.scrollHeight<=tx.clientHeight+1&&tx.scrollWidth<=tx.clientWidth+1,
   look:a&&{label:txt(q('.look > .mu')),href:a.getAttribute('href'),text:a.textContent,act:a.dataset.nxAct||null,item:a.dataset.nxItem||null,target:a.getAttribute('target'),rel:a.getAttribute('rel')},
   commit:txt(q('.rqc')),left:txt(q('.rql')),lines:[...rq.children].map(e=>e.dataset.nxKey),tops:[...rq.children].map(e=>Math.round(e.getBoundingClientRect().top)),
   above:!!words&&!!(rq.compareDocumentPosition(words)&Node.DOCUMENT_POSITION_FOLLOWING)&&r.bottom<=words.getBoundingClientRect().top,
   heading:!!(document.querySelector('.side .rec h3[data-nx-key="ph"]')?.compareDocumentPosition(rq)&Node.DOCUMENT_POSITION_FOLLOWING),
   box:[r.x,r.y,r.width,r.height].map(Math.round),inside:r.left>=b.left-1&&r.right<=b.right+1,
   cut:[...rq.querySelectorAll('*')].filter(e=>e.clientWidth>0&&e.scrollWidth>e.clientWidth+1).map(e=>e.className||e.tagName)};})()`;
 const shownAddress=value=>{const rest=Array.from(value.slice('https://'.length));return rest.length>120?rest.slice(0,120).join('')+'…':rest.join('');};
 const lookOf=o=>o&&[o.label,o.href,o.text,o.act,o.item,o.target,o.rel].join('|');
 // The folds kept in the browser's storage (SPEC-210), which the next page applies.
 const keep=kept=>evaluate(`(()=>{const keys=${JSON.stringify(FOLD_KEYS)},kept=${JSON.stringify(kept)};for(const [name,key]of Object.entries(keys)){if(kept[name])localStorage.setItem(key,kept[name]);else localStorage.removeItem(key);}return location.origin;})()`);
 await test('the-request-whole-in-the-record',async()=>{
  const seen={},shots=[],requests={'05-erd':{id:qa.erdRequest,text:qa.texts.erdRequest,look:qa.address},'04-functional-spec':{id:qa.request,text:qa.texts.request,look:'REQ-001'}};
  const answers={'05-erd':await server('05-erd'),'04-functional-spec':await server('04-functional-spec')};
  try{
   for(const stage of['05-erd','04-functional-spec'])for(const [width,kept]of[[390,{}],[1152,{}],[1152,{stages:'folded'}],[1280,{}],[1280,{stages:'folded',talk:'shown'}],[1440,{}]])for(const [lang,theme]of[['en','light'],['ko','dark'],['en','dark'],['ko','light']]){
    const tag=`${stage.slice(0,2)}-${width}-${lang}-${theme}${Object.entries(kept).map(([name,value])=>`-${name}-${value}`).join('')}`,request=requests[stage],data=answers[stage],words=labels('A checkpoint request, whole',lang);
    assert(await keep(kept)===origin,'The folds are kept at the fixture\'s origin');
    await setting({width,theme});await open(stagePath(project,part,stage)+'?lang='+lang);
    const made=await evaluate(`(JSON.parse(document.getElementById('view-data').textContent).talk?.mine?.entries||[]).find(e=>e.comment?.id===${JSON.stringify(request.id)})?.comment?.made_at||null`);
    assert(made,'The page holds the request in its talk\'s my turn: '+request.id);
    const look=stage==='05-erd'?{label:words[0],href:request.look,text:shownAddress(request.look),act:null,item:null,target:'_blank',rel:'noopener noreferrer'}:{label:words[0],href:'#item=REQ-001',text:'REQ-001',act:'look',item:'REQ-001',target:null,rel:null};
    seen[tag]={};
    if(width>=1440||width>=1280&&kept.talk==='shown'){
     seen[tag].entry=await evaluate(`(()=>{const li=document.querySelector('.side li[data-nx-entry="${request.id}"]'),a=li?.querySelector(':scope > .look a');return a&&{label:li.querySelector(':scope > .look > .mu').textContent.trim(),href:a.getAttribute('href'),text:a.textContent,act:a.dataset.nxAct||null,item:a.dataset.nxItem||null,target:a.getAttribute('target'),rel:a.getAttribute('rel')};})()`);
     assert(lookOf(seen[tag].entry)===lookOf(look),'The request\'s entry in the talk shows the link: '+JSON.stringify({entry:seen[tag].entry,look}));
    }
    await clickShown(RECORD);await waitFor(`!!document.querySelector('.side .rec .rq')`);await paint();
    const r=await evaluate(REQUEST);seen[tag].request=r;
    const left=[label('A checkpoint request, whole',2,lang,{n:count(data.record.discrepancies.total)}),label('A checkpoint request, whole',3,lang,{n:count(Math.max(0,data.record.comments.total-1))}),label('A checkpoint request, whole',4,lang,{n:count(data.record.reflections.total)})].join(' · ');
    assert(r.chip===labels("An entry's kind",lang)[3]&&r.who===labels('Author and time',lang)[0]+' · '+clock(made),'The request\'s kind, the agent and the time: '+JSON.stringify({chip:r.chip,who:r.who}));
    assert(r.text===request.text&&r.textFits,'Its last entry whole, in its lines: '+JSON.stringify({text:r.text,fits:r.textFits}));
    assert(lookOf(r.look)===lookOf(look),'Look at first: '+JSON.stringify({shown:r.look,look}));
    assert(typeof data.project.commit==='string'&&r.commit===label('The head',2,lang,{commit:data.project.commit.slice(0,7)}),'The commit that a pass names: '+JSON.stringify({shown:r.commit,commit:data.project.commit}));
    assert(r.left===words[1]+' '+left,'What is left in the stage, the request left out of the comments: '+JSON.stringify({shown:r.left,record:{discrepancies:data.record.discrepancies.total,comments:data.record.comments.total,reflections:data.record.reflections.total}}));
    assert(r.lines.join()==='rqh,rqt,look,commit,rql'&&r.tops.every((top,i)=>!i||top>r.tops[i-1]),'Each on a line of its own: '+JSON.stringify({lines:r.lines,tops:r.tops}));
    assert(r.above&&r.heading&&r.inside&&!r.cut.length,'Under the pass\'s heading, above the words box, inside the side, nothing cut: '+JSON.stringify(r));
    await noSideways('with the request '+tag);shots.push(await shot('request-'+tag));
   }
  }finally{await keep({});}
  return{evidence:'fixture pages; the counts and the commit as the server answers them',seen,screenshots:shots};
 });

 // Rule 22's item, pressed by the keyboard in the record of 04, which does not hold it: the record
 // gives way, the item's address is a step of the browser's history, and the item's panel leads
 // to 02, which holds it (SCR-115's Target), with its row selected and its panel open; the
 // browser's Back returns to 04.
 await test('look-at-first-an-item-of-another-stage-1440-en',async()=>{
  const lang='en',at=stagePath(project,part,'04-functional-spec'),prd=stagePath(project,part,'02-prd');
  await setting({width:1440,theme:'dark'});await open(at+'?lang='+lang);
  const mark=report.reads.length;
  await clickShown(RECORD);await waitFor(`!!document.querySelector('.side .rec .rq .look a')`);
  await press('.side .rec .rq .look a');
  await waitFor(`location.pathname===${JSON.stringify(prd)}&&location.hash==='#item=REQ-001'&&document.documentElement?.dataset.nxCode==='ready'`,15000);await settled();
  await waitFor(`document.querySelector('.stage .li[aria-current=true]')?.dataset.nxItem==='REQ-001'&&document.querySelector('.side #item-h .id')?.textContent==='REQ-001'`);await paint();
  const s=await state(),reads=report.reads.slice(mark).map(r=>r.path).filter(p=>p.includes('/items/REQ-001'));
  assert(s.selected.join()==='REQ-001'&&!s.record&&reads.length>=1,'02 holds the item: its row selected, its panel open, the record closed: '+JSON.stringify({selected:s.selected,record:!!s.record,reads}));
  const itemShot=await shot('look-item-1440-en');
  await evaluate('history.back()');await waitFor(`location.pathname===${JSON.stringify(at)}&&location.hash===''&&document.documentElement?.dataset.nxCode==='ready'`,15000);await settled();
  const back=await state();
  assert(back.nolist?.key==='empty'&&!back.record&&!back.selected.length,'Back returns to 04: '+JSON.stringify({nolist:back.nolist,record:!!back.record}));
  return{evidence:'fixture pages and reads',seen:{selected:s.selected,reads,back:{path:at,nolist:back.nolist?.key}},screenshot:itemShot};
 });

 // Rule 2: the server writes UTC; the code writes the same elements in the browser's time
 // zone, here Asia/Seoul, and nothing moves. It runs while the fixture's checkpoint waits, so
 // that the head holds a day as well as a time.
 await test('times-in-the-browsers-time-zone',async()=>{
  await setting({width:1440});await command('Emulation.setTimezoneOverride',{timezoneId:'Asia/Seoul'});
  try{
   // The fonts stay out, so that only the code differs (they join after the first paint).
   held={pattern:code,requests:[]};failing=[fonts];await open(page('02-prd','en'),{ready:false});
   for(const stop=Date.now()+10000;!held.requests.length&&Date.now()<stop;)await sleep(25);
   const read=`[...document.querySelectorAll('.stage time')].map(t=>{const r=t.getBoundingClientRect();return{datetime:t.getAttribute('datetime'),day:t.hasAttribute('data-nx-day'),text:t.textContent,box:[r.x,r.y,r.width,r.height].map(Math.round)};})`;
   const before=await evaluate(read);await release();await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await settled();await paint();const after=await evaluate(read);
   assert(before.length>=2&&before.length===after.length&&before.some(t=>t.day)&&before.some(t=>!t.day),'The head holds a time and a day: '+JSON.stringify(before));
   const seoul=value=>new Date(Date.parse(value)+9*3600000).toISOString().slice(0,16).replace('T',' ');
   before.forEach((t,i)=>{
    assert(t.text===(t.day?day(t.datetime):clock(t.datetime)),'Before the code, UTC: '+JSON.stringify(t));
    assert(after[i].text===(t.day?seoul(t.datetime).slice(0,10):seoul(t.datetime)),'After, Seoul: '+JSON.stringify(after[i]));
    assert(after[i].box[3]===t.box[3],'A time changed its height: '+JSON.stringify([t,after[i]]));
   });
   return{evidence:'fixture page',times:after.map(t=>({datetime:t.datetime,seoul:t.text}))};
  }finally{await command('Emulation.setTimezoneOverride',{timezoneId:'UTC'});}
 });

 // Passing and withdrawing (SPEC-138, SPEC-139): the words kept across a reload (rule 5), one
 // write ID for every try and a new one after write_id_reused (rule 4), the refusals and an
 // expired sign-in with the words kept, then real passes and withdrawals at the fixture.
 await test('pass-and-withdraw-390-ko-dark',async()=>{
  const lang='ko',seen={},since=report.posts.length,shots=[],words='합성 확인 지점: 요구사항 450개를 검토했고 남은 질문은 대화에 적었습니다.';
  await setting({width:390,theme:'dark'});await open(page('02-prd',lang));
  await evaluate(`localStorage.clear()`);await open(page('02-prd',lang));
  await click('.shd [data-nx-act="record"]');await waitFor(`!!document.querySelector('.side .rec #cp-words')`);
  await type('#cp-words',words);await sleep(50);
  await open(page('02-prd',lang));await click('.shd [data-nx-act="record"]');await waitFor(`!!document.querySelector('.side .rec #cp-words')`);
  seen.kept=await state();assert(seen.kept.record.words===words,'The words kept across a reload: '+JSON.stringify(seen.kept.record.words));
  // Near and past the limit (rule 5): the characters left, then the limit and no Pass.
  await type('#cp-words','가'.repeat(1990));await paint();seen.near=await state();
  assert(seen.near.record.left===codeMessage('Characters left',lang,{n:10})&&!seen.near.record.passButton.disabled,'From 90 per cent, the characters left: '+JSON.stringify(seen.near.record.left));
  await type('#cp-words','가'.repeat(2001));await paint();seen.over=await state();
  assert(seen.over.record.passButton.disabled&&seen.over.record.invalid==='true'&&seen.over.record.left===codeMessage('text_too_long',lang,{limit:'2,000'}),'Past the limit: '+JSON.stringify({left:seen.over.record.left,pass:seen.over.record.passButton}));
  shots.push(await shot('over-the-limit-390-ko'));
  await type('#cp-words',words);await paint();
  const pass=()=>click('.side .rec .r2 [data-nx-act="pass"]'),passed=async()=>{await waitFor(`!!document.querySelector('.side .rec .pnote .msg')||document.querySelector('.side .rec #cp-words')?.value===''`);await settled();return state();};
  // Refused: only the user, signed in themself.
  responses=[{method:'POST',pattern:/\/checkpoints$/,once:true,...problem(403,'user_only')}];
  await pass();seen.userOnly=await passed();
  assert(seen.userOnly.record.pass?.tone==='warn'&&seen.userOnly.record.pass.text===codeMessage('user_only',lang)&&!seen.userOnly.record.pass.retry&&seen.userOnly.record.words===words,'user_only: '+JSON.stringify(seen.userOnly.record.pass));
  // The server's error, with Try again; Sending… meanwhile; then write_id_reused.
  responses=[{method:'POST',pattern:/\/checkpoints$/,once:true,...problem(500,'internal')}];
  await pass();seen.internal=await passed();
  assert(seen.internal.record.pass?.tone==='err'&&seen.internal.record.pass.role==='alert'&&seen.internal.record.pass.retry==='pass'&&seen.internal.record.pass.trace===codeMessage('Trace ID',lang,{traceId:'tr_qa_internal'}),'internal: '+JSON.stringify(seen.internal.record.pass));
  shots.push(await shot('pass-error-390-ko'));
  held={pattern:/\/checkpoints$/,method:'POST',requests:[]};
  responses=[{method:'POST',pattern:/\/checkpoints$/,once:true,...problem(409,'write_id_reused')}];
  // The mocked answer comes first; the held rule then catches the next try.
  await click('.side .rec .pnote [data-nx-act="pass"]');seen.reused=await passed();
  assert(seen.reused.record.pass?.text===codeMessage('write_id_reused',lang)&&seen.reused.record.pass.retry==='pass','write_id_reused: '+JSON.stringify(seen.reused.record.pass));
  // A sign-in that expired while passing: the message with Sign in again, the words kept.
  held=null;responses=[{method:'POST',pattern:/\/checkpoints$/,once:true,...expired}];
  await click('.side .rec .pnote [data-nx-act="pass"]');seen.signIn=await passed();
  assert(seen.signIn.record.pass?.text===codeMessage('Sign-in expired',lang)&&seen.signIn.record.pass.signIn&&seen.signIn.record.words===words,'An expired sign-in keeps the words: '+JSON.stringify(seen.signIn.record.pass));
  // The real pass, held first to see Sending… and a second press that sends nothing.
  held={pattern:/\/checkpoints$/,method:'POST',requests:[]};await pass();
  await waitFor(`document.querySelector('.side .rec .r2 [data-nx-act="pass"]')?.getAttribute('aria-disabled')==='true'`);seen.sending=await state();await pass();await sleep(150);
  assert(seen.sending.record.passButton.text===codeMessage('Sending',lang)&&held.requests.length===1,'Sending…, and a second press sends nothing: '+JSON.stringify({button:seen.sending.record.passButton,held:held.requests.length}));
  shots.push(await shot('sending-390-ko'));
  await release();await waitFor(`document.querySelector('.side .rec #cp-words')?.value===''`);await settled();
  await waitFor(`document.querySelectorAll('.side .rec .wbox').length===2`);seen.passed=await state();
  const keys=postsTo(checkpoints,since).map(post=>post.write);
  assert(keys.length===5&&new Set(keys.slice(0,3)).size===1&&keys[3]===keys[4]&&keys[3]!==keys[0]&&keys.every(k=>/^"nw_[0-9a-z]{12}"$/.test(k)),'One write ID for every try, and a new one after write_id_reused: '+JSON.stringify(keys));
  // The pass names the commit that the page showed and, with no request open on 02, no request
  // (TASK-301, SPEC-194); the record's line names that commit.
  const body=JSON.parse(postsTo(checkpoints,since).at(-1).body),shownCommit=first.project.commit;
  assert(body.part===part&&body.stage==='02-prd'&&body.words===words&&body.commit===shownCommit&&!('revision' in body)&&!('comment' in body)&&!('entry' in body),'The pass sends the words and the commit that the page showed: '+JSON.stringify(body));
  const newer=seen.passed.record.boxes.find(b=>b.withdraw!==qa.checkpoint)?.withdraw,newerData=newer?(await serverGet(api+'/checkpoints/'+newer)).data:null;
  assert(newer&&newerData?.state==='passed'&&newerData.words===words&&seen.passed.record.boxes.every(b=>!b.warn)&&seen.passed.head.waiting===codeMessage('Waiting for its record',lang,{date:day(newerData.passed_at)})&&!seen.passed.record.pass,'The new checkpoint waits for its record too: '+JSON.stringify({boxes:seen.passed.record.boxes,waiting:seen.passed.head.waiting}));
  // The kind of browser and device of the real pass (TASK-299, SPEC-195, TC-1741): the page
  // sends what navigator.webdriver says, the server reads this browser's own headers, and the
  // record shows the kind under the date, a line each under 1,024 pixels and one line from
  // 1,024. The fixture's pass sent no User-Agent, so the record says so.
  const webdriver=await evaluate('navigator.webdriver'),kindWords=labels('The kind of browser and device',lang);
  const kindOf=(boxes,id)=>boxes.find(b=>b.withdraw===id)||{},newBox=kindOf(seen.passed.record.boxes,newer),oldBox=kindOf(seen.passed.record.boxes,qa.checkpoint);
  seen.kind={webdriver,sent:body.driven,stored:[newerData.browser,newerData.device,newerData.driven],seen:newBox.seen,shown:newBox.kind,tops:newBox.lineTops,fixture:oldBox.kind};
  assert(typeof webdriver==='boolean'&&body.driven===webdriver&&newerData.driven===webdriver&&newerData.browser==='chrome'&&newerData.device==='desktop','The pass records the kind of this browser: '+JSON.stringify(seen.kind));
  const shownKind=[kindWords[0]+', '+kindWords[8],...(webdriver?[kindWords[10]]:[])];
  assert(JSON.stringify(newBox.kind)===JSON.stringify(shownKind)&&newBox.lineTops.length===1+shownKind.length&&new Set(newBox.lineTops).size===newBox.lineTops.length,'Its record shows the commit and the kind, a line each at 390 pixels: '+JSON.stringify(seen.kind));
  assert(JSON.stringify(oldBox.kind)===JSON.stringify([kindWords[5]+', '+kindWords[9]]),'The fixture\'s pass, without a User-Agent, is unknown: '+JSON.stringify(oldBox));
  const commitLine=label('The head',2,lang,{commit:shownCommit.slice(0,7)});
  assert(newBox.seen===commitLine&&oldBox.seen===commitLine&&!newBox.answers&&!oldBox.answers,'Each line names the commit that it passed, and no request: '+JSON.stringify({commitLine,newBox,oldBox}));
  shots.push(await shot('passed-kind-390-ko'));
  await setting({width:1440,theme:'dark'});await open(page('02-prd',lang));
  await click('.shd [data-nx-act="record"]');await waitFor(`document.querySelectorAll('.side .rec .wbox').length===2`);await paint();
  const wide=kindOf((await state()).record.boxes,newer);seen.kindWide={seen:wide.seen,shown:wide.kind,tops:wide.lineTops};
  assert(wide.seen===newBox.seen&&JSON.stringify(wide.kind)===JSON.stringify(shownKind)&&wide.lineTops[0]===wide.lineTops[1]&&wide.lineTops.every((top,i)=>!i||top>=wide.lineTops[i-1]),'From 1,024 pixels, one line that wraps: '+JSON.stringify(seen.kindWide));
  shots.push(await shot('passed-kind-1440-ko'));
  await setting({width:390,theme:'dark'});await open(page('02-prd',lang));
  await click('.shd [data-nx-act="record"]');await waitFor(`document.querySelectorAll('.side .rec .wbox').length===2`);await settled();
  // Withdraw the fixture's checkpoint: Withdrawn on {date}; read again, the record no longer
  // holds it, since no stage record names it (API-158's record).
  await click(`.side .rec .wbox [data-nx-checkpoint="${qa.checkpoint}"]`);
  await waitFor(`!!document.querySelector('.side .rec .rnote .msg')`);await settled();seen.withdrawn=await state();
  assert(seen.withdrawn.record.note?.text===codeMessage('Withdrawn',lang,{date:day(new Date().toISOString())})&&seen.withdrawn.record.boxes.length===1&&seen.withdrawn.record.boxes[0].withdraw===newer,'Withdrawn on {date}: '+JSON.stringify(seen.withdrawn.record));
  shots.push(await shot('withdrawn-390-ko'));
  // Recorded meanwhile (mocked), then withdrawn by another tab: Already withdrawn.
  responses=[{method:'POST',pattern:new RegExp(withdrawOf(newer)+'$'),once:true,...problem(409,'checkpoint_recorded')}];
  await click(`.side .rec .wbox [data-nx-checkpoint="${newer}"]`);await waitFor(`document.querySelector('.side .rec .rnote .msg')?.classList.contains('warn')`);await settled();seen.recorded=await state();
  assert(seen.recorded.record.note.text===codeMessage('checkpoint_recorded',lang),'checkpoint_recorded: '+JSON.stringify(seen.recorded.record.note));
  await otherTab(withdrawOf(newer));
  await click(`.side .rec .wbox [data-nx-checkpoint="${newer}"]`);
  await waitFor(`document.querySelector('.side .rec .rnote .msg .t')?.textContent===${JSON.stringify(codeMessage('Already withdrawn',lang))}`);await settled();seen.already=await state();
  const held2=[];for(const id of[qa.checkpoint,newer]){const got=await serverGet(api+'/checkpoints/'+id);held2.push([id,got.data?.state]);}
  assert(held2.every(([,s])=>s==='withdrawn')&&!seen.already.record.boxes.length&&!seen.already.head.waiting&&seen.already.record.passButton.text===labels('The stage record',lang)[4],'The server holds both withdrawn, and nothing waits: '+JSON.stringify({held2,boxes:seen.already.record.boxes,meta:seen.already.head.meta}));
  const withdrawKeys=postsTo(withdrawOf(newer),since).map(post=>post.write);
  assert(withdrawKeys.length===2&&withdrawKeys[0]===withdrawKeys[1],'Each try of one withdrawal sends its write ID: '+JSON.stringify(withdrawKeys));
  await noSideways('390');
  return{evidence:'mocked refusals and failures, then the fixture server (real passes and withdrawals); write IDs as sent',seen:{keys,withdrawKeys,checkpoints:held2,kind:seen.kind,kindWide:seen.kindWide},screenshots:shots};
 });

 // Rule 14 at 390 pixels: a finger hits each control 21 pixels around its centre.
 await test('hit-areas-at-390',async()=>{
  await setting({width:390,touch:true});await open(page('02-prd','ko'));
  await waitFor(`!!document.querySelector('link[data-nexus-css="fonts"]')?.sheet&&document.fonts.status==='loaded'`);await paint();
  const probe=`((scope)=>{const controls=[...document.querySelectorAll(scope)].filter(e=>e.checkVisibility({visibilityProperty:true})).slice(0,12);
   return controls.map(e=>{e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    const misses=[[0,-21],[0,21],[-21,0],[21,0]].filter(([dx,dy])=>{const hit=document.elementFromPoint(x+dx,y+dy);return!hit||!(hit===e||e.contains(hit));});
    return{name:(e.textContent.trim()||e.getAttribute('aria-label')||e.className).slice(0,40),box:[r.x,r.y,r.width,r.height].map(Math.round),misses};});})`;
  const checked=[];
  for(const [name,scope]of[['filters','.stage .chip'],['search','.stage .find'],['grouping','.stage .gm > summary'],['stage record','.shd [data-nx-act="record"]'],['rows','.stage .li'],['tabs','.tabs .tab']]){
   const found=await evaluate(probe+'('+JSON.stringify(scope)+')');checked.push({name,found:found.length});
   assert(found.length>0,'No '+name);for(const c of found)assert(!c.misses.length,`${name}: ${c.name} misses ${JSON.stringify(c.misses)} at ${JSON.stringify(c.box)}`);
  }
  // The record's controls in the sheet.
  await click('.shd [data-nx-act="record"]');await waitFor(`document.querySelector('.ws').dataset.nxOpen==='record'`);await paint();
  const sheet=await evaluate(probe+'('+JSON.stringify('.side .rec button')+')');checked.push({name:'record',found:sheet.length});
  for(const c of sheet)assert(!c.misses.length,`record: ${c.name} misses ${JSON.stringify(c.misses)} at ${JSON.stringify(c.box)}`);
  const heights=await evaluate(`[...document.querySelectorAll('.side .rec button')].map(e=>Math.round(e.getBoundingClientRect().height))`);
  const sheetShot=await shot('hit-areas-390'),lookShots=[];
  // The link to look at first in the request's sheet, an item's ID on 04 and an address of three
  // lines on 05 (TASK-300).
  for(const stage of['04-functional-spec','05-erd']){
   await open(stagePath(project,part,stage)+'?lang=ko');await waitFor(`!!document.querySelector('link[data-nexus-css="fonts"]')?.sheet&&document.fonts.status==='loaded'`);
   await clickShown(RECORD);await waitFor(`!!document.querySelector('.side .rec .rq .look a')`);await paint();
   const looks=await evaluate(probe+'('+JSON.stringify('.side .rec .rq .look a')+')');checked.push({name:'look at first on '+stage,found:looks.length,box:looks[0]?.box});
   assert(looks.length===1,'No link to look at first on '+stage);for(const c of looks)assert(!c.misses.length,`look at first on ${stage}: ${c.name} misses ${JSON.stringify(c.misses)} at ${JSON.stringify(c.box)}`);
   lookShots.push(await shot('hit-areas-look-'+stage.slice(0,2)+'-390'));
  }
  return{evidence:'fixture pages, touch emulation',checked,heights,screenshots:[sheetShot,...lookShots]};
 });

 // Rule 22's address, pressed (TASK-300; the suite's evidence for TC-1780, which stays a case by
 // hand): before the press no request of the page went to the address's origin; the press opens
 // a new tab that cannot reach the page, whose one request is the address itself, without a
 // Referer, and which the suite fails, so that the address is never loaded; the page stays where
 // it was, with its record open, and asks that origin nothing. The link's rel, noopener
 // noreferrer, which the record's test reads, is a second guard: the page's own Referrer-Policy is
 // no-referrer, and Chrome opens a link to a new tab without an opener.
 await test('look-at-first-an-address-in-a-new-tab-1440-ko',async()=>{
  const lang='ko',host=new URL(qa.address).origin,seen={};await setting({width:1440,theme:'light'});
  await open(stagePath(project,part,'05-erd')+'?lang='+lang);
  await clickShown(RECORD);await waitFor(`!!document.querySelector('.side .rec .rq .look a')`);await paint();
  const where=await evaluate('location.href');
  seen.before={blocked:[...report.blockedExternalOrigins]};
  assert(!report.blockedExternalOrigins.includes(host),'Before the press, no request to the address\'s origin: '+JSON.stringify(seen.before));
  watching=true;opened=null;
  try{
   await command('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},false);
   await click('.side .rec .rq .look a');
   for(const stop=Date.now()+10000;!opened?.requests.length&&Date.now()<stop;)await sleep(25);
   seen.opened=opened&&{opener:opened.opener===tabId?'the page':opened.opener,canAccessOpener:opened.canAccessOpener,requests:opened.requests};
   assert(opened?.requests.length===1&&opened.requests[0].url===qa.address&&opened.requests[0].method==='GET'&&opened.requests[0].referer===null,'The press opens the whole address in a new tab, without a Referer: '+JSON.stringify(seen.opened));
   assert(opened.canAccessOpener!==true,'The new tab cannot reach the page (noopener): '+JSON.stringify(seen.opened));
  }finally{
   watching=false;
   await command('Target.setAutoAttach',{autoAttach:false,waitForDebuggerOnStart:false,flatten:true},false).catch(()=>{});
   if(opened?.target)await command('Target.closeTarget',{targetId:opened.target},false).catch(()=>{});
   await command('Target.activateTarget',{targetId:tabId},false).catch(()=>{});
  }
  await paint();
  seen.after=await evaluate(`({href:location.href,open:document.querySelector('.ws')?.dataset.nxOpen||null})`);
  assert(seen.after.href===where&&seen.after.open==='record'&&!report.blockedExternalOrigins.includes(host),'The page stays, with its record, and asks the address\'s origin nothing: '+JSON.stringify({after:seen.after,blocked:report.blockedExternalOrigins}));
  return{evidence:'fixture page; the new tab\'s one request recorded by the suite and failed (BlockedByClient), so that the address was never loaded',seen,screenshot:await shot('look-address-1440-ko')};
 });

 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.blockedExternalOrigins.length,'The page asked another origin: '+report.blockedExternalOrigins.join());
 assert(!report.runtimeExceptions.length,'The page threw: '+JSON.stringify(report.runtimeExceptions));
 const expected=6+1+1+1+1+1+1+1+1+1+1;
 report.status=report.tests.length===expected&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 closing=true;
 try{if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();await browser.stop();report.browserExited=true;}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
