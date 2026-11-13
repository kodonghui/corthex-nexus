/**
 * TASK-273: the first page (SCR-110) in a browser. Its seven states at 390 and 1,440 pixels in
 * both themes and languages; answers in place that stay until the page is loaded again
 * (choice 19); a try after a lost reply with the same write ID (rule 4); reading again, the
 * notices and the cards' order (rules 6 and 7); times in the browser's time zone (rule 2);
 * hit areas (rule 14); and 0.2's fragments on / (SPEC-154), whose words open the top bar's
 * search there (SCR-116). Node 24 built-ins only; an owned
 * headless Chrome over CDP. Requires NEXUS_QA_HOME=1, the opt-in view-server, NEXUS_CHROME
 * and NEXUS_QA_ORIGIN. Synthetic loopback fixture only. The page's writes reach the fixture
 * server, except those that a test answers itself, which the report lists as mocked; the
 * suite's own "other tab" writes go to the fixture through /api, as the page's do.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {label,labels,codeMessage} from '../src/draw/words.js';
import {stagePath} from '../src/draw/stages.js';
import {clock} from '../src/draw/html.js';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_HOME!=='1')throw Error('Use only the opt-in synthetic first page fixture');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,project='qa-home';
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'home-');
const {folder,profile}=browser;
const report={schema:'nexus-home-browser-regression/1',scope:'synthetic loopback fixture only',evidence:'page measurement and screenshots; answers either reach the fixture server (real) or are answered by the suite (mocked), as each test says',
 startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],blockedExternalOrigins:[],posts:[],otherTab:[],runtimeExceptions:[]};
const softDeadline=Date.now()+165000;
let ws,session,seq=0,held=null,failing=[],responses=[],closing=false,loads=0;
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
async function waitFor(expression,timeout=10000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await evaluate(expression))return;await sleep(25);}throw Error('Page wait timed out: '+expression);}
async function paint(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function setting({width,height=844,theme='light',touch=false}){
 await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
 await command('Emulation.setTouchEmulationEnabled',touch?{enabled:true,maxTouchPoints:1}:{enabled:false});
}
async function space(name){
 await command('Network.deleteCookies',{name:'nexus-qa-space',url:origin});
 if(name)await command('Network.setCookie',{name:'nexus-qa-space',value:name,url:origin,path:'/'});
}
// Navigation returns once the page is parsed; its held code may not have run yet.
async function open(route,{ready=true}={}){
 const url=origin+route;await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url});
 await waitFor(`location.href===${JSON.stringify(url)}&&document.readyState!=='loading'&&!!document.getElementById('view-data')`);
 if(ready){await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await settled();}
 await paint();
}
// No answer is being sent and no reading runs.
async function settled(){await waitFor(`!document.querySelector('[data-nx-entry] button[aria-disabled="true"]')&&(document.querySelector('.home .upd')?.textContent||'')===''`);}
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
 finally{held=null;failing=[];responses=[];try{await space(null);}catch{}}
 await out('results.json',report);
}
async function release(){const active=held;held=null;if(!active)return;for(const id of active.requests)await command('Fetch.continueRequest',{requestId:id});}
const problem=(status,code,extra={})=>({status,headers:[{name:'Content-Type',value:'application/problem+json'}],body:JSON.stringify({type:'about:blank',title:'Synthetic refusal',status,code,traceId:'tr_qa_'+code,...extra})});
async function onPaused(event){
 const url=new URL(event.request.url),method=event.request.method,headers=Object.fromEntries(Object.entries(event.request.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(method==='POST')report.posts.push({path:url.pathname,write:headers['idempotency-key']||null,at:new Date().toISOString()});
 if(failing.some(pattern=>pattern.test(url.pathname))){report.interceptions.push({path:url.pathname,method,action:'failed',at:new Date().toISOString()});await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'ConnectionRefused'});return;}
 const rule=responses.find(r=>r.method===method&&r.pattern.test(url.pathname));
 if(rule){
  if(rule.once)responses.splice(responses.indexOf(rule),1);
  report.interceptions.push({path:url.pathname,method,action:'mocked '+rule.status,at:new Date().toISOString()});
  await command('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:rule.status,responseHeaders:rule.headers,body:Buffer.from(rule.body||'').toString('base64')});return;
 }
 if(held&&held.pattern.test(url.pathname)&&(!held.method||held.method===method)){held.requests.push(event.requestId);report.interceptions.push({path:url.pathname,method,action:'held',at:new Date().toISOString()});return;}
 // A request that the page dropped while it was paused, as when a test navigates on before
 // the fonts that the page adds after its first paint have loaded, has no interception left
 // to continue: Chrome answers "Invalid InterceptionId", which is recorded, not a failure.
 try{await command('Fetch.continueRequest',{requestId:event.requestId});}
 catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;report.interceptions.push({path:url.pathname,method,action:'dropped by the page',at:new Date().toISOString()});}
}
// A write of another tab or the agent's, to the fixture server through /api, as the page's go.
let otherSerial=0;
async function otherTab(pathname){
 const write='nw_'+(++otherSerial).toString(32).padStart(12,'0');
 const response=await fetch(origin+pathname,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Idempotency-Key':JSON.stringify(write)},body:'{}',signal:AbortSignal.timeout(10000)});
 report.otherTab.push({path:pathname,status:response.status});
 assert(response.ok,'The other tab\'s write failed: '+pathname+' '+response.status);return response.json();
}
async function serverGet(pathname){const response=await fetch(origin+pathname,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});return{status:response.status,data:await response.json()};}
// One entry as the page shows it.
const ENTRY=`((id)=>{const e=document.querySelector('[data-nx-entry="'+CSS.escape(id)+'"]');if(!e)return null;const msg=e.querySelector('.msg');
 return{answered:e.classList.contains('answered'),kind:e.querySelector('.kind')?.textContent,buttons:[...e.querySelectorAll('.acts button')].map(b=>({act:b.dataset.nxAct,text:b.textContent,disabled:b.disabled,wait:b.dataset.nxWait||null,aria:b.getAttribute('aria-disabled')})),
  links:[...e.querySelectorAll('.acts a')].map(a=>({text:a.textContent,href:a.getAttribute('href')})),res:e.querySelector('.res')?.textContent||null,record:e.querySelector('.res a')?.getAttribute('href')||null,
  msg:msg?{tone:[...msg.classList].find(c=>c!=='msg'),role:msg.getAttribute('role'),text:msg.querySelector('.t')?.textContent,trace:msg.querySelector('.tid')?.textContent||null,retry:msg.querySelector('[data-nx-act=retry]')?.textContent||null,links:[...msg.querySelectorAll('a')].map(a=>({text:a.textContent,href:a.getAttribute('href')}))}:null,
  focus:document.activeElement?.dataset?.nxFocus||null};})`;
const entry=id=>evaluate(ENTRY+'('+JSON.stringify(id)+')');
const ids=()=>evaluate(`[...document.querySelectorAll('[data-nx-entry]')].map(e=>e.dataset.nxEntry)`);
const heading=()=>evaluate(`document.getElementById('mine-h')?.textContent||null`);
const cards=()=>evaluate(`[...document.querySelectorAll('.pcard footer a')].map(a=>a.getAttribute('href').slice(3))`);
const notice=()=>evaluate(`(()=>{const b=document.querySelector('.home > .notes .bar');return b?{tone:[...b.classList].find(c=>c!=='bar'),text:b.querySelector('.t').textContent,button:b.querySelector('button')?.textContent||null,act:b.querySelector('button')?.dataset.nxAct||null}:null;})()`);
// Each project of the agent to-do by its title, beside which "{n} not read yet" shows since TASK-298.
const todo=()=>evaluate(`Object.fromEntries([...document.querySelectorAll('.todo .pj')].map(p=>[p.querySelector('h3 > span:first-child').textContent,Object.fromEntries([...p.querySelectorAll('a')].map(a=>[a.querySelector('span').textContent,a.querySelector('b').textContent]))]))`);
const sideways=()=>evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth})`);
async function noSideways(where){const s=await sideways();assert(s.scrollWidth<=s.width&&s.bodyWidth<=s.width,'The page scrolls sideways '+where+': '+JSON.stringify(s));return s;}
// A control by the keyboard: the focus on it, then Enter, as a person who tabs to it does.
async function press(selector){
 const found=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.scrollIntoView({block:'center'});e.focus();return document.activeElement===e;})()`);
 assert(found,'No control to focus: '+selector);
 for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
}
// A control by the mouse, at its centre.
async function click(selector){
 const at=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'No control to click: '+selector);
 for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x:at.x,y:at.y,button:'left',clickCount:1});
}
const button=(id,act)=>`[data-nx-entry="${id}"] button[data-nx-act="${act}"]`;
const retry=id=>`[data-nx-entry="${id}"] button[data-nx-act="retry"]`;
async function answered(id){await waitFor(`!!document.querySelector('[data-nx-entry="${id}"] .res, [data-nx-entry="${id}"] .msg')`);await settled();return entry(id);}
const writesTo=pathname=>report.posts.filter(post=>post.path===pathname).map(post=>post.write);
const readAgain=()=>evaluate(`document.dispatchEvent(new Event('visibilitychange'))`);

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json(),home=fixture.home;
 assert(home?.project===project&&home.second==='qa-home-two'&&['accept','dismiss','stale','retry','reused','sending'].every(k=>/^np_/.test(home[k]||''))&&['recommended','taken','closed','checkpoint','gonePart','question','forAgent'].every(k=>/^nc_/.test(home[k]||'')),'The origin is not the opt-in synthetic first page fixture');
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),entries=JSON.parse(metadataBytes).entries;
 assert(/^\/code\/page\.[a-f0-9]{8}\.js$/.test(entries['page-js']||''),'Content-hashed page code is required');
 report.preflight={fixture:home,build:{entries:{'page-js':entries['page-js'],'page-css':entries['page-css']},sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
 const code=new RegExp('^'+entries['page-js'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
 const api='/api/spaces/'+project,accept=id=>api+'/proposals/'+id+'/accept',take=id=>api+'/comments/'+id+'/recommended';
 const browserEnv={...process.env};for(const key of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(key))delete browserEnv[key];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],browserEnv);
 const endpoint=await browser.endpoint();
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);}else if(m.sessionId===session){if(m.method==='Page.loadEventFired')loads++;if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error)+' ('+m.params.request.method+' '+new URL(m.params.request.url).pathname+')';});if(m.method==='Runtime.exceptionThrown')report.runtimeExceptions.push({at:new Date().toISOString(),text:m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text});}};
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});

 // The seven states at both widths, in both themes and languages. Loading holds the page's
 // code; stale, error and permission are answered by the suite (mocked), so that the
 // fixture's entries stay open for the real answers below; nothing-waits and empty are
 // two more fixture servers, chosen by a cookie.
 for(const [lang,theme]of[['en','light'],['ko','dark'],['en','dark'],['ko','light']])for(const width of[390,1440]){
  await test(`states-${lang}-${theme}-${width}`,async()=>{
   const tag=`${lang}-${theme}-${width}`,answers=labels('Answers',lang),seen={};await setting({width,theme});
   held={pattern:code,requests:[]};await open('/?lang='+lang,{ready:false});
   for(const stop=Date.now()+10000;!held.requests.length&&Date.now()<stop;)await sleep(25);
   assert(held.requests.length===1,'The page asks for its code once, and the suite holds it');
   seen.loading=await evaluate(`({code:document.documentElement.dataset.nxCode||null,waiting:[...document.querySelectorAll('.home button')].map(b=>b.disabled&&b.dataset.nxWait).filter(Boolean),links:document.querySelectorAll('.home a[href]').length,heading:document.getElementById('mine-h').textContent})`);
   assert(seen.loading.code===null&&seen.loading.waiting.length>=12&&seen.loading.waiting.every(w=>w==='answer'||w==='order'),'#loading: the answers and the order wait for the code: '+JSON.stringify(seen.loading));
   const loading=await shot('loading-'+tag);
   await release();await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await settled();await paint();
   seen.normal=await entry(home.accept);
   assert(seen.normal.buttons.map(b=>[b.act,b.text,b.disabled,b.wait]).join()===[['accept',answers[0],false,null],['dismiss',answers[1],false,null]].join(),'#normal: Accept and Dismiss work: '+JSON.stringify(seen.normal));
   assert((await entry(home.checkpoint)).links[0]?.text===answers[5]&&(await entry(home.question)).buttons.length===0,'#normal: each kind with its answers');
   assert(seen.normal.kind===labels("An entry's kind",lang)[0],'The entry speaks the page\'s language');
   // A picture that is not current: its flag shows the icon beside the whole word on one
   // line, inside its small view and clear of the count of comments.
   seen.flag=await evaluate(`(()=>{const f=document.querySelector('.home .thumb .flag');if(!f)return null;const pic=f.closest('.pic'),count=pic.querySelector('.cnt'),word=f.querySelector(':scope > span');
    const r=e=>e.getBoundingClientRect(),a=r(f),p=r(pic),i=r(f.querySelector('svg')),t=r(word),c=count&&r(count),line=parseFloat(getComputedStyle(word).lineHeight);
    return{flag:[a.x,a.y,a.width,a.height].map(Math.round),icon:[i.width,i.height],apart:i.right<=t.left+0.5,whole:word.scrollWidth<=word.clientWidth,oneLine:t.height<line*1.5,
     inside:a.left>=p.left&&a.right<=p.right&&a.top>=p.top&&a.bottom<=p.bottom,clear:!c||a.right<=c.left||a.left>=c.right||a.bottom<=c.top||a.top>=c.bottom,count:!!c}})()`);
   assert(seen.flag?.apart&&seen.flag.icon[0]<=seen.flag.flag[3]&&seen.flag.whole&&seen.flag.oneLine&&seen.flag.inside&&seen.flag.clear&&seen.flag.count,'#normal: the flag of a picture that is not current: '+JSON.stringify(seen.flag));
   await noSideways('#normal');const normal=await fullShot('normal-'+tag);
   // Stale, error and permission under their entries, and the notice of a reading that failed.
   responses=[{method:'POST',pattern:new RegExp(accept(home.stale)+'$'),...problem(409,'proposal_not_open',{state:'accepted'})},
    {method:'POST',pattern:new RegExp(take(home.recommended)+'$'),...problem(500,'internal')},
    {method:'POST',pattern:new RegExp(accept(home.retry)+'$'),...problem(403,'user_only')},
    {method:'GET',pattern:/^\/api\/home$/,...problem(503,'busy')}];
   await click(button(home.stale,'accept'));seen.stale=await answered(home.stale);
   await click(button(home.recommended,'recommended'));seen.error=await answered(home.recommended);
   await click(button(home.retry,'accept'));seen.permission=await answered(home.retry);
   seen.unread=await notice();
   assert(seen.stale.msg?.text===codeMessage('proposal_not_open',lang,{state:labels('Proposal states',lang)[1]})&&seen.stale.res===label('Answered',0,lang)&&!seen.stale.buttons.length,'#stale: '+JSON.stringify(seen.stale));
   assert(seen.error.msg?.tone==='err'&&seen.error.msg.role==='alert'&&seen.error.msg.text===codeMessage('internal',lang)&&seen.error.msg.trace===codeMessage('Trace ID',lang,{traceId:'tr_qa_internal'})&&seen.error.msg.retry===labels('Page buttons',lang)[0]&&seen.error.buttons.length===1,'#error: '+JSON.stringify(seen.error));
   assert(seen.permission.msg?.tone==='warn'&&seen.permission.msg.text===codeMessage('user_only',lang)&&seen.permission.buttons.length===2,'#permission: '+JSON.stringify(seen.permission));
   assert(seen.unread?.tone==='err'&&seen.unread.text===codeMessage('Could not update',lang)&&seen.unread.act==='read','#error: reading again that failed: '+JSON.stringify(seen.unread));
   await noSideways('with the messages');const messages=await fullShot('stale-error-permission-'+tag);
   // A sign-in that expired, when the page reads again (rule 7).
   responses=[{method:'GET',pattern:/^\/api\/home$/,status:302,headers:[{name:'Location',value:origin+'/cdn-cgi/access/login/qa'}],body:''}];
   await click('.home > .notes button[data-nx-act="read"]');await waitFor(`!!document.querySelector('.home > .notes .bar.warn')`);await settled();
   seen.signIn=await notice();
   assert(seen.signIn.text===codeMessage('Sign-in expired',lang)&&seen.signIn.button===labels('Page buttons',lang)[2]&&seen.signIn.act==='sign-in','#permission: the sign-in bar: '+JSON.stringify(seen.signIn));
   const signIn=await shot('sign-in-'+tag);responses=[];
   // Nothing waits: a server with a project and nothing for the user.
   await space('quiet');await open('/?lang='+lang);
   seen.quiet=await evaluate(`({none:document.querySelector('.empty-l')?.innerText||null,entries:document.querySelectorAll('[data-nx-entry]').length,cards:document.querySelectorAll('.pcard').length,todo:document.querySelectorAll('.todo .pj a').length})`);
   assert(seen.quiet.entries===0&&seen.quiet.none?.includes(labels('Nothing waits',lang)[0])&&seen.quiet.cards===1&&seen.quiet.todo===1,'#nothing-waits: '+JSON.stringify(seen.quiet));
   await noSideways('#nothing-waits');const quiet=await fullShot('nothing-waits-'+tag);
   // Empty: a server without a snapshot.
   await space('empty');await open('/?lang='+lang);
   seen.empty=await evaluate(`({lead:document.querySelector('.emp .lead')?.textContent||null,steps:document.querySelectorAll('.hsteps li').length,code:document.querySelectorAll('.hsteps code').length,mine:!!document.getElementById('mine-h'),hub:document.querySelector('header.tb a[href="/hub"]')?.getAttribute('href')||null})`);
   assert(seen.empty.lead===labels('Nothing pushed',lang)[0]&&seen.empty.steps===4&&seen.empty.code>=3&&!seen.empty.mine,'#empty: '+JSON.stringify(seen.empty));
   await noSideways('#empty');const empty=await fullShot('empty-'+tag);
   return{evidence:'fixture pages; the stale, error and permission answers are mocked',seen,screenshots:[loading,normal,messages,signIn,quiet,empty]};
  });
 }

 // Answers in place (choice 19), against the fixture server: each kind, and the entries that
 // another tab or the agent answered meanwhile. They stay, marked, until the page loads again.
 await test('answers-stay-in-place-until-the-page-loads-again',async()=>{
  const lang='en',seen={};await setting({width:1440,theme:'light'});await open('/?lang='+lang);
  const first=await ids(),before=await todo();seen.headingBefore=await heading();
  // Another tab accepts a proposal; this page then accepts it too.
  await otherTab(accept(home.stale));await press(button(home.stale,'accept'));seen.stale=await answered(home.stale);
  assert(seen.stale.msg?.text===codeMessage('proposal_not_open',lang,{state:'accepted'})&&seen.stale.res==='Accepted','Stale proposal: '+JSON.stringify(seen.stale));
  // Another tab takes a recommendation: the server had taken it already.
  await otherTab(take(home.taken));await press(button(home.taken,'recommended'));seen.taken=await answered(home.taken);
  assert(seen.taken.res===label('Answered',2,lang)&&seen.taken.msg?.text===label('Done already',0,lang)&&seen.taken.msg.tone==='info','Done already: '+JSON.stringify(seen.taken));
  // The comment is closed meanwhile: it no longer waits for an answer.
  await otherTab(api+'/comments/'+home.closed+'/answered');await press(button(home.closed,'recommended'));seen.closed=await answered(home.closed);
  assert(seen.closed.msg?.text===codeMessage('not_recommended',lang)&&!seen.closed.buttons.length,'Not recommended: '+JSON.stringify(seen.closed));
  // This page's own answers.
  await press(button(home.accept,'accept'));seen.accept=await answered(home.accept);
  assert(seen.accept.res==='Accepted'&&seen.accept.answered&&!seen.accept.buttons.length&&!seen.accept.msg,'Accept: '+JSON.stringify(seen.accept));
  assert(seen.accept.focus===home.accept+':after','The focus moves to the answer\'s mark: '+seen.accept.focus);
  await press(button(home.dismiss,'dismiss'));seen.dismiss=await answered(home.dismiss);assert(seen.dismiss.res==='Dismissed','Dismiss: '+JSON.stringify(seen.dismiss));
  await press(button(home.recommended,'recommended'));seen.recommended=await answered(home.recommended);assert(seen.recommended.res===label('Answered',2,lang),'As recommended: '+JSON.stringify(seen.recommended));
  await press(button(home.checkpoint,'recommended'));seen.checkpoint=await answered(home.checkpoint);
  assert(seen.checkpoint.res===label('Answered',3,lang)+' '+label('The head',4,lang)&&seen.checkpoint.record===stagePath(project,'sample','05-erd'),'Checkpoint: '+JSON.stringify(seen.checkpoint));
  // A checkpoint asked for on a part that the snapshot no longer holds: the talk instead.
  await press(button(home.gonePart,'recommended'));seen.gonePart=await answered(home.gonePart);
  assert(seen.gonePart.msg?.text===codeMessage('part_not_found',lang)&&seen.gonePart.msg.links[0]?.href===stagePath(project,'gone','05-erd')+'#talk='+home.gonePart&&seen.gonePart.buttons.length===1,'Part not found: '+JSON.stringify(seen.gonePart));
  // Every entry stays where it was; my turn and the agent to-do read again.
  const after=await ids(),now=await todo();seen.headingAfter=await heading();seen.todo={before,after:now};
  assert(JSON.stringify(after)===JSON.stringify(first),'The entries moved or left: '+JSON.stringify({first,after}));
  const total=text=>Number(String(text).match(/\((\d+)/)[1]);
  assert(total(seen.headingAfter)===total(seen.headingBefore)-7,'My turn\'s count drops by the seven that no longer wait: '+JSON.stringify([seen.headingBefore,seen.headingAfter]));
  const lists=labels('Agent to-do',lang),mine=before[home.title]||{},later=now[home.title]||{},n=(list,key)=>Number(list[lists[key]]||0);
  assert(n(later,1)===n(mine,1)+3&&n(later,3)===n(mine,3)+2&&n(later,4)===n(mine,4)+1,'The agent to-do reads again: three comments, two reflections and a checkpoint for the agent: '+JSON.stringify(seen.todo));
  const fullAnswered=await fullShot('answered-1440');
  const server=await serverGet(api+'/proposals/'+home.accept);
  assert(server.status===200&&server.data.state==='accepted','The server holds the accepted proposal: '+JSON.stringify(server.data?.state));
  // Loaded again, the entries that no longer wait are gone; the others stay.
  await open('/?lang='+lang);const reloaded=await ids();seen.reloaded=reloaded;
  for(const key of['stale','taken','closed','accept','dismiss','recommended','checkpoint'])assert(!reloaded.includes(home[key]),key+' is still in my turn after a reload');
  for(const key of['gonePart','question','retry','reused','sending'])assert(reloaded.includes(home[key]),key+' left my turn');
  return{evidence:'fixture server (real writes); the other tab\'s writes through /api',seen,screenshot:fullAnswered,writes:report.posts.slice(-8)};
 });

 // Rule 4: Sending… while an answer is sent, one write ID for every try of the same answer,
 // and a new one after write_id_reused; a sign-in that expired on an answer (rule 7).
 await test('repeats-keep-their-write-id-390-ko-dark',async()=>{
  const lang='ko',seen={},mark=report.posts.length;await setting({width:390,theme:'dark'});await open('/?lang='+lang);
  const writesTo=pathname=>report.posts.slice(mark).filter(post=>post.path===pathname).map(post=>post.write);
  held={pattern:new RegExp(accept(home.sending)+'$'),method:'POST',requests:[]};
  await press(button(home.sending,'accept'));await waitFor(`!!document.querySelector('${button(home.sending,'accept')}[aria-disabled="true"]')`);
  seen.sending=await entry(home.sending);
  assert(seen.sending.buttons.every(b=>b.aria==='true'&&!b.disabled)&&seen.sending.buttons[0].text===codeMessage('Sending',lang)&&seen.sending.focus===home.sending+':accept','Sending…: '+JSON.stringify(seen.sending));
  for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
  await click(button(home.sending,'dismiss'));await sleep(150);
  assert(writesTo(accept(home.sending)).length===1&&!writesTo(api+'/proposals/'+home.sending+'/dismiss').length,'A second press while sending sends nothing');
  const sending=await shot('sending-390-ko-dark');
  await release();seen.sent=await answered(home.sending);assert(seen.sent.res===label('Answered',0,lang),'Sent: '+JSON.stringify(seen.sent));
  // No connection, then the server's error, then the answer: the same write ID each time.
  failing=[new RegExp(accept(home.retry)+'$')];
  await press(button(home.retry,'accept'));seen.network=await answered(home.retry);failing=[];
  assert(seen.network.msg?.text===codeMessage('No connection',lang)&&seen.network.msg.retry,'No connection: '+JSON.stringify(seen.network));
  responses=[{method:'POST',pattern:new RegExp(accept(home.retry)+'$'),once:true,...problem(500,'internal')}];
  await press(retry(home.retry));await waitFor(`document.querySelector('[data-nx-entry="${home.retry}"] .tid')?.textContent.includes('tr_qa_internal')`);await settled();seen.internal=await entry(home.retry);
  await press(retry(home.retry));seen.retried=await answered(home.retry);await waitFor(`!!document.querySelector('[data-nx-entry="${home.retry}"] .res')`);seen.retried=await entry(home.retry);
  const keys=writesTo(accept(home.retry));
  assert(keys.length===3&&new Set(keys).size===1&&/^"nw_[0-9a-z]{12}"$/.test(keys[0]),'Every try of one answer sends its write ID: '+JSON.stringify(keys));
  assert(seen.retried.res===label('Answered',0,lang)&&seen.retried.focus===home.retry+':after','The third try answers: '+JSON.stringify(seen.retried));
  // write_id_reused: Try again makes a new write ID.
  responses=[{method:'POST',pattern:new RegExp(accept(home.reused)+'$'),once:true,...problem(409,'write_id_reused')}];
  await press(button(home.reused,'accept'));seen.reused=await answered(home.reused);
  assert(seen.reused.msg?.text===codeMessage('write_id_reused',lang),'write_id_reused: '+JSON.stringify(seen.reused));
  await press(retry(home.reused));await waitFor(`!!document.querySelector('[data-nx-entry="${home.reused}"] .res')`);await settled();
  const reusedKeys=writesTo(accept(home.reused));
  assert(reusedKeys.length===2&&reusedKeys[0]!==reusedKeys[1],'A new write ID after write_id_reused: '+JSON.stringify(reusedKeys));
  // A sign-in that expired while answering: the bar, and Sign in again loads the page.
  responses=[{method:'POST',pattern:new RegExp(take(home.gonePart)+'$'),status:302,headers:[{name:'Location',value:origin+'/cdn-cgi/access/login/qa'}],body:''}];
  await press(button(home.gonePart,'recommended'));await waitFor(`!!document.querySelector('.home > .notes .bar.warn')`);await settled();
  seen.signIn={notice:await notice(),entry:await entry(home.gonePart)};
  assert(seen.signIn.notice?.text===codeMessage('Sign-in expired',lang)&&!seen.signIn.entry.msg&&seen.signIn.entry.buttons.length===1,'Sign-in on an answer: '+JSON.stringify(seen.signIn));
  const signIn=await shot('sign-in-answer-390-ko-dark'),loaded=loads;
  await click('.home > .notes button[data-nx-act="sign-in"]');
  for(const stop=Date.now()+10000;loads===loaded&&Date.now()<stop;)await sleep(25);
  assert(loads>loaded,'Sign in again loads the page');
  await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await settled();
  assert((await ids()).includes(home.gonePart)&&!(await notice()),'The page comes back with the entry');
  await noSideways('390');
  return{evidence:'mocked failures, then the fixture server; write IDs as sent',seen,keys,reusedKeys,screenshots:[sending,signIn]};
 });

 // Reading again (rule 6): Updating… while it runs, a card pushed again, a reading that
 // fails and Try again; and the cards' order, kept in the browser.
 await test('reading-again-and-the-order-1440-ko',async()=>{
  const lang='ko',seen={};await setting({width:1440,theme:'light'});
  await open('/?lang='+lang);await evaluate(`localStorage.removeItem('nexus0.3:order')`);await open('/?lang='+lang);seen.byName=await cards();
  assert(JSON.stringify(seen.byName)===JSON.stringify([...seen.byName].sort()),'The cards by name first: '+JSON.stringify(seen.byName));
  await click('.seg button[data-nx-order="push"]');await paint();seen.byPush=await cards();
  seen.pressed=await evaluate(`[...document.querySelectorAll('.seg button')].map(b=>b.getAttribute('aria-pressed'))`);
  assert(seen.byPush[0]===home.second&&seen.byPush.indexOf(home.second)<seen.byPush.indexOf(project)&&seen.pressed.join()==='false,true','By the last push: '+JSON.stringify(seen));
  assert(await evaluate(`localStorage.getItem('nexus0.3:order')`)==='push','The order is kept in the browser');
  await open('/?lang='+lang);seen.kept=await cards();assert(JSON.stringify(seen.kept)===JSON.stringify(seen.byPush),'The kept order after a reload');
  // A card pushed again, while Updating… shows.
  const pushed=await (await fetch(origin+'/__qa/push-again',{method:'POST',signal:AbortSignal.timeout(10000)})).json();
  pushed.received_at=(await serverGet('/api/home')).data.projects.find(card=>card.name===home.second)?.pushed_at;
  assert(pushed.name===home.second&&pushed.received_at,'The fixture pushed the second project again: '+JSON.stringify(pushed));
  held={pattern:/^\/api\/home$/,method:'GET',requests:[]};await readAgain();
  await waitFor(`document.querySelector('.home .upd').textContent===${JSON.stringify(codeMessage('Updating',lang))}`);seen.updating=await shot('updating-1440-ko');
  await release();await settled();
  seen.chip=await evaluate(`(()=>{const c=[...document.querySelectorAll('.pcard')].find(a=>a.querySelector('footer a').getAttribute('href')==='/p/${home.second}');const k=c.querySelector('header .kind');return k?{text:k.textContent,datetime:k.querySelector('time')?.getAttribute('datetime')}:null;})()`);
  assert(seen.chip?.datetime===pushed.received_at&&seen.chip.text===label('Projects',7,lang,{time:clock(pushed.received_at,true)}),'Pushed again at {time}: '+JSON.stringify({chip:seen.chip,pushed}));
  // A reading that fails, then Try again.
  responses=[{method:'GET',pattern:/^\/api\/home$/,once:true,...problem(500,'internal')}];await readAgain();
  await waitFor(`!!document.querySelector('.home > .notes .bar.err')`);seen.unread=await notice();
  assert(seen.unread.text===codeMessage('Could not update',lang)&&seen.unread.button===labels('Page buttons',lang)[0],'Could not update: '+JSON.stringify(seen.unread));
  const unread=await shot('could-not-update-1440-ko');
  await click('.home > .notes button[data-nx-act="read"]');await waitFor(`!document.querySelector('.home > .notes .bar')`);await settled();
  await click('.seg button[data-nx-order="name"]');await paint();seen.back=await cards();
  assert(JSON.stringify(seen.back)===JSON.stringify(seen.byName)&&await evaluate(`localStorage.getItem('nexus0.3:order')`)==='name','Back to by name');
  return{evidence:'fixture server; one mocked failed reading',seen,screenshots:[seen.updating,unread]};
 });

 // Rule 2: the server writes UTC; the code writes the same elements in the browser's time
 // zone, here Asia/Seoul, and nothing moves.
 await test('times-in-the-browsers-time-zone',async()=>{
  await setting({width:1440});await command('Emulation.setTimezoneOverride',{timezoneId:'Asia/Seoul'});
  try{
   // The fonts stay out, so that only the code differs (they join after the first paint).
   held={pattern:code,requests:[]};failing=[/^\/code\/fonts\.[a-f0-9]{8}\.css$/];await open('/?lang=en',{ready:false});
   for(const stop=Date.now()+10000;!held.requests.length&&Date.now()<stop;)await sleep(25);
   const read=`[...document.querySelectorAll('.home time')].map(t=>{const r=t.getBoundingClientRect();return{datetime:t.getAttribute('datetime'),text:t.textContent,box:[r.x,r.y,r.width,r.height].map(Math.round)};})`;
   const before=await evaluate(read);await release();await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await settled();await paint();const after=await evaluate(read);
   assert(before.length>=5&&before.length===after.length,'The page holds its times: '+before.length+' and '+after.length);
   const seoul=value=>{const d=new Date(Date.parse(value)+9*3600000);return d.toISOString().slice(0,16).replace('T',' ');};
   before.forEach((t,i)=>{assert(t.text===clock(t.datetime),'Before the code, UTC: '+JSON.stringify(t));assert(after[i].text===seoul(t.datetime),'After, Seoul: '+JSON.stringify(after[i]));assert(after[i].box[2]===t.box[2]&&after[i].box[3]===t.box[3],'A time changed size: '+JSON.stringify([t,after[i]]));});
   return{evidence:'fixture page',first:{utc:before[0].text,seoul:after[0].text},count:after.length};
  }finally{await command('Emulation.setTimezoneOverride',{timezoneId:''});}
 });

 // Rule 14 at 390 pixels: a finger hits each control 22 pixels around its centre.
 await test('hit-areas-at-390',async()=>{
  await setting({width:390,touch:true});await open('/?lang=ko');
  await waitFor(`!!document.querySelector('link[data-nexus-css="fonts"]')?.sheet&&document.fonts.status==='loaded'`);await paint();
  const coarse=await evaluate(`matchMedia('(pointer:coarse)').matches`);
  const probe=`((scope)=>{const controls=[...document.querySelectorAll(scope)].filter(e=>e.checkVisibility({visibilityProperty:true}));
   return controls.map(e=>{e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    const misses=[[0,-21],[0,21],[-21,0],[21,0]].filter(([dx,dy])=>{const hit=document.elementFromPoint(x+dx,y+dy);return!hit||!(hit===e||e.contains(hit));});
    return{name:(e.textContent.trim()||e.className).slice(0,40),box:[r.x,r.y,r.width,r.height].map(Math.round),misses};});})`;
  const checked=[];
  for(const [name,scope]of[['answers','.home .acts button,.home .acts a'],['places','.home .where > a'],['agent to-do','.home .todo a'],['order','.home .seg button'],['cards','.home .pcard footer a,.home .thumb']]){
   const found=await evaluate(probe+'('+JSON.stringify(scope)+')');checked.push({name,found:found.length});
   assert(found.length>0,'No '+name);for(const c of found)assert(!c.misses.length,`${name}: ${c.name} misses ${JSON.stringify(c.misses)} at ${JSON.stringify(c.box)}`);
  }
  const heights=await evaluate(`[...document.querySelectorAll('.home .acts > *')].map(e=>Math.round(e.getBoundingClientRect().height))`);
  assert(heights.every(h=>h===44),'Under 1,024 pixels the answers are drawn 44 pixels high: '+heights.join());
  return{evidence:'fixture page, touch emulation',coarse,checked,screenshot:await shot('hit-areas-390')};
 });

 // SPEC-154: 0.2's fragments on / lead to their places; the words of #q=, and an ID that the
 // server does not find, open the top bar's search on the first page (SCR-116, TASK-277),
 // under 1,024 pixels over the top bar.
 await test('fragments-on-slash-lead-to-their-places',async()=>{
  await setting({width:390});const seen=[];
  const go=async(hash,expected)=>{
   await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url:origin+'/'+hash});
   const stop=Date.now()+10000;let at;
   while(Date.now()<stop){at=await evaluate(`location.pathname+location.hash`).catch(()=>null);if(at===expected&&await evaluate(`document.readyState==='complete'`).catch(()=>false))break;await sleep(50);}
   seen.push({hash,at});assert(at===expected,`${hash} leads to ${at}, not ${expected}`);
  };
  // The search, opened with its words, once its answer came: nothing of the fixture matches them.
  const searched=async words=>{
   const nothing=label('The search',4,'en',{q:words});
   await waitFor(`document.querySelector('.tb .spanel .pad p')?.textContent===${JSON.stringify(nothing)}`);
   const field=await evaluate(`(()=>{const t=document.querySelector('.tb'),i=t.querySelector('input[name="q"]');return{words:i.value,open:t.dataset.nxSearch||null,focused:document.activeElement===i,panel:!t.querySelector('.spanel').hidden};})()`);
   seen.push({words,field});assert(field.words===words&&field.open==='open'&&field.focused&&field.panel,'The search opens with the words: '+JSON.stringify(field));
  };
  await go('#q=retry%20payment','/#q=retry%20payment');await searched('retry payment');
  await go('#p='+project+'&id=REQ-107',stagePath(project,'sample','02-prd')+'#item=REQ-107');
  await go('#p='+project+'&id=TBL-999','/#q=TBL-999');await searched('TBL-999');
  await go('#p='+project+'&s=07-sitemap',stagePath(project,'sample','07-sitemap'));
  await go('#talk=nc_1','/#talk=nc_1');
  const current=await serverGet('/api/home'),card=current.data.projects.find(c=>c.name===project),part=card.parts[0];
  await go('#p='+project,stagePath(project,part.name,part.current||'01-domain'));
  return{evidence:'fixture server',seen};
 });

 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.blockedExternalOrigins.length,'The page asked another origin: '+report.blockedExternalOrigins.join());
 assert(!report.runtimeExceptions.length,'The page threw: '+JSON.stringify(report.runtimeExceptions));
 const expected=8+1+1+1+1+1+1;
 report.status=report.tests.length===expected&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 closing=true;
 try{if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();await browser.stop();report.browserExited=true;}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
