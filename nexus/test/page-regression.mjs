/**
 * TASK-272: the redesign's pages read before their code, and the code moves nothing
 * (stage 08's rules 14 to 17); TASK-271: they answer at their addresses, a project's
 * address leads to its current stage and the hub page answers at /hub. Node 24 built-ins only; an owned headless Chrome over CDP.
 * Requires NEXUS_QA_PAGES=1, the opt-in view-server, NEXUS_CHROME and NEXUS_QA_ORIGIN.
 * Synthetic loopback fixture only. The suite reads pages and sends no writes. One case
 * writes into the page itself: it empties the data block before the held code runs, to
 * see the page whose code fails.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_PAGES!=='1')throw Error('Use only the opt-in synthetic page fixture');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,project='qa-pages';
const stagePage=(lang,part='sample',stage='05-erd')=>`/p/${project}/${part}/${stage}?lang=${lang}`,homePage=lang=>'/?lang='+lang;
const words={en:{bar:"The page's buttons could not load. Load the page again to answer here."},ko:{bar:'페이지의 단추를 불러오지 못했습니다. 여기서 답하려면 페이지를 다시 불러와 주세요.'}};
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'pages-');
const {folder,profile}=browser;
const report={schema:'nexus-page-browser-regression/1',scope:'synthetic loopback fixture only',startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],blockedExternalOrigins:[],posts:[],runtimeExceptions:[]};
const softDeadline=Date.now()+150000;
let ws,session,seq=0,held=null,failing=[],closing=false,loads=0;
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
async function waitFor(expression,timeout=15000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await evaluate(expression))return;await sleep(25);}throw Error('Page wait timed out: '+expression);}
async function paint(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function setting({width,height=844,theme='light'}){
 await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
}
// Navigation returns once the page is parsed; its held code may not have run yet.
async function open(route){const url=origin+route;await command('Page.navigate',{url});await waitFor(`location.href===${JSON.stringify(url)}&&document.readyState!=='loading'&&!!document.getElementById('view-data')`);await paint();}
async function shot(name){const image=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(folder,name+'.png'),Buffer.from(image.data,'base64'));return name+'.png';}
async function test(name,fn){
 const startedAt=new Date().toISOString();
 try{const evidence=await fn();report.tests.push({name,verdict:'works',startedAt,finishedAt:new Date().toISOString(),...evidence});console.log('PASS '+name);}
 catch(error){let screenshot;try{screenshot=await shot(name+'-failure');}catch{}report.tests.push({name,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),error:String(error),screenshot});console.error('FAIL '+name+': '+error);}
 finally{held=null;failing=[];}
 await out('results.json',report);
}
async function release(){const active=held;held=null;if(!active)return;for(const id of active.requests)await command('Fetch.continueRequest',{requestId:id});}
async function onPaused(event){
 const url=new URL(event.request.url);
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(failing.some(pattern=>pattern.test(url.pathname))){report.interceptions.push({path:url.pathname,action:'failed',at:new Date().toISOString()});await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(held&&held.pattern.test(url.pathname)){held.requests.push(event.requestId);report.interceptions.push({path:url.pathname,action:'held',at:new Date().toISOString()});return;}
 await command('Fetch.continueRequest',{requestId:event.requestId});
}
// What the page shows: each part's markup and the box of every element in the parts and
// the frame, in the order of the document. mark names each element, so that a later read
// can tell whether the code replaced it.
const READ=`((mark)=>{
 const frame=[...document.querySelectorAll('header.tb,.bars,.ws,nav.rail,nav.tabs,main.stage,aside.side,main.home')],inside=[...document.querySelectorAll('[data-nx-part] *')];
 const box=e=>{const r=e.getBoundingClientRect();return[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100);};
 const parts=Object.fromEntries([...document.querySelectorAll('[data-nx-part]')].map(e=>[e.dataset.nxPart,e.innerHTML]));
 let kept=0;inside.forEach((e,i)=>{if(e.__nexusMark===i)kept++;if(mark)e.__nexusMark=i;});
 const bar=document.querySelector('[data-nx-codebar]'),barBox=bar.getBoundingClientRect(),style=getComputedStyle(bar);
 return{code:document.documentElement.dataset.nxCode||null,redrawn:document.documentElement.dataset.nxRedrawn||null,parts,frame:frame.map(e=>[e.tagName+'.'+e.className,box(e)]),boxes:inside.map(box),elements:inside.length,kept,
  bar:{height:barBox.height,visible:style.visibility==='visible'&&barBox.height>0,text:bar.textContent},width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
  fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight)};
})`;
const read=(mark=false)=>evaluate(READ+'('+mark+')');
const pageCode=entries=>new RegExp('^'+entries['page-js'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json();
 assert(fixture.pages?.project===project&&fixture.pages.parts?.join()==='sample,second'&&/^nc_/.test(fixture.pages.mine||''),'The origin is not the opt-in synthetic page fixture');
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),metadata=JSON.parse(metadataBytes),entries=metadata.entries;
 assert(/^\/code\/page\.[a-f0-9]{8}\.js$/.test(entries['page-js']||'')&&/^\/code\/fonts\.[a-f0-9]{8}\.css$/.test(entries['fonts-css']||''),'Content-hashed page code and fonts are required');
 report.preflight={fixture:fixture.pages,build:{entries:{'page-js':entries['page-js'],'page-css':entries['page-css'],'fonts-css':entries['fonts-css']},sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
 const code=pageCode(entries),fonts=/^\/code\/fonts\.[a-f0-9]{8}\.css$/;
 const browserEnv={...process.env};for(const key of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(key))delete browserEnv[key];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],browserEnv);
 let endpoint;for(let n=0;n<100;n++){try{endpoint=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{await sleep(100);}}
 if(!endpoint)throw Error('Owned Chrome did not publish its CDP endpoint');
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);}else if(m.sessionId===session){if(m.method==='Page.loadEventFired')loads++;if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error);});if(m.method==='Runtime.exceptionThrown')report.runtimeExceptions.push({at:new Date().toISOString(),text:m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text});if(m.method==='Network.requestWillBeSent'&&m.params.request.method!=='GET')report.posts.push({path:new URL(m.params.request.url).pathname,method:m.params.request.method});}};
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 // The times stay in the server's UTC here; the first page's suite shows them in another zone.
 await command('Emulation.setTimezoneOverride',{timezoneId:'UTC'});

 // Rule 15: the code draws every part again from the page's data and keeps the server's,
 // node for node and pixel for pixel. The fonts stay out, so that only the code differs.
 for(const [lang,theme]of[['en','light'],['ko','dark']])for(const width of[390,1440])for(const [kind,route]of[['stage',stagePage(lang)],['home',homePage(lang)]]){
  await test(`same-before-and-after-code-${kind}-${lang}-${theme}-${width}`,async()=>{
   await setting({width,theme});held={pattern:code,requests:[]};failing=[fonts];
   await open(route);
   const stop=Date.now()+10000;while(!held.requests.length&&Date.now()<stop)await sleep(25);
   assert(held.requests.length===1,'The page asks for its code once, and the suite holds it');
   const before=await read(true);
   assert(before.code===null&&before.redrawn===null,'The code ran before it was released');
   assert(!before.bar.visible&&before.bar.height===0,'The bar of rule 15 takes no room while the code may still come');
   await release();await waitFor(`document.documentElement.dataset.nxCode==='ready'`);await paint();
   const after=await read();
   assert(after.redrawn==='0','The code redrew '+after.redrawn+' parts');
   // The code makes the first page's answers and order work (TASK-273): those controls lose
   // their wait, and nothing else changes.
   const working=parts=>Object.fromEntries(Object.entries(parts).map(([key,html])=>[key,html.replace(/ disabled="" data-nx-wait="(?:answer|order)"/g,"")]));
   assert(JSON.stringify(after.parts)===JSON.stringify(working(before.parts)),'A part differs after the code ran');
   assert(kind!=='home'||/data-nx-wait="(?:answer|order)"/.test(before.parts.home)&&!/data-nx-wait="(?:answer|order)"/.test(after.parts.home),'The first page\'s answers and order did not start to work');
   assert(after.elements===before.elements&&after.kept===before.elements,'The code replaced elements ('+after.kept+' of '+before.elements+' kept)');
   assert(JSON.stringify(after.frame)===JSON.stringify(before.frame)&&JSON.stringify(after.boxes)===JSON.stringify(before.boxes),'An element moved or changed size when the code ran');
   assert(!after.bar.visible&&after.scrollWidth<=after.width,'The bar stays hidden and nothing scrolls sideways');
   return{elements:before.elements,frame:after.frame,redrawn:after.redrawn,screenshot:await shot(`code-${kind}-${lang}-${theme}-${width}`)};
  });
 }

 // The fonts join after the first paint (font-display: swap): the frame keeps its boxes.
 await test('fonts-keep-the-frame',async()=>{
  await setting({width:1440});held={pattern:fonts,requests:[]};
  await open(stagePage('ko'));await waitFor(`document.documentElement.dataset.nxCode==='ready'`);
  const stop=Date.now()+10000;while(!held.requests.length&&Date.now()<stop)await sleep(25);
  assert(held.requests.length===1,'The code adds the fonts after the first paint');
  const before=await read();await release();
  await waitFor(`document.fonts.status==='loaded'&&[...document.fonts].some(f=>f.family.includes('IBM Plex Sans KR')&&f.status==='loaded')`);await paint();
  const after=await read(),rows=`[...document.querySelectorAll('a.row')].map(e=>e.getBoundingClientRect().height)`;
  assert(JSON.stringify(after.frame)===JSON.stringify(before.frame),'The fonts moved the frame');
  return{before:before.fonts,after:after.fonts,frame:after.frame,rowHeights:await evaluate(rows)};
 });

 // A page whose code never comes: readable, and the bar shows after its wait.
 await test('code-blocked-shows-the-bar-after-its-wait',async()=>{
  await setting({width:390});failing=[code];const start=Date.now();
  await open(stagePage('en'));await sleep(1000);
  const early=await read();
  assert(early.code===null&&!early.bar.visible,'The bar shows before its wait');
  assert(Object.values(early.parts).join('').includes('Domain discovery')&&early.parts.rail.includes('href="/p/qa-pages/sample/01-domain"'),'The page reads without its code');
  await waitFor(`getComputedStyle(document.querySelector('[data-nx-codebar]')).visibility==='visible'`,9000);
  const late=await read(),waited=Date.now()-start;
  assert(late.bar.visible&&late.bar.height>=48&&late.bar.text===words.en.bar,'The bar of rule 15 did not show with its words');
  assert(waited>=6000,'The bar showed before 6 seconds: '+waited);
  return{waitedMs:waited,bar:late.bar,screenshot:await shot('code-blocked-390')};
 });

 // A page whose code fails: the bar shows at once, and the page stays as drawn.
 await test('code-fails-shows-the-bar-at-once',async()=>{
  await setting({width:390});held={pattern:code,requests:[]};const start=Date.now();
  await open(stagePage('ko'));const before=await read(true);
  await evaluate(`document.getElementById('view-data').textContent='{'`);
  const exceptions=report.runtimeExceptions.length;await release();
  await waitFor(`document.documentElement.dataset.nxCode==='failed'`);await paint();
  const after=await read(),elapsed=Date.now()-start;
  assert(after.bar.visible&&after.bar.text===words.ko.bar&&elapsed<6000,'The bar did not show at once ('+elapsed+' ms)');
  assert(JSON.stringify(after.parts)===JSON.stringify(before.parts)&&after.kept===before.elements,'The failed code changed the page');
  await sleep(200);assert(report.runtimeExceptions.length===exceptions+1,'The failure is reported once');
  return{elapsedMs:elapsed,bar:after.bar,screenshot:await shot('code-fails-390-ko')};
 });

 // Without scripts the bar shows from the start (scripting: none). Evaluation does not
 // run then, so the suite reads the page through the DOM and CSS domains.
 await test('no-scripts-shows-the-bar',async()=>{
  await setting({width:1440});await command('Emulation.setScriptExecutionDisabled',{value:true});
  try{
   const url=origin+stagePage('en'),start=Date.now(),loaded=loads;await command('DOM.enable');await command('CSS.enable');await command('Page.navigate',{url});
   for(const stop=Date.now()+10000;loads===loaded&&Date.now()<stop;)await sleep(25);
   assert(loads>loaded,'The page without scripts did not load');await sleep(300);
   const root=(await command('DOM.getDocument',{depth:0})).root,bar=(await command('DOM.querySelector',{nodeId:root.nodeId,selector:'[data-nx-codebar]'})).nodeId;
   assert(root.documentURL===url&&bar,'The page without scripts has no bar of rule 15');
   const style=Object.fromEntries((await command('CSS.getComputedStyleForNode',{nodeId:bar})).computedStyle.map(p=>[p.name,p.value]));
   const box=(await command('DOM.getBoxModel',{nodeId:bar})).model,html=(await command('DOM.getOuterHTML',{nodeId:bar})).outerHTML;
   const current=(await command('DOM.querySelector',{nodeId:root.nodeId,selector:'a.row.on[aria-current="page"]'})).nodeId,elapsed=Date.now()-start;
   assert(style.visibility==='visible'&&box.height>=48&&html.includes(words.en.bar),'The bar of rule 15 is missing without scripts');
   assert(current&&elapsed<6000,'The page does not read at once without scripts');
   return{bar:{height:box.height,visibility:style.visibility},elapsedMs:elapsed,screenshot:await shot('no-scripts-1440')};
  }finally{await command('Emulation.setScriptExecutionDisabled',{value:false});await command('CSS.disable');await command('DOM.disable');}
 });

 // Rule 16's widths without the code's help: the links #stages and #talk open the sheet
 // and the talk, and nothing scrolls the page sideways from 320 pixels.
 await test('widths-without-code',async()=>{
  const layout=`(()=>{const shown=s=>{const e=document.querySelector(s);return!!e&&e.getClientRects().length>0&&getComputedStyle(e).display!=='none';},box=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?[r.x,r.y,r.width,r.height].map(Math.round):null;};
   return{rail:shown('nav.rail'),stage:shown('main.stage'),side:shown('aside.side'),tabs:shown('nav.tabs'),scrim:shown('a.scrim'),railBox:box('nav.rail'),stageBox:box('main.stage'),sideBox:box('aside.side'),railPosition:getComputedStyle(document.querySelector('nav.rail')).position,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth};})()`;
  const seen=[];failing=[code];
  for(const width of[320,390,1024,1152,1279,1280,1440])for(const hash of['','#talk','#stages']){
   await setting({width});await open(stagePage('ko')+hash);const l=await evaluate(layout);seen.push({width,hash,...l});
   assert(l.scrollWidth<=width&&l.bodyWidth<=width,`The page scrolls sideways at ${width}${hash}`);
   if(width>=1280)assert(l.rail&&l.stage&&l.side&&!l.tabs&&l.railBox[0]<l.stageBox[0]&&l.stageBox[0]+l.stageBox[2]<=l.sideBox[0],'Three columns from 1,280 pixels');
   else if(width>=1024){assert(l.rail&&l.stage&&!l.tabs,'The list of stages and the stage from 1,024 pixels');assert(l.side===(hash==='#talk'),'The talk opens over the stage only by its link');if(l.side)assert(l.sideBox[0]+l.sideBox[2]===width&&l.sideBox[0]>l.stageBox[0],'The talk sits over the stage\'s right edge');}
   else{assert(l.tabs,'The tabs under 1,024 pixels');assert(l.side===(hash==='#talk')&&l.stage===(hash!=='#talk'),'The tabs show the stage or the talk');assert(l.rail===(hash==='#stages')&&l.scrim===(hash==='#stages'),'The list of stages is a sheet opened by its link');if(l.rail)assert(l.railPosition==='fixed'&&l.railBox[1]+l.railBox[3]===844,'The sheet rises from the bottom');}
  }
  for(const width of[320,390,1440]){await setting({width});await open(homePage('en'));const l=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})`);seen.push({width,page:'home',...l});assert(l.scrollWidth<=width,'The first page scrolls sideways at '+width);}
  return{seen};
 });

 // Rule 14 at 390 pixels: a finger hits each control 22 pixels around its centre.
 await test('hit-areas-at-390',async()=>{
  const probe=`((scope)=>{const controls=[...document.querySelectorAll(scope)].filter(e=>e.checkVisibility({visibilityProperty:true}));
   return controls.map(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(y<22||y>innerHeight-22)return null;
    const misses=[[0,-21],[0,21],[-21,0],[21,0]].filter(([dx,dy])=>{const hit=document.elementFromPoint(x+dx,y+dy);return!hit||!(hit===e||e.contains(hit));});
    return{name:(e.textContent.trim()||e.getAttribute('aria-label')||e.className).slice(0,40),box:[r.x,r.y,r.width,r.height].map(Math.round),misses};}).filter(Boolean);})`;
  const checked=[];
  // The fonts join after the first paint (TC-1368) and may wrap the sheet's title on fewer
  // lines: probe and click only once they have, or a control may move between the two.
  const fontsIn=async()=>{await waitFor(`document.documentElement.dataset.nxCode==='ready'&&!!document.querySelector('link[data-nexus-css="fonts"]')?.sheet&&document.fonts.status==='loaded'&&[...document.fonts].some(f=>f.family.includes('IBM Plex Sans KR')&&f.status==='loaded')`);await paint();};
  const run=async(label,scope)=>{const found=await evaluate(probe+'('+JSON.stringify(scope)+')');checked.push({label,found});for(const c of found)assert(!c.misses.length,`${label}: ${c.name} misses ${JSON.stringify(c.misses)}`);return found.length;};
  await setting({width:390});
  await open(stagePage('en'));await fontsIn();
  assert(await run('stage top bar and tabs','header.tb a,header.tb button,nav.tabs a')>=4,'Too few controls in the top bar and tabs');
  await open(stagePage('en')+'#stages');await fontsIn();
  assert(await run('sheet of stages','nav.rail a,nav.rail summary')>=8,'Too few controls in the sheet');
  const summary=await evaluate(`(()=>{const r=document.querySelector('.partsw summary').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  for(const type of['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x:summary.x,y:summary.y,button:'left',clickCount:1});await paint();
  assert(await evaluate(`document.querySelector('.partsw').open`),'The part switch opens without code');
  assert(await run('part switch','.partsw ul a')===2,'Both parts are links');
  await open(homePage('ko'));await fontsIn();
  assert(await run('first page top bar','header.tb a,header.tb button,header.tb summary')>=3,'Too few controls on the first page');
  return{checked,screenshot:await shot('hit-areas-390')};
 });

 // API-153 and API-101 at their addresses (TASK-271): a project's address answers 302 to its
 // first part's current stage, and the browser keeps what follows #; the hub page is at /hub.
 await test('addresses-lead-to-their-pages',async()=>{
  await setting({width:1440});
  const asked=origin+'/p/'+project+'#talk='+fixture.pages.mine,ends=origin+'/p/'+project+'/sample/04-functional-spec#talk='+fixture.pages.mine;
  await command('Page.navigate',{url:asked});
  await waitFor(`location.href===${JSON.stringify(ends)}&&document.readyState!=='loading'&&!!document.getElementById('view-data')`);
  const stage=await evaluate(`(()=>{const data=JSON.parse(document.getElementById('view-data').textContent);return{schema:data.schema,part:data.data.part,stage:data.data.stage,current:document.querySelector('nav.rail [aria-current]')?.getAttribute('href')||null};})()`);
  assert(stage.schema==='corthex-stage-page/0.3'&&stage.part==='sample'&&stage.stage==='04-functional-spec','The project leads to its first part\'s current stage: '+JSON.stringify(stage));
  await command('Page.navigate',{url:origin+'/hub'});
  await waitFor(`location.pathname==='/hub'&&document.readyState==='complete'&&document.getElementById('projects')?.children.length>0`);
  const hub=await evaluate(`({data:!!document.getElementById('hub-data'),view:!!document.getElementById('view-data'),projects:document.getElementById('projects').children.length})`);
  assert(hub.data&&!hub.view,'/hub serves the hub page');
  const screenshot=await shot('hub-at-hub');
  // 0.2's picture view and stage overview keep their pages until TASK-278 leads them to the
  // stage's page. Their top bar leads back to the hub page at /hub: the picture view's as the
  // server first draws it, and the overview's as its code draws it, since the server draws none.
  const kept={};
  for(const view of['pictures','overview']){
   const url=origin+'/'+view+'/'+project+'/sample/05-erd';
   await command('Page.navigate',{url});
   await waitFor(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'&&!!document.querySelector('#view > header.topbar a.control')`);
   kept[view]=await evaluate(`(()=>{const data=JSON.parse(document.getElementById('view-data').textContent),link=document.querySelector('#view > header.topbar a.control');return{schema:data.schema,view:data.view,path:location.pathname,back:link.origin===location.origin?link.pathname+link.search+link.hash:link.href,words:link.textContent};})()`);
   assert(kept[view].schema==='corthex-view-page/0.2'&&kept[view].view===(view==='pictures'?'picture':'overview')&&kept[view].path==='/'+view+'/'+project+'/sample/05-erd','0.2\'s '+view+' page answers at its address: '+JSON.stringify(kept[view]));
   assert(kept[view].back==='/hub'&&kept[view].words==='Hub page','The top bar leads back to the hub page at /hub: '+JSON.stringify(kept[view]));
  }
  return{asked:'/p/'+project+'#talk=<the fixture comment>',ended:new URL(ends).pathname+'#talk=<the fixture comment>',stage,hub,kept,screenshot};
 });

 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.posts.length,'The page suite must not send writes');
 assert(!report.blockedExternalOrigins.length,'The pages asked another origin: '+report.blockedExternalOrigins.join());
 const expected=1+1+1+1+1+1+8+1;
 report.status=report.tests.length===expected&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 closing=true;
 try{if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();await browser.stop();report.browserExited=true;}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
