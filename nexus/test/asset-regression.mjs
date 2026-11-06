/**
 * NEXUS synthetic asset failure regressions. Node 24 built-ins only.
 * Required environment:
 *   NEXUS_CHROME     absolute path to an installed Chromium/Chrome executable
 *   NEXUS_QA_ORIGIN  loopback origin of nexus/test/view-server.mjs
 * Uses only project qa-views and a new, owned browser profile. Never production.
 * Writes one uniquely named synthetic comment; never removes existing data.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {viewItemHeading} from './view-fixtures.js';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';

if(process.argv.includes('--core-css')&&process.argv.includes('--editor-css'))throw Error('Use a separate fresh Chrome execution for each stylesheet case');
if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute path to an installed executable');
await fs.access(chrome);
if(!process.env.NEXUS_QA_ORIGIN)throw Error('Set NEXUS_QA_ORIGIN to the synthetic loopback fixture origin');
const target=new URL(process.env.NEXUS_QA_ORIGIN);
const hostname=target.hostname.replace(/^\[|\]$/g,'');
if(target.protocol!=='http:'||!['127.0.0.1','localhost','::1'].includes(hostname)||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('NEXUS_QA_ORIGIN must be a plain HTTP loopback origin');
const origin=target.origin,api='/api/spaces/qa-views',here=path.dirname(fileURLToPath(import.meta.url));
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'run-');
const {folder,profile}=browser;
const report={schema:'nexus-asset-browser-regression-draft/1',startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],posts:[],codeRequests:[],blockedExternalOrigins:[]};
let ws,session,seq=0,hold=null;let rules=[],paused=[];
const pending=new Map();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const out=async(name,data)=>fs.writeFile(path.join(folder,name),JSON.stringify(data,null,2));
class CheckFailure extends Error{}
function assert(ok,message){if(!ok)throw new CheckFailure(message);}
function command(method,params={},scoped=true,timeout=20000){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},timeout);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params,...(scoped?{sessionId:session}:{})}));});}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
async function waitFor(expression,timeout=15000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await evaluate(expression))return;await sleep(75);}throw Error('UI wait timed out: '+expression);}
async function settled(){await evaluate('document.fonts.ready');await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(100);}
async function size(width,height=844){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await settled();}
async function navigate(stage='01-domain'){const url=origin+'/pictures/qa-views/sample/'+stage+'?lang=ko';await command('Page.navigate',{url});await waitFor('location.href==='+JSON.stringify(url)+'&&document.querySelector(".picture-shell")?.dataset.ready==="true"');await settled();const heading=await evaluate('document.querySelector("h1")?.textContent');assert(heading?.startsWith('qa-views / sample /'),'The page is not the synthetic qa-views project');}
async function nativePoint(x,y){await command('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await command('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await command('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});}
async function clickText(text,selector='button',prefix=false){await waitFor('!document.querySelector(".panel")?.getAnimations().some(a=>a.playState==="running")');const b=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>!e.disabled&&e.getClientRects().length&&${prefix?'e.textContent.trim().startsWith':'e.textContent.trim()==='}(${JSON.stringify(text)}));if(!e)throw Error('Visible enabled control missing: '+${JSON.stringify(text)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await nativePoint(b.x,b.y);await sleep(90);}
async function item(id){await clickText(id+' ·','.items button',true);await waitFor('!document.querySelector(".panel").hidden&&document.querySelector("#panel-heading")?.textContent==='+JSON.stringify(viewItemHeading(id)));await settled();}
async function type(text){const b=await evaluate(`(()=>{const t=document.querySelector('.panel textarea');if(!t||t.readOnly)throw Error('Writable draft missing');t.scrollIntoView({block:'center'});const r=t.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await nativePoint(b.x,b.y);await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await command('Input.insertText',{text});await waitFor('document.querySelector(".panel textarea")?.value==='+JSON.stringify(text));}
async function state(){return evaluate(`(()=>{const p=document.querySelector('.panel'),t=p?.querySelector('textarea');return{at:new Date().toISOString(),url:location.href,width:innerWidth,height:innerHeight,lang:document.documentElement.lang,zoom:[...document.querySelectorAll('.excalidraw button')].map(e=>e.textContent.trim()).find(t=>/^\\d+%$/.test(t)),panel:p&&!p.hidden?{heading:p.querySelector('h2')?.textContent,draft:t?.value,readOnly:t?.readOnly,modal:p.getAttribute('aria-modal')}:null,pins:[...document.querySelectorAll('.pin')].map(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{title:e.title,rect:r.toJSON(),hitOwn:h===e||e.contains(h)}})}})()`);}
async function pictureGet(){return evaluate(`fetch(${JSON.stringify(api+'/pictures/sample/01-domain')}).then(async r=>({status:r.status,data:await r.json()}))`);}
async function shot(name){await evaluate('window.scrollTo(0,0)');await settled();const image=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(folder,name+'.png'),Buffer.from(image.data,'base64'));return name+'.png';}
async function test(name,fn){if(!(process.argv.includes('--core-css')?['view-css-only-failure']:process.argv.includes('--editor-css')?['excalidraw-css-only-failure']:['pictures-core-js-only-failure','overview-core-js-only-failure','01-domain-editor-js-only-failure','05-erd-editor-js-only-failure']).includes(name))return;const startedAt=new Date().toISOString();try{const evidence=await fn();report.tests.push({name,verdict:'works',startedAt,finishedAt:new Date().toISOString(),...evidence});console.log('PASS '+name);}catch(error){let screenshot;try{screenshot=await shot(name+'-failure');}catch{}report.tests.push({name,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),error:String(error),screenshot});console.error('FAIL '+name+': '+error);}await out('results.json',report);}
async function onPaused(event){
 const url=new URL(event.request.url),phase=event.responseStatusCode!==undefined||event.responseErrorReason?'Response':'Request';
 if(phase==='Response'&&url.origin===origin){report.responses??=[];report.responses.push({at:new Date().toISOString(),path:url.pathname,method:event.request.method,status:event.responseStatusCode});}
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 const rule=rules.find(r=>(!r.path||r.path===url.pathname)&&(!r.includes||url.pathname.includes(r.includes))&&(!r.method||r.method===event.request.method)&&(r.phase||'Request')===phase);
 if(rule){if(rule.once)rules=rules.filter(r=>r!==rule);const entry={at:new Date().toISOString(),path:url.pathname,method:event.request.method,phase,action:rule.action,tag:rule.tag,responseStatus:event.responseStatusCode,status:rule.status};report.interceptions.push(entry);
  if(rule.action==='hold'){paused.push({event,entry});return;}
  if(rule.action==='fail'){await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'ConnectionClosed'});return;}
  if(rule.action==='fulfill'){await command('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:rule.status||200,responseHeaders:[{name:'Content-Type',value:(rule.status||200)>=400?'application/problem+json':'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(typeof rule.body==='string'?rule.body:JSON.stringify(rule.body??{})).toString('base64')});return;}
 }
 await command('Fetch.continueRequest',{requestId:event.requestId});
}
async function closeOwnedBrowser(){
 if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}
 for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();
 await browser.stop();
}

try{
 const fixture=await fetch(origin+'/__qa/receipts').then(async r=>({status:r.status,data:await r.json()}));
 assert(fixture.status===200&&Array.isArray(fixture.data.writes)&&/^nc_/.test(fixture.data.comment||'')&&/^np_/.test(fixture.data.proposal||''),'The origin is not the expected synthetic view-server fixture');
 const browserEnv={...process.env};for(const key of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(key))delete browserEnv[key];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost','about:blank'],browserEnv);
 let endpoint;for(let i=0;i<100;i++){try{endpoint=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{await sleep(100);}}
 if(!endpoint)throw Error('The owned Chrome process did not publish a CDP endpoint');
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);}else if(m.sessionId===session){if(m.method==='Runtime.exceptionThrown'){report.runtimeExceptions??=[];report.runtimeExceptions.push(m.params.exceptionDetails);}if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error);});if(m.method==='Network.requestWillBeSent'){const u=new URL(m.params.request.url);if(u.origin===origin&&u.pathname.startsWith('/code/'))report.codeRequests.push({path:u.pathname,method:m.params.request.method});}if(m.method==='Network.requestWillBeSent'&&m.params.request.method==='POST'&&m.params.request.url.startsWith(origin)){report.posts.push({at:new Date().toISOString(),path:new URL(m.params.request.url).pathname,body:m.params.request.postData,write:Object.entries(m.params.request.headers).find(([k])=>k.toLowerCase()==="idempotency-key")?.[1]});}}};
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'},{urlPattern:origin+'/api/*',requestStage:'Response'}]});
 await size(1440,1000);
 const seed=fixture.data,mode='assets';
 async function get(route){const r=await fetch(new URL(route,origin));return{status:r.status,data:await r.json()};}
 async function inspect(){return evaluate(`(()=>{const p=document.querySelector('.panel');return{url:location.href,lang:document.documentElement.lang,width:innerWidth,height:innerHeight,text:document.body.innerText,panel:p&&!p.hidden?{text:p.innerText,heading:p.querySelector('h2')?.textContent,draft:p.querySelector('textarea')?.value,readOnly:p.querySelector('textarea')?.readOnly,skeletons:[...p.querySelectorAll('.skeleton')].map(x=>x.textContent),buttons:[...p.querySelectorAll('button')].map(x=>({text:x.textContent,disabled:x.disabled}))}:null,errors:[...document.querySelectorAll('.error')].map(e=>({code:e.dataset.code,text:e.innerText})),links:[...document.querySelectorAll('a')].map(e=>({text:e.textContent,href:e.href,target:e.target,rel:e.rel})),headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>e.textContent),scripts:[...document.scripts].map(e=>e.src).filter(Boolean),scroll:{client:document.documentElement.clientWidth,scroll:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)}}})()`);}
 async function go(route,ready=true){const url=new URL(route,origin).href;if(await evaluate('location.href')===url){await command('Page.navigate',{url:'about:blank'});await waitFor('location.href==="about:blank"&&document.readyState==="complete"');}await command('Page.navigate',{url});await waitFor('location.href==='+JSON.stringify(url)+'&&!!document.querySelector("#view h1")');if(!route.startsWith('/overview')&&ready)await waitFor('document.querySelector(".picture-shell")?.dataset.ready==="true"||document.querySelector(".after-picture")?.dataset.fallback==="true"');await settled();}
 async function panel(kind,id,stage='01-domain',project='qa-views',lang='en',ready=true){await go('/pictures/'+project+'/sample/'+stage+'?lang='+lang+'#'+kind+'='+id,ready);await waitFor('!document.querySelector(".panel").hidden');if(ready)await waitFor('!document.querySelector(".panel .skeleton")');await waitFor('!document.querySelector(".panel").getAnimations().some(a=>a.playState==="running")');await settled();}
 async function input(text,selector='.panel textarea'){await waitFor('!document.querySelector(".panel")?.getAnimations().some(a=>a.playState==="running")');const b=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.readOnly)throw Error("No writable control");e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await nativePoint(b.x,b.y);await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await command('Input.insertText',{text});await waitFor('document.querySelector('+JSON.stringify(selector)+')?.value==='+JSON.stringify(text));}
 async function click(selector){const b=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.disabled)throw Error("No enabled control");e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await nativePoint(b.x,b.y);await sleep(120);}
 async function observe(name,fn){await test(name,async()=>{const o=await fn();o.screenshot=await shot(name);await out(name+'-observed.json',o);assert(o.ok,o.expectation||name);return o;});}
 async function waitPaused(){const end=Date.now()+10000;while(!paused.length&&Date.now()<end)await sleep(50);assert(paused.length,'Expected intercepted request missing');return paused.at(-1);}
 async function release(){const all=paused;paused=[];rules=[];for(const p of all)try{await command('Fetch.continueRequest',{requestId:p.event.requestId});}catch(e){report.releaseErrors??=[];report.releaseErrors.push(String(e));}await sleep(150);}

 if(mode==='assets'){

  const pages={};for(const stage of ['01-domain','05-erd']){const response=await fetch(origin+'/pictures/qa-views/sample/'+stage+'?lang=en');assert(response.status===200,'Synthetic asset page is unavailable');pages[stage]=await response.text();}
  const tags=html=>[...html.matchAll(/<(?:link|script)\b[^>]*>/g)].map(m=>Object.fromEntries([...m[0].matchAll(/([a-z-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]])));
  const ddd=tags(pages['01-domain']),erd=tags(pages['05-erd']);
  const metadataBytes=await fs.readFile(path.join(here,'../src/view-code/sizes.json')),metadata=JSON.parse(metadataBytes);
  const inlineViewCSS=pages['01-domain'].match(/<style\b[^>]*data-nexus-css="view"[^>]*>([\s\S]*?)<\/style>/)?.[1];
  const entries={'view-js':ddd.find(t=>t.type==='module'&&t.src)?.src,'view-css':ddd.find(t=>t['data-nexus-css']==='view')?.href||(inlineViewCSS?metadata.entries['view-css']:undefined),'excalidraw-css':ddd.find(t=>t['data-nexus-css']==='editor')?.href,'excalidraw-js':ddd.find(t=>/^\/code\/excalidraw\.[0-9a-f]{8}\.js$/.test(t.href||''))?.href,'erd-js':erd.find(t=>/^\/code\/erd\.[0-9a-f]{8}\.js$/.test(t.href||''))?.href};
  assert(Object.values(entries).every(u=>/^\/code\/[a-z0-9-]+\.[0-9a-f]{8}\.(?:js|css)$/.test(u||'')),'Expected fixed same-origin asset URLs are missing');
  const assets=[];for(const [name,url]of Object.entries(entries)){const file=metadata.files.find(f=>'/code/'+f.name===url);assert(metadata.entries[name]===url&&file&&file.path===path.basename(file.path),'Asset URL differs from the static build metadata');const bytes=await fs.readFile(path.join(here,'../src/view-code',file.path)),payloadSha256=createHash('sha256').update(bytes).digest('hex');assert(bytes.length===file.raw&&payloadSha256===file.payloadSha256,'Asset payload differs from its exact metadata hash');assets.push({name,url,payloadSha256,bytes:bytes.length});}
  assert(inlineViewCSS&&createHash('sha256').update(inlineViewCSS).digest('hex')===assets.find(a=>a.name==='view-css').payloadSha256,'Inline critical CSS differs from the hashed view stylesheet');
  const manifest={entries,assets,viewCSSDelivery:'inline',metadataSha256:createHash('sha256').update(metadataBytes).digest('hex')};report.assetManifest=manifest;

  async function pictureAvailability(){return evaluate(`(()=>{const frame=document.querySelector('.picture-shell'),svg=frame?.querySelector('svg[data-nexus-preview]'),style=document.querySelector('style[data-nexus-css="view"]'),controls=[...document.querySelectorAll('.items li button,.items li a')];return{frame:frame?{ready:frame.dataset.ready,previewReady:frame.dataset.previewReady,editorReady:frame.dataset.editorReady,position:getComputedStyle(frame).position,rect:frame.getBoundingClientRect().toJSON()}:null,svg:svg?{rect:svg.getBoundingClientRect().toJSON(),nodes:[...svg.querySelectorAll('[data-nexus-node]')].map(n=>({key:n.dataset.nexusNode,lines:[...n.querySelectorAll('tspan')].map(t=>t.textContent),positiveRect:n.querySelectorAll('rect').length>0&&[...n.querySelectorAll('rect')].every(r=>Number(r.getAttribute('width'))>0&&Number(r.getAttribute('height'))>0)}))}:null,list:{open:document.querySelector('.items')?.open,text:controls.map(e=>e.textContent.trim()),allVisible:controls.every(e=>e.getClientRects().length>0)},inlineCSS:{matches:style?.textContent===${JSON.stringify(inlineViewCSS)},rules:style?.sheet?.cssRules.length||0}}})()`);}
  const previewUsable=value=>value.frame?.previewReady==='true'&&value.svg?.nodes.length>0&&value.svg.nodes.every(n=>n.positiveRect)&&value.svg.rect.width>0&&value.svg.rect.height>0&&value.list.text.length>0;
  const editorWarning='The editor could not load. The picture and item list remain available.';
  for(const view of ['pictures','overview'])await observe(view+'-core-js-only-failure',async()=>{
   await command('Network.clearBrowserCache');const js=manifest.entries['view-js'];rules=[{path:js,method:'GET',action:'fail',tag:'core-js-only-network-failure'}];const start=report.interceptions.length,url=origin+'/'+view+'/qa-views/sample/05-erd?lang=en';
   await command('Page.navigate',{url:'about:blank'});await waitFor('location.href==="about:blank"&&document.readyState==="complete"');await command('Page.navigate',{url});await waitFor('location.href==='+JSON.stringify(url)+'&&document.readyState==="complete"');await settled();
   if(view==='pictures')await clickText('Items as a list','summary',true);
   const ui=await inspect(),availability=await pictureAvailability(),interceptions=report.interceptions.slice(start);rules=[];assert(interceptions.some(i=>i.path===js),'Core JS was not intercepted');
   if(view==='overview')return{ok:ui.text.includes('load the page again')&&ui.links.some(l=>l.text==='Load again'),ui,interceptions};
   const source=await get(api+'/pictures/sample/05-erd'),tables=source.data.picture.source.tables;
   const complete=tables.length>0&&availability.svg?.nodes.length===tables.length&&tables.every(table=>availability.svg.nodes.some(n=>n.lines[0]===table.name&&n.lines.length===table.columns.length+1&&table.columns.every(c=>n.lines.slice(1).some(line=>line.split(/\s+/).includes(c.name)&&line.includes(c.type)))))&&availability.list.text.length===tables.length&&tables.every(table=>availability.list.text.some(text=>text.startsWith(table.id+' ·')));
   return{ok:previewUsable(availability)&&complete&&availability.list.open&&availability.list.allVisible,expectation:'Blocked core JS leaves the complete server SVG, every ERD table/column and a natively expandable item list.',ui,availability,expectedTables:tables.map(t=>({id:t.id,columns:t.columns.length})),interceptions};
  });
  for(const stage of ['01-domain','05-erd'])await observe(stage+'-editor-js-only-failure',async()=>{
   await command('Network.clearBrowserCache');const js=manifest.entries[stage==='05-erd'?'erd-js':'excalidraw-js'];rules=[{path:js,method:'GET',action:'fail',tag:'editor-js-only-network-failure'}];const start=report.interceptions.length;
   await go('/pictures/qa-views/sample/'+stage+'?lang=en');await waitFor('document.querySelector(".after-picture")?.dataset.fallback==="true"');await item(stage==='05-erd'?'TBL-001':'CTX-001');
   const ui=await inspect(),availability=await pictureAvailability(),interceptions=report.interceptions.slice(start);rules=[];assert(interceptions.some(i=>i.path===js),'Editor JS was not intercepted');
   return{ok:ui.text.includes(editorWarning)&&previewUsable(availability)&&availability.frame.editorReady==='false'&&ui.panel?.draft!==undefined&&!ui.panel.readOnly,ui,availability,interceptions,note:'The real editor JS request failed. The SVG/list remain and the actual native pointer opens a writable comment-entry panel.'};
  });
  for(const asset of ['view-css','excalidraw-css'])await observe(asset+'-only-failure',async()=>{
   await command('Network.clearBrowserCache');const css=manifest.entries[asset];rules=[{path:css,method:'GET',action:'fail',tag:'stylesheet-only-network-failure'}];const start=report.interceptions.length,requestStart=report.codeRequests.length,url=origin+'/pictures/qa-views/sample/01-domain?lang=en#comment='+seed.comment;
   await command('Page.navigate',{url:'about:blank'});await waitFor('location.href==="about:blank"&&document.readyState==="complete"');await command('Page.navigate',{url});await waitFor('location.href==='+JSON.stringify(url)+'&&document.readyState==="complete"');
   await waitFor(asset==='view-css'?'document.querySelector(".picture-shell")?.dataset.editorReady==="true"':'document.querySelector(".after-picture")?.dataset.fallback==="true"');await waitFor('!document.querySelector(".panel").hidden&&!document.querySelector(".panel .skeleton")');await settled();
   const ui=await inspect(),availability=await pictureAvailability(),geometry=await evaluate(`(()=>{const panel=document.querySelector('.panel'),frame=document.querySelector('.picture-shell');return{frameReady:frame?.dataset.ready,fallback:document.querySelector('.after-picture')?.dataset.fallback,panel:panel?{hidden:panel.hidden,rect:panel.getBoundingClientRect().toJSON(),position:getComputedStyle(panel).position}:null,frame:frame?.getBoundingClientRect().toJSON(),styles:[...document.styleSheets].map(s=>s.href),styleDetails:[...document.querySelectorAll('link[rel=stylesheet]')].map(l=>{let rules;try{rules=l.sheet?.cssRules.length??null;}catch{rules='unreadable';}return{role:l.dataset.nexusCss,href:l.href,disabled:l.disabled,sheet:!!l.sheet,rules};}),excal:(()=>{const e=document.querySelector('.excalidraw');if(!e)return null;const s=getComputedStyle(e);return{position:s.position,display:s.display,height:s.height,rect:e.getBoundingClientRect().toJSON(),hasPrimary:Boolean(s.getPropertyValue('--color-primary').trim()),hasPrimaryDarker:Boolean(s.getPropertyValue('--color-primary-darker').trim())};})()}})()`),interceptions=report.interceptions.slice(start),cssRequests=report.codeRequests.slice(requestStart).filter(r=>r.path===css).length,cssIntercepts=interceptions.filter(i=>i.path===css).length;rules=[];
   const styled=availability.inlineCSS.matches&&availability.inlineCSS.rules>0&&availability.frame.position==='relative'&&geometry.panel?.position==='fixed'&&ui.panel?.draft!==undefined&&!ui.panel.readOnly;
   if(asset==='view-css')return{ok:cssRequests===0&&cssIntercepts===0&&styled&&availability.frame.editorReady==='true'&&geometry.frameReady==='true'&&geometry.excal?.hasPrimary&&geometry.excal.rect.height>0,applicability:{stylesheetNetworkFailure:'not applicable: critical view CSS is inline',blockingRuleConfigured:true,requestCount:cssRequests,interceptCount:cssIntercepts},expectation:'The exact metadata CSS is applied inline; a blocking rule for its hashed URL sees no request, while the picture/editor and styled panel work.',ui,availability,geometry,interceptions};
   assert(cssRequests>0&&cssIntercepts>0,'Editor CSS was not requested and intercepted');
   return{ok:styled&&geometry.fallback==='true'&&ui.text.includes(editorWarning)&&previewUsable(availability),expectation:'A real editor stylesheet failure keeps the styled SVG/list and writable panel.',ui,availability,geometry,cssRequests,interceptions,note:'This is an isolated editor stylesheet request failure, separate from the JS-module failures.'};
  });
 }

 report.receipts=await get('/__qa/receipts');await out('receipts-final.json',report.receipts);
 assert(!report.runtimeExceptions?.length,'Unexpected browser runtime error');
 assert(!report.eventError,'CDP interception error: '+report.eventError);
 report.status=report.tests.length===(process.argv.includes('--core-css')||process.argv.includes('--editor-css')?1:4)&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 try{await closeOwnedBrowser();}catch(error){report.shutdownError=String(error);}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works'||!report.profileRemoved)process.exitCode=1;
}
