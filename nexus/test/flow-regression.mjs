/**
 * TASK-278: the paths that browser agents walked through FL-117 to FL-119 (TC-1785) and that no
 * other suite repeats, pinned as the agents took them, each test named with its case and its row
 * in the walk's report (docs/12-qa/runs/2026-11-13-redesign-flows.md). The rows that another
 * suite already repeats are named there with that suite's test. Two of these paths failed in the
 * walk and are fixed: an entry's place on the first page that cut its item before its ID from
 * 1,024 pixels (BUG-602), and on a phone an item that a comment of the talk selects, shown in the
 * Picture tab at a zoom of 0 % (BUG-603).
 *
 * One group per run, named by the first argument, on the opt-in view-server with the group's
 * fixture: first-page (NEXUS_QA_HOME=1), workspace (NEXUS_QA_STAGE=1), picture
 * (NEXUS_QA_PICTURE=1) and talk (NEXUS_QA_TALK=1). Under 1,024 pixels a finger taps, with touch;
 * from 1,024 the mouse clicks. The page's language is the fixture's cookie, which a link keeps,
 * as the agents set it. Node 24 built-ins only; an owned headless Chrome over CDP. Requires
 * NEXUS_CHROME and NEXUS_QA_ORIGIN. Synthetic loopback fixture only: the page's reads and writes
 * reach the fixture server, and the suite reads their effects through its API.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {codeMessage} from '../src/draw/words.js';
import {stagePath} from '../src/draw/stages.js';
import {words} from '../ui/messages.js';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
const GROUPS={'first-page':'home',workspace:'stage',picture:'picture',talk:'talk'};
const group=process.argv[2];
if(!GROUPS[group])throw Error('Name one group: '+Object.keys(GROUPS).join(', '));
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin;
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'flows-'+group+'-');
const {folder}=browser;
const report={schema:'nexus-flow-browser-regression/1',scope:'synthetic loopback fixture only',group,
 evidence:'page measurement and screenshots; the page\'s reads and writes reach the fixture server, whose API the suite reads for their effects',
 startedAt:new Date().toISOString(),origin,node:process.version,tests:[],blockedExternalOrigins:[],posts:[],runtimeExceptions:[]};
const softDeadline=Date.now()+165000;
let ws,session,seq=0,closing=false,touch=false;
const pending=new Map(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const out=(name,value)=>fs.writeFile(path.join(folder,name),JSON.stringify(value,null,2));
class CheckFailure extends Error{}
function assert(ok,message){if(!ok)throw new CheckFailure(message);}
function command(method,params={},scoped=true,timeout=15000){
 if(!closing&&Date.now()>softDeadline)return Promise.reject(Error('165s work budget reached; preserving time for owned cleanup'));
 const id=++seq;
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},timeout);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params,...(scoped?{sessionId:session}:{})}));});
}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
// A wait that outlives a navigation of the page's own, as a link or the back button makes.
const NAVIGATED=/navigated or closed|Execution context was destroyed|Cannot find context|Inspected target navigated/;
async function waitFor(expression,what,timeout=10000){
 const stop=Date.now()+timeout;
 while(Date.now()<stop){let ok=false;try{ok=await evaluate(expression);}catch(error){if(!NAVIGATED.test(String(error)))throw error;}if(ok)return;await sleep(25);}
 throw new CheckFailure('Not reached: '+what);
}
async function paint(){try{await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}catch(error){if(!NAVIGATED.test(String(error)))throw error;}}
// A setting as the agents had it: a phone of 390 pixels touched, or a window of 1,024 or more.
async function setting({width,theme,lang}){
 touch=width<1024;
 await command('Page.navigate',{url:'about:blank'});
 await command('Storage.clearDataForOrigin',{origin,storageTypes:'cookies,local_storage,session_storage'});
 await command('Network.setCookie',{name:'nexus-qa-lang',value:lang,url:origin,path:'/'});
 await command('Emulation.setDeviceMetricsOverride',{width,height:width<1024?844:900,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
 await command('Emulation.setTouchEmulationEnabled',touch?{enabled:true,maxTouchPoints:1}:{enabled:false});
}
const cookie=(name,value)=>value===null?command('Network.deleteCookies',{name,url:origin}):command('Network.setCookie',{name,value,url:origin,path:'/'});
// The page has settled: no reading runs, nothing is being sent, a picture shown is drawn and the
// fonts that the code adds are in.
const SENDING=JSON.stringify([codeMessage('Sending','en'),codeMessage('Sending','ko')]);
const SETTLED=`(()=>{const q=s=>document.querySelector(s),shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});
 if(['.stage .upd','.side .tupd','.home .upd'].some(s=>(q(s)?.textContent||'')!==''))return false;
 if(q('.side .sk')&&shown(q('.side .sk')))return false;
 if([...document.querySelectorAll('button')].some(b=>${SENDING}.includes(b.textContent.trim())))return false;
 const pf=q('.pf');if(shown(pf)&&!q('.pf > .cv.drawn, .pf .empty-p, .pf .fnote .msg.warn'))return false;
 const fonts=q('link[data-nexus-css="fonts"]');if(fonts&&(!fonts.sheet||document.fonts.status!=='loaded'))return false;
 return true;})()`;
async function settled(){await waitFor(SETTLED,'the page settles',20000);await paint();}
// A page of the redesign, its code run and settled. The page's code may write the address after
// # again; the page is the same.
async function open(route){
 const url=origin+route,base=url.split('#')[0];
 await command('Page.navigate',{url});
 await waitFor(`location.href.split('#')[0]===${JSON.stringify(base)}&&document.readyState!=='loading'&&!!document.getElementById('view-data')`,'the page '+route,15000);
 await arrived();
}
async function arrived(){await waitFor(`document.documentElement.dataset.nxCode==='ready'`,'the page\'s code runs',15000);await settled();}
async function shot(name){const image=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(folder,name+'.png'),Buffer.from(image.data,'base64'));return name+'.png';}
// The first control shown that the selector finds, in sight, and its centre.
async function point(selector){
 const at=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}));if(!e)return null;e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'Nothing shown to press: '+selector);return at;
}
// A finger's tap under 1,024 pixels, a click of the mouse from 1,024.
async function press(selector){
 const {x,y}=await point(selector);
 if(touch){await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
 await paint();
}
// Words typed into a field, as a person types them.
async function type(selector,text){
 await press(selector);
 const focused=await evaluate(`document.activeElement===[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}))`);
 assert(focused,'The field takes no focus: '+selector);await command('Input.insertText',{text});
}
async function back(){await evaluate('setTimeout(()=>history.back(),0)');}
async function api(pathname){const response=await fetch(origin+pathname,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});return{status:response.status,data:await response.json()};}
async function onPaused(event){
 const url=new URL(event.request.url),method=event.request.method,headers=Object.fromEntries(Object.entries(event.request.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(method==='POST')report.posts.push({path:url.pathname,write:headers['idempotency-key']||null,at:new Date().toISOString()});
 // A request that the page dropped while it was paused has no interception left to continue:
 // Chrome answers "Invalid InterceptionId", which is not a failure.
 try{await command('Fetch.continueRequest',{requestId:event.requestId});}
 catch(error){if(!String(error).includes('Invalid InterceptionId'))throw error;}
}
async function test(name,settings,fn){
 for(const [width,theme,lang]of settings){
  const full=`${name} @${width}-${theme}-${lang}`,file=name.split(' ')[0]+'-'+name.split(' ')[1].replace('/','-')+`-${width}-${theme}-${lang}`,startedAt=new Date().toISOString();
  try{
   await setting({width,theme,lang});
   const seen=await fn({width,theme,lang,phone:width<1024});
   report.tests.push({name:full,verdict:'works',startedAt,finishedAt:new Date().toISOString(),seen,screenshot:await shot(file)});console.log('PASS '+full);
  }catch(error){
   let screenshot;try{screenshot=await shot(file+'-failure');}catch{}
   report.tests.push({name:full,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),error:String(error),screenshot});console.error('FAIL '+full+': '+error);
  }
  await out('results.json',report);
 }
}

// The first page (FL-117).
async function firstPage(home){
 const project=home.project;
 // BUG-602: from 1,024 pixels the place stood on one line, and the project's title and the item
 // shrank together, so that an item lost its ID ("SCR-…"). Each entry's place now wraps: the
 // stage and the item's ID are whole, the item's own title is cut only when the line cannot hold
 // it, and the project's title only past two fifths of the line.
 const PLACES=`[...document.querySelectorAll('.home .ent')].map(e=>{const w=e.querySelector('.where'),spans=[...w.children].filter(c=>c.tagName==='SPAN'&&!c.hasAttribute('aria-hidden')),title=spans[0],a=w.querySelector('a.clip'),id=a.querySelector('.mono'),box=x=>x.getBoundingClientRect(),cut=x=>x.scrollWidth>x.clientWidth+1;
  return{entry:e.dataset.nxEntry,line:Math.round(box(w).width),lines:new Set([...w.children].map(c=>Math.round(box(c).top))).size,
   title:{cut:cut(title),share:title.clientWidth/w.clientWidth},others:spans.slice(1).filter(cut).map(s=>s.textContent),
   id:id?.textContent||null,idWhole:!id||box(id).left>=box(a).left-0.5&&box(id).right<=box(a).right+0.5,itemCut:cut(a),
   inside:box(a).right<=box(w).right+0.5&&box(w).right<=box(e).right+0.5};})`;
 await test('TC-1826 FL-117/R1 each entry\'s place keeps its stage and its item\'s ID whole',[[1024,'light','en'],[1440,'light','en'],[1440,'dark','ko']],async()=>{
  await open('/');
  const places=await evaluate(PLACES),sideways=await evaluate(`document.documentElement.scrollWidth-innerWidth`);
  assert(places.length>=10&&places.filter(p=>p.id).length>=5,'Too few entries with an item to measure: '+places.length);
  const wrong=places.filter(p=>!p.idWhole||p.others.length||!p.inside||p.title.cut&&p.title.share<0.39);
  assert(!wrong.length,'Places that cut their stage or their item\'s ID, or leave their entry: '+JSON.stringify(wrong));
  assert(sideways<=0,'The page scrolls sideways by '+sideways);
  await evaluate(`document.querySelector('.home .ent .where a.clip .mono')?.closest('.ent')?.scrollIntoView({block:'start'})`);await paint();
  return{entries:places.length,withID:places.filter(p=>p.id).length,itemsCut:places.filter(p=>p.itemCut).length,titlesCut:places.filter(p=>p.title.cut).length,wrapped:places.filter(p=>p.lines>1).length,lines:[Math.min(...places.map(p=>p.line)),Math.max(...places.map(p=>p.line))]};
 });
 // Reply on the agent's question leads to the stage's talk at that entry, open with its box and
 // the focus in it; on a phone the Talk tab is in front.
 await test('TC-1388 FL-117/R6 Reply on a question opens its entry in the stage\'s talk',[[390,'dark','ko'],[1440,'light','en']],async c=>{
  const id=home.question,talkAt=stagePath(project,'sample','01-domain');
  await open('/');
  await press(`[data-nx-entry="${id}"] .acts a[data-nx-focus="${id}:talk"]`);
  await waitFor(`location.pathname===${JSON.stringify(talkAt)}&&location.hash===${JSON.stringify('#talk='+id)}`,'the stage\'s address with talk=',15000);
  await arrived();
  await waitFor(`!!document.querySelector('.side li[data-nx-entry="${id}"] > .hd .ref[aria-expanded="true"]')`,'the entry open');await settled();
  const s=await evaluate(`(()=>{const li=document.querySelector('.side li[data-nx-entry="${id}"]'),r=li.getBoundingClientRect(),body=li.closest('.body')?.getBoundingClientRect()||{top:0,bottom:innerHeight};
   return{tab:document.querySelector('.ws')?.dataset.nxTab||null,talk:document.querySelector('.side .talk')?.checkVisibility({visibilityProperty:true}),box:!!li.querySelector(':scope > .rbox textarea')?.checkVisibility(),
    focus:li.contains(document.activeElement),inSight:r.top>=Math.max(0,body.top)-1&&r.top<Math.min(innerHeight,body.bottom)};})()`);
  assert(s.talk&&s.box&&s.focus&&s.inSight,'The entry open in the talk, in sight, with its box and the focus: '+JSON.stringify(s));
  assert(!c.phone||s.tab==='talk','On a phone the Talk tab in front: '+s.tab);
  return{address:talkAt+'#talk=<the question>',...s};
 });
 // Open on a project's card leads to the address that the server names for its current stage.
 await test('TC-1388 FL-117/R7 Open on a project\'s card leads to its current stage',[[1440,'light','en']],async()=>{
  const first=await fetch(origin+'/p/'+project,{redirect:'manual',signal:AbortSignal.timeout(10000)}),current=first.headers.get('location');
  assert(first.status===302&&current?.startsWith('/p/'+project+'/'),'The project answers 302 to its current stage: '+first.status+' '+current);
  await open('/');
  await press(`.pcard footer a[href="/p/${project}"]`);
  await waitFor(`location.pathname===${JSON.stringify(current)}`,'the current stage\'s address',15000);await arrived();
  const s=await evaluate(`({h1:document.querySelector('main h1')?.textContent.trim(),current:document.querySelector('nav#stages a.row[aria-current="page"]')?.getAttribute('href')})`);
  assert(s.current===current&&s.h1?.startsWith(current.split('/').pop().slice(0,2)),'The stage\'s heading and its row marked current: '+JSON.stringify(s));
  return{current,...s};
 });
 // An answer that Access did not check is refused with access_missing under its entry, which
 // keeps its answers, and nothing changes; sent again once Access checks it, it carries the same
 // write ID and is saved.
 await test('TC-1393 FL-117/F3 an answer that Access did not check keeps its entry, and the same write ID passes later',[[1440,'light','en']],async()=>{
  const id=home.accept,accept='/api/spaces/'+project+'/proposals/'+id+'/accept',button=`[data-nx-entry="${id}"] button[data-nx-act="accept"]`;
  await open('/');
  const before=await evaluate(`document.getElementById('mine-h').textContent`),posts=report.posts.length;
  await cookie('nexus-qa-access','none');
  await press(button);
  await waitFor(`!!document.querySelector('[data-nx-entry="${id}"] .msg')`,'the refusal under the entry');await settled();
  const refused=await evaluate(`(()=>{const e=document.querySelector('[data-nx-entry="${id}"]'),m=e.querySelector('.msg');return{tone:[...m.classList].find(c=>c!=='msg'),text:m.querySelector('.t')?.textContent,trace:m.querySelector('.tid')?.textContent||null,answers:[...e.querySelectorAll('.acts button')].map(b=>b.dataset.nxAct),answered:e.classList.contains('answered'),mine:document.getElementById('mine-h').textContent};})()`);
  assert(refused.tone==='warn'&&refused.text===codeMessage('access_missing','en')&&refused.trace&&!refused.answered&&refused.answers.join()==='accept,dismiss'&&refused.mine===before,'Refused under the entry, which keeps its answers: '+JSON.stringify(refused));
  assert((await api('/api/spaces/'+project+'/proposals/'+id)).data.state==='open','The proposal stays open');
  await cookie('nexus-qa-access',null);
  await press(button);
  await waitFor(`!!document.querySelector('[data-nx-entry="${id}"] .res')`,'the answer in place');await settled();
  const done=await evaluate(`({res:document.querySelector('[data-nx-entry="${id}"] .res').textContent,msg:!!document.querySelector('[data-nx-entry="${id}"] .msg'),mine:document.getElementById('mine-h').textContent})`);
  const writes=report.posts.slice(posts).filter(p=>p.path===accept).map(p=>p.write),count=t=>Number(/\((\d+)\)/.exec(t)?.[1]);
  assert(!done.msg&&count(done.mine)===count(before)-1,'Accepted in place, My turn one less: '+JSON.stringify({before,...done}));
  assert(writes.length===2&&writes[0]&&writes[0]===writes[1],'Both tries carry one write ID: '+JSON.stringify(writes));
  assert((await api('/api/spaces/'+project+'/proposals/'+id)).data.state==='accepted','The proposal accepted once');
  return{refused:{text:refused.text,tone:refused.tone},accepted:done.res,mine:[before,done.mine],writes:writes.length};
 });
}

// The workspace (FL-118): another stage from the list of stages, and back.
async function workspace(stage){
 const project=stage.project,at=key=>stagePath(project,stage.part,key);
 await test('TC-1407 FL-118/R8 another stage from the list of stages, and the browser\'s Back',[[390,'dark','ko'],[1440,'light','en']],async c=>{
  await open(at('01-domain'));
  const seen=[];
  for(const key of['05-erd','02-prd']){
   if(c.phone){
    await press('header a.ttl');
    await waitFor(`location.hash==='#stages'&&document.querySelector('nav#stages')?.checkVisibility()`,'the sheet of stages');
    const sheet=await evaluate(`(()=>{const r=document.querySelector('nav#stages').getBoundingClientRect();return{height:Math.round(r.height),bottom:Math.round(r.bottom),rows:[...document.querySelectorAll('nav#stages a.row')].filter(a=>a.checkVisibility()).length};})()`);
    assert(sheet.rows===13&&sheet.bottom===844&&sheet.height<=Math.ceil(844*.85),'The sheet rises with the 13 stages: '+JSON.stringify(sheet));
   }
   await press(`nav#stages a.row[href="${at(key)}"]`);
   await waitFor(`location.pathname===${JSON.stringify(at(key))}`,'the stage '+key,15000);await arrived();
   const s=await evaluate(`({h1:document.querySelector('main h1')?.textContent.trim(),current:document.querySelector('nav#stages a.row[aria-current="page"]')?.getAttribute('href'),sheet:!!document.querySelector('nav#stages')?.checkVisibility(),rows:document.querySelectorAll('main li a[href^="#item="]').length})`);
   assert(s.h1?.startsWith(key.slice(0,2))&&s.current===at(key)&&!(c.phone&&s.sheet),'The picked stage, marked current, the sheet closed: '+JSON.stringify(s));
   assert(key!=='02-prd'||s.rows===200,'The PRD\'s list shows its first 200 rows: '+s.rows);
   seen.push({key,...s});
  }
  await back();
  await waitFor(`location.pathname===${JSON.stringify(at('05-erd'))}`,'Back to 05',15000);await arrived();
  const first=await evaluate(`({hash:location.hash,sheet:!!document.querySelector('nav#stages')?.checkVisibility(),h1:document.querySelector('main h1')?.textContent.trim()})`);
  // On a phone the sheet was the last place before the pick: Back opens it again, and a second
  // Back closes it.
  assert(first.h1?.startsWith('05')&&(c.phone?first.hash==='#stages'&&first.sheet:first.hash===''),'Back returns to 05: '+JSON.stringify(first));
  if(c.phone){
   await back();
   await waitFor(`location.hash===''&&!document.querySelector('nav#stages')?.checkVisibility()`,'a second Back closes the sheet');
  }
  return{seen,back:first};
 });
}

// The picture stage (FL-119's R3, TC-1779): a comment picked in stage 01's talk selects its item.
async function picture(qa){
 const route=stagePath(qa.project,qa.part,'01-domain'),node='.pf svg a[href="#item=CTX-001"] rect';
 const SIGHT=`(()=>{const box=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r&&r.width>0?[r.left,r.top,r.right,r.bottom].map(Math.round):null;};
  return{node:box(${JSON.stringify(node)}),frame:box('.pf'),outline:box('.pf svg.mks .mk-sel'),zoom:(document.querySelector('.stage .ptools')?.textContent.match(/\\d+%/)||[null])[0]};})()`;
 const inside=(a,b,slack=1)=>!!a&&!!b&&a[0]>=b[0]-slack&&a[1]>=b[1]-slack&&a[2]<=b[2]+slack&&a[3]<=b[3]+slack;
 const READABLE=`(s=>!!s.node&&s.node[2]-s.node[0]>=40&&s.node[3]-s.node[1]>=20)(${SIGHT})&&(s=>s.node[0]>=s.frame[0]-1&&s.node[1]>=s.frame[1]-1&&s.node[2]<=s.frame[2]+1&&s.node[3]<=s.frame[3]+1)(${SIGHT})`;
 async function picked(c){
  await waitFor(`/(^|[#&])item=CTX-001(&|$)/.test(location.hash)&&!!document.querySelector('.pf svg.mks .mk-sel')`,'the item selected and outlined',15000);await settled();
  const s=await evaluate(`({tab:document.querySelector('.ws')?.dataset.nxTab||null,itemTab:!!document.querySelector('.tabs .tab[data-nx-tab="item"]')?.checkVisibility(),hash:location.hash})`);
  assert(!c.phone||s.tab==='talk'&&s.itemTab,'On a phone the Talk tab stays in front, with the Item tab: '+JSON.stringify(s));
  if(c.phone){
   // BUG-603: the picture was moved while its tab was hidden, at no size, and showed the item
   // as a dot at 0 %; it now comes into sight once the tab shows it.
   await press('.tabs .tab[data-nx-tab="stage"]');
   await waitFor(READABLE,'the item in sight and readable in the Picture tab',5000);await paint();
  }
  const sight=await evaluate(SIGHT);
  assert(inside(sight.node,sight.frame)&&inside(sight.node,sight.outline,4)&&sight.zoom!=='0%','The item in sight and outlined: '+JSON.stringify(sight));
  return{...sight,tab:s.tab,itemTab:s.itemTab};
 }
 await test('TC-1779 FL-119/R3 a comment picked in the talk brings its item into sight',[[390,'light','en'],[1440,'light','en']],async c=>{
  await open(route);
  await waitFor(`!!document.querySelector(${JSON.stringify(node)})`,'the context drawn');
  if(c.phone){await press('.tabs .tab[data-nx-tab="talk"]');await settled();}
  await press(`.side .talk li[data-nx-entry="${qa.domain}"] > .hd .ref`);
  const seen=await picked(c);
  if(!c.phone){
   const item=await evaluate(`document.querySelector('.side .item .ih .id')?.textContent||null`);
   assert(item==='CTX-001','The item\'s panel shows the context: '+item);seen.panel=item;
  }
  return seen;
 });
 // The same item from the address, loaded with the Talk tab in front on a phone.
 await test('TC-1779 FL-119/R3 an address with talk= and item= brings its item into sight',[[390,'dark','ko']],async c=>{
  await open(route+'#talk='+qa.domain+'&item=CTX-001');
  return picked(c);
 });
}

// The talk (FL-119's R7 and F1): a reply to a comment closed as answered opens it again, and a
// comment refused by Access is left again with its write ID.
async function talk(qa){
 const route=stagePath(qa.project,qa.part,'02-prd'),id=qa.answered;
 await test('TC-1803 FL-119/R7 a reply to a comment closed as answered opens it again',[[390,'dark','ko']],async c=>{
  await open(route);
  if(c.phone){await press('.tabs .tab[data-nx-tab="talk"]');await settled();}
  await press('.side .talk [data-nx-act="closed"]');await settled();
  await press(`.side .talk li[data-nx-entry="${id}"] > .hd .ref`);
  const send=`li[data-nx-entry="${id}"] > .rbox [data-nx-act="reply"]`;
  await waitFor(`[...document.querySelectorAll(${JSON.stringify(send)})].some(b=>b.checkVisibility())`,'the closed comment open with its box',15000);await settled();
  const word=await evaluate(`[...document.querySelectorAll(${JSON.stringify(send)})].find(b=>b.checkVisibility()).textContent.trim()`);
  assert(word===words('Open again',c.lang),'The box offers "Reply and open again": '+word);
  const text='A synthetic reply that opens the answered comment again';
  await type('#rp-'+id,text);
  const posts=report.posts.length;
  await press(send);
  await waitFor(`!!document.querySelector('ol[data-nx-key="l-agent"] > li[data-nx-entry="${id}"]')`,'the comment in the agent\'s turn',15000);await settled();
  const shown=await evaluate(`(()=>{const li=[...document.querySelectorAll('ol[data-nx-key="l-agent"] > li[data-nx-entry="${id}"]')].find(e=>e.checkVisibility());return li?{waits:[...li.querySelectorAll(':scope > .wt')].map(w=>w.textContent.trim()),replies:li.querySelector(':scope > .reps')?.textContent.includes(${JSON.stringify(text)})}:null;})()`);
  const comment=(await api('/api/spaces/'+qa.project+'/comments/'+id)).data,sent=report.posts.slice(posts).filter(p=>p.path==='/api/spaces/'+qa.project+'/comments/'+id+'/replies');
  assert(sent.length===1&&comment.state==='open'&&comment.waits==='agent'&&comment.replies.at(-1)?.text===text,'The API: open again, the agent\'s turn, with the reply: '+JSON.stringify({sent:sent.length,state:comment.state,waits:comment.waits}));
  assert(shown?.waits.length&&shown.replies,'Shown in the agent\'s turn with the reply: '+JSON.stringify(shown));
  return{state:comment.state,waits:comment.waits,shown};
 });
 // A comment that Access did not check is refused with access_missing above the box, which keeps
 // its words, and nothing is saved; left again once Access checks it, it carries the same write ID
 // and is saved once.
 await test('TC-1801 FL-119/F1 a comment that Access did not check keeps its words, and the same write ID passes later',[[1440,'light','en']],async()=>{
  const text='A synthetic comment that Access checks the second time',comments='/api/spaces/'+qa.project+'/comments';
  const saved=async()=>{const t=(await api('/api/spaces/'+qa.project+'/talk/'+qa.part+'/02-prd')).data;return['mine','agent','apart','closed'].flatMap(k=>t[k].entries).filter(e=>e.text===text).length;};
  const NOTE=`(()=>{const m=document.querySelector('.side .talk > .box .bnote .msg'),t=e=>e?e.textContent.replace(/\\s+/g,' ').trim():null;return{tone:m?.classList[1]||null,text:t(m?.querySelector('.t')),trace:t(m?.querySelector('.tid')),acts:m?[...m.querySelectorAll('button')].map(b=>b.dataset.nxAct):[],words:document.getElementById('talk-text').value};})()`;
  await open(route);
  await type('#talk-text',text);
  const posts=report.posts.length;
  await cookie('nexus-qa-access','none');
  await press('.side [data-nx-act="leave"]');
  await waitFor(`!!document.querySelector('.side .talk > .box .bnote .msg')`,'the refusal above the box');await settled();
  const note=await evaluate(NOTE);
  assert(note.tone==='warn'&&note.text===codeMessage('access_missing','en')&&note.trace&&!note.acts.length&&note.words===text,'Refused above the box, the words kept, no Try again: '+JSON.stringify(note));
  assert(await saved()===0,'Nothing saved');
  await cookie('nexus-qa-access',null);
  await press('.side [data-nx-act="leave"]');
  await waitFor(`!document.querySelector('.side .talk > .box .bnote .msg')&&document.getElementById('talk-text').value===''`,'the comment left and the box empty',15000);await settled();
  const writes=report.posts.slice(posts).filter(p=>p.path===comments).map(p=>p.write);
  assert(writes.length===2&&writes[0]&&writes[0]===writes[1],'Both tries carry one write ID: '+JSON.stringify(writes));
  assert(await saved()===1,'Saved once');
  assert(await evaluate(`[...document.querySelectorAll('.side ol[data-nx-key="l-agent"] > li')].some(li=>li.checkVisibility()&&li.textContent.includes(${JSON.stringify(text)}))`),'Shown in the agent\'s turn');
  return{refused:note.text,writes:writes.length,saved:1};
 });
}

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json(),qa=fixture[GROUPS[group]];
 assert(qa?.project,'The origin is not the opt-in synthetic fixture of the group '+group);
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),entries=JSON.parse(metadataBytes).entries;
 assert(/^\/code\/page\.[a-f0-9]{8}\.js$/.test(entries['page-js']||''),'Content-hashed page code is required');
 report.preflight={project:qa.project,build:{entries:{'page-js':entries['page-js'],'page-css':entries['page-css']},sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
 const browserEnv={...process.env};for(const key of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(key))delete browserEnv[key];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],browserEnv);
 const endpoint=await browser.endpoint();
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);return;}
  if(m.sessionId!==session)return;
  if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error)+' ('+m.params.request.method+' '+new URL(m.params.request.url).pathname+')';});
  else if(m.method==='Runtime.exceptionThrown')report.runtimeExceptions.push({at:new Date().toISOString(),text:m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text});
 };
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await({'first-page':firstPage,workspace,picture,talk})[group](qa);
 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.blockedExternalOrigins.length,'The page asked another origin: '+report.blockedExternalOrigins.join());
 assert(!report.runtimeExceptions.length,'The page threw: '+JSON.stringify(report.runtimeExceptions));
 report.status=report.tests.length&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 closing=true;
 try{if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();await browser.stop();report.browserExited=true;}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,group,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,runs:report.tests.length,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
