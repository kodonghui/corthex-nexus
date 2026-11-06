/**
 * BUG-589–592 and BUG-594: actual local browser regressions, Node 24 built-ins only.
 * Requires NEXUS_QA_LATE_SCREEN=1, the opt-in view-server, and NEXUS_CHROME.
 * EN/KO × light/dark × 320/1440px. No credentials, external sites or DOM writes.
 * Camera input uses CDP mouse events; nexusView() is observed, never mutated.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_LATE_SCREEN!=='1')throw Error('Use only the opt-in synthetic late-screen fixture');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,project='qa-late-screen',api='/api/spaces/'+project;
const settings=['en','ko'].flatMap(lang=>['light','dark'].flatMap(theme=>[320,1440].map(width=>({lang,theme,width,height:844}))));
const checkpointValues=[{approved:'<b>Synthetic approval</b>',by:'Synthetic reviewer',date:'2026-11-03',where:'https://example.com/qa/synthetic-checkpoint'},{approved:'Second synthetic approval',by:'Another synthetic reviewer',date:'2026-11-04'}];
const staleReasons={'01-domain':'size','05-erd':'source-gone','07-sitemap':'other-repository'};
const staleMessages={en:{size:'Not current: its newest source is larger than a snapshot may hold.','source-gone':'Not current: its newest source is gone from the repository.','other-repository':'Not current: its newest source is in another repository.'},ko:{size:'최신 아님: 최신 원본이 스냅샷에 담을 수 있는 크기보다 큼.','source-gone':'최신 아님: 저장소에서 사라짐.','other-repository':'최신 아님: 다른 저장소에 있음.'}};
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'late-screen-');
const {folder,profile}=browser;
const report={schema:'nexus-late-screen-browser-regression/1',scope:'synthetic loopback fixture only',startedAt:new Date().toISOString(),origin,node:process.version,settings,tests:[],interceptions:[],cameraInputs:[],blockedExternalOrigins:[],posts:[]};
const softDeadline=Date.now()+150000;
let ws,session,seq=0,held=null,closing=false;
const pending=new Map(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const out=(name,value)=>fs.writeFile(path.join(folder,name),JSON.stringify(value,null,2));
class CheckFailure extends Error{}
function assert(ok,message){if(!ok)throw new CheckFailure(message);}
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9;
const round4=value=>Math.round(value*10000)/10000;
// Independent values from the pinned viewer's public supported range/precision.
const supportedZoom=value=>Math.round(Math.max(.1,Math.min(1.5,value))*100)/100;
function command(method,params={},scoped=true,timeout=10000){
 if(!closing&&Date.now()>softDeadline)return Promise.reject(Error('150s work budget reached; preserving time for owned cleanup'));
 const id=++seq;
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},timeout);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params,...(scoped?{sessionId:session}:{})}));});
}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
async function waitFor(expression,timeout=15000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await evaluate(expression))return;await sleep(50);}throw Error('UI wait timed out: '+expression);}
async function paint(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function get(route){
 if(route!=='/__qa/receipts'&&!route.startsWith(api+'/'))throw Error('Unexpected fixture route');
 const response=await fetch(origin+route,{redirect:'error',signal:AbortSignal.timeout(10000)});
 assert(response.status===200,'Stored fixture GET failed: '+route+' '+response.status);return response.json();
}
async function nativePoint(x,y){await command('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await command('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await command('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});}
async function control(text){
 for(let attempt=0;attempt<8;attempt++){
  const box=await evaluate(`(()=>{const e=[...document.querySelectorAll('main.content .controls button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.disabled&&e.getClientRects().length);if(!e)throw Error('Missing enabled camera control');const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return{x,y,height:innerHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height},label:e.textContent,hit:hit?.tagName,hitText:hit?.textContent,visible:y>8&&y<innerHeight-8&&(hit===e||e.contains(hit)),at:performance.now()};})()`);
  if(box.visible){const input={label:text,before:box,startedAt:new Date().toISOString()};await nativePoint(box.x,box.y);await paint();input.finishedAt=new Date().toISOString();(report.controlInputs??=[]).push(input);return input;}
  // Scroll with an actual wheel outside the canvas; do not call DOM scrolling APIs.
  await command('Input.dispatchMouseEvent',{type:'mouseWheel',x:3,y:box.height/2,deltaX:0,deltaY:box.y-box.height/2});await paint();
 }
 throw Error('Camera control could not be reached by native scrolling: '+text);
}
async function applySetting(setting){
 await command('Emulation.setDeviceMetricsOverride',{width:setting.width,height:setting.height,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:setting.theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
}
async function navigate(route,ready){const url=origin+route;await command('Page.navigate',{url});await waitFor('location.href==='+JSON.stringify(url)+'&&('+ready+')');await paint();}
async function shot(name){const image=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(folder,name+'.png'),Buffer.from(image.data,'base64'));return name+'.png';}
async function test(name,setting,fn){
 const startedAt=new Date().toISOString();
 try{const evidence=await fn();report.tests.push({name,setting,verdict:'works',startedAt,finishedAt:new Date().toISOString(),...evidence});console.log('PASS '+name);}
 catch(error){let screenshot;try{screenshot=await shot(name+'-failure');}catch{}report.tests.push({name,setting,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),error:String(error),screenshot});console.error('FAIL '+name+': '+error);}
 await out('results.json',report);
}
async function camera(){return evaluate(`(()=>{const f=document.querySelector('.picture-shell');if(!f)throw Error('Picture frame missing');const svg=f.querySelector('.picture-preview svg'),native=f.querySelector('erd-viewer'),ready=f.dataset.editorReady==='true';let v,svgMeasurement;if(ready){v=native?.nexusView?.();if(!v)throw Error('Public native viewport unavailable');}else{if(!svg||f.dataset.previewActive!=='true')throw Error('Interactive preview missing');const raw=svg.getAttribute('viewBox'),[x,y,width,height]=raw.trim().split(/\\s+/).map(Number),b=svg.viewBox.baseVal,z=f.clientWidth/width;svgMeasurement={raw,parsed:{x,y,width,height},float32BaseVal:{x:b.x,y:b.y,width:b.width,height:b.height},at:performance.now()};v={x:-x*z,y:-y*z,zoom:z,rects:[...svg.querySelectorAll('[data-nexus-node] > rect')].map(e=>({x:Number(e.getAttribute('x')),y:Number(e.getAttribute('y')),width:Number(e.getAttribute('width')),height:Number(e.getAttribute('height'))}))};}return{mode:ready?'native':'svg',x:v.x,y:v.y,zoom:v.zoom,width:f.clientWidth,height:f.clientHeight,rects:v.rects,editorReady:f.dataset.editorReady,previewActive:f.dataset.previewActive,svgMeasurement};})()`);}
function sameHandoff(before,after){
 assert(before.mode==='svg'&&after.mode==='native','Actual SVG-to-native handoff did not occur');
 assert(before.width===after.width&&before.height===after.height,'Handoff changed the frame dimensions');
 assert(near(before.zoom,after.zoom),'Native zoom differs from independently read SVG zoom');
 for(const axis of['x','y'])assert(near(round4(before[axis]),after[axis]),'Native '+axis+' differs from the SVG origin rounded to vendor four decimals');
}
function centerPreserved(before,after){
 for(const [axis,size]of[['x','width'],['y','height']]){
  const center=before[size]/2,expected=center-(center-before[axis])*after.zoom/before.zoom;
  assert(near(after[axis],after.mode==='native'?round4(expected):expected),'Bounded/quantized zoom changed the center world point on '+axis);
 }
}
async function zoomStep(setting,direction){
 const before=await camera(),factor=direction==='in'?1.25:.8;
 const input=await control(setting.lang==='ko'?(direction==='in'?'확대':'축소'):(direction==='in'?'Zoom in':'Zoom out'));
 const after=await camera(),expected=supportedZoom(before.zoom*factor);
 report.cameraInputs.push({setting,control:direction,before,after,expected,input});
 assert(before.mode===after.mode,'Native readiness changed while operating a held or ready camera');
 assert(near(after.zoom,expected),'Actual camera button violated the supported 0.1–1.5/two-decimal zoom');
 centerPreserved(before,after);
 return after;
}
async function bound(setting,direction){
 const limit=direction==='in'?1.5:.1;
 for(let n=0;n<20;n++){const v=await camera();if(near(v.zoom,limit)){const clamped=await zoomStep(setting,direction);assert(near(clamped.zoom,limit),'One more click must keep the exact zoom boundary');return clamped;}await zoomStep(setting,direction);}
 throw new CheckFailure('Camera did not reach its supported '+limit+' bound using real controls');
}
async function fit(setting){
 await control(setting.lang==='ko'?'그림 전체':'Whole picture');
 const v=await camera();assert(v.mode==='svg'&&v.rects.length===2,'Expected two-table SVG scene for whole-picture fit');
 const x=Math.min(...v.rects.map(r=>r.x)),y=Math.min(...v.rects.map(r=>r.y)),width=Math.max(...v.rects.map(r=>r.x+r.width))-x,height=Math.max(...v.rects.map(r=>r.y+r.height))-y;
 const expected=supportedZoom(Math.min(1,(v.width-48)/width,(v.height-48)/height));
 assert(near(v.zoom,expected),'SVG fit is not quantized to the native supported precision');
 assert(near(v.x,(v.width-width*expected)/2-x*expected)&&near(v.y,(v.height-height*expected)/2-y*expected),'Fit origin must use the final supported zoom');
 return v;
}
async function panPreview(){
 const before=await camera();
 let point;
 for(let attempt=0;attempt<8;attempt++){
  point=await evaluate(`(()=>{const f=document.querySelector('.picture-shell'),r=f.getBoundingClientRect();for(let y=Math.max(30,r.top+25);y<Math.min(innerHeight-40,r.bottom-25);y+=20)for(let x=r.left+10;x<r.right-30;x+=20){const e=document.elementFromPoint(x,y);if(e?.closest('.picture-preview')&&!e.closest('[data-nexus-node],button,.picture-loading'))return{x,y};}return{scroll:r.y+r.height/2-innerHeight/2,height:innerHeight};})()`);
  if(point.x!==undefined)break;
  await command('Input.dispatchMouseEvent',{type:'mouseWheel',x:3,y:point.height/2,deltaX:0,deltaY:point.scroll});await paint();
 }
 assert(point.x!==undefined,'No actual blank SVG point is reachable for mouse panning');
 await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
 await command('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
 await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+17,y:point.y-9,button:'left',buttons:1});
 await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+17,y:point.y-9,button:'left',clickCount:1});await paint();
 const after=await camera();assert(near(after.x,before.x+17)&&near(after.y,before.y-9)&&near(after.zoom,before.zoom),'Actual pointer drag did not pan the held SVG by its input delta');
 return{point,before,after};
}
async function releaseHeld(){const active=held;held=null;if(!active)return;for(const request of active.requests)await command('Fetch.continueRequest',{requestId:request.id});}
async function onPaused(event){
 const url=new URL(event.request.url);
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(held&&url.origin===origin&&url.pathname===held.path){const entry={id:event.requestId,path:url.pathname,method:event.request.method,heldAt:new Date().toISOString()};held.requests.push(entry);report.interceptions.push(entry);return;}
 await command('Fetch.continueRequest',{requestId:event.requestId});
}
async function closeOwnedBrowser(){
 closing=true;
 if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}
 for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();
 await browser.stop();
 report.browserExited=true;
}

try{
 const fixture=await get('/__qa/receipts'),seed=fixture.lateScreen;
 assert(seed?.project===project&&seed.part==='sample'&&seed.stalePart==='stale'&&/^nc_/.test(seed.comment||'')&&/^np_/.test(seed.proposal||'')&&/^ne_/.test(seed.edit||''),'The origin is not the opt-in synthetic late-screen fixture');
 const rich=await get(api+'/overview/sample/05-erd'),stale=await get(api+'/overview/stale/05-erd'),source=await get(api+'/pictures/sample/05-erd');
 assert(['comments','discrepancies','reflections'].every(key=>rich[key].total>0),'Rich fixture must have all three actual stored remaining-work groups');
 assert(rich.record.from==='repository','The overview fixture must hold repository stage records');
 assert(JSON.stringify(rich.record.checkpoints)===JSON.stringify(checkpointValues),'Stored approval DTO differs from its independent literal fixture expectation');
 assert(rich.pictures.length===3&&rich.pictures.every(p=>p.not_current===null),'Current-part pictures must actually be current in the store');
 assert(stale.pictures.length===3&&stale.pictures.every(p=>p.not_current===staleReasons[p.stage]),'Normal snapshot pushes must store all three distinct stale reasons');
 assert(source.picture.source.tables.length===2,'Expected the original two-table synthetic public source');
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),metadata=JSON.parse(metadataBytes),erdEntry=metadata.entries['erd-js'];
 assert(/^\/code\/erd\.[a-f0-9]{8}\.js$/.test(erdEntry||''),'A fixed content-hashed ERD entry is required');
 report.preflight={seed,rich,stale,source,build:{entries:metadata.entries,sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
 const browserEnv={...process.env};for(const key of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(key))delete browserEnv[key];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],browserEnv);
 let endpoint;for(let n=0;n<100;n++){try{endpoint=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{await sleep(100);}}
 if(!endpoint)throw Error('Owned Chrome did not publish its CDP endpoint');
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);}else if(m.sessionId===session){if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error);});if(m.method==='Runtime.exceptionThrown'){report.runtimeExceptions??=[];report.runtimeExceptions.push(m.params.exceptionDetails);}if(m.method==='Network.requestWillBeSent'&&m.params.request.method==='POST')report.posts.push({path:new URL(m.params.request.url).pathname});}};
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 for(const setting of settings){
  if(Date.now()>softDeadline)throw Error('Work budget reached before all eight settings; no pass claimed');
  await applySetting(setting);const label=[setting.lang,setting.theme,setting.width].join('-');
  await test('overview-'+label,setting,async()=>{
   await navigate('/overview/'+project+'/sample/05-erd?lang='+setting.lang,'!!document.querySelector(".overview form textarea")');
   const current=await evaluate(`(()=>{const wrap=document.querySelector('.overview'),record=wrap.querySelector('.recorded-state')||wrap.querySelector('section.card.wide'),heading=[...wrap.querySelectorAll('h2')].find(e=>e.textContent===${JSON.stringify(setting.lang==='ko'?'남은 것':'What is left')});return{lang:document.documentElement.lang,width:innerWidth,dark:matchMedia('(prefers-color-scheme: dark)').matches,recordText:record.textContent,recordMarkup:{b:record.querySelectorAll('b').length,script:record.querySelectorAll('script').length},recordLinks:[...record.querySelectorAll('a')].map(e=>({text:e.textContent,href:e.href,row:e.parentElement.textContent,warning:!!e.parentElement.querySelector('span')})),remaining:heading?{text:heading.textContent,visible:!!heading.getClientRects().length}:null,groups:[...wrap.querySelectorAll('section.card')].filter(e=>/^(${setting.lang==='ko'?'어긋남|의견|반영 대기':'Discrepancies|Comments|Pending reflections'}) \\(/.test(e.querySelector('h2')?.textContent||'')).map(e=>({heading:e.querySelector('h2').textContent,text:e.textContent,afterHeading:!!(heading?.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING)}))};})()`);
   assert(current.lang===setting.lang&&current.width===setting.width&&current.dark===(setting.theme==='dark'),'The actual browser setting differs from its declared matrix row');
   assert(current.remaining?.visible&&current.groups.length===3&&current.groups.every(g=>g.afterHeading),'The specified remaining-work heading must precede all three actual rich groups');
   const sourceLabel=setting.lang==='ko'?'저장소에서':'from the repository';
   const passHeading=setting.lang==='ko'?'확인 지점 통과시키기':'Pass the checkpoint';
   assert(current.recordText.includes(sourceLabel),'The stage record must identify its repository source');
   const passHeadingVisible=await evaluate(`[...document.querySelectorAll('.overview h3')].some(h=>h.textContent===${JSON.stringify(passHeading)}&&h.getClientRects().length>0)`);
   assert(passHeadingVisible,'The checkpoint form must display the specified heading');
   for(const cp of checkpointValues)for(const field of['approved','by','date'])assert(current.recordText.includes(cp[field]),'Recorded checkpoint '+field+' is missing from the actual DOM');
   assert(current.recordMarkup.b===0&&current.recordMarkup.script===0,'Approval text must not become HTML');
   assert(current.recordLinks.some(a=>a.href===checkpointValues[0].where&&a.text===checkpointValues[0].where),'The safe optional recorded checkpoint link is missing');
   const currentLinks=current.recordLinks.filter(a=>new URL(a.href).pathname.startsWith('/pictures/'+project+'/sample/'));
   assert(currentLinks.length===3&&currentLinks.every(a=>!a.warning&&!Object.values(staleMessages[setting.lang]).some(message=>a.row.includes(message))),'Current picture links must not get stale warnings');
   const currentScreenshot=await shot('overview-current-'+label);
   await navigate('/overview/'+project+'/stale/05-erd?lang='+setting.lang,'!!document.querySelector(".overview form textarea")');
   const observed=await evaluate(`[...document.querySelectorAll('.overview section.card.wide a')].filter(a=>new URL(a.href).pathname.startsWith('/pictures/${project}/stale/')).map(a=>({stage:new URL(a.href).pathname.split('/').at(-1),href:a.href,text:a.parentElement.textContent}))`);
   assert(observed.length===3&&new Set(observed.map(p=>p.stage)).size===3,'Every retained stale picture must have its own real overview link');
   for(const p of observed)assert(p.text.includes(staleMessages[setting.lang][staleReasons[p.stage]]),'Stored stale reason is absent or beside the wrong picture link');
   return{current,stale:observed,screenshots:[currentScreenshot,await shot('overview-stale-'+label)]};
  });
  await test('erd-camera-'+label,setting,async()=>{
   held={path:erdEntry,requests:[]};
   try{
    await navigate('/pictures/'+project+'/sample/05-erd?lang='+setting.lang,'document.querySelector(".picture-shell")?.dataset.previewActive==="true"&&!!document.querySelector(".picture-preview svg")');
    const stop=Date.now()+10000;while(!held.requests.length&&Date.now()<stop){await sleep(50);}
    assert(held.requests.length>0,'A genuine native ERD entry request must be held before editing camera controls');
    const fitted=await fit(setting);if(setting.width===320)assert(fitted.zoom>.1&&fitted.zoom<1&&!near(fitted.zoom,Math.round(fitted.zoom)),'Narrow fit must exercise an actual fractional zoom');
    const previewLow=await bound(setting,'out'),pan=await panPreview(),previewHigh=await bound(setting,'in');
    await fit(setting);
    let releaseCase;
    if(setting.theme==='light'&&setting.width===1440){assert(near((await camera()).zoom,1),'Wide whole-picture fit must start at 1.0 before the actual 125% click');await zoomStep(setting,'in');assert(near((await camera()).zoom,1.25),'The held preview must reach exactly 1.25');releaseCase='1.25';}
    else if(setting.theme==='light')releaseCase='fractional-fit';
    else if(setting.width===320){await bound(setting,'out');releaseCase='lower-0.1';}
    else{await bound(setting,'in');releaseCase='upper-1.5';}
    const before=await camera(),requests=held.requests.map(r=>({...r}));
    assert(before.editorReady==='false'&&before.previewActive==='true','The final camera observation must still be before native readiness');
    await releaseHeld();await waitFor('document.querySelector(".picture-shell")?.dataset.editorReady==="true"',20000);await paint();
    const after=await camera();sameHandoff(before,after);assert(after.rects.length===2,'The real native viewer must expose both source tables');
    const nativeHigh=await bound(setting,'in'),nativeLow=await bound(setting,'out');
    return{releaseCase,requests,fitted,previewLow,pan,previewHigh,before,after,nativeHigh,nativeLow,screenshot:await shot('erd-camera-'+label)};
   }finally{await releaseHeld();}
  });
 }
 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.posts.length,'Read/camera suite must not submit browser writes');
 const finalRich=await get(api+'/overview/sample/05-erd'),finalStale=await get(api+'/overview/stale/05-erd');
 assert(JSON.stringify(finalRich)===JSON.stringify(rich)&&JSON.stringify(finalStale)===JSON.stringify(stale),'Browser checks changed the stored synthetic fixture');
 report.storedStateUnchanged=true;
 report.status=report.tests.length===16&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 try{await closeOwnedBrowser();}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
