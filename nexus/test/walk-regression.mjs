/**
 * TASK-278: the walk of the redesign's 53 states, SCR-110 to SCR-117 (stage 08), each in a
 * browser at 390 and 1,440 pixels, SCR-111's at 1,152 too, in the light and the dark theme and
 * in English and Korean, with stage 12's page checks: the page does not scroll sideways, no
 * element is drawn outside it, the console holds no error that the state did not cause, and at
 * 390 pixels, with touch, each control that a finger can select takes it 21 pixels around its
 * centre (rule 14). Each state is reached as its definition names it: from the fixture's own
 * data, from a real failure or refusal of the server (a database that fails every query, a
 * request without Access's assertion), from a request that the suite holds or fails, or from an
 * answer that the suite gives itself, which the report lists as mocked. Each state's frame is
 * kept to be looked at. A group also measures its page when the page's code does not load
 * (rule 15). The suite reads and answers; it sends no write to the fixture but the push of
 * SCR-111#stale, which the fixture makes as the agent would.
 *
 * One group per run, named by the first argument, on the opt-in view-server with the group's
 * fixture: home (NEXUS_QA_HOME=1), hub (NEXUS_QA_HOME=1 and NEXUS_QA_STAGE=1), workspace and
 * document (NEXUS_QA_STAGE=1), picture (NEXUS_QA_PICTURE=1), talk (NEXUS_QA_TALK=1), item and
 * search (NEXUS_QA_ITEM=1). Node 24 built-ins only; an owned headless Chrome over CDP. Requires
 * NEXUS_CHROME and NEXUS_QA_ORIGIN. Synthetic loopback fixture only.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {label,labels,codeMessage,notCurrentWhy} from '../src/draw/words.js';
import {stagePath} from '../src/draw/stages.js';
import {words} from '../ui/messages.js';
import {SIDEWAYS,OUTSIDE,HITS} from './page-checks.mjs';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
const GROUPS=['home','workspace','document','picture','talk','item','search','hub'];
const group=process.argv[2];
if(!GROUPS.includes(group))throw Error('Name one group: '+GROUPS.join(', '));
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin;
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'walk-'+group+'-');
const {folder,profile}=browser;
const report={schema:'nexus-walk-browser-regression/1',scope:'synthetic loopback fixture only',group,
 evidence:'page measurement and screenshots of each state; each test names how its state was reached: the fixture\'s data, a real failure or refusal of the fixture server, a request that the suite held or failed, or an answer that the suite gave itself (mocked)',
 startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],blockedExternalOrigins:[],posts:[],otherTab:[],runtimeExceptions:[],console:[]};
const budget=Number(process.env.NEXUS_QA_WALK_BUDGET_MS)||300000,softDeadline=Date.now()+budget;
let ws,session,seq=0,held=null,failing=[],responses=[],closing=false;
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
async function waitFor(expression,timeout=10000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await evaluate(expression).catch(()=>false))return true;await sleep(25);}return false;}
async function paint(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function setting({width,theme}){
 await command('Emulation.setDeviceMetricsOverride',{width,height:width<1024?844:900,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
 // A phone is touched: the hit areas of rule 14 are measured with touch, as a finger selects.
 await command('Emulation.setTouchEmulationEnabled',width<1024?{enabled:true,maxTouchPoints:1}:{enabled:false});
}
async function shot(name){const image=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(folder,name+'.png'),Buffer.from(image.data,'base64'));return name+'.png';}
async function release(){const active=held;held=null;if(!active)return;for(const id of active.requests){try{await command('Fetch.continueRequest',{requestId:id});}catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;}}}
const problem=(status,code,extra={})=>({status,headers:[{name:'Content-Type',value:'application/problem+json'}],body:JSON.stringify({type:'about:blank',title:'Synthetic refusal',status,code,traceId:'tr_qa_'+code,...extra})});
// The rules match a request's path with its query.
async function onPaused(event){
 const url=new URL(event.request.url),method=event.request.method,where=url.pathname+url.search;
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(method==='POST')report.posts.push({path:url.pathname,at:new Date().toISOString()});
 if(failing.some(pattern=>pattern.test(where))){report.interceptions.push({path:where,method,action:'failed',at:new Date().toISOString()});await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'ConnectionRefused'});return;}
 const rule=responses.find(r=>r.method===method&&r.pattern.test(where));
 if(rule){
  if(rule.once)responses.splice(responses.indexOf(rule),1);
  report.interceptions.push({path:where,method,action:'mocked '+rule.status,at:new Date().toISOString()});
  await command('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:rule.status,responseHeaders:rule.headers,body:Buffer.from(rule.body||'').toString('base64')});return;
 }
 if(held&&held.pattern.test(where)&&(!held.method||held.method===method)){held.requests.push(event.requestId);report.interceptions.push({path:where,method,action:'held',at:new Date().toISOString()});return;}
 // A request that the page dropped while it was paused has no interception left to continue:
 // Chrome answers "Invalid InterceptionId", which is recorded, not a failure.
 try{await command('Fetch.continueRequest',{requestId:event.requestId});}
 catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;report.interceptions.push({path:where,method,action:'dropped by the page',at:new Date().toISOString()});}
}
// A control by the mouse, at its centre; the first one shown that the selector finds.
async function click(selector){
 const at=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}));if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'No control to click: '+selector);
 for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x:at.x,y:at.y,button:'left',clickCount:1});
 await paint();
}
// Words typed into a field, as a person types them.
async function type(selector,text){
 const found=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.scrollIntoView({block:'center'});e.focus();e.select?.();return document.activeElement===e;})()`);
 assert(found,'No field to type in: '+selector);await command('Input.insertText',{text});
}

// The page checks of each state: ./page-checks.mjs.

// The words of a page's message (rule 9).
const MESSAGE=`(()=>{const m=document.querySelector('main.content.refusal');if(!m)return null;return{lang:document.documentElement.lang,h1:m.querySelector('h1')?.textContent||null,trace:m.querySelector('p.meta')?.textContent||null,
 controls:[...m.querySelectorAll('p.controls a.control')].map(a=>({text:a.textContent,href:a.getAttribute('href')})),scripts:document.scripts.length,sheets:document.querySelectorAll('link[rel=stylesheet]').length};})()`;
// The page has settled: no reading runs, no item loads and a picture shown is drawn, has
// failed or is not there; the fonts that the code adds are in.
const SETTLED=`(()=>{const q=s=>document.querySelector(s),shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});
 if(['.stage .upd','.side .tupd','.home .upd'].some(s=>(q(s)?.textContent||'')!==''))return false;
 if(q('.side .item .sk')&&shown(q('.side .item')))return false;
 const pf=q('.pf');if(shown(pf)&&!q('.pf > .cv.drawn, .pf .empty-p, .pf .fnote .msg.warn'))return false;
 const fonts=q('link[data-nexus-css="fonts"]');if(fonts&&(!fonts.sheet||document.fonts.status!=='loaded'))return false;
 return true;})()`;

const COMBOS=[['light','en'],['dark','ko'],['dark','en'],['light','ko']];
const consoleSince=()=>report.console.length;
async function fresh(lang,cookies={}){
 await command('Page.navigate',{url:'about:blank'});
 await command('Storage.clearDataForOrigin',{origin,storageTypes:'cookies,local_storage,session_storage,indexeddb,cache_storage'});
 for(const [name,value]of Object.entries({'nexus-qa-lang':lang,...cookies}))await command('Network.setCookie',{name,value,url:origin,path:'/'});
}

// One state in one setting: reach it, wait for what it shows, then the page checks and the frame.
async function walk(state,width,theme,lang){
 const file=`${state.id.replace('#','-')}-${width}-${theme}-${lang}`,name=`${state.id}@${width}-${theme}-${lang}`;
 const startedAt=new Date().toISOString(),since={console:consoleSince(),interceptions:report.interceptions.length,exceptions:report.runtimeExceptions.length};
 let shotName=null;
 try{
  await fresh(lang,state.cookies||{});await setting({width,theme});
  const c=context({width,theme,lang});
  const seen=await state.run(c);
  await paint();
  const sideways=await evaluate(SIDEWAYS),outside=await evaluate(OUTSIDE);
  shotName=await shot(file);
  const hits=width===390?await evaluate(HITS):null;
  await release();await sleep(60);
  // The console: errors that the state did not cause. A network error of a request that the
  // suite answered, failed or held, or that the state names, is the state's own.
  const induced=report.interceptions.slice(since.interceptions).map(i=>i.path.split('?')[0]);
  const expected=[...(state.network||[]),...(c.network||[])];
  const entries=report.console.slice(since.console);
  const own=entry=>entry.kind==='log'&&entry.source==='network'&&entry.url&&(()=>{const u=new URL(entry.url);return induced.includes(u.pathname)||expected.some(p=>p.test(u.pathname+u.search));})();
  const errors=entries.filter(entry=>entry.level==='error'&&!own(entry)&&!(state.exception&&entry.kind==='exception'&&state.exception.test(entry.text)));
  const result={sideways,outside,console:{entries:entries.length,errors,own:entries.filter(own).map(e=>e.text.slice(0,120))},hits};
  assert(sideways.scrollWidth<=sideways.width&&sideways.bodyWidth<=sideways.width,'The page scrolls sideways: '+JSON.stringify(sideways));
  assert(!outside.length,'Elements outside the page: '+JSON.stringify(outside));
  assert(!errors.length,'Console errors that the state did not cause: '+JSON.stringify(errors));
  assert(!hits||!hits.missed.some(m=>!m.inline),'Hit areas under 44 pixels (rule 14): '+JSON.stringify(hits&&hits.missed.filter(m=>!m.inline)));
  report.tests.push({name,state:state.id,width,theme,lang,verdict:'works',startedAt,finishedAt:new Date().toISOString(),reached:state.reached,seen,checks:result,screenshot:shotName});
  console.log('PASS '+name);
 }catch(error){
  try{shotName=shotName||await shot(file+'-failure');}catch{}
  try{await release();}catch{}
  report.tests.push({name,state:state.id,width,theme,lang,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),reached:state.reached,error:String(error),screenshot:shotName});
  console.error('FAIL '+name+': '+error);
 }finally{held=null;failing=[];responses=[];}
 await out('results.json',report);
}

// What a state's recipe works with.
function context({width,theme,lang}){
 const c={width,theme,lang,network:[],
  // A page of the redesign: its data, its code ready unless the state holds or fails it, and settled.
  async go(route,{code=true,settle=true}={}){
   // The page's code may write the address after # again; the page is the same.
   const url=origin+route,base=url.split('#')[0];await command('Page.navigate',{url});
   assert(await waitFor(`location.href.split('#')[0]===${JSON.stringify(base)}&&document.readyState!=='loading'&&!!document.getElementById('view-data')`,15000),'The page did not arrive: '+route);
   if(code){assert(await waitFor(`document.documentElement.dataset.nxCode==='ready'`,15000),'The page\'s code did not run: '+route);if(settle)await c.settle();}
   await paint();
  },
  async settle(timeout=20000){assert(await waitFor(SETTLED,timeout),'The page did not settle');await paint();},
  // A page's message (rule 9): the code's message, the trace ID and its ways on, no script.
  async message(route,code,ways){
   const url=origin+route;await command('Page.navigate',{url});
   assert(await waitFor(`location.href===${JSON.stringify(url)}&&!!document.querySelector('main.content.refusal > h1')`,15000),'No message page: '+route);
   c.network.push(new RegExp('^'+route.split('#')[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'));
   const m=await evaluate(MESSAGE),again=lang==='ko'?'다시 불러오기':'Load again';
   assert(m.lang===lang&&m.h1===codeMessage(code,lang)&&m.trace?.length>0&&!m.scripts&&!m.sheets,'The message page of '+code+': '+JSON.stringify(m));
   assert(JSON.stringify(m.controls.map(a=>a.href))===JSON.stringify(ways)&&m.controls[0].text===again,'Its ways on: '+JSON.stringify(m.controls));
   return{h1:m.h1,ways:m.controls.map(a=>a.text)};
  },
  // Wait for what the state shows.
  async mark(expression,what,timeout=10000){assert(await waitFor(expression,timeout),'Not reached: '+what);await paint();},
  read:evaluate,click,type,
  hold(pattern,method){held={pattern,method,requests:[]};},
  async held(){for(const stop=Date.now()+10000;!held?.requests.length&&Date.now()<stop;)await sleep(25);assert(held?.requests.length>=1,'The page did not ask for what the suite holds: '+held?.pattern);},
  fail(pattern){failing.push(pattern);},
  mock(method,pattern,answer,once=false){responses.push({method,pattern,once,...answer});},
  // Under 1,024 pixels the talk is a tab of its own.
  async talkTab(){if(width<1024){await click('.tabs .tab[data-nx-tab="talk"]');await c.settle();}},
 };
 return c;
}
const text=selector=>`(document.querySelector(${JSON.stringify(selector)})?.textContent||'').replace(/\\s+/g,' ').trim()`;
const is=(selector,words)=>`${text(selector)}===${JSON.stringify(words)}`;
const has=selector=>`!!document.querySelector(${JSON.stringify(selector)})`;
const count=selector=>`document.querySelectorAll(${JSON.stringify(selector)}).length`;
const esc=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

let codeEntry,editorCode,qa;
const S=(screen,name,reached,run,more={})=>({id:screen+'#'+name,screen,name,reached,run,...more});
// The page's code does not load (rule 15): the page reads as drawn, and the bar says so after
// its wait.
const codeFails=(screen,route,place)=>S(screen,'code-not-loaded','the page\'s code failed by the suite (ConnectionRefused)',async c=>{
 c.fail(codeEntry);await c.go(route(c.lang),{code:false});
 await c.mark(`getComputedStyle(document.querySelector('[data-nx-codebar]')).visibility==='visible'`,'the bar of rule 15',12000);
 const seen=await c.read(`({code:document.documentElement.dataset.nxCode||null,bar:${text('[data-nx-codebar] .t')},links:${count('a[href]')}})`);
 assert(seen.code===null&&seen.bar===label('Buttons not loaded',0,c.lang)&&seen.links>0,'The page reads without its code, with the bar: '+JSON.stringify(seen));
 return{...seen,place};
},{extra:true});

function states(){
 const home=qa.home,stage=qa.stage,picture=qa.picture,talk=qa.talk,item=qa.item;
 const pages={
  home:[
   S('SCR-110','loading','the page\'s code held by the suite',async c=>{
    c.hold(codeEntry);await c.go('/',{code:false});await c.held();
    await c.mark(`!document.documentElement.dataset.nxCode&&[...document.querySelectorAll('.home button')].filter(b=>b.dataset.nxWait).every(b=>b.disabled)&&${count('.home button[data-nx-wait]')}>=12`,'the answers wait for the code');
    return{waiting:await c.read(count('.home button[data-nx-wait]')),links:await c.read(count('.home a[href]'))};
   }),
   S('SCR-110','normal','the fixture\'s data',async c=>{
    await c.go('/');await c.mark(`${count('[data-nx-entry]')}>=10&&${count('.pcard')}>=2&&!${has('[data-nx-entry] button[disabled]')}`,'my turn and the cards');
    return{entries:await c.read(count('[data-nx-entry]')),cards:await c.read(count('.pcard'))};
   }),
   S('SCR-110','nothing-waits','the fixture\'s second server, with a project and nothing for the user',async c=>{
    await c.go('/');await c.mark(`${text('.empty-l')}.includes(${JSON.stringify(labels('Nothing waits',c.lang)[0])})&&${count('[data-nx-entry]')}===0&&${count('.pcard')}===1`,'nothing waits');
    return{words:await c.read(text('.empty-l'))};
   },{cookies:{'nexus-qa-space':'quiet'}}),
   S('SCR-110','empty','the fixture\'s third server, without a snapshot',async c=>{
    await c.go('/');await c.mark(`${is('.emp .lead',labels('Nothing pushed',c.lang)[0])}&&${count('.hsteps li')}===4`,'the four steps');
    return{lead:await c.read(text('.emp .lead'))};
   },{cookies:{'nexus-qa-space':'empty'}}),
   S('SCR-110','stale','the fixture\'s page; the proposal\'s Accept answered 409 proposal_not_open by the suite (mocked)',async c=>{
    await c.go('/');c.mock('POST',new RegExp('^/api/spaces/'+home.project+'/proposals/'+home.stale+'/accept$'),problem(409,'proposal_not_open',{state:'accepted'}));
    await click(`[data-nx-entry="${home.stale}"] button[data-nx-act="accept"]`);
    const want=codeMessage('proposal_not_open',c.lang,{state:labels('Proposal states',c.lang)[1]});
    await c.mark(is(`[data-nx-entry="${home.stale}"] .msg .t`,want),'no longer open, under the entry');await c.settle();
    return{message:want};
   }),
   S('SCR-110','error','a real failure: the fixture\'s database fails every query (internal)',async c=>c.message('/','internal',['']),{cookies:{'nexus-qa-space':'broken'}}),
   S('SCR-110','permission','a real refusal: the request comes without Access\'s assertion (access_missing)',async c=>c.message('/','access_missing',['']),{cookies:{'nexus-qa-access':'none'}}),
  ],
  workspace:[
   S('SCR-111','loading','the project\'s address, which answers 302 to its current stage; the page\'s code held by the suite',async c=>{
    c.hold(codeEntry);await command('Page.navigate',{url:origin+'/p/'+stage.project});
    await c.mark(`location.pathname.startsWith(${JSON.stringify('/p/'+stage.project+'/'+stage.part+'/')})&&!!document.getElementById('view-data')`,'the current stage');await c.held();
    await c.mark(`!document.documentElement.dataset.nxCode&&${has('.stage .shd [data-nx-act=record][data-nx-wait]')}&&(${c.width>=1024}?${count('.rail .row')}===13:${has('.tabs .tab')})`,'the frame, the record waiting for the code');
    return{path:await c.read('location.pathname')};
   }),
   S('SCR-111','normal','the fixture\'s data',async c=>{
    await c.go(stagePath(stage.project,stage.part,'02-prd'));
    await c.mark(c.width>=1024?`${count('.rail .row')}===13&&${count('.stage .li')}===200`:`${count('.tabs .tab')}>=2&&${count('.stage .li')}===200`,'the list of stages or the tabs, and the stage');
    return{rows:await c.read(count('.rail .row')),tabs:await c.read(count('.tabs .tab'))};
   }),
   S('SCR-111','unrecorded','the fixture\'s project without recorded progress, whose address answers 302 to stage 01',async c=>{
    await command('Page.navigate',{url:origin+'/p/'+stage.unrecorded});
    await c.mark(`location.pathname===${JSON.stringify(stagePath(stage.unrecorded,'sample','01-domain'))}&&document.documentElement.dataset.nxCode==='ready'`,'stage 01',15000);await c.settle();
    if(c.width<1024)await click('a.ttl.only-ph');
    await c.mark(is('.rail .unrec',label('No progress',0,c.lang))+`&&document.querySelector('.rail .unrec').checkVisibility()`,'no progress recorded yet, above the list');
    return{words:await c.read(text('.rail .unrec'))};
   }),
   S('SCR-111','stale','the fixture\'s page; the fixture pushes the project again, as the agent would; the list reads again',async c=>{
    await c.go(stagePath(stage.project,stage.part,'02-prd'));
    const pushed=await fetch(origin+'/__qa/push-again',{method:'POST',signal:AbortSignal.timeout(10000)});report.otherTab.push({path:'/__qa/push-again',status:pushed.status});
    assert(pushed.ok,'The fixture did not push again');
    await click('.stage .chip[data-nx-filter="talk"]');
    await c.mark(`[...document.querySelectorAll('.bars .bar:not([data-nx-codebar])')].some(b=>!!b.querySelector('button[data-nx-act=load]'))`,'pushed again, with Load again');await c.settle();
    return{bar:await c.read(text('.bars .bar:not([data-nx-codebar]) .t'))};
   }),
   S('SCR-111','error','a real answer: a stage key outside the 13 (not_found)',async c=>c.message(stagePath(stage.project,stage.part,'14-other'),'not_found',['','/'])),
   S('SCR-111','permission','a real refusal: the request comes without Access\'s assertion (access_missing)',async c=>c.message(stagePath(stage.project,stage.part,'02-prd'),'access_missing',['','/']),{cookies:{'nexus-qa-access':'none'}}),
  ],
  document:[
   S('SCR-113','loading','the page\'s code held by the suite',async c=>{
    c.hold(codeEntry);await c.go(stagePath(stage.project,stage.part,'02-prd'),{code:false});await c.held();
    await c.mark(`!document.documentElement.dataset.nxCode&&${count('.stage .li')}===200&&[...document.querySelectorAll('.stage .chip')].every(b=>b.disabled&&b.dataset.nxWait==='list')`,'the list as drawn, its controls waiting');
    return{rows:200};
   }),
   S('SCR-113','normal','the fixture\'s data',async c=>{
    await c.go(stagePath(stage.project,stage.part,'02-prd'));
    await c.mark(`${count('.stage .li')}===200&&![...document.querySelectorAll('.stage .chip')].some(b=>b.disabled)`,'the list and its filters');
    return{rows:200,more:await c.read(text('.stage .more'))};
   }),
   S('SCR-113','empty','the fixture\'s stage without items',async c=>{
    await c.go(stagePath(stage.project,stage.part,'04-functional-spec'));await c.mark(has('.stage .nolist[data-nx-key=empty]'),'no items yet');
    return{words:await c.read(text('.stage .nolist p'))};
   }),
   S('SCR-113','not-read','the fixture\'s stage that the project does not read',async c=>{
    await c.go(stagePath(stage.project,stage.part,'03-user-flow'));await c.mark(has('.stage .nolist[data-nx-key=not-read]'),'not read, with Stage record');
    return{words:await c.read(text('.stage .nolist p'))};
   }),
   S('SCR-113','no-match','the fixture\'s list, searched for words that it does not hold',async c=>{
    await c.go(stagePath(stage.project,stage.part,'02-prd'));await type('.stage input[name=q]','zzq');
    await c.mark(has('.stage .nolist[data-nx-key=no-match]'),'nothing matches',15000);await c.settle();
    return{words:await c.read(text('.stage .nolist p'))};
   }),
   S('SCR-113','stale','the fixture\'s checkpoint passed in NEXUS that no record names; Stage record opened',async c=>{
    await c.go(stagePath(stage.project,stage.part,'02-prd'));await c.mark(`${text('.stage .shd .meta > .wait')}!==''`,'the head says it waits for its record');
    await click('.stage .shd [data-nx-act=record]');await c.mark(`document.querySelector('.ws')?.dataset.nxOpen==='record'&&${has('.side .rec .wbox')}`,'the record with the checkpoint that waits');
    return{head:await c.read(text('.stage .shd .meta > .wait')),box:await c.read(text('.side .rec .wbox b'))};
   }),
   S('SCR-113','error','the fixture\'s page; the list\'s next reading answered 500 internal by the suite (mocked)',async c=>{
    await c.go(stagePath(stage.project,stage.part,'02-prd'));
    c.mock('GET',new RegExp('^/api/spaces/'+stage.project+'/stages/'+stage.part+'/02-prd\\?'),problem(500,'internal'),true);
    await click('.stage .chip[data-nx-filter="talk"]');
    await c.mark(`${has('.stage .notes .bar.err')}&&${text('.stage .notes .bar.err .t')}.startsWith(${JSON.stringify(codeMessage('Could not update',c.lang))})`,'could not update, with Try again');await c.settle();
    return{bar:await c.read(text('.stage .notes .bar .t'))};
   }),
   S('SCR-113','permission','the fixture\'s page; the list\'s next reading answered 403 access_missing by the suite (mocked)',async c=>{
    await c.go(stagePath(stage.project,stage.part,'02-prd'));
    c.mock('GET',new RegExp('^/api/spaces/'+stage.project+'/stages/'+stage.part+'/02-prd\\?'),problem(403,'access_missing'),true);
    await click('.stage .chip[data-nx-filter="mine"]');
    await c.mark(`${has('.stage .notes .bar.warn')}&&${text('.stage .notes .bar.warn .t')}.startsWith(${JSON.stringify(codeMessage('access_missing',c.lang))})`,'the code\'s message in the bar');await c.settle();
    return{bar:await c.read(text('.stage .notes .bar .t'))};
   }),
  ],
  picture:[
   S('SCR-112','loading','the editor\'s code held by the suite',async c=>{
    c.hold(editorCode);await c.go(stagePath(picture.project,picture.part,'05-erd'),{settle:false});await c.held();
    await c.mark(`${is('.pf .fnote .t',label('The editor',0,c.lang))}&&${count('.pf svg.board a[href^="#item="]')}>=2`,'the server\'s picture, the editor loading');
    return{note:label('The editor',0,c.lang)};
   }),
   S('SCR-112','normal','the fixture\'s data',async c=>{
    await c.go(stagePath(picture.project,picture.part,'05-erd'));await c.mark(`${has('.pf > .cv.drawn')}&&${count('.pf svg.mks .mk')}>=1`,'the picture drawn, with its marks',20000);
    return{marks:await c.read(count('.pf svg.mks .mk'))};
   }),
   S('SCR-112','large','the fixture\'s sitemap of 320 screens',async c=>{
    await c.go(stagePath(picture.states,'sample','07-sitemap'));await c.mark(is('.stage .pbars .bar.info .t',words('Large',c.lang,{n:320})),'large',20000);
    return{bar:words('Large',c.lang,{n:320})};
   }),
   S('SCR-112','empty','the fixture\'s ERD, left out for its size',async c=>{
    await c.go(stagePath(picture.states,'sample','05-erd'));await c.mark(is('.pf .empty-p p',words('picture_not_found:size',c.lang)),'no picture, why, and List');
    return{words:words('picture_not_found:size',c.lang)};
   }),
   S('SCR-112','stale','the fixture\'s DDD board, which the last push left out: not current',async c=>{
    await c.go(stagePath(picture.states,'sample','01-domain'));await c.mark(is('.stage .pbars .bar.warn .t',notCurrentWhy('source-gone','aaaaaaa',c.lang)),'the commit that the picture shows, and why',20000);
    return{bar:notCurrentWhy('source-gone','aaaaaaa',c.lang)};
   }),
   S('SCR-112','error','a real failure: the fixture\'s database fails every query (internal)',async c=>c.message(stagePath(picture.project,picture.part,'05-erd'),'internal',['','/']),{cookies:{'nexus-qa-space':'broken'}}),
   S('SCR-112','code-failed','the editor\'s code failed by the suite (ConnectionRefused)',async c=>{
    c.fail(editorCode);await c.go(stagePath(picture.project,picture.part,'05-erd'),{settle:false});
    await c.mark(is('.pf .fnote .msg.warn .t',label('The editor',1,c.lang)),'the editor could not load',15000);await c.settle();
    return{note:label('The editor',1,c.lang)};
   }),
   S('SCR-112','permission','the fixture\'s page; the pass answered 403 user_only by the suite (mocked)',async c=>{
    await c.go(stagePath(picture.project,picture.part,'05-erd'));
    await click(c.width>=1024?'.ptools [data-nx-act="record"]':'.stage [data-nx-act="record"]');
    await c.mark(`document.querySelector('.ws')?.dataset.nxOpen==='record'&&${has('#cp-words')}`,'the stage record');
    const said=c.lang==='ko'?'합성 확인: 그림을 봤습니다':'Synthetic pass: the picture is seen';
    await type('#cp-words',said);
    c.mock('POST',new RegExp('^/api/spaces/'+picture.project+'/checkpoints$'),problem(403,'user_only'));
    await click('.side .rec .r2 [data-nx-act="pass"]');
    await c.mark(`${is('.side .rec .pnote .msg .t',codeMessage('user_only',c.lang))}&&document.getElementById('cp-words').value===${JSON.stringify(said)}`,'only you, the words kept');await c.settle();
    return{message:codeMessage('user_only',c.lang)};
   }),
  ],
  talk:[
   // Under 1,024 pixels the talk is opened by its tab, a link to #talk: Chrome marks the target of a
   // first page's address only when its deferred code has run or failed, so an address with #talk
   // shows the list while the code loads.
   S('SCR-114','loading','the page\'s code held by the suite; under 1,024 pixels the talk opened by its tab',async c=>{
    c.hold(codeEntry);await c.go(stagePath(talk.project,talk.part,'02-prd'),{code:false});await c.held();
    if(c.width<1024)await click('.tabs .tab[data-nx-tab="talk"]');
    await c.mark(`!document.documentElement.dataset.nxCode&&document.querySelector('.side .talk')?.checkVisibility()&&${count('[data-nx-wait="talk"]')}>=1&&[...document.querySelectorAll('[data-nx-wait="talk"]')].every(b=>b.disabled)`,'the talk as drawn, its controls waiting');
    return{waiting:await c.read(count('[data-nx-wait="talk"]'))};
   }),
   S('SCR-114','normal','the fixture\'s data',async c=>{
    await c.go(stagePath(talk.project,talk.part,'02-prd'));await c.talkTab();
    await c.mark(`${is('#talk-h',labels('The talk',c.lang)[0])}&&${count('.side .talk li[data-nx-entry]')}>=5`,'the talk with my turn and the agent\'s');
    return{entries:await c.read(count('.side .talk li[data-nx-entry]'))};
   }),
   S('SCR-114','narrowed','the fixture\'s question on REQ-002, opened from the talk',async c=>{
    await c.go(stagePath(talk.project,talk.part,'02-prd'));await c.talkTab();
    await click(`li[data-nx-entry="${talk.question}"] .ref`);
    // From 1,024 pixels the item's panel holds the narrowed talk, with its own heading (SCR-115).
    await c.mark(`[...document.querySelectorAll('#talk-h,#itk-h')].some(h=>h.checkVisibility()&&h.textContent===${JSON.stringify(label('Narrowed',0,c.lang,{id:'REQ-002'}))})&&location.hash===${JSON.stringify(`#talk=${talk.question}&item=REQ-002`)}`,'talk on REQ-002');await c.settle();
    return{heading:label('Narrowed',0,c.lang,{id:'REQ-002'})};
   }),
   S('SCR-114','empty','the fixture\'s DDD board, without talk',async c=>{
    await c.go(stagePath(talk.project,talk.part,'01-domain'));await c.talkTab();
    await c.mark(`${text('.side .empty-t')}!==''`,'no talk on this stage yet');
    return{words:await c.read(text('.side .empty-t p'))};
   }),
   S('SCR-114','stale','the fixture\'s ERD talk; Accept answered 409 proposal_not_open by the suite (mocked)',async c=>{
    await c.go(stagePath(talk.project,talk.part,'05-erd'));await c.talkTab();
    c.mock('POST',new RegExp('^/api/spaces/'+talk.project+'/proposals/'+talk.stale+'/accept$'),problem(409,'proposal_not_open',{state:'dismissed'}));
    await click(`li[data-nx-entry="${talk.stale}"] [data-nx-act="accept"]`);
    const want=codeMessage('proposal_not_open',c.lang,{state:labels('Proposal states',c.lang)[2]});
    await c.mark(`[...document.querySelectorAll('li[data-nx-entry="${talk.stale}"] .msg .t')].some(t=>t.textContent===${JSON.stringify(want)})`,'no longer open, in its place');await c.settle();
    return{message:want};
   }),
   S('SCR-114','error','the fixture\'s page; the comment answered 500 internal by the suite (mocked)',async c=>{
    await c.go(stagePath(talk.project,talk.part,'02-prd'));await c.talkTab();
    const said=c.lang==='ko'?'합성 의견: 서버 오류로 실패':'Synthetic comment that the server fails';
    await type('#talk-text',said);c.mock('POST',new RegExp('^/api/spaces/'+talk.project+'/comments$'),problem(500,'internal'));
    await click('.side [data-nx-act="leave"]');
    await c.mark(`${is('.side .talk > .box .bnote .msg.err .t',codeMessage('internal',c.lang))}&&document.getElementById('talk-text').value===${JSON.stringify(said)}`,'the code\'s message above the box, the words kept');await c.settle();
    return{message:codeMessage('internal',c.lang)};
   }),
   S('SCR-114','permission','the fixture\'s page; the comment answered 403 no_kind by the suite (mocked)',async c=>{
    await c.go(stagePath(talk.project,talk.part,'02-prd'));await c.talkTab();
    const said=c.lang==='ko'?'합성 의견: 권한이 없어 거절됨':'Synthetic comment that Access refuses';
    await type('#talk-text',said);c.mock('POST',new RegExp('^/api/spaces/'+talk.project+'/comments$'),problem(403,'no_kind'));
    await click('.side [data-nx-act="leave"]');
    await c.mark(`${is('.side .talk > .box .bnote .msg .t',codeMessage('no_kind',c.lang))}&&document.getElementById('talk-text').value===${JSON.stringify(said)}`,'the code\'s message above the box, the words kept');await c.settle();
    return{message:codeMessage('no_kind',c.lang)};
   }),
   S('SCR-114','gone','a real answer: an address that names a comment not on the server (comment_not_found)',async c=>{
    await c.go(stagePath(talk.project,talk.part,'02-prd')+'#talk=nc_000000000000');await c.talkTab();
    await c.mark(is('.side .tnotes .msg .t',codeMessage('comment_not_found',c.lang)),'not on the server, above the talk');
    return{message:codeMessage('comment_not_found',c.lang)};
   },{network:[/\/comments\/nc_000000000000/]}),
  ],
  item:[
   S('SCR-115','loading','the item\'s reading held by the suite',async c=>{
    c.hold(new RegExp('^/api/spaces/'+item.project+'/items/REQ-001\\?'));await c.go(stagePath(item.project,item.part,'02-prd')+'#item=REQ-001',{settle:false});await c.held();
    await c.mark(`${is('.side .item .ih .id','REQ-001')}&&${has('.side .item .sk')}&&${text('.side .item [data-nx-key="loading"]')}!==''`,'the ID, kind and text, grey lines');
    return{words:await c.read(text('.side .item [data-nx-key="loading"]'))};
   }),
   S('SCR-115','normal','the fixture\'s data',async c=>{
    await c.go(stagePath(item.project,item.part,'02-prd')+'#item=REQ-001');
    await c.mark(`${is('.side .item .ih .id','REQ-001')}&&${count('.side .item .fields > dt')}>=3`,'the item with its fields');
    return{fields:await c.read(count('.side .item .fields > dt'))};
   }),
   S('SCR-115','gone','a real answer: an ID that no stage holds (item_not_found)',async c=>{
    await c.go(stagePath(item.project,item.part,'02-prd')+'#item=REQ-999');
    await c.mark(`${is('.side .item .ih .id','REQ-999')}&&${has('.side .item [data-nx-key="gone"] .msg')}`,'not in this project\'s stages now');
    return{words:await c.read(text('.side .item [data-nx-key="gone"] .msg .t'))};
   },{network:[/\/items\/REQ-999\?/]}),
   S('SCR-115','error','the fixture\'s page; the item\'s reading answered 500 internal by the suite (mocked)',async c=>{
    c.mock('GET',new RegExp('^/api/spaces/'+item.project+'/items/REQ-001\\?'),problem(500,'internal'));
    await c.go(stagePath(item.project,item.part,'02-prd')+'#item=REQ-001');
    await c.mark(is('.side .item [data-nx-key="failed"] .msg .t',codeMessage('internal',c.lang)),'the code\'s message with Try again');
    return{message:codeMessage('internal',c.lang)};
   }),
   S('SCR-115','permission','the fixture\'s page; the item\'s reading answered 403 access_missing by the suite (mocked)',async c=>{
    c.mock('GET',new RegExp('^/api/spaces/'+item.project+'/items/REQ-001\\?'),problem(403,'access_missing'));
    await c.go(stagePath(item.project,item.part,'02-prd')+'#item=REQ-001');
    await c.mark(is('.side .item [data-nx-key="refused"] .msg .t',codeMessage('access_missing',c.lang)),'the code\'s message');
    return{message:codeMessage('access_missing',c.lang)};
   }),
  ],
  search:[
   S('SCR-116','loading','the search held by the suite',async c=>{
    c.hold(/^\/api\/search\?/);await c.go('/#q=refund',{settle:false});await c.held();
    await c.mark(is('.tb .spanel .st',labels('The search',c.lang)[0]),'searching');
    return{status:labels('The search',c.lang)[0]};
   }),
   S('SCR-116','normal','the fixture\'s two projects that hold REQ-001',async c=>{
    await c.go('/#q=req-001');await c.mark(`${count('.tb .spanel .ms .m')}>=2&&!document.querySelector('.tb .spanel').hidden`,'the matches');
    return{status:await c.read(text('.tb .spanel .st'))};
   }),
   S('SCR-116','short','one character, which the page does not send',async c=>{
    await c.go('/#q=r');await c.mark(is('.tb .spanel .pad > p',labels('The search',c.lang)[3]),'type at least two characters');
    return{words:labels('The search',c.lang)[3]};
   }),
   S('SCR-116','empty','the fixture\'s data, which nothing matches',async c=>{
    await c.go('/#q=zzzz');await c.mark(is('.tb .spanel .pad > p',label('The search',4,c.lang,{q:'zzzz'})),'nothing matches, with Look in the full checks');
    return{words:label('The search',4,c.lang,{q:'zzzz'})};
   }),
   S('SCR-116','error','the search answered 500 internal by the suite (mocked)',async c=>{
    c.mock('GET',/^\/api\/search\?/,problem(500,'internal'));await c.go('/#q=refund');
    await c.mark(`${is('.tb .spanel .pad .msg .t',codeMessage('internal',c.lang))}&&${has('.tb .spanel [data-nx-search-act="retry"]')}`,'the code\'s message with Try again');
    return{message:codeMessage('internal',c.lang)};
   }),
   S('SCR-116','permission','the search answered 403 access_missing by the suite (mocked)',async c=>{
    c.mock('GET',/^\/api\/search\?/,problem(403,'access_missing'));await c.go('/#q=refund');
    await c.mark(is('.tb .spanel .pad .msg .t',codeMessage('access_missing',c.lang)),'the code\'s message');
    return{message:codeMessage('access_missing',c.lang)};
   }),
  ],
  hub:[
   S('SCR-117','normal','the fixture\'s data',async c=>{
    await command('Page.navigate',{url:origin+'/hub'});await c.mark(`${count('article.card')}>=3&&document.readyState==='complete'`,'the cards',15000);
    return{cards:await c.read(count('article.card'))};
   }),
   S('SCR-117','empty','the fixture\'s third server, without a snapshot',async c=>{
    await command('Page.navigate',{url:origin+'/hub'});await c.mark(`document.readyState==='complete'&&${count('article.card')}===0&&document.getElementById('projects').textContent.includes('nexus.push')`,'the four steps',15000);
    return{steps:await c.read(`document.querySelectorAll('#projects li').length`)};
   },{cookies:{'nexus-qa-space':'empty'}}),
   S('SCR-117','stale','the fixture\'s picture whose newest source is in another repository, and its checkpoint that waits for its record',async c=>{
    await command('Page.navigate',{url:origin+'/hub'});
    await c.mark(`document.readyState==='complete'&&${text('#meta')}!==''&&${has('article.card p.alert')}`,'built at, and not current',15000);
    await c.read(`document.querySelector('article.card p.alert').scrollIntoView({block:'center'})`);
    return{meta:await c.read(text('#meta')),alert:await c.read(text('article.card p.alert'))};
   }),
   S('SCR-117','error','a real failure: the fixture\'s database fails every query (internal)',async c=>c.message('/hub','internal',['','/']),{cookies:{'nexus-qa-space':'broken'}}),
   S('SCR-117','permission','a real refusal: the request comes without Access\'s assertion (access_missing)',async c=>c.message('/hub','access_missing',['','/']),{cookies:{'nexus-qa-access':'none'}}),
  ],
 };
 const extra={
  home:[codeFails('SCR-110',()=>'/','the first page')],
  document:[codeFails('SCR-113',()=>stagePath(stage.project,stage.part,'02-prd'),'the document stage')],
  picture:[codeFails('SCR-112',()=>stagePath(picture.project,picture.part,'05-erd'),'the picture stage')],
 };
 return{states:pages[group],extra:extra[group]||[]};
}

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json();
 qa=fixture;
 const needs={home:['home'],hub:['home','stage'],workspace:['stage'],document:['stage'],picture:['picture'],talk:['talk'],item:['item'],search:['item']}[group];
 assert(needs.every(key=>fixture[key]?.project),'The origin is not the opt-in synthetic fixture of the group '+group+': it needs '+needs.join(' and '));
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),entries=JSON.parse(metadataBytes).entries;
 assert(/^\/code\/page\.[a-f0-9]{8}\.js$/.test(entries['page-js']||''),'Content-hashed page code is required');
 codeEntry=new RegExp('^'+esc(entries['page-js'])+'$');editorCode=/^\/code\/(?:erd|excalidraw)[.-]/;
 report.preflight={fixture:Object.fromEntries(needs.map(key=>[key,fixture[key]])),build:{entries:{'page-js':entries['page-js']},sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
 const browserEnv={...process.env};for(const key of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(key))delete browserEnv[key];
 // Each state opens a new page: Chrome's back-forward cache kept the pages left behind, and with
 // them the large picture's canvases, 13.4 GB at most where one page takes 4.7 (BUG-601).
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
 await command('Page.enable');await command('Runtime.enable');await command('Log.enable');await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 // The times stay in the server's UTC.
 await command('Emulation.setTimezoneOverride',{timezoneId:'UTC'});

 const {states:list,extra}=states();
 for(const state of list)for(const width of state.screen==='SCR-111'?[390,1152,1440]:[390,1440])for(const [theme,lang]of COMBOS)await walk(state,width,theme,lang);
 for(const state of extra)for(const [width,theme,lang]of[[390,'light','en'],[1440,'dark','ko']])await walk(state,width,theme,lang);
 const expected=list.reduce((n,state)=>n+(state.screen==='SCR-111'?3:2)*COMBOS.length,0)+extra.length*2;
 report.summary={states:list.map(s=>s.id),runs:report.tests.length,expected,works:report.tests.filter(t=>t.verdict==='works').length,
  hits:report.tests.filter(t=>t.checks?.hits).reduce((sum,t)=>({probed:sum.probed+t.checks.hits.probed,covered:sum.covered+t.checks.hits.covered,alike:sum.alike+t.checks.hits.alike,missed:sum.missed+t.checks.hits.missed.length}),{probed:0,covered:0,alike:0,missed:0})};
 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.blockedExternalOrigins.length,'The page asked another origin: '+report.blockedExternalOrigins.join());
 report.status=report.tests.length===expected&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 closing=true;
 try{if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();await browser.stop();report.browserExited=true;}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,group,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,runs:report.tests.length,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
