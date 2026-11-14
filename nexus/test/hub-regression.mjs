/**
 * TASK-281, TC-1766: the hub page's three views at /hub. On the synthetic server, /hub is the
 * hub page whole (SCR-117), and /hub#q={words}, /hub#p={project}&id={id} and
 * /hub#p={project}&s={stage} open the search (SCR-102), the trace view (SCR-103) and the stage
 * detail (SCR-104); the same three after # open the same views in the file that the pinned hub
 * builds on a device from the same synthetic snapshot. In English and Korean. Node 24
 * built-ins only; an owned headless Chrome over CDP. Requires NEXUS_QA_HUB_VIEWS=1, the opt-in
 * view-server, NEXUS_CHROME, NEXUS_QA_ORIGIN, NEXUS_QA_PYTHON and CORTHEX_HUB_CHECKOUT. The
 * suite reads pages and sends no writes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createBrowserRun} from './owned-browser.mjs';
import {hubSnapshot} from './view-fixtures.js';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_HUB_VIEWS!=='1')throw Error('Use only the opt-in synthetic hub fixture');
const chrome=process.env.NEXUS_CHROME,python=process.env.NEXUS_QA_PYTHON;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
if(!python||!path.isAbsolute(python))throw Error('NEXUS_QA_PYTHON must be an absolute installed executable path');
await fs.access(chrome);await fs.access(python);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,project='qa-hub';
// What each view should say, from the hub page's own words.
const words={
 en:{title:'CORTHEX hub',server:'Built from snapshots sent to your NEXUS server.',local:'Built from files on this machine. This page loads nothing from the network.',
  results:'5 matches for “order”',stage:'02 PRD · ',record:'In progress · Next: Review the synthetic requirements'},
 ko:{title:'CORTHEX 허브',server:'NEXUS 서버에 올린 스냅샷으로 만든 페이지입니다.',local:'이 기기의 파일로 만든 페이지입니다. 네트워크에서 아무것도 불러오지 않습니다.',
  results:'“order” 검색 결과 5개',stage:'02 PRD · ',record:'진행 중 · 다음 행동: Review the synthetic requirements'},
};
const views=[['hub',''],['search','#q=order'],['trace','#p='+project+'&id=REQ-001'],['stage','#p='+project+'&s=02-prd']];
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'hub-');
const {folder,profile}=browser;
const report={schema:'nexus-hub-browser-regression/1',scope:'synthetic loopback fixture and a synthetic device file only',startedAt:new Date().toISOString(),origin,node:process.version,tests:[],blockedRequests:[],posts:[],runtimeExceptions:[]};
const softDeadline=Date.now()+150000,devicePages={};
let ws,session,seq=0,closing=false;
const pending=new Map(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const out=(name,value)=>fs.writeFile(path.join(folder,name),JSON.stringify(value,null,2));
class CheckFailure extends Error{}
function assert(ok,message){if(!ok)throw new CheckFailure(message);}
function command(method,params={},scoped=true,timeout=10000){
 if(!closing&&Date.now()>softDeadline)return Promise.reject(Error('150s work budget reached; preserving time for owned cleanup'));
 const id=++seq;
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},timeout);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params,...(scoped?{sessionId:session}:{})}));});
}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
async function waitFor(expression,timeout=15000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await evaluate(expression).catch(()=>false))return;await sleep(25);}throw Error('Page wait timed out: '+expression);}
async function shot(name){const image=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(folder,name+'.png'),Buffer.from(image.data,'base64'));return name+'.png';}
async function test(name,fn){
 const startedAt=new Date().toISOString();
 try{const evidence=await fn();report.tests.push({name,verdict:'works',startedAt,finishedAt:new Date().toISOString(),...evidence});console.log('PASS '+name);}
 catch(error){let screenshot;try{screenshot=await shot(name+'-failure');}catch{}report.tests.push({name,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),error:String(error),screenshot});console.error('FAIL '+name+': '+error);}
 await out('results.json',report);
}
// The page may ask only the fixture's origin, or, for the device's file, that file itself.
async function onPaused(event){
 const url=new URL(event.request.url),allowed=url.origin===origin||['about:','data:'].includes(url.protocol)||(url.protocol==='file:'&&Object.values(devicePages).includes(url.href.split('#')[0]));
 if(!allowed){report.blockedRequests.push(url.protocol==='file:'?'file:':url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 await command('Fetch.continueRequest',{requestId:event.requestId});
}
// The pinned hub builds the device's file, as `hub.py build` does, from the suite's synthetic snapshot.
function buildDevicePage(language,file){
 return new Promise((resolve,reject)=>{
  const child=spawn(python,['-I',path.join(import.meta.dirname,'hub_device_page.py'),'--language',language,'--now','2026-11-12T09:00:00+09:00','--out',file],{stdio:['pipe','ignore','pipe'],env:{...process.env}});
  let errors='';child.stderr.on('data',chunk=>{errors+=chunk;});child.on('error',reject);
  child.on('exit',code=>code===0?resolve():reject(Error('The pinned hub did not build the device file: '+errors.slice(-500))));
  child.stdin.end(JSON.stringify(hubSnapshot(project)));
 });
}
// What the page shows: the frame of the hub page, the view under the search, and the open stage.
const READ=`(()=>{
 const text=e=>e?e.textContent.trim():null,view=document.getElementById('view');
 const open=[...document.querySelectorAll('article.card')].filter(c=>c.querySelector('.detail')&&!c.querySelector('.detail').hidden);
 return{lang:document.documentElement.lang,hubData:!!document.getElementById('hub-data'),viewData:!!document.getElementById('view-data'),
  title:text(document.getElementById('title')),footer:text(document.getElementById('footer')),cards:[...document.querySelectorAll('article.card')].map(c=>c.id),
  heading:text(view.querySelector('h2')),viewIds:[...view.querySelectorAll('button.id')].map(b=>b.textContent),
  open:open.map(c=>({card:c.id,heading:text(c.querySelector('.detail h3')),records:[...c.querySelectorAll('.detail .part-record')].map(s=>[text(s.querySelector('h4')),text(s.querySelector('p'))]),ids:[...c.querySelectorAll('.detail button.id')].map(b=>b.textContent)})),
  pressed:[...document.querySelectorAll('article.card .stage[aria-pressed="true"]')].map(b=>b.closest('article').id+' '+b.dataset.stage),
  focused:document.activeElement&&document.activeElement!==document.body?document.activeElement.tagName+' '+text(document.activeElement):null,
  sideways:document.documentElement.scrollWidth>innerWidth};
})()`;

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json();
 assert(fixture.hubViews?.project===project,'The origin is not the opt-in synthetic hub fixture');
 for(const language of['en','ko']){const file=path.join(folder,'hub-'+language+'.html');await buildDevicePage(language,file);devicePages[language]=pathToFileURL(file).href;}
 const browserEnv={...process.env};for(const key of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(key))delete browserEnv[key];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],browserEnv);
 const endpoint=await browser.endpoint();
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);}else if(m.sessionId===session){if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error);});if(m.method==='Runtime.exceptionThrown')report.runtimeExceptions.push({at:new Date().toISOString(),text:m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text});if(m.method==='Network.requestWillBeSent'&&m.params.request.method!=='GET')report.posts.push({path:new URL(m.params.request.url).pathname,method:m.params.request.method});}};
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await command('Emulation.setTimezoneOverride',{timezoneId:'UTC'});
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});

 for(const place of['server','device'])for(const language of['en','ko'])for(const [view,hash]of views){
  await test(`${view}-${place}-${language}`,async()=>{
   // A fresh document each time, so that each address opens its view from the start.
   const url=place==='server'?origin+'/hub'+(language==='ko'?'?lang=ko':'')+hash:devicePages[language]+hash;
   await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url});
   await waitFor(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'&&document.querySelectorAll('article.card').length>0`);
   await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   const seen=await evaluate(READ),w=words[language];
   // The hub page whole: its frame, its words and every project the place holds.
   assert(seen.lang===language&&seen.hubData&&!seen.viewData&&seen.title===w.title,'The hub page in '+language+': '+JSON.stringify(seen));
   assert(seen.footer===(place==='server'?w.server:w.local),'The footer says where the page was built: '+seen.footer);
   // The server holds this suite's project and the fixture's qa-views; since TASK-278 it no
   // longer pushes the two projects of 0.2's retired suites.
   assert(seen.cards.includes('project-'+project)&&(place==='server'?seen.cards.length===2:seen.cards.length===1),'The cards of the place\'s projects: '+seen.cards.join());
   assert(!seen.sideways,'Nothing scrolls sideways');
   if(view==='hub'){
    assert(seen.heading===null&&!seen.open.length&&!seen.pressed.length,'/hub opens no view: '+JSON.stringify(seen));
   }else if(view==='search'){
    assert(seen.heading===w.results,'The search lists its matches: '+seen.heading);
    assert(JSON.stringify([...seen.viewIds].sort())===JSON.stringify(['CTX-001','REQ-001','REQ-002','SCR-001','TBL-001']),'The matches: '+seen.viewIds.join());
    assert(!seen.open.length&&seen.focused==='H2 '+w.results,'The search takes the focus: '+seen.focused);
   }else if(view==='trace'){
    assert(seen.heading==='REQ-001 Record each synthetic order','The trace view of REQ-001: '+seen.heading);
    assert(['CTX-001','SCR-001','TBL-001'].every(id=>seen.viewIds.includes(id)),'What REQ-001 comes from and leads to: '+seen.viewIds.join());
    assert(!seen.open.length&&seen.focused==='H2 '+seen.heading,'The trace view takes the focus: '+seen.focused);
   }else{
    assert(seen.heading===null&&seen.open.length===1&&seen.open[0].card==='project-'+project,'One stage detail opens, on its project: '+JSON.stringify(seen.open));
    assert(seen.open[0].heading.startsWith(w.stage)&&['REQ-001','REQ-002'].every(id=>seen.open[0].ids.includes(id)),'The PRD stage and its items: '+JSON.stringify(seen.open[0]));
    assert(JSON.stringify(seen.open[0].records)===JSON.stringify([['sample',w.record]]),'The part\'s record of the stage: '+JSON.stringify(seen.open[0].records));
    assert(JSON.stringify(seen.pressed)===JSON.stringify(['project-'+project+' 02-prd'])&&seen.focused==='H3 '+seen.open[0].heading,'The stage\'s button is pressed and its detail takes the focus: '+JSON.stringify([seen.pressed,seen.focused]));
   }
   return{evidence:place==='server'?'synthetic fixture server':'file built by the pinned hub',address:place==='server'?url.slice(origin.length):'hub-'+language+'.html'+hash,heading:seen.heading||seen.open[0]?.heading||null,screenshot:await shot(`${view}-${place}-${language}`)};
  });
 }

 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.posts.length,'The hub suite must not send writes');
 assert(!report.blockedRequests.length,'The pages asked another origin or file: '+report.blockedRequests.join());
 assert(!report.runtimeExceptions.length,'The page threw: '+JSON.stringify(report.runtimeExceptions));
 report.status=report.tests.length===2*2*views.length&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 closing=true;
 try{if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();await browser.stop();report.browserExited=true;}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
