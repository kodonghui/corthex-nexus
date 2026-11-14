/**
 * TASK-301: a pass bound to what the page showed (SPEC-194, SPEC-196), in a browser. The stage's
 * record sends with the pass the commit that the page showed, or the snapshot's revision where it
 * names none, and the open checkpoint request with the place of its last entry; while a request
 * is open, the pass is named for the stage.
 *
 * SCR-112#stale and SCR-113#stale (TC-1714, TC-1717), on the pictured 05 and on 04 in the 24
 * settings of stage 12's cases (390, 1,152 and 1,280 pixels with each fold, and 1,440, each in
 * both themes and languages): the agent's hub pushes another commit, or the agent asks again on
 * the request, after the page was drawn, and the real server refuses the pass. The refusal shows
 * above the words box, the words stay and nothing is recorded; after a push, SCR-111#stale's bar
 * and the refusal's own Load again, with the pass off; after a newer entry, the request as it is
 * now. SCR-112#error and SCR-113#error (TC-1715, TC-1718) in the same settings:
 * comment_not_found, reply_limit and space_full, which the suite answers (mocked), and the real
 * server's invalid_request for a pass that names no commit, as a page of before the release sends
 * it, which the suite makes by taking commit, comment and entry out of the page's body on its way
 * (TC-1760's page half), with Load again. Each setting runs stage 12's page checks
 * (./page-checks.mjs) and keeps a screenshot.
 *
 * Then, at the real server: Load again after that refusal, and the pass that answers the request,
 * which settles it; the record's line "Answers the request", which opens the request in the talk,
 * by the keyboard at 1,440 pixels and by a finger's press at 390; a push that keeps the pass off
 * until Load again, after which the pass names the new commit; a request asked after the page was
 * drawn; a snapshot without a commit, whose pass names its revision; a request whose comment is
 * full, which the user marks answered in the talk before passing without it; a stage that the
 * project does not read, which passes with the project's commit (SCR-113#not-read); a second
 * press of the pass while the record reads again after the first, which sends nothing (BUG-608);
 * and a pass and a withdrawal on their way when the record closes, after which the record opened
 * again has its pass and Withdraw on (BUG-622).
 *
 * Node 24 built-ins only; an owned headless Chrome over CDP. Requires NEXUS_QA_PASS=1, the opt-in
 * view-server, NEXUS_CHROME and NEXUS_QA_ORIGIN. Synthetic loopback fixture only: the page's reads
 * and writes reach the fixture server, except those that a test answers itself or rewrites on
 * their way, which the report lists as mocked or rewritten; what the agent and its hub do
 * meanwhile goes to the fixture through /__qa/pass.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {label,labels,codeMessage,oldLabels} from '../src/draw/words.js';
import {stagePath} from '../src/draw/stages.js';
import {clock} from '../src/draw/html.js';
import {FOLD_KEYS} from '../ui/folds.js';
import {SIDEWAYS,OUTSIDE,HITS} from './page-checks.mjs';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_PASS!=='1')throw Error('Use only the opt-in synthetic pass fixture');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,project='qa-pass',bare='qa-pass-bare',part='sample';
const page=(stage,lang,name=project)=>stagePath(name,part,stage)+'?lang='+lang;
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'pass-');
const {folder}=browser;
const report={schema:'nexus-pass-browser-regression/1',scope:'synthetic loopback fixture only',evidence:'page measurement, stage 12\'s page checks and screenshots; reads and writes reach the fixture server (real), or the suite answers or rewrites them (mocked, rewritten), as each test says',
 startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],blockedExternalOrigins:[],posts:[],reads:[],fixture:[],runtimeExceptions:[],console:[]};
const budget=Number(process.env.NEXUS_QA_PASS_BUDGET_MS)||300000,softDeadline=Date.now()+budget;
let ws,session,seq=0,responses=[],held=null,closing=false,loads=0;
const pending=new Map(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const out=(name,value)=>fs.writeFile(path.join(folder,name),JSON.stringify(value,null,2));
class CheckFailure extends Error{}
function assert(ok,message){if(!ok)throw new CheckFailure(message);}
function command(method,params={},scoped=true,timeout=15000){
 if(!closing&&Date.now()>softDeadline)return Promise.reject(Error(Math.round(budget/1000)+'s work budget reached; preserving time for owned cleanup'));
 const id=++seq;
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},timeout);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params,...(scoped?{sessionId:typeof scoped==='string'?scoped:session}:{})}));});
}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
async function waitFor(expression,timeout=10000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await evaluate(expression))return;await sleep(25);}throw Error('Page wait timed out: '+expression);}
async function paint(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
// A phone is touched: rule 14's hit areas are measured with touch, as a finger selects.
async function setting({width,height=844,theme='light',touch=width<1024}){
 await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
 await command('Emulation.setTouchEmulationEnabled',touch?{enabled:true,maxTouchPoints:1}:{enabled:false});
}
// No read runs: a page whose pass is off after a refusal never settles in the stage suite's sense.
async function quiet(){await waitFor(`(document.querySelector('.stage .upd')?.textContent||'')===''`);}
async function open(route){
 const url=origin+route;await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url});
 await waitFor(`location.href===${JSON.stringify(url)}&&document.readyState!=='loading'&&!!document.getElementById('view-data')`);
 await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await quiet();await paint();
}
async function shot(name){const image=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(folder,name+'.png'),Buffer.from(image.data,'base64'));return name+'.png';}
async function test(name,fn){
 const startedAt=new Date().toISOString();
 try{const evidence=await fn();report.tests.push({name,verdict:'works',startedAt,finishedAt:new Date().toISOString(),...evidence});console.log('PASS '+name);}
 catch(error){let screenshot;try{screenshot=await shot(name+'-failure');}catch{}report.tests.push({name,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),error:String(error),screenshot});console.error('FAIL '+name+': '+error);}
 finally{responses=[];if(held){try{await release();}catch{}}}
 await out('results.json',report);
}
// The requests that a test holds (a delay that the suite makes), until it lets them go on.
async function release(){const active=held;held=null;if(!active)return;for(const id of active.requests)await command('Fetch.continueRequest',{requestId:id});}
const problem=(status,code,extra={})=>({status,headers:[{name:'Content-Type',value:'application/problem+json'}],body:JSON.stringify({type:'about:blank',title:'Synthetic refusal',status,code,traceId:'tr_qa_'+code,...extra})});
// A rule answers a request (mocked), or rewrites its body on its way to the fixture (rewritten).
async function onPaused(event){
 const url=new URL(event.request.url),method=event.request.method,where=url.pathname+url.search,headers=Object.fromEntries(Object.entries(event.request.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(method==='GET'&&url.pathname.startsWith('/api/'))report.reads.push({path:where,at:new Date().toISOString()});
 const rule=responses.find(r=>r.method===method&&r.pattern.test(where));
 if(rule?.once)responses.splice(responses.indexOf(rule),1);
 const body=rule?.rewrite?rule.rewrite(event.request.postData||''):null;
 if(method==='POST')report.posts.push({path:url.pathname,write:headers['idempotency-key']||null,body:event.request.postData||null,...(body===null?{}:{sent:body}),at:new Date().toISOString()});
 if(rule&&body!==null){
  report.interceptions.push({path:where,method,action:'rewritten',at:new Date().toISOString()});
  await command('Fetch.continueRequest',{requestId:event.requestId,postData:Buffer.from(body).toString('base64')});return;
 }
 if(rule){
  report.interceptions.push({path:where,method,action:'mocked '+rule.status,at:new Date().toISOString()});
  await command('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:rule.status,responseHeaders:rule.headers,body:Buffer.from(rule.body||'').toString('base64')});return;
 }
 if(held&&held.method===method&&held.pattern.test(where)){held.requests.push(event.requestId);report.interceptions.push({path:where,method,action:'held',at:new Date().toISOString()});return;}
 try{await command('Fetch.continueRequest',{requestId:event.requestId});}
 catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;report.interceptions.push({path:where,method,action:'dropped by the page',at:new Date().toISOString()});}
}
async function serverGet(pathname){const response=await fetch(origin+pathname,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});return{status:response.status,data:await response.json()};}
// What the agent and its hub do while the page is open, and what the server holds.
async function fixture(body){
 const response=await fetch(origin+'/__qa/pass',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 assert(response.ok,'The fixture failed: '+JSON.stringify(body));const answer=await response.json();
 if(body.act!=='count')report.fixture.push({...body,answer,at:new Date().toISOString()});
 return answer;
}
const counts=()=>fixture({act:'count'});

// What the record shows: the pass's message, the words box, the pass, the request whole and the
// checkpoints that wait or were withdrawn, each with what its line names; and the bars.
const STATE=`(()=>{const q=s=>document.querySelector(s),txt=e=>e?e.textContent.replace(/\\s+/g,' ').trim():null,tone=(e,base)=>[...e.classList].find(c=>c!==base)||null;
 const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return[r.x,r.y,r.width,r.height].map(Math.round);};
 const msg=m=>m&&{tone:tone(m,'msg'),role:m.getAttribute('role'),text:txt(m.querySelector('.t')),trace:txt(m.querySelector('.tid')),retry:m.querySelector('[data-nx-act=pass]')?.dataset.nxAct||null,
  load:txt(m.querySelector('[data-nx-act=load]')),signIn:!!m.querySelector('[data-nx-act=sign-in]'),box:box(m),
  cut:[...[...m.querySelectorAll('.t,.tid')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className),...[...m.querySelectorAll('button')].filter(b=>{const r=document.createRange();r.selectNodeContents(b);const c=r.getBoundingClientRect(),o=b.getBoundingClientRect();return c.left<o.left-1||c.right>o.right+1;}).map(b=>txt(b))]};
 const rec=q('.side .rec'),words=rec?.querySelector('#cp-words'),pass=rec?.querySelector('.r2 [data-nx-act=pass]'),rq=rec?.querySelector('.rq');
 return{code:document.documentElement.dataset.nxCode||null,open:q('.ws')?.dataset.nxOpen||null,tab:q('.ws')?.dataset.nxTab||null,hash:location.hash,focus:document.activeElement?.dataset?.nxFocus||document.activeElement?.id||null,side:box(q('.side')),
  bars:[...document.querySelectorAll('.bars .bar')].filter(b=>!b.hasAttribute('data-nx-codebar')).map(b=>({tone:tone(b,'bar'),text:txt(b.querySelector('.t')),act:b.querySelector('button')?.dataset.nxAct||null})),
  record:rec?{pass:msg(rec.querySelector('.pnote .msg')),note:msg(rec.querySelector('.rnote .msg')),words:words?.value??null,invalid:words?.getAttribute('aria-invalid')||null,wordsBox:box(words),
   passButton:pass&&{text:txt(pass),disabled:pass.disabled,aria:pass.getAttribute('aria-disabled')},
   request:rq&&{text:rq.querySelector('.tx')?.textContent??null,commit:txt(rq.querySelector('.rqc'))},
   boxes:[...rec.querySelectorAll('.wbox')].map(w=>({id:(w.dataset.nxKey||'').slice(3),warn:w.classList.contains('warn'),text:txt(w.querySelector('b')),seen:txt(w.querySelector('.cpk>.cpc')),
    answers:w.querySelector('.cpk>.cpq a')?.getAttribute('href')||null,answersText:txt(w.querySelector('.cpk>.cpq a')),kind:[...w.querySelectorAll('.cpk>span:not(.sep):not(.cpc):not(.cpq)')].map(txt)}))}:null};})()`;
const state=()=>evaluate(STATE);
async function pageChecks(width){const sideways=await evaluate(SIDEWAYS),outside=await evaluate(OUTSIDE),hits=width<1024?await evaluate(HITS):null;return{sideways,outside,hits};}
const summary=checks=>({sideways:checks.sideways,outside:checks.outside.length,hits:checks.hits&&{probed:checks.hits.probed,covered:checks.hits.covered,alike:checks.hits.alike,missed:checks.hits.missed.length}});
// The console's errors, apart from the lines in which Chrome reports each refused pass's status.
const consoleErrors=since=>report.console.slice(since).filter(e=>e.level==='error'&&!(e.url&&new URL(e.url).pathname==='/favicon.ico')&&!(e.source==='network'&&e.url&&/\/checkpoints$/.test(new URL(e.url).pathname)));
function judge(what,checks,since){
 assert(checks.sideways.scrollWidth<=checks.sideways.width&&checks.sideways.bodyWidth<=checks.sideways.width,what+': the page scrolls sideways: '+JSON.stringify(checks.sideways));
 assert(!checks.outside.length,what+': elements outside the page: '+JSON.stringify(checks.outside));
 assert(!checks.hits||!checks.hits.missed.some(m=>!m.inline),what+': hit areas under 44 pixels (rule 14): '+JSON.stringify(checks.hits&&checks.hits.missed.filter(m=>!m.inline)));
 const errors=consoleErrors(since);assert(!errors.length,what+': console errors: '+JSON.stringify(errors));
}
// The refusal's message above the words box, inside the side or the sheet, with nothing cut.
function placed(what,s){
 const m=s.record?.pass,w=s.record?.wordsBox,side=s.side;
 assert(m&&w&&side&&m.box[1]+m.box[3]<=w[1]+1&&m.box[0]>=side[0]-1&&m.box[0]+m.box[2]<=side[0]+side[2]+1&&!m.cut.length,what+': the refusal above the words box, inside the side, nothing cut: '+JSON.stringify({message:m&&{box:m.box,cut:m.cut},words:w,side}));
}
// A control by the keyboard: the focus on it, then Enter.
async function key(name,code=name,keyCode=13,text){for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:name,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode,...(type==='keyDown'&&text?{text}:{})});}
async function press(selector){
 const found=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.scrollIntoView({block:'nearest'});e.focus();return document.activeElement===e;})()`);
 assert(found,'No control to focus: '+selector);await key('Enter','Enter',13,'\r');
}
async function clickAt(x,y){for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});}
// A control that shows, by the mouse at its centre: a pictured stage draws Stage record twice, in
// the head for the phone and in the picture's bar from 1,024 pixels (SCR-112). It is measured two
// frames on, after a scroll that the page makes in its next frame, as the talk does when it
// opens an entry, which moved a control of a long entry from under the mouse.
async function click(selector){
 const find=`[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}))`;
 const at=await evaluate(`new Promise(resolve=>{if(!${find})return resolve(null);requestAnimationFrame(()=>requestAnimationFrame(()=>{const e=${find};if(!e)return resolve(null);e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();resolve({x:r.x+r.width/2,y:r.y+r.height/2});}));})`);
 assert(at,'No control that shows: '+selector);await clickAt(at.x,at.y);
}
// A finger's press at a control's centre, as the touch emulation sends it.
async function tap(selector){
 const at=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'No control to press: '+selector);
 await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:at.x,y:at.y}]});await command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
const RECORD='[data-nx-act="record"][data-nx-key="rec"]',PASS='.side .rec .r2 [data-nx-act="pass"]';
async function type(selector,text){
 await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});e.focus();e.select?.();return true;})()`);
 await command('Input.insertText',{text});
}
async function openRecord(request=true){await click(RECORD);await waitFor(`document.querySelector('.ws')?.dataset.nxOpen==='record'&&!!document.querySelector('.side .rec #cp-words')${request?"&&!!document.querySelector('.side .rec .rq')":''}`);await paint();}
const passPath='/api/spaces/'+project+'/checkpoints';
const postsTo=(pathname,since=0)=>report.posts.slice(since).filter(post=>post.path===pathname);
const sentBody=post=>JSON.parse(post.sent??post.body);
// The folds kept in the browser's storage (SPEC-210), which the next page applies.
const keep=kept=>evaluate(`(()=>{const keys=${JSON.stringify(FOLD_KEYS)},kept=${JSON.stringify(kept)};for(const [name,key]of Object.entries(keys)){if(kept[name])localStorage.setItem(key,kept[name]);else localStorage.removeItem(key);}return location.origin;})()`);
// A body as a page of before the release sends it: no commit, revision or request.
const beforeTheRelease=body=>{const sent=JSON.parse(body);for(const name of['commit','revision','comment','entry'])delete sent[name];return JSON.stringify(sent);};
// Stage 12's 24 settings: 390, 1,152 and 1,280 pixels with each fold, and 1,440, each in light
// English, dark Korean, dark English and light Korean.
const SETTINGS=[];
for(const [w,[width,kept]]of[[390,{}],[1152,{}],[1152,{stages:'folded'}],[1280,{}],[1280,{stages:'folded',talk:'shown'}],[1440,{}]].entries())
 for(const [c,[lang,theme]]of[['en','light'],['ko','dark'],['en','dark'],['ko','light']].entries())SETTINGS.push({width,kept,lang,theme,turn:w+c});
const tagOf=(stage,s)=>`${stage.slice(0,2)}-${s.width}-${s.lang}-${s.theme}${Object.entries(s.kept).map(([name,value])=>`-${name}-${value}`).join('')}`;
const wordsOf=(lang,tag)=>(lang==='ko'?'합성 통과의 말 ':'Synthetic words of the pass ')+tag;

try{
 const receipts=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json(),qa=receipts.pass;
 assert(qa?.project===project&&qa.bare===bare&&qa.part===part&&/^[0-9a-f]{40}$/.test(qa.commit||'')&&['04-functional-spec','05-erd'].every(stage=>/^nc_/.test(qa.requests?.[stage]||'')),'The origin is not the opt-in synthetic pass fixture');
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),entries=JSON.parse(metadataBytes).entries;
 assert(/^\/code\/page\.[a-f0-9]{8}\.js$/.test(entries['page-js']||''),'Content-hashed page code is required');
 report.preflight={fixture:{project:qa.project,bare:qa.bare,requests:qa.requests,commit:qa.commit},build:{entries:{'page-js':entries['page-js'],'page-css':entries['page-css']},sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
 // What the server holds as the suite goes: the project's commit, and the place of each request's last entry.
 let commit=qa.commit;const requests={...qa.requests},last={'04-functional-spec':0,'05-erd':0};
 const browserEnv={...process.env};for(const name of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(name))delete browserEnv[name];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-features=BackForwardCache','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],browserEnv);
 const endpoint=await browser.endpoint();
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);return;}
  if(m.sessionId!==session)return;
  if(m.method==='Page.loadEventFired')loads++;
  else if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error)+' ('+m.params.request.method+' '+new URL(m.params.request.url).pathname+')';});
  else if(m.method==='Runtime.exceptionThrown'){const text=m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text;report.runtimeExceptions.push({at:new Date().toISOString(),text});report.console.push({kind:'exception',level:'error',text:String(text)});}
  else if(m.method==='Runtime.consoleAPICalled'&&['error','warning','assert'].includes(m.params.type))report.console.push({kind:'console',level:m.params.type==='warning'?'warning':'error',text:m.params.args.map(a=>a.value??a.description??'').join(' ')});
  else if(m.method==='Log.entryAdded'&&['error','warning'].includes(m.params.entry.level))report.console.push({kind:'log',source:m.params.entry.source,level:m.params.entry.level,text:m.params.entry.text,url:m.params.entry.url||null});
 };
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Log.enable');
 await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await command('Emulation.setTimezoneOverride',{timezoneId:'UTC'});
 await setting({width:1440});await open(page('04-functional-spec','en'));
 const buttonsOf=lang=>labels('Page buttons',lang);
 const stageAnswer=async(stage,name=project)=>(await serverGet(`/api/spaces/${name}/stages/${part}/${stage}?filter=all&group=context`)).data;

 // SCR-112#stale and SCR-113#stale in the 24 settings: in turn, a push of another commit and the
 // agent's reply that asks again, after the page was drawn and the words typed.
 for(const stage of['05-erd','04-functional-spec']){
  await test('stale-on-'+stage.slice(0,2)+'-in-24-settings',async()=>{
   const seen={},shots=[];
   try{
    for(const s of SETTINGS){
     const tag=tagOf(stage,s),{width,kept,lang,theme}=s,push=s.turn%2===0,named=label('The pass',0,lang,{n:stage.slice(0,2)});
     assert(await keep(kept)===origin,'The folds are kept at the fixture\'s origin');
     await setting({width,theme});await open(page(stage,lang));await openRecord();
     const words=wordsOf(lang,tag),since=report.console.length;await type('#cp-words',words);
     // What the page showed, before the hub pushes or the agent asks again.
     const shown={commit,entry:last[stage]};
     const changed=push?await fixture({act:'push'}):await fixture({act:'ask-again',stage});
     if(push)commit=changed.commit;else last[stage]=changed.seq;
     const before=await counts(),posts=report.posts.length,reads=report.reads.length;
     await click(PASS);await waitFor(`!!document.querySelector('.side .rec .pnote .msg')`);
     if(push)await waitFor(`!!document.querySelector('.bars .bar [data-nx-act="load"]')`);
     else await waitFor(`document.querySelector('.side .rec .rq .tx')?.textContent===${JSON.stringify(changed.text)}`);
     await quiet();await paint();
     const st=await state(),after=await counts(),sent=postsTo(passPath,posts);
     const body=sent.length===1?sentBody(sent[0]):null;
     assert(body&&body.part===part&&body.stage===stage&&body.commit===shown.commit&&body.comment===requests[stage]&&body.entry===shown.entry&&body.words===words&&!('revision' in body),tag+': the pass named what the page showed: '+JSON.stringify({body,shown}));
     assert(JSON.stringify(before)===JSON.stringify(after),tag+': nothing recorded: '+JSON.stringify({before,after}));
     assert(st.record.words===words&&!st.record.invalid,tag+': the words stay: '+JSON.stringify(st.record.words));
     placed(tag,st);
     if(push){
      const pushedAt=(await stageAnswer(stage)).project.pushed_at;
      assert(st.record.pass.tone==='warn'&&st.record.pass.role==='status'&&st.record.pass.text===codeMessage('snapshot_changed',lang,{commit:commit.slice(0,7)})&&st.record.pass.load===buttonsOf(lang)[1]&&!st.record.pass.retry&&st.record.pass.trace,tag+': snapshot_changed, the commit that the project now shows, and Load again of its own: '+JSON.stringify(st.record.pass));
      assert(st.bars.some(b=>b.act==='load'&&b.text===label('Pushed again',0,lang,{time:clock(pushedAt)})),tag+': SCR-111#stale\'s bar with Load again: '+JSON.stringify(st.bars));
      assert(st.record.passButton.aria==='true'&&!st.record.passButton.disabled&&st.record.passButton.text===named,tag+': the pass stays off, still named: '+JSON.stringify(st.record.passButton));
      await click(PASS);await sleep(150);
      assert(postsTo(passPath,posts).length===1,tag+': a press of the pass that is off sends nothing');
     }else{
      assert(st.record.pass.tone==='warn'&&st.record.pass.text===codeMessage('request_changed',lang)&&!st.record.pass.load&&!st.record.pass.retry&&st.record.pass.trace,tag+': request_changed: '+JSON.stringify(st.record.pass));
      assert(st.record.request?.text===changed.text&&st.record.request.commit===label('The head',2,lang,{commit:commit.slice(0,7)}),tag+': the request as it is now, its newer entry whole: '+JSON.stringify(st.record.request));
      assert(st.record.passButton.aria!=='true'&&!st.record.passButton.disabled&&st.record.passButton.text===named,tag+': the pass, named, takes the request as it is now: '+JSON.stringify(st.record.passButton));
      const read=report.reads.slice(reads).map(r=>r.path);
      assert(read.some(p=>p.startsWith(`/api/spaces/${project}/talk/${part}/${stage}`))&&read.some(p=>p.startsWith(`/api/spaces/${project}/stages/${part}/${stage}?`)),tag+': the talk and the record read again: '+JSON.stringify(read));
     }
     const checks=await pageChecks(width);judge(tag,checks,since);
     seen[tag]={variant:push?'push':'request',sent:{commit:body.commit.slice(0,7),comment:body.comment,entry:body.entry},message:{tone:st.record.pass.tone,text:st.record.pass.text,load:st.record.pass.load},pass:st.record.passButton,bars:st.bars.length,checks:summary(checks)};
     shots.push(await shot('stale-'+tag));
    }
   }finally{await keep({}).catch(()=>{});}
   return{evidence:'fixture server (real pushes, real replies of the agent and real refusals)',seen,screenshots:shots};
  });
 }

 // SCR-112#error and SCR-113#error in the 24 settings, a code in turn: comment_not_found,
 // reply_limit and space_full answered by the suite (mocked), and the real server's
 // invalid_request for a body without commit and request, as a page of before the release sends it.
 const CODES=['comment_not_found','reply_limit','space_full','invalid_request'];
 for(const stage of['05-erd','04-functional-spec']){
  await test('error-on-'+stage.slice(0,2)+'-in-24-settings',async()=>{
   const seen={},shots=[];
   try{
    for(const s of SETTINGS){
     const tag=tagOf(stage,s),{width,kept,lang,theme}=s,code=CODES[s.turn%4],named=label('The pass',0,lang,{n:stage.slice(0,2)}),real=code==='invalid_request';
     assert(await keep(kept)===origin,'The folds are kept at the fixture\'s origin');
     await setting({width,theme});await open(page(stage,lang));await openRecord();
     const words=wordsOf(lang,tag),since=report.console.length;await type('#cp-words',words);
     responses=[real?{method:'POST',pattern:/\/checkpoints$/,once:true,rewrite:beforeTheRelease}:{method:'POST',pattern:/\/checkpoints$/,once:true,...problem(code==='comment_not_found'?404:409,code,code==='reply_limit'?{limit:200}:{})}];
     const before=await counts(),posts=report.posts.length,reads=report.reads.length;
     await click(PASS);await waitFor(`!!document.querySelector('.side .rec .pnote .msg')`);await quiet();await paint();
     const st=await state(),after=await counts(),m=st.record.pass,sent=postsTo(passPath,posts);
     assert(sent.length===1&&!responses.length,tag+': one pass, answered by the rule: '+JSON.stringify(sent));
     if(real){const went=JSON.parse(sent[0].sent);assert(!['commit','revision','comment','entry'].some(name=>name in went)&&sentBody({body:sent[0].body}).commit===commit,tag+': the page named the commit, and the body went without it: '+JSON.stringify(sent[0]));}
     assert(JSON.stringify(before)===JSON.stringify(after),tag+': nothing recorded: '+JSON.stringify({before,after}));
     assert(m.tone==='err'&&m.role==='alert'&&m.trace,tag+': an error with its trace ID: '+JSON.stringify(m));
     assert(st.record.words===words&&st.record.passButton.aria!=='true'&&!st.record.passButton.disabled&&st.record.passButton.text===named,tag+': the words stay and the pass is there: '+JSON.stringify({words:st.record.words,pass:st.record.passButton}));
     placed(tag,st);
     if(code==='comment_not_found'){
      const read=report.reads.slice(reads).map(r=>r.path);
      assert(m.text===codeMessage(code,lang)&&!m.retry&&!m.load&&m.trace===codeMessage('Trace ID',lang,{traceId:'tr_qa_'+code}),tag+': '+code+': '+JSON.stringify(m));
      assert(read.some(p=>p.startsWith(`/api/spaces/${project}/talk/${part}/${stage}`))&&read.some(p=>p.startsWith(`/api/spaces/${project}/stages/${part}/${stage}?`)),tag+': the talk and the record read again: '+JSON.stringify(read));
     }else if(code==='reply_limit')assert(m.text===codeMessage(code,lang,{limit:'200'})&&!m.retry&&!m.load,tag+': reply_limit, the comment full, without Try again: '+JSON.stringify(m));
     else if(code==='space_full')assert(m.text===codeMessage(code,lang)&&m.retry==='pass'&&!m.load,tag+': space_full with Try again: '+JSON.stringify(m));
     else assert(m.text===codeMessage(code,lang)&&m.load===buttonsOf(lang)[1]&&!m.retry&&!st.record.invalid&&!/^Trace ID tr_qa_|^추적 ID tr_qa_/.test(m.trace),tag+': the server\'s invalid_request, with Load again and no field marked: '+JSON.stringify({message:m,invalid:st.record.invalid}));
     const checks=await pageChecks(width);judge(tag,checks,since);
     seen[tag]={code,evidence:real?'rewritten on its way, refused by the fixture server':'mocked',message:{text:m.text,retry:m.retry,load:m.load},checks:summary(checks)};
     shots.push(await shot('error-'+tag));
    }
   }finally{await keep({}).catch(()=>{});}
   return{evidence:'invalid_request: the page\'s body rewritten on its way and refused by the fixture server; the other codes answered by the suite (mocked)',seen,screenshots:shots};
  });
 }

 // TC-1760's page half, then a pass that answers the request (SPEC-196): a body of before the
 // release refused by the server; Load again of the refusal's own; the words from the browser's
 // storage; the pass, named for the stage, which names the commit, the request and its last
 // entry, and settles it; the record's line, and the request in the talk.
 let answered=null;
 await test('load-again-then-a-pass-that-answers-the-request-1440-ko',async()=>{
  const lang='ko',stage='04-functional-spec',seen={},shots=[],words='합성: 기능 명세를 확인했고 요청에 답합니다.',since=report.console.length;
  await setting({width:1440,theme:'dark'});await open(page(stage,lang));await openRecord();await type('#cp-words',words);
  responses=[{method:'POST',pattern:/\/checkpoints$/,once:true,rewrite:beforeTheRelease}];
  const before=await counts(),posts=report.posts.length;
  await click(PASS);await waitFor(`!!document.querySelector('.side .rec .pnote .msg [data-nx-act="load"]')`);await quiet();
  seen.refused=(await state()).record;
  assert(seen.refused.pass.text===codeMessage('invalid_request',lang)&&seen.refused.words===words&&JSON.stringify(await counts())===JSON.stringify(before),'Refused, the words kept, nothing recorded: '+JSON.stringify(seen.refused.pass));
  shots.push(await shot('before-the-release-1440-ko'));
  const loaded=loads;await click('.side .rec .pnote [data-nx-act="load"]');for(const stop=Date.now()+10000;loads===loaded&&Date.now()<stop;)await sleep(25);
  await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await quiet();await openRecord();
  seen.loaded=(await state()).record;
  assert(loads>loaded&&seen.loaded.words===words&&!seen.loaded.pass&&seen.loaded.passButton.text===label('The pass',0,lang,{n:'04'}),'Load again: the page loaded again, the words from the browser\'s storage, the pass named: '+JSON.stringify(seen.loaded));
  await click(PASS);await waitFor(`document.querySelector('.side .rec #cp-words')?.value===''&&!document.querySelector('.side .rec .rq')`);await quiet();await paint();
  const sent=postsTo(passPath,posts),body=sentBody(sent.at(-1)),st=await state(),made=st.record.boxes.find(b=>b.answers);
  assert(sent.length===2&&sent[0].write===sent[1].write,'One write ID for the refused pass and the one after Load again: '+JSON.stringify(sent.map(p=>p.write)));
  assert(body.commit===commit&&body.comment===requests[stage]&&body.entry===last[stage]&&body.words===words&&!('revision' in body),'The pass names the commit, the request and its last entry: '+JSON.stringify(body));
  const checkpoint=(await serverGet(`/api/spaces/${project}/checkpoints/${made?.id}`)).data;
  assert(checkpoint.commit===commit&&checkpoint.comment===requests[stage]&&checkpoint.entry===last[stage]&&checkpoint.state==='passed','The server holds what the pass named: '+JSON.stringify(checkpoint));
  const talk=(await serverGet(`/api/spaces/${project}/talk/${part}/${stage}`)).data,ofEntry=e=>e?.comment??e,held=ofEntry(talk.agent.entries.find(e=>ofEntry(e)?.id===requests[stage]));
  assert(!talk.mine.entries.some(e=>ofEntry(e)?.id===requests[stage])&&held?.waits==='agent'&&held.settled===true&&held.asks===null&&held.last_reply?.author==='user'&&held.last_reply.settles===true&&held.last_reply.text===words,'The pass settled the request, in the user\'s words: '+JSON.stringify(held));
  assert(made.seen===label('The head',2,lang,{commit:commit.slice(0,7)})&&made.answers==='#talk='+requests[stage]&&made.answersText===label("A passed checkpoint's record",0,lang)&&st.record.passButton.text===codeMessage('Pass again',lang),'Its line: the commit, Answers the request, then the kind; the pass is Pass again: '+JSON.stringify({made,pass:st.record.passButton}));
  answered={id:made.id,comment:requests[stage]};
  const checks=await pageChecks(1440);judge('passed',checks,since);
  shots.push(await shot('answers-the-request-1440-ko'));
  seen.passed={body:{...body,words:undefined},checkpoint:{id:checkpoint.id,commit:checkpoint.commit,comment:checkpoint.comment,entry:checkpoint.entry},line:made,checks:summary(checks)};
  return{evidence:'fixture server: the first body rewritten on its way and refused (TC-1760\'s page half), then a real pass',seen,screenshots:shots};
 });

 // "Answers the request" (SCR-112, SCR-113): by the keyboard at 1,440 pixels, the record gives way
 // to the talk with the request's entry open, a step of the browser's history; and at 390, where
 // the line is a finger's target in the sheet, a press brings the Talk tab to the front.
 await test('answers-the-request-opens-it-in-the-talk-1440-en-and-390-ko',async()=>{
  assert(answered,'The pass that answered a request came first');
  const stage='04-functional-spec',seen={},shots=[],link=`.side .rec .wbox[data-nx-key="cp:${answered.id}"] .cpq a`;
  await setting({width:1440,theme:'light'});await open(page(stage,'en'));await openRecord(false);
  const at=await evaluate('location.href');await press(link);
  await waitFor(`location.hash===${JSON.stringify('#talk='+answered.comment)}&&document.querySelector('.ws')?.dataset.nxOpen!=='record'&&document.querySelector('.side li[data-nx-entry="${answered.comment}"] > .hd .ref')?.getAttribute('aria-expanded')==='true'`);await quiet();await paint();
  seen.wide=await evaluate(`(()=>{const li=document.querySelector('.side li[data-nx-entry="${answered.comment}"]');return{hash:location.hash,open:document.querySelector('.ws').dataset.nxOpen||null,turn:li?.closest('ol')?.dataset.nxKey||null,expanded:li?.querySelector(':scope > .hd .ref')?.getAttribute('aria-expanded'),inView:!!li&&li.getBoundingClientRect().top<innerHeight&&li.getBoundingClientRect().bottom>0,focus:document.activeElement?.dataset?.nxFocus||null};})()`);
  assert(seen.wide.turn==='l-agent'&&seen.wide.inView,'The request, settled, in the agent\'s turn, open and in sight: '+JSON.stringify(seen.wide));
  shots.push(await shot('answers-talk-1440-en'));
  await evaluate('history.back()');await waitFor(`location.href===${JSON.stringify(at)}`);seen.back=await evaluate('location.hash');
  assert(seen.back==='','Back leaves the talk\'s address: '+JSON.stringify(seen.back));
  await setting({width:390,theme:'dark',touch:true});await open(page(stage,'ko'));await openRecord(false);
  await waitFor(`!!document.querySelector(${JSON.stringify(link)})`);
  const hits=await evaluate(`((selector)=>{const e=document.querySelector(selector);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
   return{box:[r.x,r.y,r.width,r.height].map(Math.round),misses:[[0,-21],[0,21],[-21,0],[21,0]].filter(([dx,dy])=>{const hit=document.elementFromPoint(x+dx,y+dy);return!hit||!(hit===e||e.contains(hit));})};})(${JSON.stringify(link)})`);
  seen.phone={hits};assert(!hits.misses.length&&hits.box[3]>=44,'A finger\'s target, 21 pixels around its centre (rule 14): '+JSON.stringify(hits));
  shots.push(await shot('answers-line-390-ko'));
  await tap(link);
  await waitFor(`location.hash===${JSON.stringify('#talk='+answered.comment)}&&document.querySelector('.ws')?.dataset.nxOpen!=='record'&&document.querySelector('.ws')?.dataset.nxTab==='talk'`);await quiet();await paint();
  seen.phone.after=await evaluate(`(()=>{const li=document.querySelector('.side li[data-nx-entry="${answered.comment}"]');return{tab:document.querySelector('.ws').dataset.nxTab,expanded:li?.querySelector(':scope > .hd .ref')?.getAttribute('aria-expanded'),shown:!!li&&li.checkVisibility({visibilityProperty:true})};})()`);
  assert(seen.phone.after.expanded==='true'&&seen.phone.after.shown,'The sheet gives way to the Talk tab, the request open: '+JSON.stringify(seen.phone.after));
  shots.push(await shot('answers-talk-390-ko'));
  return{evidence:'fixture pages',seen,screenshots:shots};
 });

 // A push between the drawing and the pass (SCR-112#stale) on a phone: the refusal's own Load
 // again, a finger's target; the page loaded again names the new commit, and the pass is taken.
 await test('a-push-keeps-the-pass-off-until-load-again-390-ko',async()=>{
  const lang='ko',stage='05-erd',seen={},shots=[],words='합성: 주문 표의 고유 참조를 확인했습니다.',since=report.console.length;
  await setting({width:390,theme:'dark',touch:true});await open(page(stage,lang));await openRecord();await type('#cp-words',words);
  const pushed=await fixture({act:'push'});commit=pushed.commit;const posts=report.posts.length;
  await click(PASS);await waitFor(`!!document.querySelector('.side .rec .pnote .msg [data-nx-act="load"]')`);await quiet();await paint();
  seen.refused=(await state()).record;
  const hits=await evaluate(HITS);seen.hits={probed:hits.probed,missed:hits.missed};
  assert(seen.refused.pass.text===codeMessage('snapshot_changed',lang,{commit:commit.slice(0,7)})&&seen.refused.passButton.aria==='true'&&!hits.missed.some(m=>!m.inline),'Refused, the pass off, Load again a finger\'s target: '+JSON.stringify(seen));
  shots.push(await shot('push-refused-390-ko'));
  const loaded=loads;await tap('.side .rec .pnote [data-nx-act="load"]');for(const stop=Date.now()+10000;loads===loaded&&Date.now()<stop;)await sleep(25);
  await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await quiet();await openRecord();
  seen.loaded=(await state()).record;
  assert(loads>loaded&&seen.loaded.words===words&&seen.loaded.passButton.aria!=='true'&&seen.loaded.request?.commit===label('The head',2,lang,{commit:commit.slice(0,7)}),'Loaded again: the words kept, the pass on, the new commit shown: '+JSON.stringify(seen.loaded));
  await click(PASS);await waitFor(`document.querySelector('.side .rec #cp-words')?.value===''&&!document.querySelector('.side .rec .rq')`);await quiet();await paint();
  const body=sentBody(postsTo(passPath,posts).at(-1)),st=await state(),made=st.record.boxes.find(b=>b.answers==='#talk='+requests[stage]);
  assert(body.commit===commit&&body.comment===requests[stage]&&body.entry===last[stage],'The pass names the new commit: '+JSON.stringify(body));
  assert(made?.seen===label('The head',2,lang,{commit:commit.slice(0,7)}),'Its line names the new commit: '+JSON.stringify(made));
  const checks=await pageChecks(390);judge('passed after Load again',checks,since);
  shots.push(await shot('push-passed-390-ko'));
  seen.passed={body:{commit:body.commit,comment:body.comment,entry:body.entry},line:made,checks:summary(checks)};
  return{evidence:'fixture server (a real push, refusal and pass), touch emulation',seen,screenshots:shots};
 });

 // A request that the agent asked after the page was drawn (SCR-112#stale): the pass that names
 // none is refused, the record shows the request and the pass names it.
 await test('a-request-asked-after-the-page-was-drawn-1440-ko',async()=>{
  const lang='ko',stage='07-sitemap',seen={},shots=[],words='합성: 사이트맵을 확인했습니다.',since=report.console.length;
  await setting({width:1440,theme:'light'});await open(page(stage,lang));await openRecord(false);
  seen.first=(await state()).record;
  assert(!seen.first.request&&seen.first.passButton.text===labels('The stage record',lang)[4],'No request yet, the pass as before: '+JSON.stringify(seen.first.passButton));
  await type('#cp-words',words);const asked=await fixture({act:'request',stage});requests[stage]=asked.comment;
  const before=await counts(),posts=report.posts.length;
  await click(PASS);await waitFor(`document.querySelector('.side .rec .rq .tx')?.textContent===${JSON.stringify(asked.text)}&&!!document.querySelector('.side .rec .pnote .msg')`);await quiet();await paint();
  seen.refused=(await state()).record;
  assert(seen.refused.pass.tone==='warn'&&seen.refused.pass.text===oldLabels('request_changed',lang)[1]&&seen.refused.words===words&&seen.refused.passButton.text===label('The pass',0,lang,{n:'07'})&&JSON.stringify(await counts())===JSON.stringify(before),'This stage now has a checkpoint request: shown whole, the pass named for it: '+JSON.stringify(seen.refused));
  assert(!('comment' in sentBody(postsTo(passPath,posts)[0])),'The first pass named no request');
  shots.push(await shot('asked-after-1440-ko'));
  await click(PASS);await waitFor(`document.querySelector('.side .rec #cp-words')?.value===''&&!document.querySelector('.side .rec .rq')`);await quiet();
  const body=sentBody(postsTo(passPath,posts).at(-1));
  assert(body.comment===asked.comment&&body.entry===0&&body.commit===commit,'The pass names the request and its first entry: '+JSON.stringify(body));
  judge('asked after',await pageChecks(1440),since);
  return{evidence:'fixture server (the agent\'s real request, a real refusal and pass)',seen:{...seen,passed:{comment:body.comment,entry:body.entry}},screenshots:shots};
 });

 // A snapshot without a commit (SPEC-194): the pass names its revision and the line says
 // "Snapshot {n}"; a newer snapshot refuses the next pass with Load again.
 await test('a-snapshot-without-a-commit-1440-en',async()=>{
  const lang='en',stage='04-functional-spec',seen={},shots=[],since=report.console.length;
  await setting({width:1440,theme:'dark'});await open(page(stage,lang,bare));await openRecord(false);
  const revision=(await stageAnswer(stage,bare)).project.revision,bareApi=`/api/spaces/${bare}/checkpoints`,posts=report.posts.length;
  await type('#cp-words','Synthetic: the spec as drafted, without a commit.');
  await click(PASS);await waitFor(`document.querySelector('.side .rec #cp-words')?.value===''&&!!document.querySelector('.side .rec .wbox .cpc')`);await quiet();await paint();
  const body=sentBody(postsTo(bareApi,posts).at(-1)),made=(await state()).record.boxes[0];
  assert(body.revision===revision&&!('commit' in body)&&made.seen===label("A passed checkpoint's record",1,lang,{n:String(revision)})&&!made.answers,'The pass names the revision, and its line Snapshot {n}: '+JSON.stringify({body,made}));
  shots.push(await shot('snapshot-line-1440-en'));
  await fixture({act:'bare'});await type('#cp-words','Synthetic: a pass after a newer snapshot.');
  const before=await counts();
  await click(PASS);await waitFor(`!!document.querySelector('.side .rec .pnote .msg [data-nx-act="load"]')&&!!document.querySelector('.bars .bar [data-nx-act="load"]')`);await quiet();await paint();
  seen.refused=(await state()).record;
  assert(seen.refused.pass.text===oldLabels('snapshot_changed',lang)[1]&&seen.refused.passButton.aria==='true'&&(await counts()).bareCheckpoints===before.bareCheckpoints,'A newer snapshot: the words of a snapshot, the pass off: '+JSON.stringify(seen.refused.pass));
  judge('snapshot',await pageChecks(1440),since);
  shots.push(await shot('snapshot-refused-1440-en'));
  return{evidence:'fixture server (real passes, a real push without a commit and a real refusal)',seen:{sent:body,line:made,refused:seen.refused.pass},screenshots:shots};
 });

 // A request whose comment holds its 200 replies (SCR-112#error): reply_limit from the real
 // server; the user marks the request answered in the talk and passes without it.
 await test('a-full-request-marked-answered-then-passed-1440-en',async()=>{
  const lang='en',stage='01-domain',seen={},shots=[],words='Synthetic: the domain as drafted.',since=report.console.length;
  const asked=await fixture({act:'request',stage}),filled=await fixture({act:'fill',stage});
  assert(filled.seq===200,'The fixture filled the request\'s comment: '+JSON.stringify(filled));
  await setting({width:1440,theme:'light'});await open(page(stage,lang));await openRecord();await type('#cp-words',words);
  const before=await counts(),posts=report.posts.length;
  await click(PASS);await waitFor(`!!document.querySelector('.side .rec .pnote .msg')`);await quiet();await paint();
  seen.refused=(await state()).record;
  assert(seen.refused.pass.text===codeMessage('reply_limit',lang,{limit:'200'})&&!seen.refused.pass.retry&&seen.refused.words===words&&JSON.stringify(await counts())===JSON.stringify(before)&&sentBody(postsTo(passPath,posts)[0]).entry===200,'reply_limit, the words kept, nothing recorded: '+JSON.stringify(seen.refused.pass));
  shots.push(await shot('full-refused-1440-en'));
  await key('Escape','Escape',27);await waitFor(`!document.querySelector('.ws').dataset.nxOpen`);
  const entry=`.side li[data-nx-entry="${asked.comment}"]`;
  await click(entry+' > .hd .ref');await waitFor(`!!document.querySelector(${JSON.stringify(entry+' [data-nx-act="answered"]')})`);
  await click(entry+' [data-nx-act="answered"]');await waitFor(`!document.querySelector('.side ol[data-nx-key="l-mine"] li[data-nx-entry="${asked.comment}"]')`);await quiet();
  await openRecord(false);seen.after=(await state()).record;
  assert(!seen.after.request&&seen.after.words===words,'Marked answered: no request in the record, the words kept: '+JSON.stringify(seen.after));
  await click(PASS);await waitFor(`document.querySelector('.side .rec #cp-words')?.value===''`);await quiet();
  const body=sentBody(postsTo(passPath,posts).at(-1));
  assert(!('comment' in body)&&!('entry' in body)&&body.commit===commit,'The pass without the request: '+JSON.stringify(body));
  judge('full',await pageChecks(1440),since);
  shots.push(await shot('full-passed-1440-en'));
  return{evidence:'fixture server (a real full comment, refusal, Mark answered and pass)',seen,screenshots:shots};
 });

 // A stage that the project does not read (SCR-113#not-read) passes in the same way, with the
 // commit of the project's snapshot, which the workspace's head shows, and its line says so.
 await test('a-stage-that-the-project-does-not-read-1440-en',async()=>{
  const lang='en',stage='03-user-flow',shots=[],words='Synthetic: the flows, which the project does not read.',since=report.console.length,posts=report.posts.length;
  await setting({width:1440,theme:'light'});await open(page(stage,lang));
  const shown=await evaluate(`document.querySelector('.stage .nolist')?.dataset.nxKey||null`);
  assert(shown==='not-read','The stage is not read: '+JSON.stringify(shown));
  await openRecord(false);await type('#cp-words',words);
  await click(PASS);await waitFor(`document.querySelector('.side .rec #cp-words')?.value===''&&!!document.querySelector('.side .rec .wbox .cpc')`);await quiet();await paint();
  const body=sentBody(postsTo(passPath,posts).at(-1)),made=(await state()).record.boxes[0];
  assert(body.stage===stage&&body.commit===commit&&!('revision' in body)&&!('comment' in body)&&body.words===words,'The pass names the project\'s commit: '+JSON.stringify(body));
  assert(made.seen===label('The head',2,lang,{commit:commit.slice(0,7)})&&!made.answers,'Its line says the commit: '+JSON.stringify(made));
  judge('not read',await pageChecks(1440),since);
  shots.push(await shot('not-read-passed-1440-en'));
  return{evidence:'fixture server (a real pass on a stage that the project does not read)',seen:{shown,sent:{stage:body.stage,commit:body.commit},line:made},screenshots:shots};
 });

 // Two quick presses of the pass in the record (BUG-608): after the first is answered, the record
 // reads again, and until it has, the pass and Withdraw stay off, so that the second press sends
 // nothing and no refusal shows. The suite holds that reading (a delay that it makes) and presses
 // then, by a finger at 390 pixels: on a pass that answers a request, then on a plain pass.
 await test('a-second-press-while-the-record-reads-again-390-ko',async()=>{
  const lang='ko',stage='07-sitemap',seen={},shots=[],since=report.console.length;
  const asked=await fixture({act:'request',stage});requests[stage]=asked.comment;
  await setting({width:390,theme:'dark',touch:true});await open(page(stage,lang));await openRecord();
  const read=new RegExp('^/api/spaces/'+project+'/stages/'+part+'/'+stage+'(?:\\?|$)');
  const off=()=>evaluate(`({pass:document.querySelector(${JSON.stringify(PASS)})?.getAttribute('aria-disabled')||null,withdraw:[...document.querySelectorAll('.side .rec [data-nx-act="withdraw"]')].map(b=>b.getAttribute('aria-disabled'))})`);
  for(const what of['request','plain']){
   const before=await counts(),mark=report.posts.length;
   held={pattern:read,method:'GET',requests:[]};
   await tap(PASS);
   for(const stop=Date.now()+10000;!held.requests.length&&Date.now()<stop;)await sleep(25);
   assert(held.requests.length>=1&&postsTo(passPath,mark).length===1,what+': the pass is answered and the record reads again');
   await paint();seen[what]={during:await off()};
   await tap(PASS);await sleep(200);
   seen[what].sent=postsTo(passPath,mark).length;
   assert(seen[what].sent===1,what+': the second press sends nothing: '+JSON.stringify(postsTo(passPath,mark).map(p=>p.write)));
   assert(seen[what].during.pass==='true'&&seen[what].during.withdraw.every(a=>a==='true')&&(what==='request'||seen[what].during.withdraw.length>=1),what+': the pass and Withdraw are off while the record reads again: '+JSON.stringify(seen[what].during));
   shots.push(await shot('second-press-'+what+'-390-ko'));
   await release();await quiet();await waitFor(`document.querySelector(${JSON.stringify(PASS)})?.getAttribute('aria-disabled')!=='true'`);await paint();
   const after=(await state()).record,now=await counts();
   seen[what].after={pass:after.pass,button:after.passButton,boxes:after.boxes.length,checkpoints:now.checkpoints-before.checkpoints,replies:now.replies-before.replies};
   assert(!after.pass&&now.checkpoints===before.checkpoints+1&&now.replies===before.replies+(what==='request'?1:0),what+': one checkpoint and no refusal: '+JSON.stringify(seen[what].after));
   const body=sentBody(postsTo(passPath,mark)[0]);
   assert(what==='request'?body.comment===asked.comment&&body.entry===0:!('comment' in body),what+': the pass names '+(what==='request'?'the request':'no request')+': '+JSON.stringify(body));
  }
  judge('second press',await pageChecks(390),since);
  return{evidence:'fixture server (a real request and two real passes); the record\'s reading again held by the suite (a delay that it makes); touch emulation',seen,screenshots:shots};
 });

 // A pass and a withdrawal on their way when the record closes (BUG-622): the record keeps the
 // state that the write holds, so that, opened again once the write is answered, its pass and
 // Withdraw are on, and a press of the pass sends it. The suite holds each write (a delay that it
 // makes) and closes the record with Escape at 1,440 pixels.
 await test('a-write-on-its-way-when-the-record-closes-1440-en',async()=>{
  const lang='en',stage='03-user-flow',seen={},shots=[],since=report.console.length;
  const read=new RegExp('^/api/spaces/'+project+'/stages/'+part+'/'+stage+'(?:\\?|$)');
  const on=()=>evaluate(`({pass:document.querySelector(${JSON.stringify(PASS)})?.getAttribute('aria-disabled')||null,withdraw:[...document.querySelectorAll('.side .rec [data-nx-act="withdraw"]')].map(b=>b.getAttribute('aria-disabled'))})`);
  // The write on its way, the record closed, the write let go and the record's reading again
  // done, then the record opened again.
  async function closeWhileSent(what,pattern,send){
   held={pattern,method:'POST',requests:[]};
   await send();
   for(const stop=Date.now()+10000;!held.requests.length&&Date.now()<stop;)await sleep(25);
   assert(held.requests.length===1,what+': the write is on its way');
   seen[what]={during:await on()};
   await key('Escape','Escape',27);await waitFor(`!document.querySelector('.ws').dataset.nxOpen&&!document.querySelector('.side .rec')`);
   const mark=report.reads.length;
   await release();
   for(const stop=Date.now()+10000;!report.reads.slice(mark).some(r=>read.test(r.path))&&Date.now()<stop;)await sleep(25);
   await quiet();await sleep(200);await quiet();
   await openRecord(false);seen[what].after=await on();
   const after=(await state()).record;seen[what].note=after.note;seen[what].refused=after.pass;
   assert(seen[what].after.pass!=='true'&&seen[what].after.withdraw.length>=1&&seen[what].after.withdraw.every(a=>a!=='true')&&!after.pass,what+': opened again, the pass and Withdraw are on: '+JSON.stringify(seen[what]));
  }
  // A pass that the record's press sends, and its reading again done.
  async function passes(words){
   await type('#cp-words',words);
   const mark=report.posts.length;
   await click(PASS);
   for(const stop=Date.now()+5000;!postsTo(passPath,mark).length&&Date.now()<stop;)await sleep(25);
   return postsTo(passPath,mark).length;
  }
  await setting({width:1440,theme:'light'});await open(page(stage,lang));await openRecord(false);
  const before=await counts();
  await closeWhileSent('pass',new RegExp('^'+passPath+'$'),()=>passes('Synthetic: a pass sent as the record closes.'));
  assert(seen.pass.during.pass==='true'&&(await counts()).checkpoints===before.checkpoints+1,'The pass was off while on its way, and is recorded once: '+JSON.stringify(seen.pass.during));
  shots.push(await shot('closed-while-passed-1440-en'));
  await closeWhileSent('withdraw',new RegExp('^'+passPath+'/nk_[0-9a-hjkmnp-tv-z]{12}/withdraw$'),()=>click('.side .rec [data-nx-act="withdraw"]'));
  assert(seen.withdraw.during.withdraw[0]==='true','Withdraw was off while on its way: '+JSON.stringify(seen.withdraw.during));
  seen.sent=await passes('Synthetic: a pass after a withdrawal sent as the record closed.');
  assert(seen.sent===1,'Opened again, a press of the pass sends it: '+JSON.stringify(seen.sent));
  await waitFor(`document.querySelector('.side .rec #cp-words')?.value===''`);await quiet();await paint();
  assert((await counts()).checkpoints===before.checkpoints+2,'Two passes recorded');
  shots.push(await shot('closed-while-withdrawn-1440-en'));
  judge('closed while sent',await pageChecks(1440),since);
  return{evidence:'fixture server (two real passes and a real withdrawal); a pass and the withdrawal held by the suite (a delay that it makes) while the record closed',seen,screenshots:shots};
 });

 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.blockedExternalOrigins.length,'The page asked another origin: '+report.blockedExternalOrigins.join());
 assert(!report.runtimeExceptions.length,'The page threw: '+JSON.stringify(report.runtimeExceptions));
 const expected=2+2+9;
 report.status=report.tests.length===expected&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 closing=true;
 try{if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();await browser.stop();report.browserExited=true;}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
