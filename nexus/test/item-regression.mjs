/**
 * TASK-277: the item (SCR-115) and the search (SCR-116) in a browser. The item's panel at 1,440
 * pixels in both themes and languages: #loading from the row while the page holds its reading,
 * then #normal with its fields, Details, context, source and trace, whose stage folds after six
 * links and opens the linked item at its place; the switch to the stage's whole talk and back;
 * Close, Escape and the browser's back button; on the ERD a table's own fields and its
 * discrepancy, commented on, then one that was resolved meanwhile; an item of another stage,
 * which leads there; #gone with its talk and the search for its ID; a reading that fails or is
 * refused, with the row's ID and text kept; and the revision's line on
 * why the stage does not show the item: a list narrowed past its row, with Show all, a picture
 * that is not current and one not drawn (rule 24); an entry of the talk picked on the DDD board's
 * context, which comes into sight, outlined, with its panel, and one on an item that left the
 * stage, which selects nothing (SPEC-209). Under 1,024 pixels the Item tab, which comes
 * forward for an item picked in the stage and stays behind the Talk tab for one picked in the
 * talk, with its hit areas at 390 and nothing wider than the page at 320 (rules 14 and 16); from
 * 1,024 to 1,279 the panel that the item opens, which Escape folds. The search from the top bar
 * of a stage and of the first page: the short words, the pause that asks once, 20 of 25 matches
 * with the line under them, the arrow keys, Escape, a press outside and Enter, which opens the
 * match at its place; the exact ID once per project, nothing found, an error, a refusal, a
 * sign-in that expired and an answer to older words, which is dropped; and under 1,024 pixels the
 * field over the top bar, Close and the matches that fill the screen. Node 24 built-ins only; an
 * owned headless Chrome over CDP. Requires NEXUS_QA_ITEM=1, the opt-in view-server, NEXUS_CHROME
 * and NEXUS_QA_ORIGIN. Synthetic loopback fixture only. The page's reads and writes reach the
 * fixture server, except those that a test answers, holds or fails itself, which the report
 * lists as mocked, held or failed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {label,labels,codeMessage,oldLabels} from '../src/draw/words.js';
import {stagePath,stageName,stageNumber} from '../src/draw/stages.js';
import {kindWord} from '../src/draw/item.js';
import {itemFields,reasonText} from '../ui/fields.js';
import {words} from '../ui/messages.js';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_ITEM!=='1')throw Error('Use only the opt-in synthetic item fixture');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,project='qa-item',part='sample',second='qa-item-two',commit='a'.repeat(40);
const page=(stage,lang,hash='',where=part,name=project)=>stagePath(name,where,stage)+'?lang='+lang+hash;
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'item-');
const {folder,profile}=browser;
const report={schema:'nexus-item-browser-regression/1',scope:'synthetic loopback fixture only',evidence:'page measurement and screenshots; reads and writes either reach the fixture server (real) or are answered, held or failed by the suite (mocked), as each test says',
 startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],blockedExternalOrigins:[],posts:[],reads:[],runtimeExceptions:[]};
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
// A wait that outlives a navigation of the page's own, such as a match or a trace link.
const NAVIGATED=/navigated or closed|Execution context was destroyed|Cannot find context/;
async function waitFor(expression,timeout=10000){const stop=Date.now()+timeout;while(Date.now()<stop){let ok=false;try{ok=await evaluate(expression);}catch(error){if(!NAVIGATED.test(String(error)))throw error;}if(ok)return;await sleep(25);}throw Error('Page wait timed out: '+expression);}
async function paint(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function setting({width,height=width<1024?844:900,theme='light',touch=false}){
 await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
 await command('Emulation.setTouchEmulationEnabled',touch?{enabled:true,maxTouchPoints:1}:{enabled:false});
}
// No reading runs in the side or the stage, the item is not loading and nothing is being sent.
// The words of a button that is sent, which show over its own words kept unseen (BUG-606).
const SENDING=JSON.stringify([codeMessage('Sending','en'),codeMessage('Sending','ko')]);
async function settled(){await waitFor(`(document.querySelector('.side .tupd')?.textContent||'')===''&&(document.querySelector('.stage .upd')?.textContent||'')===''&&!document.querySelector('.side .sk')&&![...document.querySelectorAll('.side button')].some(b=>${SENDING}.includes((b.querySelector('.keep > :not(.was)')||b).textContent.trim()))`);await paint();}
// The item's panel, read: its head, once its answer came.
const ready=id=>waitFor(`document.querySelector('.side .item .ih .id')?.textContent===${JSON.stringify(id)}&&!document.querySelector('.side .item .sk')&&!!document.querySelector('.side .item :is(.fields,.src,.msg)')`).then(settled);
// Navigation returns once the page is parsed; its held code may not have run yet.
// The page's code may add to the address's fragment, such as view=list for a picture that is not
// current, so the wait asks only for what the route's fragment names.
async function open(route,{ready=true}={}){
 const url=origin+route,[base,fragment='']=url.split('#');await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url});
 await waitFor(`location.href.split('#')[0]===${JSON.stringify(base)}&&${JSON.stringify(fragment)}.split('&').filter(Boolean).every(p=>('&'+location.hash.slice(1)+'&').includes('&'+p+'&'))&&document.readyState!=='loading'&&!!document.getElementById('view-data')`);
 if(ready){await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await settled();}
 await paint();
}
// A page that the page itself leads to, as a match's or a link's: its code ran and it settled.
async function arrived(pathname,hash){await waitFor(`location.pathname===${JSON.stringify(pathname)}&&location.hash===${JSON.stringify(hash)}&&document.readyState==='complete'&&document.documentElement.dataset.nxCode==='ready'`);await settled();}
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
 const url=new URL(event.request.url),method=event.request.method,where=url.pathname+url.search;
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(method==='POST')report.posts.push({path:url.pathname,body:event.request.postData||null,at:new Date().toISOString()});
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
// The mouse and the keyboard, as a person uses them.
async function clickAt(x,y){for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});}
async function click(selector){
 const at=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}));if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'No control to click: '+selector);await clickAt(at.x,at.y);await paint();
}
const KEYS={Escape:27,Enter:13,ArrowDown:40,ArrowUp:38};
async function press(key){for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:KEYS[key]});await paint();}
async function type(selector,text){await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await command('Input.insertText',{text});await paint();}
// A field emptied as a person empties it.
async function clear(selector){await evaluate(`(()=>{const t=document.querySelector(${JSON.stringify(selector)});t.value='';t.dispatchEvent(new Event('input',{bubbles:true}));})()`);await paint();}
const FIELD='.tb input[name="q"]';
// Words typed in the top bar's search, after which the suite waits for the read that they ask for.
async function searchFor(text,{each=false}={}){
 await clear(FIELD);const before=report.reads.length,asked='/api/search?q='+encodeURIComponent(text.trim());
 if(each)for(const character of text){await type(FIELD,character);await sleep(40);}else await type(FIELD,text);
 const stop=Date.now()+5000;while(Date.now()<stop&&!report.reads.slice(before).includes(asked))await sleep(25);
 assert(report.reads.slice(before).includes(asked),'The search did not ask for '+JSON.stringify(text));
 await waitFor(`(()=>{const p=document.querySelector('.tb .spanel');return!p.hidden&&p.querySelector('.st').textContent!==${JSON.stringify(labels('The search','en')[0])}&&p.querySelector('.st').textContent!==${JSON.stringify(labels('The search','ko')[0])};})()`);await paint();
 return report.reads.slice(before).filter(p=>p.startsWith('/api/search'));
}

// What the item's panel shows.
function itemState(){
 const q=s=>document.querySelector(s),all=(s,root=document)=>[...root.querySelectorAll(s)],txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():null;
 const panel=q('.side .item'),ws=q('.ws'),side=q('.side'),box=side?.getBoundingClientRect(),active=document.activeElement;
 const msg=m=>m&&{tone:m.classList[1],text:txt(m.querySelector('.t')),trace:txt(m.querySelector('.tid')),acts:all('button',m).map(b=>b.dataset.nxAct),buttons:all('button',m).map(txt)};
 const trace=key=>({head:txt(q('.item h3[data-nx-key="h-'+key+'"]')),groups:all('.item .trace[data-nx-key="t-'+key+'"] .tsg').map(g=>({head:txt(g.querySelector('.sgh')),links:all('a.a',g).map(a=>a.querySelector('.mono').textContent),hrefs:all('a.a',g).map(a=>a.getAttribute('href')),more:txt(g.querySelector(':scope > button, :scope > .mu'))}))});
 return{hash:location.hash,path:location.pathname,tab:ws?.dataset.nxTab||null,open:ws?.dataset.nxOpen||null,
  side:side&&side.checkVisibility()?[box.left,box.width].map(Math.round):null,panel:Boolean(panel&&panel.checkVisibility()),talk:!!q('.side .talk'),
  id:txt(panel?.querySelector('.ih .id')),idLines:panel?.querySelector('.ih .id')?.getClientRects().length??0,kind:txt(panel?.querySelector('.ih .kind')),
  sw:all('.side .seg.sw button').filter(b=>b.checkVisibility()).map(b=>b.dataset.nxSide+':'+b.getAttribute('aria-pressed')),
  text:txt(panel?.querySelector('.tx')),lang:panel?.querySelector('.tx')?.getAttribute('lang')??null,
  loading:!!panel?.querySelector('.sk'),loadingWords:txt(panel?.querySelector('[data-nx-key="loading"]')),
  fields:all('.side .item .fields > dt').map(dt=>[txt(dt),txt(dt.nextElementSibling)]),details:panel?.querySelector('.det pre')?.textContent??null,
  ctx:txt(panel?.querySelector('.ctx')),src:txt(panel?.querySelector('.src')),link:(a=>a&&{href:a.getAttribute('href'),target:a.target,rel:a.rel})(panel?.querySelector('.src a')),
  why:msg(panel?.querySelector('[data-nx-key="why"] .msg')),message:msg(panel?.querySelector(':is([data-nx-key="gone"],[data-nx-key="failed"],[data-nx-key="refused"]) .msg')),
  dscHead:txt(q('.item h3[data-nx-key="h-dsc"]')),dscs:all('.side .item .dsc').map(d=>({text:txt(d.querySelector('p')),pressed:d.querySelector('button')?.getAttribute('aria-pressed'),id:d.querySelector('button')?.dataset.nxDiscrepancy})),
  from:trace('from'),to:trace('to'),itk:txt(q('#itk-h')),entries:all('.side .item .itk li[data-nx-entry]').map(li=>li.dataset.nxEntry),heading:txt(q('#talk-h')),
  label:txt(q('.side :is(.talk,.item) > .box .lab')),box:!!q('.side .item > .box'),boxNote:msg(q('.side :is(.talk,.item) > .box .bnote .msg')),
  selected:txt(q('.stage .li[aria-current="true"] .id')),find:q('.stage input[name="q"]')?.value??null,rows:all('.stage .li[data-nx-item]').map(a=>a.dataset.nxItem),
  outlined:!!q('.pf svg.mks .mk-sel'),view:q('.stage [data-nx-act="view"][aria-pressed="true"]')?.dataset.nxView||null,
  tabs:all('.tabs .tab').filter(t=>t.checkVisibility()).map(t=>t.dataset.nxTab),
  active:active?.dataset?.nxFocus||active?.id||active?.tagName||null,activeItem:active?.closest?.('[data-nx-item]')?.dataset.nxItem||null,
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
}
const state=()=>evaluate(`(${itemState})()`);
// What the search shows.
function searchView(){
 const q=s=>document.querySelector(s),txt=e=>e?e.textContent.replace(/\s+/g,' ').trim():null,shown=e=>Boolean(e&&!e.hidden&&e.checkVisibility());
 const tb=q('.tb'),input=tb.querySelector('input[name="q"]'),panel=tb.querySelector('.spanel'),active=document.activeElement,box=e=>{const r=e.getBoundingClientRect();return[r.left,r.top,r.width,r.height].map(Math.round);};
 return{hash:location.hash,path:location.pathname,words:input.value,disabled:input.disabled,wait:input.dataset.nxWait||null,expanded:input.getAttribute('aria-expanded'),current:input.getAttribute('aria-activedescendant'),
  phone:tb.dataset.nxSearch||null,field:shown(input),panel:shown(panel),dim:shown(tb.querySelector('.sdim')),close:shown(tb.querySelector('.sclose')),button:shown(tb.querySelector('.sbtn')),
  status:shown(panel.querySelector('.sh2'))?txt(panel.querySelector('.st')):null,
  rows:[...panel.querySelectorAll('.ms .m')].map(li=>({id:txt(li.querySelector('.mono')),title:txt(li.querySelector('.clip')),where:txt(li.querySelector('.wh')),on:li.classList.contains('on'),selected:li.getAttribute('aria-selected'),key:li.id})),
  foot:shown(panel.querySelector('.foot'))?txt(panel.querySelector('.foot')):null,pad:shown(panel.querySelector('.pad'))?txt(panel.querySelector('.pad > p')):null,
  msg:(m=>m&&{tone:m.classList[1],text:txt(m.querySelector('.t')),trace:txt(m.querySelector('.tid')),acts:[...m.querySelectorAll('button')].map(b=>b.dataset.nxSearchAct)})(panel.querySelector('.pad .msg')),
  link:(a=>a&&{href:a.getAttribute('href'),text:txt(a)})(panel.querySelector('.pad a')),
  boxes:{bar:box(tb),panel:shown(panel)?box(panel):null,rows:[...panel.querySelectorAll('.ms .m')].slice(0,3).map(box)},
  active:active===input?'field':active?.dataset?.nxFocus||active?.className||active?.tagName||null,
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
}
const search=()=>evaluate(`(${searchView})()`);

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json(),qa=fixture.item;
 assert(qa?.project===project&&qa.part===part&&qa.second===second&&qa.bare==='bare'&&/^nc_/.test(qa.talk||'')&&/^nc_/.test(qa.apart||'')&&/^nc_/.test(qa.board||'')&&qa.discrepancies?.open===1,'The origin is not the opt-in synthetic item fixture');
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),entries=JSON.parse(metadataBytes).entries;
 assert(/^\/code\/page\.[a-f0-9]{8}\.js$/.test(entries['page-js']||''),'Content-hashed page code is required');
 // The ERD's table as its picture holds it, whose own fields the panel shows (SCR-106's).
 const erd=await (await fetch(origin+`/api/spaces/${project}/pictures/${part}/05-erd`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)})).json();
 const table=erd.picture?.source?.tables?.find(t=>t.id==='TBL-002'),discrepancy=(erd.discrepancies||[]).find(d=>d.item==='TBL-002');
 assert(table&&discrepancy?.state==='open','The fixture\'s ERD holds TBL-002 and its discrepancy');
 report.preflight={fixture:qa,discrepancy:discrepancy.id,build:{entries:{'page-js':entries['page-js']},sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
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
 const link=(stage,id)=>stagePath(project,part,stage)+'#item='+encodeURIComponent(id);
 const sgh=(stage,n,lang)=>stageNumber(stage)+' '+stageName(stage,lang)+' ('+n+')';

 // #loading, then #normal: the row's ID, kind and text at once with grey lines while the page
 // holds the item's reading; then its fields, "None" for the empty one, Details, the context, the
 // source linked at the snapshot's commit and line, the trace by stage, its first six links of
 // nine, and "Talk on REQ-001" with its comment and box; the row selected (TC-1810).
 for(const [lang,theme]of[['en','light'],['ko','dark']]){
  await test(`loading-and-normal-1440-${lang}-${theme}`,async()=>{
   await setting({width:1440,theme});
   held={pattern:new RegExp('^/api/spaces/'+project+'/items/REQ-001\\?'),requests:[]};
   await open(page('02-prd',lang,'#item=REQ-001'),{ready:false});
   await waitFor(`document.documentElement.dataset.nxCode==='ready'&&!!document.querySelector('.side .item .sk')`);
   const stop=Date.now()+5000;while(!held.requests.length&&Date.now()<stop)await sleep(25);
   assert(held.requests.length===1,'The page asks for the item once, and the suite holds it');
   await paint();
   const title='When a synthetic buyer places an order, the shop shall record it.';
   let s=await state();
   assert(s.panel&&s.id==='REQ-001'&&s.kind===kindWord('requirement',lang)&&s.text===title&&s.loading&&s.loadingWords===label('The item',6,lang,{id:'REQ-001'})&&!s.fields.length,'#loading: the row\'s ID, kind and text with grey lines: '+JSON.stringify({id:s.id,kind:s.kind,text:s.text,loading:s.loading,words:s.loadingWords}));
   const loadingShot=await shot(`loading-1440-${lang}-${theme}`);
   await release();await ready('REQ-001');
   s=await state();
   const names=labels('List fields',lang),none=oldLabels('Item values',lang)[0];
   assert(JSON.stringify(s.sw)===JSON.stringify(['talk:false','item:true'])&&s.idLines===1&&s.text===title&&s.lang==='en','The head\'s switch, the ID on one line, and the text in the source\'s language: '+JSON.stringify({sw:s.sw,idLines:s.idLines,lang:s.lang}));
   assert(JSON.stringify(s.fields)===JSON.stringify([[names[0],'Must'],[names[1],'approved'],[names[2],none]])&&s.details.includes('"links"')&&s.details.includes('FL-009')&&!s.details.includes('"where"'),'The fields, "None" for the empty one, the others under Details: '+JSON.stringify({fields:s.fields,details:s.details}));
   assert(s.ctx===label('The item',0,lang,{id:'CTX-001',name:'Ordering'})&&s.src===label('The item',1,lang,{path:'docs/qa-prd.md',n:14})+' aaaaaaa'&&s.link?.href===`https://github.com/example/qa-shop/blob/${commit}/docs/qa-prd.md#L14`&&s.link.target==='_blank'&&s.link.rel==='noreferrer','The context, and the source linked at the commit and line: '+JSON.stringify({ctx:s.ctx,src:s.src,link:s.link}));
   const from={head:label('The item',2,lang)+' (1)',groups:[{head:sgh('01-domain',1,lang),links:['CTX-001'],hrefs:[link('01-domain','CTX-001')],more:null}]};
   const flows=Array.from({length:6},(_,i)=>'FL-00'+(i+1));
   const to={head:label('The item',3,lang)+' (12)',groups:[{head:sgh('03-user-flow',9,lang),links:flows,hrefs:flows.map(id=>link('03-user-flow',id)),more:label('More',0,lang,{n:'3'})},{head:sgh('05-erd',1,lang),links:['TBL-001'],hrefs:[link('05-erd','TBL-001')],more:null},{head:sgh('07-sitemap',2,lang),links:['SCR-001','SCR-002'],hrefs:[link('07-sitemap','SCR-001'),link('07-sitemap','SCR-002')],more:null}]};
   assert(JSON.stringify(s.from)===JSON.stringify(from)&&JSON.stringify(s.to)===JSON.stringify(to),'The trace by stage, six links of nine: '+JSON.stringify({from:s.from,to:s.to}));
   assert(s.itk===label('Narrowed',0,lang,{id:'REQ-001'})&&JSON.stringify(s.entries)===JSON.stringify([qa.talk])&&s.label===words('Comment on',lang,{id:'REQ-001'})&&s.selected==='REQ-001'&&!s.why&&!s.tabs.length&&s.side?.[1]===400&&s.overflow===0,'Talk on REQ-001 with its comment and box, the row selected: '+JSON.stringify({itk:s.itk,entries:s.entries,label:s.label,selected:s.selected,side:s.side}));
   return{evidence:'fixture page and reads; the item\'s reading held by the suite, then released (held)',screenshots:[loadingShot,await shot(`normal-1440-${lang}-${theme}`)]};
  });
 }

 // A stage of the trace unfolds its other links, the focus on the first of them; a link opens
 // its item at its place in this part, where the trace leads back; a source on the file's first
 // line links the file; a table that links the requirement is where the requirement leads
 // (SCR-115's actions, TC-1811).
 await test('trace-and-source-1440-en',async()=>{
  await setting({width:1440});
  await open(page('02-prd','en','#item=REQ-001'));await ready('REQ-001');
  await click('.item [data-nx-act="trace-more"][data-nx-trace="to"][data-nx-stage="03-user-flow"]');await settled();
  let s=await state();const group=s.to.groups[0];
  assert(group.links.length===9&&group.links[8]==='FL-009'&&group.more===null&&s.active==='t:to:03-user-flow:6','The stage unfolds, the focus on its seventh link: '+JSON.stringify({group,active:s.active}));
  await click('.item .trace a.a[href$="#item=FL-007"]');
  await arrived(stagePath(project,part,'03-user-flow'),'#item=FL-007');await ready('FL-007');
  s=await state();
  assert(s.id==='FL-007'&&s.kind===kindWord('flow','en')&&s.selected==='FL-007'&&JSON.stringify(s.from.groups.map(g=>[g.head,g.links]))===JSON.stringify([[sgh('02-prd',1,'en'),['REQ-001']]])&&s.src===label('The item',1,'en',{path:'docs/qa-flow/FL-007.md',n:3})+' aaaaaaa','The linked item at its place, leading back: '+JSON.stringify({id:s.id,from:s.from,src:s.src}));
  const linkedShot=await shot('trace-linked-1440-en');
  // REQ-002's line is the file's first, which links the file.
  await open(page('02-prd','en','#item=REQ-002'));await ready('REQ-002');
  s=await state();
  assert(s.src===label('The item',1,'en',{path:'docs/qa-prd.md',n:1})+' aaaaaaa'&&s.link?.href===`https://github.com/example/qa-shop/blob/${commit}/docs/qa-prd.md`&&JSON.stringify(s.to.groups.map(g=>[g.head,g.links]))===JSON.stringify([[sgh('05-erd',1,'en'),['TBL-002']]]),'The first line links the file; a later stage\'s link leads on: '+JSON.stringify({src:s.src,link:s.link,to:s.to}));
  return{evidence:'fixture pages and reads',screenshot:linkedShot};
 });

 // The switch shows the stage's whole talk with the item still selected, and the item again;
 // Close, Escape and the browser's back button close it, the address without item=, the side
 // showing the stage's talk and the focus back on the item's row; after an entry of the talk
 // selected the item, Close returns to the whole talk at that entry (SCR-115's actions, TC-1812).
 await test('switch-close-escape-back-1440-en',async()=>{
  await setting({width:1440});
  await open(page('02-prd','en','#item=REQ-001'));await ready('REQ-001');
  await click('.item [data-nx-act="side"][data-nx-side="talk"]');await settled();
  let s=await state();
  assert(!s.panel&&s.talk&&s.heading===labels('The talk','en')[0]&&JSON.stringify(s.sw)===JSON.stringify(['talk:true','item:false'])&&s.selected==='REQ-001'&&s.hash==='#item=REQ-001','Talk: the stage\'s whole talk, the item still selected: '+JSON.stringify({heading:s.heading,sw:s.sw,selected:s.selected,hash:s.hash}));
  const switchShot=await shot('switch-talk-1440-en');
  await click('.talk [data-nx-act="side"][data-nx-side="item"]');await settled();
  s=await state();
  assert(s.panel&&s.id==='REQ-001'&&JSON.stringify(s.sw)===JSON.stringify(['talk:false','item:true']),'Item: the panel again: '+JSON.stringify({id:s.id,sw:s.sw}));
  await click('.item [data-nx-act="item-close"]');await waitFor(`location.hash===''`);await settled();
  s=await state();
  assert(!s.panel&&s.talk&&s.heading===labels('The talk','en')[0]&&!s.selected&&s.activeItem==='REQ-001','Close: the stage\'s talk, the focus on the row: '+JSON.stringify({heading:s.heading,selected:s.selected,active:s.active,activeItem:s.activeItem}));
  await click('.stage .li[data-nx-item="REQ-002"]');await ready('REQ-002');
  s=await state();
  assert(s.hash==='#item=REQ-002'&&s.selected==='REQ-002','A row opens its item: '+JSON.stringify({hash:s.hash,selected:s.selected}));
  await press('Escape');await waitFor(`location.hash===''`);await settled();
  s=await state();
  assert(!s.panel&&!s.selected&&s.activeItem==='REQ-002','Escape closes it, the focus on its row: '+JSON.stringify({panel:s.panel,selected:s.selected,activeItem:s.activeItem}));
  await click('.stage .li[data-nx-item="REQ-001"]');await ready('REQ-001');
  await evaluate('history.back()');await waitFor(`location.hash===''&&!document.querySelector('.side .item')`);await settled();
  s=await state();
  assert(!s.panel&&s.talk&&!s.selected,'The back button closes it: '+JSON.stringify({panel:s.panel,selected:s.selected}));
  // An entry of the stage's whole talk on the item: the item's panel with the entry open in its
  // talk; Close leaves item= and talk=, and the whole talk shows the entry with the focus on it
  // (rule 24, SCR-115's revision).
  await click(`.side .talk li[data-nx-entry="${qa.talk}"] .ref`);await ready('REQ-001');
  await waitFor(`!!document.querySelector('.side .item .itk li[data-nx-entry="${qa.talk}"] .ref[aria-expanded="true"]')`);await settled();
  s=await state();
  assert(s.panel&&s.selected==='REQ-001'&&new RegExp('(?:^|[#&])talk='+qa.talk+'(?:&|$)').test(s.hash)&&/(?:^|[#&])item=REQ-001(?:&|$)/.test(s.hash),'An entry on the item opens the item\'s panel with the entry: '+JSON.stringify({hash:s.hash,selected:s.selected}));
  await click('.item [data-nx-act="item-close"]');await waitFor(`location.hash===''&&!document.querySelector('.side .item')`);await settled();
  s=await state();
  const sight=await evaluate(`(()=>{const e=document.querySelector('.side .talk li[data-nx-entry="${qa.talk}"]'),b=document.querySelector('.side .talk > .body');if(!e||!b)return false;const r=e.getBoundingClientRect(),o=b.getBoundingClientRect();return r.top>=o.top&&r.top<o.bottom;})()`);
  assert(!s.panel&&s.talk&&!s.selected&&s.active==='talk:'+qa.talk&&sight,'Close returns to the whole talk at the entry, the focus on it: '+JSON.stringify({panel:s.panel,selected:s.selected,active:s.active,sight}));
  return{evidence:'fixture page and reads',screenshot:switchShot};
 });

 // On the ERD: the table selected and outlined in the picture, its own fields, and its open
 // discrepancy with its reason; "Comment on this discrepancy" names it in the box, and the
 // comment that it leaves names it; one resolved meanwhile answers discrepancy_not_found, after
 // which the box names the item again and the item reads again (SPEC-126, SCR-115's state
 // changes, TC-1813).
 await test('discrepancy-1440-en',async()=>{
  await setting({width:1440});
  await open(page('05-erd','en','#item=TBL-002'));await ready('TBL-002');
  let s=await state();
  const own=itemFields(table,'en').filter(f=>f.field!=='context').map(f=>[f.name,f.text]);
  assert(s.outlined&&s.kind===kindWord('table','en')&&JSON.stringify(s.fields)===JSON.stringify(own)&&s.details.includes('"columns"')&&s.details.includes('NUMERIC(12,2)'),'The table outlined, with its own fields and Details: '+JSON.stringify({outlined:s.outlined,fields:s.fields,details:s.details}));
  const reason=reasonText({kind:'other-context',contexts:['CTX-001','CTX-002']},'aggregate-table','en');
  assert(s.dscHead===label('The item',4,'en',{n:'1'})&&JSON.stringify(s.dscs)===JSON.stringify([{text:reason,pressed:'false',id:discrepancy.id}]),'Its discrepancy with its reason: '+JSON.stringify({head:s.dscHead,dscs:s.dscs}));
  await click(`.item [data-nx-act="discrepancy"][data-nx-discrepancy="${discrepancy.id}"]`);await settled();
  s=await state();
  assert(s.dscs[0].pressed==='true'&&s.label===label('The item',5,'en')&&s.active==='talk-text','The box names the discrepancy, the focus in it: '+JSON.stringify({dscs:s.dscs,label:s.label,active:s.active}));
  const targetShot=await shot('discrepancy-1440-en');
  await type('#talk-text','Synthetic comment on the discrepancy');
  let before=report.posts.length;
  await click('.item [data-nx-act="leave"]');
  const stop=Date.now()+10000;while(Date.now()<stop&&!report.posts.slice(before).some(p=>p.path.endsWith('/comments')))await sleep(25);
  await settled();await waitFor(`document.querySelectorAll('.side .item .itk li[data-nx-entry]').length===1`);
  const left=report.posts.slice(before).find(p=>p.path.endsWith('/comments'));
  s=await state();
  const body=JSON.parse(left?.body||'{}');
  assert(body.discrepancy===discrepancy.id&&body.item==='TBL-002'&&body.stage==='05-erd'&&body.part===part&&s.entries.length===1&&s.label===words('Comment on','en',{id:'TBL-002'})&&s.dscs[0].pressed==='false','The comment names the discrepancy, and joins the item\'s talk: '+JSON.stringify({body,entries:s.entries,label:s.label}));
  // Resolved meanwhile: the server answers discrepancy_not_found.
  await click(`.item [data-nx-act="discrepancy"][data-nx-discrepancy="${discrepancy.id}"]`);await settled();
  await type('#talk-text','Synthetic comment on a resolved discrepancy');
  responses.push({method:'POST',pattern:new RegExp('^/api/spaces/'+project+'/comments$'),...problem(404,'discrepancy_not_found')});
  before=report.reads.length;
  await click('.item [data-nx-act="leave"]');await settled();
  await waitFor(`(document.querySelector('.side .item > .box .lab')?.textContent||'')===${JSON.stringify(words('Comment on','en',{id:'TBL-002'}))}`);await settled();
  s=await state();
  const again=report.reads.slice(before).filter(p=>p.startsWith(`/api/spaces/${project}/items/TBL-002?`));
  assert(again.length>=1&&s.label===words('Comment on','en',{id:'TBL-002'})&&s.boxNote?.text===codeMessage('discrepancy_not_found','en')&&(await evaluate(`document.getElementById('talk-text').value`))==='Synthetic comment on a resolved discrepancy','The box names the item again, the words kept, and the item reads again: '+JSON.stringify({again,label:s.label,note:s.boxNote}));
  await clear('#talk-text');
  return{evidence:'fixture page and one write to the fixture server; one comment answered discrepancy_not_found by the suite (mocked)',screenshots:[targetShot,await shot('discrepancy-gone-1440-en')]};
 });

 // An item of another stage leads to its stage; an ID that no stage holds is #gone, with the
 // comment that still names it apart, no box, nothing selected, and "Search all projects for
 // {id}", which opens the search with the ID (SCR-115's Target and #gone, TC-1814).
 await test('other-stage-and-gone-1440-en',async()=>{
  await setting({width:1440});
  await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url:origin+page('05-erd','en','#item=REQ-001')});
  await arrived(stagePath(project,part,'02-prd'),'#item=REQ-001');await ready('REQ-001');
  let s=await state();
  assert(s.id==='REQ-001'&&s.selected==='REQ-001','Another stage\'s item at its stage: '+JSON.stringify({path:s.path,id:s.id}));
  await open(page('02-prd','en','#item=REQ-999'));await ready('REQ-999');
  s=await state();
  const [text,searchWords]=words('item_not_found','en',{id:'REQ-999'}).split(' · ');
  assert(s.message?.tone==='warn'&&s.message.text===text&&JSON.stringify(s.message.acts)==='["item-search"]'&&s.message.buttons[0]===searchWords&&JSON.stringify(s.entries)===JSON.stringify([qa.apart])&&!s.box&&!s.selected&&!s.fields.length&&!s.from.head,'#gone: the words, its comment apart, no box, nothing selected: '+JSON.stringify({message:s.message,entries:s.entries,box:s.box,selected:s.selected}));
  const goneShot=await shot('gone-1440-en');
  const before=report.reads.length;
  await click('.item [data-nx-act="item-search"]');
  await waitFor(`!document.querySelector('.tb .spanel').hidden&&!!document.querySelector('.tb .spanel .pad p')`);await paint();
  const v=await search();
  assert(v.words==='REQ-999'&&v.active==='field'&&v.pad===label('The search',4,'en',{q:'REQ-999'})&&v.link?.href==='/hub#q=REQ-999'&&v.link.text===labels('The search','en')[5]&&/(?:^|[#&])q=REQ-999(?:&|$)/.test(v.hash)&&report.reads.slice(before).includes('/api/search?q=REQ-999'),'The search with the ID, nothing found, Look in the full checks: '+JSON.stringify(v));
  return{evidence:'fixture pages and reads',screenshots:[goneShot,await shot('gone-search-1440-en')]};
 });

 // The item's reading that fails: no connection with Try again, which reads again; internal
 // with its trace ID; a refusal; a sign-in that expired with Sign in again; part_not_found, after
 // which the page reads again. In each the ID, kind and text from the row stay, with the stage
 // and its talk (SCR-115#error and #permission, TC-1815).
 await test('item-errors-1440-en',async()=>{
  await setting({width:1440});
  await open(page('02-prd','en'));
  const read=id=>new RegExp('^/api/spaces/'+project+'/items/'+id+'\\?');
  const shown=async(id,key)=>{await waitFor(`document.querySelector('.side .item .ih .id')?.textContent===${JSON.stringify(id)}&&!!document.querySelector('.side .item [data-nx-key="${key}"] .msg')`);await settled();return state();};
  const kept=(s,id)=>s.id===id&&s.text===(id==='REQ-001'?'When a synthetic buyer places an order, the shop shall record it.':'Retry the payment of a synthetic order')&&!s.fields.length&&!s.from.head&&s.selected===id&&s.itk===label('Narrowed',0,'en',{id});
  failing=[read('REQ-001')];
  await click('.stage .li[data-nx-item="REQ-001"]');
  let s=await shown('REQ-001','failed');
  assert(s.message?.tone==='err'&&s.message.text===codeMessage('No connection','en')&&JSON.stringify(s.message.acts)==='["item-retry"]'&&s.message.buttons[0]===labels('Page buttons','en')[0]&&kept(s,'REQ-001'),'#error: no connection, with Try again; the row\'s ID, kind and text stay: '+JSON.stringify({message:s.message,id:s.id,text:s.text,itk:s.itk}));
  const errorShot=await shot('item-error-1440-en');
  failing=[];
  let before=report.reads.length;
  await click('.side .item [data-nx-act="item-retry"]');await ready('REQ-001');
  s=await state();
  assert(report.reads.slice(before).some(p=>read('REQ-001').test(p))&&!s.message&&s.fields.length===3,'Try again reads the item again: '+JSON.stringify({message:s.message,fields:s.fields}));
  responses.push({method:'GET',pattern:read('REQ-002'),...problem(500,'internal')});
  await click('.stage .li[data-nx-item="REQ-002"]');
  s=await shown('REQ-002','failed');
  assert(s.message?.tone==='err'&&s.message.text===codeMessage('internal','en')&&s.message.trace===codeMessage('Trace ID','en',{traceId:'tr_qa_internal'})&&JSON.stringify(s.message.acts)==='["item-retry"]'&&kept(s,'REQ-002'),'#error: internal, with its trace ID: '+JSON.stringify(s.message));
  responses.push({method:'GET',pattern:read('REQ-001'),...problem(403,'access_missing')});
  await click('.stage .li[data-nx-item="REQ-001"]');
  s=await shown('REQ-001','refused');
  assert(s.message?.tone==='warn'&&s.message.text===codeMessage('access_missing','en')&&s.message.trace===codeMessage('Trace ID','en',{traceId:'tr_qa_access_missing'})&&!s.message.acts.length&&kept(s,'REQ-001'),'#permission: refused, with its trace ID: '+JSON.stringify(s.message));
  responses.push({method:'GET',pattern:read('REQ-002'),...signedOut});
  await click('.stage .li[data-nx-item="REQ-002"]');
  s=await shown('REQ-002','refused');
  assert(s.message?.tone==='warn'&&s.message.text===codeMessage('Sign-in expired','en')&&JSON.stringify(s.message.acts)==='["sign-in"]'&&!s.message.trace&&kept(s,'REQ-002'),'#permission: a sign-in that expired, with Sign in again: '+JSON.stringify(s.message));
  const signInShot=await shot('item-sign-in-1440-en');
  responses.push({method:'GET',pattern:read('REQ-001'),...problem(404,'part_not_found')});
  before=report.reads.length;
  await click('.stage .li[data-nx-item="REQ-001"]');
  s=await shown('REQ-001','failed');
  const stop=Date.now()+5000;while(Date.now()<stop&&!report.reads.slice(before).some(p=>p.startsWith('/api/spaces/'+project+'/stages/')))await sleep(25);
  assert(s.message?.tone==='err'&&s.message.text===codeMessage('part_not_found','en')&&s.message.trace===codeMessage('Trace ID','en',{traceId:'tr_qa_part_not_found'})&&report.reads.slice(before).some(p=>p.startsWith('/api/spaces/'+project+'/stages/')),'#error: part_not_found, after which the page reads again: '+JSON.stringify({message:s.message,reads:report.reads.slice(before)}));
  return{evidence:'fixture page and reads; the item\'s reads failed (failed) or answered by the suite (mocked), then read from the fixture server',screenshots:[errorShot,signInShot]};
 });

 // Rule 24: a list narrowed past the item's row says so, with Show all, which clears the list's
 // search and selects the row; a picture that is not current, and one not drawn, show the item
 // in the list and say why; a source without a line links the file (TC-1816).
 await test('why-lines-1440-ko-dark',async()=>{
  await setting({width:1440,theme:'dark'});
  await open(page('02-prd','ko'));
  await type('.stage input[name="q"]','Retry');
  await waitFor(`document.querySelectorAll('.stage .li[data-nx-item]').length===1`);await settled();
  await evaluate(`location.hash='#item=REQ-001'`);await ready('REQ-001');
  await waitFor(`!!document.querySelector('.side .item [data-nx-key="why"]')`);
  let s=await state();
  assert(s.why?.tone==='info'&&s.why.text===label('An item that the talk selects',3,'ko')&&JSON.stringify(s.why.acts)==='["item-show-all"]'&&JSON.stringify(s.rows)==='["REQ-002"]'&&!s.selected,'A narrowed list: why, with Show all: '+JSON.stringify({why:s.why,rows:s.rows}));
  const narrowedShot=await shot('why-narrowed-1440-ko-dark');
  await click('.item [data-nx-act="item-show-all"]');
  await waitFor(`document.querySelector('.stage .li[aria-current="true"] .id')?.textContent==='REQ-001'&&!document.querySelector('.side .item [data-nx-key="why"]')`);await settled();
  s=await state();
  assert(s.find===''&&s.selected==='REQ-001'&&!s.why&&s.rows.length===2,'Show all clears the list\'s search and selects the row: '+JSON.stringify({find:s.find,selected:s.selected,rows:s.rows}));
  await open(page('07-sitemap','ko','#item=SCR-002'));await ready('SCR-002');
  await waitFor(`!!document.querySelector('.side .item [data-nx-key="why"]')`);
  s=await state();
  assert(s.why?.text===label('An item that the talk selects',1,'ko')&&!s.why.acts.length&&s.selected==='SCR-002'&&/(?:^|[#&])view=list(?:&|$)/.test(s.hash)&&s.src===label('The item',7,'ko',{path:'docs/qa-sitemap.yaml'})+' aaaaaaa'&&s.link?.href===`https://github.com/example/qa-shop/blob/${commit}/docs/qa-sitemap.yaml`,'A picture not current: the list shows it, and a source without a line: '+JSON.stringify({why:s.why,selected:s.selected,hash:s.hash,src:s.src,link:s.link}));
  const staleShot=await shot('why-stale-1440-ko-dark');
  await open(page('05-erd','ko','#item=TBL-001','bare'));await ready('TBL-001');
  await waitFor(`!!document.querySelector('.side .item [data-nx-key="why"]')`);
  s=await state();
  assert(s.why?.text===label('An item that the talk selects',2,'ko')&&s.selected==='TBL-001'&&!s.dscs.length,'A picture not drawn: the list shows it: '+JSON.stringify({why:s.why,selected:s.selected}));
  return{evidence:'fixture pages and reads',screenshots:[narrowedShot,staleShot,await shot('why-none-1440-ko-dark')]};
 });

 // Under 1,024 pixels: a row brings the Item tab forward, whose controls are 44 pixels; All talk
 // of the stage leads to the Talk tab; Close returns to the tab in front before; an entry of the
 // talk keeps the Talk tab in front, with the Item tab beside it; nothing wider than the page at
 // 390 or 320 (rules 14 and 16, SCR-115's layout, TC-1817).
 for(const [lang,theme]of[['en','light'],['ko','dark']]){
  await test(`phone-390-${lang}-${theme}`,async()=>{
   await setting({width:390,theme,touch:true});
   await open(page('02-prd',lang));
   await click('.stage .li[data-nx-item="REQ-001"]');await ready('REQ-001');
   let s=await state();
   assert(s.tab==='item'&&JSON.stringify(s.tabs)==='["stage","talk","item"]'&&s.panel&&s.side?.[0]===0&&s.side[1]===390&&!s.sw.length&&s.overflow===0,'A row brings the Item tab forward, the page\'s width: '+JSON.stringify({tab:s.tab,tabs:s.tabs,side:s.side,sw:s.sw,overflow:s.overflow}));
   // Rule 14: a finger hits each control 21 pixels around its centre, and no control's hit
   // area takes another's.
   const hits=await evaluate(`(()=>{const probe=(name,list)=>list.filter(e=>e&&e.checkVisibility({visibilityProperty:true})).map(e=>{e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    const misses=[[0,-21],[0,21],[-21,0],[21,0]].filter(([dx,dy])=>{const hit=document.elementFromPoint(x+dx,y+dy);return!hit||!(hit===e||e.contains(hit));});return{name,misses};}),q=s=>document.querySelector(s);
    return[...probe('close',[q('.item [data-nx-act="item-close"]')]),...probe('source',[q('.item .src a')]),...probe('details',[q('.item .det summary')]),...probe('link',[...document.querySelectorAll('.item .trace a.a')]),...probe('more',[q('.item [data-nx-act="trace-more"]')]),...probe('whole',[q('.item [data-nx-act="whole"]')]),...probe('leave',[q('.item [data-nx-act="leave"]')])];})()`);
   const counted=hits.reduce((n,c)=>({...n,[c.name]:(n[c.name]||0)+1}),{});
   assert(JSON.stringify(counted)===JSON.stringify({close:1,source:1,details:1,link:10,more:1,whole:1,leave:1})&&hits.every(c=>!c.misses.length),'Hit areas of 44 pixels: '+JSON.stringify({counted,misses:hits.filter(c=>c.misses.length)}));
   await evaluate(`document.querySelector('.item > .ib2').scrollTop=0`);await paint();
   const tabShot=await shot(`phone-item-390-${lang}-${theme}`);
   await click('.item [data-nx-act="whole"]');await waitFor(`location.hash===''`);await settled();
   s=await state();
   assert(s.tab==='talk'&&s.talk&&!s.panel&&JSON.stringify(s.tabs)==='["stage","talk"]','All talk of the stage: the Talk tab: '+JSON.stringify({tab:s.tab,tabs:s.tabs}));
   await click('.tabs .tab[data-nx-tab="stage"]');
   await click('.stage .li[data-nx-item="REQ-002"]');await ready('REQ-002');
   await click('.item [data-nx-act="item-close"]');await waitFor(`location.hash===''`);await settled();
   s=await state();
   assert(s.tab==='stage'&&!s.panel&&JSON.stringify(s.tabs)==='["stage","talk"]','Close returns to the tab in front before: '+JSON.stringify({tab:s.tab,tabs:s.tabs}));
   await open(page('02-prd',lang,`#talk=${qa.talk}&item=REQ-001`));await ready('REQ-001').catch(()=>{});
   await waitFor(`document.querySelector('.ws')?.dataset.nxTab==='talk'&&!!document.querySelector('li[data-nx-entry="${qa.talk}"] .ref[aria-expanded="true"]')`);await settled();
   s=await state();
   assert(s.tab==='talk'&&JSON.stringify(s.tabs)==='["stage","talk","item"]'&&s.heading===label('Narrowed',0,lang,{id:'REQ-001'})&&s.overflow===0,'An entry keeps the Talk tab in front, the Item tab beside it: '+JSON.stringify({tab:s.tab,tabs:s.tabs,heading:s.heading}));
   await click('.tabs .tab[data-nx-tab="item"]');await settled();
   s=await state();
   assert(s.tab==='item'&&s.panel&&s.id==='REQ-001','The Item tab shows the item: '+JSON.stringify({tab:s.tab,id:s.id}));
   await setting({width:320,theme,touch:true});await paint();
   s=await state();
   assert(s.overflow===0&&s.panel,'Nothing wider than the page at 320: '+s.overflow);
   return{evidence:'fixture pages and reads; touch emulated',screenshots:[tabShot,await shot(`phone-item-320-${lang}-${theme}`)]};
  });
 }

 // From 1,024 to 1,279 pixels an item opens the side's panel, and Escape closes the item and
 // folds the panel that it opened (rule 10, rule 16, TC-1818).
 await test('panel-1152-en',async()=>{
  await setting({width:1152,height:800});
  await open(page('02-prd','en'));
  await click('.stage .li[data-nx-item="REQ-001"]');await ready('REQ-001');
  let s=await state();
  assert(s.open==='talk'&&s.panel&&s.side?.[1]===400&&s.idLines===1&&s.overflow===0,'The item opens the panel, its ID on one line: '+JSON.stringify({open:s.open,side:s.side,idLines:s.idLines}));
  const panelShot=await shot('panel-1152-en');
  await press('Escape');await waitFor(`location.hash===''`);await settled();
  s=await state();
  assert(!s.open&&!s.side&&!s.panel&&s.activeItem==='REQ-001','Escape closes the item and folds the panel: '+JSON.stringify({open:s.open,side:s.side,activeItem:s.activeItem}));
  return{evidence:'fixture page and reads',screenshot:panelShot};
 });

 // SPEC-209's acceptances 1 and 4 with the item's panel (TC-1492, TC-1495): on the DDD board an
 // entry of the talk on its context, picked, brings the context into sight, outlines it and
 // opens its panel with the entry open, the address holding talk= and item=; an entry on an item
 // that the stage no longer holds, picked, selects nothing and says so, the panel shut (TC-1819).
 await test('pick-entries-1440-en',async()=>{
  await setting({width:1440});
  await open(page('01-domain','en'));
  const NODE='.pf svg.board a[href="#item=CTX-001"] rect',boxOf=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect();return r?[r.left,r.top,r.right,r.bottom].map(Math.round):null;})()`);
  const inside=(inner,outer,slack=1)=>!!inner&&!!outer&&inner[0]>=outer[0]-slack&&inner[1]>=outer[1]-slack&&inner[2]<=outer[2]+slack&&inner[3]<=outer[3]+slack;
  await waitFor(`!!document.querySelector(${JSON.stringify(NODE)})`);
  // Zoomed in until the context no longer fits in sight.
  for(let n=0;n<4&&inside(await boxOf(NODE),await boxOf('.pf'),0);n++)await click('.stage [data-nx-act="zoom-in"]');
  const before=await boxOf(NODE),frame=await boxOf('.pf');
  assert(!inside(before,frame,0),'The context is not wholly in sight first: '+JSON.stringify({before,frame}));
  await click(`.side .talk li[data-nx-entry="${qa.board}"] .ref`);await ready('CTX-001');
  await waitFor(`!!document.querySelector('.pf svg.mks .mk-sel')&&!!document.querySelector('.side .item .itk li[data-nx-entry="${qa.board}"] .ref[aria-expanded="true"]')`);await settled();
  let s=await state();
  const box=await boxOf(NODE),outline=await boxOf('.pf svg.mks .mk-sel');
  assert(s.panel&&s.id==='CTX-001'&&s.outlined&&inside(box,frame)&&inside(box,outline,4)&&new RegExp('(?:^|[#&])talk='+qa.board+'(?:&|$)').test(s.hash)&&/(?:^|[#&])item=CTX-001(?:&|$)/.test(s.hash)&&s.itk===label('Narrowed',0,'en',{id:'CTX-001'}),'The board brings the context into sight, outlined, with its panel and the entry open: '+JSON.stringify({hash:s.hash,id:s.id,box,frame,outline,itk:s.itk}));
  const boardShot=await shot('pick-board-1440-en');
  // An entry whose item left the stage: picked, it selects nothing and says so.
  await open(page('02-prd','en'));
  await click(`.side .talk li[data-nx-entry="${qa.apart}"] .ref`);await settled();
  s=await state();
  const said=await evaluate(`[...document.querySelectorAll('.side .talk li[data-nx-entry="${qa.apart}"] .msg .t')].map(e=>e.textContent.replace(/\\s+/g,' ').trim())`);
  assert(!s.panel&&s.talk&&!s.selected&&!/(?:^|[#&])item=/.test(s.hash)&&said.includes(label('An item that the talk selects',0,'en',{id:'REQ-999'})),'An entry whose item left: nothing selected, the entry says so, the panel shut: '+JSON.stringify({hash:s.hash,selected:s.selected,said}));
  return{evidence:'fixture pages and reads',screenshots:[boardShot,await shot('pick-apart-1440-en')]};
 });

 // The search from a stage's top bar (SCR-116#short, #loading, #normal): one character asks
 // nothing; words typed quickly ask once, after the pause; 20 of 25 matches with the line under
 // them, each with its place, the words in the address; the arrow keys move the marked match and
 // wrap; Escape closes the matches and keeps the words, and Down opens them with the first marked;
 // a press outside closes them, and the field's focus shows them again without a mark; Enter
 // opens the marked match at its place (TC-1820).
 for(const [lang,theme]of[['en','light'],['ko','dark']]){
  await test(`search-1440-${lang}-${theme}`,async()=>{
   await setting({width:1440,theme});
   await open(page('02-prd',lang));
   let v=await search();
   assert(!v.disabled&&!v.wait&&v.field&&!v.panel&&v.expanded==='false','The field works once the code runs: '+JSON.stringify(v));
   const before=report.reads.length;
   await type(FIELD,'r');await sleep(400);
   v=await search();
   assert(v.panel&&v.pad===labels('The search',lang)[3]&&!report.reads.slice(before).some(p=>p.startsWith('/api/search')),'#short: one character asks nothing: '+JSON.stringify(v));
   const asked=await searchFor('refund',{each:true});
   v=await search();
   assert(JSON.stringify(asked)==='["/api/search?q=refund"]','Words typed quickly ask once: '+JSON.stringify(asked));
   assert(v.status===label('The search',1,lang,{n:'25',q:'refund'})&&v.rows.length===20&&v.foot===labels('The search',lang)[2]&&v.expanded==='true'&&v.dim,'#normal: 20 of 25, the line under them: '+JSON.stringify({status:v.status,rows:v.rows.length,foot:v.foot}));
   assert(JSON.stringify(v.rows[0])===JSON.stringify({id:'REQ-101',title:'Synthetic refund rule 1',where:`${second} · ${part} · 02 ${stageName('02-prd',lang)}`,on:false,selected:'false',key:'sm-0'})&&/(?:^|[#&])q=refund(?:&|$)/.test(v.hash),'Each match with its place, the words in the address: '+JSON.stringify({row:v.rows[0],hash:v.hash}));
   await press('ArrowDown');await press('ArrowDown');
   v=await search();
   assert(v.rows[1].on&&v.rows[1].selected==='true'&&v.current==='sm-1'&&!v.rows[0].on,'The arrow keys mark a match: '+JSON.stringify({current:v.current}));
   await press('ArrowUp');await press('ArrowUp');
   v=await search();
   assert(v.rows[19].on&&v.current==='sm-19','Up from the first wraps to the last: '+v.current);
   await press('ArrowDown');
   v=await search();
   assert(v.rows[0].on&&v.current==='sm-0','Down from the last wraps to the first: '+v.current);
   const normalShot=await shot(`search-1440-${lang}-${theme}`);
   await press('Escape');
   v=await search();
   assert(!v.panel&&!v.dim&&v.words==='refund'&&v.active==='field'&&v.expanded==='false','Escape closes the matches, the words stay: '+JSON.stringify(v));
   await press('ArrowDown');
   v=await search();
   assert(v.panel&&v.rows.length===20&&v.current==='sm-0','Down opens them again with the first marked: '+JSON.stringify({panel:v.panel,current:v.current}));
   await clickAt(700,600);await paint();
   v=await search();
   assert(!v.panel&&v.words==='refund','A press outside closes them: '+v.panel);
   await evaluate(`document.querySelector(${JSON.stringify(FIELD)}).focus()`);await paint();
   v=await search();
   assert(v.panel&&!v.current,'The field\'s focus shows them again, nothing marked: '+JSON.stringify({panel:v.panel,current:v.current}));
   await press('ArrowDown');await press('ArrowDown');
   await press('Enter');
   await arrived(stagePath(second,part,'02-prd'),'#item=REQ-102');await ready('REQ-102');
   const s=await state();
   assert(s.id==='REQ-102'&&s.selected==='REQ-102','Enter opens the marked match at its place: '+JSON.stringify({path:s.path,id:s.id}));
   return{evidence:'fixture pages and reads',screenshots:[normalShot,await shot(`search-opened-1440-${lang}-${theme}`)]};
  });
 }

 // The exact ID once for each project that holds it, first; nothing found with Look in the full
 // checks; no connection with Try again, which asks again; internal with its trace ID; a refusal;
 // a sign-in that expired with Sign in again; an answer to older words, which waits for the newer
 // ones (SCR-116#normal, #empty, #error, #permission and Repeats, TC-1821).
 await test('search-states-1440-en',async()=>{
  await setting({width:1440});
  await open(page('02-prd','en'));
  await searchFor('req-001');
  let v=await search();
  assert(v.status===label('The search',1,'en',{n:'2',q:'req-001'})&&JSON.stringify(v.rows.map(r=>[r.id,r.where.split(' · ')[0]]))===JSON.stringify([['REQ-001',project],['REQ-001',second]])&&v.foot===null,'The exact ID, once for each project: '+JSON.stringify(v.rows));
  await searchFor('zzzz');
  v=await search();
  assert(v.pad===label('The search',4,'en',{q:'zzzz'})&&v.link?.href==='/hub#q=zzzz'&&!v.rows.length&&v.status===null,'#empty: Look in the full checks: '+JSON.stringify(v));
  const emptyShot=await shot('search-empty-1440-en');
  failing=[/^\/api\/search\?/];
  await searchFor('refund');
  v=await search();
  assert(v.msg?.tone==='err'&&v.msg.text===codeMessage('No connection','en')&&JSON.stringify(v.msg.acts)==='["retry"]'&&v.words==='refund','#error: no connection, with Try again, the words kept: '+JSON.stringify(v.msg));
  const errorShot=await shot('search-error-1440-en');
  failing=[];
  let before=report.reads.length;
  await click('.tb .spanel [data-nx-search-act="retry"]');
  await waitFor(`(document.querySelector('.tb .spanel .st')?.textContent||'')===${JSON.stringify(label('The search',1,'en',{n:'25',q:'refund'}))}`);
  assert(report.reads.slice(before).includes('/api/search?q=refund'),'Try again asks again');
  responses.push({method:'GET',pattern:/^\/api\/search\?/,...problem(500,'internal')});
  await searchFor('refund rule');
  v=await search();
  assert(v.msg?.tone==='err'&&v.msg.text===codeMessage('internal','en')&&v.msg.trace===codeMessage('Trace ID','en',{traceId:'tr_qa_internal'})&&JSON.stringify(v.msg.acts)==='["retry"]','#error: internal, with its trace ID: '+JSON.stringify(v.msg));
  responses.push({method:'GET',pattern:/^\/api\/search\?/,...problem(403,'access_missing')});
  await searchFor('refund rules');
  v=await search();
  assert(v.msg?.tone==='warn'&&v.msg.text===codeMessage('access_missing','en')&&v.msg.trace===codeMessage('Trace ID','en',{traceId:'tr_qa_access_missing'})&&!v.msg.acts.length,'#permission: refused, with its trace ID: '+JSON.stringify(v.msg));
  responses.push({method:'GET',pattern:/^\/api\/search\?/,...signedOut});
  await searchFor('refund rule 1');
  v=await search();
  assert(v.msg?.tone==='warn'&&v.msg.text===codeMessage('Sign-in expired','en')&&JSON.stringify(v.msg.acts)==='["sign-in"]'&&!v.msg.trace,'#permission: a sign-in that expired, with Sign in again: '+JSON.stringify(v.msg));
  const refusedShot=await shot('search-sign-in-1440-en');
  // The answer to "refund" comes after the one to "refund rule 2", and waits for the newer words.
  held={pattern:/^\/api\/search\?q=refund$/,requests:[]};
  await clear(FIELD);await type(FIELD,'refund');
  const stop=Date.now()+5000;while(!held.requests.length&&Date.now()<stop)await sleep(25);
  assert(held.requests.length===1,'The older words\' reading is held');
  await searchFor('refund rule 2');
  await release();await sleep(300);await paint();
  v=await search();
  assert(v.status===label('The search',1,'en',{n:'8',q:'refund rule 2'})&&v.rows.length===8&&v.words==='refund rule 2','An answer to older words is dropped: '+JSON.stringify({status:v.status,rows:v.rows.length}));
  return{evidence:'fixture page and reads; one search failed, one answered 500, one 403 and one 401, and one held by the suite (mocked, failed, held)',screenshots:[emptyShot,errorShot,refusedShot]};
 });

 // Under 1,024 pixels: the search button opens the field over the top bar, with the keyboard and
 // Close; the matches fill the screen under it, each 44 pixels high; Escape closes the matches,
 // then the field, the focus back on the button; Close too; nothing wider than the page at 320
 // (SCR-116's layout, rule 14, TC-1822).
 await test('search-phone-390-ko-dark',async()=>{
  await setting({width:390,theme:'dark',touch:true});
  await open(page('02-prd','ko'));
  let v=await search();
  assert(!v.field&&v.button&&!v.close,'The field waits behind the search button: '+JSON.stringify(v));
  await click('.tb .sbtn');
  v=await search();
  assert(v.phone==='open'&&v.field&&v.close&&!v.button&&v.active==='field','The field over the top bar, with the keyboard and Close: '+JSON.stringify(v));
  await searchFor('refund');
  v=await search();
  const height=await evaluate('innerHeight');
  assert(v.panel&&v.boxes.panel[0]===0&&v.boxes.panel[1]===v.boxes.bar[1]+v.boxes.bar[3]&&v.boxes.panel[2]===390&&v.boxes.panel[1]+v.boxes.panel[3]===height&&v.boxes.rows.every(r=>r[3]>=44)&&!v.dim&&v.overflow===0,'The matches fill the screen under the field, each 44 pixels high: '+JSON.stringify(v.boxes));
  const phoneShot=await shot('search-390-ko-dark');
  await press('Escape');
  v=await search();
  assert(!v.panel&&v.phone==='open'&&v.words==='refund','Escape closes the matches first: '+JSON.stringify(v));
  await press('Escape');
  v=await search();
  assert(!v.phone&&v.button&&!v.field&&v.active==='ib only-ph sbtn','Then the field, the focus on the search button: '+JSON.stringify(v));
  await click('.tb .sbtn');
  v=await search();
  assert(v.phone==='open'&&v.words==='refund','The field opens again with its words: '+JSON.stringify(v));
  await click('.tb .sclose');
  v=await search();
  assert(!v.phone&&!v.panel&&v.active==='ib only-ph sbtn','Close returns to the page: '+JSON.stringify(v));
  await setting({width:320,theme:'dark',touch:true});await paint();
  await click('.tb .sbtn');await press('ArrowDown');await paint();
  v=await search();
  assert(v.panel&&v.overflow===0,'Nothing wider than the page at 320: '+JSON.stringify({panel:v.panel,overflow:v.overflow}));
  return{evidence:'fixture page and reads; touch emulated',screenshots:[phoneShot,await shot('search-320-ko-dark')]};
 });

 // The first page's search (SCR-110, SCR-116): the field works there, its words go into the
 // address after #, and a match opens its item at its place (TC-1823).
 await test('search-first-page-1440-en',async()=>{
  await setting({width:1440});
  await open('/?lang=en');
  await searchFor('req-001');
  let v=await search();
  assert(v.rows.length===2&&v.hash==='#q=req-001','The first page\'s search, its words in the address: '+JSON.stringify({rows:v.rows.length,hash:v.hash}));
  await click(`.tb .spanel .m[data-nx-match="1"]`);
  await arrived(stagePath(second,part,'02-prd'),'#item=REQ-001');await ready('REQ-001');
  const s=await state();
  assert(s.id==='REQ-001'&&s.text==='Record each synthetic order of the second shop','A match opens its item at its place: '+JSON.stringify({path:s.path,id:s.id,text:s.text}));
  return{evidence:'fixture pages and reads',screenshot:await shot('search-first-page-1440-en')};
 });

 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.blockedExternalOrigins.length,'The page asked another origin: '+report.blockedExternalOrigins.join());
 assert(!report.runtimeExceptions.length,'The page threw: '+JSON.stringify(report.runtimeExceptions));
 const expected=2+1+1+1+1+1+1+2+1+1+2+1+1+1;
 report.status=report.tests.length===expected&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 closing=true;
 try{if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();await browser.stop();report.browserExited=true;}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
