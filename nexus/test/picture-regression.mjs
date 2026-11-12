/**
 * TASK-275: the picture stage (SCR-112) in a browser. The picture opens at 100 per cent in one
 * column with the five places of stage 09's sheet, with the server's SVG first and the editor
 * over it; Fit, the zoom, the map, Go to and a DDD board's steps at 1,440 and 390 pixels; the
 * addresses #view=edit, #view=board and #view=list (TC-1765); the tools' line at 1,280 pixels
 * (TC-1770); the dark ground (TC-1793); an item that the address selects, in sight and outlined
 * (SPEC-209, the picture's side of TC-1492); an editor whose code fails; and SCR-112's states
 * (#loading, #normal, #empty, #stale, #large, #error, #permission, #code-failed), both themes
 * and languages. Node 24 built-ins only; an owned headless Chrome over CDP. Requires
 * NEXUS_QA_PICTURE=1, the opt-in view-server, NEXUS_CHROME and NEXUS_QA_ORIGIN. Synthetic
 * loopback fixture only. The page's reads and writes reach the fixture server, except those
 * that a test answers itself, which the report lists as mocked or failed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {createBrowserRun} from './owned-browser.mjs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {label,labels,codeMessage,notCurrentWhy} from '../src/draw/words.js';
import {stagePath} from '../src/draw/stages.js';
import {words} from '../ui/messages.js';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or newer is required');
if(process.env.NEXUS_QA_PICTURE!=='1')throw Error('Use only the opt-in synthetic picture fixture');
const chrome=process.env.NEXUS_CHROME;
if(!chrome||!path.isAbsolute(chrome))throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const target=new URL(process.env.NEXUS_QA_ORIGIN||'about:blank');
if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Use a plain numeric IPv4 loopback fixture origin');
const origin=target.origin,part='sample';
const page=(project,stage,lang,hash='')=>stagePath(project,part,stage)+'?lang='+lang+hash;
const artifactBase=path.resolve(process.env.NEXUS_QA_ARTIFACTS||path.join(tmpdir(),'nexus-browser-artifacts'));
await fs.mkdir(artifactBase,{recursive:true});
const browser=await createBrowserRun(artifactBase,'picture-');
const {folder,profile}=browser;
const report={schema:'nexus-picture-browser-regression/1',scope:'synthetic loopback fixture only',evidence:'page measurement and screenshots; reads and writes either reach the fixture server (real) or are answered or failed by the suite (mocked), as each test says',
 startedAt:new Date().toISOString(),origin,node:process.version,tests:[],interceptions:[],blockedExternalOrigins:[],posts:[],runtimeExceptions:[]};
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
async function waitFor(expression,timeout=10000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await evaluate(expression))return;await sleep(25);}throw Error('Page wait timed out: '+expression);}
async function paint(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function setting({width,height=width<1024?844:900,theme='light'}){
 await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
}
// The page's code has run and, unless asked otherwise, the editor has drawn over the SVG.
async function open(route,{drawn=true}={}){
 const url=origin+route;await command('Page.navigate',{url:'about:blank'});await command('Page.navigate',{url});
 await waitFor(`location.href===${JSON.stringify(url)}&&document.readyState!=='loading'&&!!document.getElementById('view-data')`);
 await waitFor(`document.documentElement.dataset.nxCode==='ready'`);
 if(drawn)await waitFor(`!!document.querySelector('.pf > .cv.drawn')`,20000);
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
const problem=(status,code)=>({status,headers:[{name:'Content-Type',value:'application/problem+json'}],body:JSON.stringify({type:'about:blank',title:'Synthetic refusal',status,code,traceId:'tr_qa_'+code})});
async function onPaused(event){
 const url=new URL(event.request.url),method=event.request.method,where=url.pathname+url.search;
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(method==='POST')report.posts.push({path:url.pathname,at:new Date().toISOString()});
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
// The mouse, as a person moves it: a press, a drag and a release, or a click.
async function mouse(type,x,y,buttons=0){await command('Input.dispatchMouseEvent',{type,x,y,button:type==='mouseMoved'?(buttons?'left':'none'):'left',buttons,clickCount:type==='mouseMoved'?0:1});}
async function clickAt(x,y){await mouse('mousePressed',x,y,1);await mouse('mouseReleased',x,y);}
async function drag(x,y,dx,dy){await mouse('mousePressed',x,y,1);for(let i=1;i<=5;i++)await mouse('mouseMoved',x+dx*i/5,y+dy*i/5,1);await mouse('mouseReleased',x+dx,y+dy);await paint();}
async function click(selector){
 const at=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility({visibilityProperty:true}));if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 assert(at,'No control to click: '+selector);await clickAt(at.x,at.y);await paint();
}
// One pixel of the page, read from a screenshot of that pixel alone (8-bit RGB or RGBA PNG).
async function pixel(x,y){
 const image=Buffer.from((await command('Page.captureScreenshot',{format:'png',clip:{x,y,width:1,height:1,scale:1}})).data,'base64');
 let at=8,type=0;const data=[];
 while(at<image.length){const length=image.readUInt32BE(at),kind=image.toString('latin1',at+4,at+8),body=image.subarray(at+8,at+8+length);if(kind==='IHDR'){assert(body[8]===8,'An 8-bit screenshot');type=body[9];}else if(kind==='IDAT')data.push(body);at+=12+length;}
 // One pixel: every filter leaves the first pixel of the first row as it is.
 const raw=zlib.inflateSync(Buffer.concat(data));assert(raw[0]<=4&&(type===2||type===6),'An RGB screenshot');
 return [...raw.subarray(1,4)];
}
const hex=value=>{const m=/^#([0-9a-f]{6})$/i.exec(String(value).trim());assert(m,'A six-digit token colour: '+value);return [0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16));};

// What the picture shows: the camera, the frame's parts and the lines above it.
const CAMERA=`(()=>{const t=document.querySelector('.pf svg.board g.world')?.getAttribute('transform')||'',m=/translate\\(([-\\d.]+) ([-\\d.]+)\\) scale\\(([\\d.]+)\\)/.exec(t);return m?{x:+m[1],y:+m[2],zoom:+m[3]}:null;})()`;
const camera=()=>evaluate(CAMERA);
const STATE=`(()=>{const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],txt=e=>e?e.textContent.replace(/\\s+/g,' ').trim():null,box=e=>{if(!e||!e.checkVisibility({visibilityProperty:true}))return null;const b=e.getBoundingClientRect();return b.width?[b.left,b.top,b.right,b.bottom].map(Math.round):null;};
 const shd=q('.stage .shd'),cn=q('.stage .shd .cn'),pad=shd?parseFloat(getComputedStyle(shd).paddingRight):0;
 return{hash:location.hash,mode:q('.stage .pf')?'picture':q('.stage .lw')?'list':null,cv:q('.pf > .cv')?.className||null,key:q('.pf > .cv')?.dataset.nxKey||null,
  links:all('.pf svg.board a[href^="#item="]').map(a=>a.getAttribute('href')),note:txt(q('.pf .fnote .t')),noteTone:q('.pf .fnote .msg')?.classList[1]||null,
  pct:txt(q('.ptools [data-nx-pct]')),map:box(q('.pf > .map')),frame:box(q('.pf')),stage:box(q('.stage')),
  head:txt(shd),headRight:shd?Math.round(shd.getBoundingClientRect().right-pad):null,countsRight:cn&&cn.textContent.trim()?Math.round(cn.getBoundingClientRect().right):null,headEnd:shd?txt(shd.lastElementChild):null,
  views:all('.ptools .seg > button').map(b=>({view:b.dataset.nxView,pressed:b.getAttribute('aria-pressed')})),
  tools:all('.ptools > *').map(e=>({part:e.dataset.nxKey||e.className,box:box(e)})),steps:box(q('.stage .steps')),step:q('.stage select[name=step]')?.value??null,
  bars:all('.stage .pbars .bar').map(b=>({tone:b.classList[1],text:txt(b.querySelector('.t')),act:b.querySelector('button')?.dataset.nxAct||null})),
  notes:all('.stage .notes .bar').map(b=>({tone:b.classList[1],text:txt(b.querySelector('.t')),trace:txt(b.querySelector('.tid')),act:b.querySelector('button')?.dataset.nxAct||null})),
  empty:txt(q('.pf .empty-p p')),selected:box(q('.pf svg.mks .mk-sel')),marks:all('.pf svg.mks .mk').length,
  scrollWidth:document.documentElement.scrollWidth,width:innerWidth};})()`;
const state=()=>evaluate(STATE);
// The client box of a node of the server's SVG, which the code keeps under the editor's drawing
// at the camera's place; the Excalidraw boards draw each node at the same box.
const nodeBox=id=>evaluate(`(()=>{const a=document.querySelector('.pf svg.board a[href="#item=${id}"] rect');if(!a)return null;const b=a.getBoundingClientRect();return[b.left,b.top,b.right,b.bottom];})()`);
const inside=(inner,outer,slack=1)=>inner&&outer&&inner[0]>=outer[0]-slack&&inner[1]>=outer[1]-slack&&inner[2]<=outer[2]+slack&&inner[3]<=outer[3]+slack;
// A point of the frame's ground: clear of every node, line, mark and control in the frame.
const GROUND=`(()=>{const pf=document.querySelector('.pf').getBoundingClientRect(),grow=(b,n)=>[b.left-n,b.top-n,b.right+n,b.bottom+n];
 const busy=[...document.querySelectorAll('.pf svg.board rect, .pf svg.board path, .pf svg.board text, .pf > .map:not([hidden]), .pf .pcn > *, .pf .zpad, .pf svg.mks .mk')].filter(e=>e.checkVisibility({visibilityProperty:true})||e.closest('svg.board')).map(e=>grow(e.getBoundingClientRect(),16));
 for(let y=pf.bottom-40;y>pf.top+40;y-=20)for(let x=pf.left+40;x<pf.right-40;x+=20)if(!busy.some(b=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]))return{x:Math.round(x),y:Math.round(y),token:getComputedStyle(document.querySelector('.pf > .cv')).getPropertyValue('--nx-color-picture-ground').trim()};
 return null;})()`;
const zoomIn=()=>click('[data-nx-act="zoom-in"]');
const pictureApi=(project,stage)=>new RegExp('^/api/spaces/'+project+'/pictures/'+part+'/'+stage+'$');

try{
 const fixture=await (await fetch(origin+'/__qa/receipts',{signal:AbortSignal.timeout(10000)})).json(),qa=fixture.picture;
 assert(qa?.project==='qa-picture'&&qa.part===part&&qa.states==='qa-picture-states'&&/^nc_/.test(qa.erd||'')&&/^np_/.test(qa.proposal||''),'The origin is not the opt-in synthetic picture fixture');
 const metadataBytes=await fs.readFile(new URL('../src/view-code/sizes.json',import.meta.url)),entries=JSON.parse(metadataBytes).entries;
 assert(/^\/code\/page\.[a-f0-9]{8}\.js$/.test(entries['page-js']||'')&&/^\/code\/erd\.[a-f0-9]{8}\.js$/.test(entries['erd-js']||'')&&/^\/code\/excalidraw\.[a-f0-9]{8}\.js$/.test(entries['excalidraw-js']||''),'Content-hashed page and editor code is required');
 report.preflight={fixture:qa,build:{entries:{'page-js':entries['page-js'],'erd-js':entries['erd-js'],'excalidraw-js':entries['excalidraw-js']},sizesSHA256:createHash('sha256').update(metadataBytes).digest('hex')}};
 const erdCode=/^\/code\/erd[.-]/,editorCode=/^\/code\/(?:erd|excalidraw)[.-]/;
 const {project,states}=qa;
 const browserEnv={...process.env};for(const key of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(key))delete browserEnv[key];
 browser.launch(chrome,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],browserEnv);
 let endpoint;for(let n=0;n<100;n++){try{endpoint=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{await sleep(100);}}
 if(!endpoint)throw Error('Owned Chrome did not publish its CDP endpoint');
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);}else if(m.sessionId===session){if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error)+' ('+m.params.request.method+' '+new URL(m.params.request.url).pathname+')';});if(m.method==='Runtime.exceptionThrown')report.runtimeExceptions.push({at:new Date().toISOString(),text:m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text});}};
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await command('Emulation.setTimezoneOverride',{timezoneId:'UTC'});

 // #loading, then #normal, at both widths in both themes and languages: the server's SVG with
 // its links, which moves at once, and the editor's note while its code is held; then the
 // editor over it, at 100 per cent, with the head's counts at its right end and nothing at the
 // two places that wait for editing; and the ground of each editor at the token's colour
 // (TC-1793, BUG-595).
 for(const [width,lang,theme]of[[1440,'en','light'],[1440,'ko','dark'],[390,'en','dark'],[390,'ko','light']]){
  await test(`loading-normal-${width}-${lang}-${theme}`,async()=>{
   await setting({width,theme});
   held={pattern:erdCode,requests:[]};await open(page(project,'05-erd',lang),{drawn:false});
   await waitFor(`(document.querySelector('.pf .fnote .t')?.textContent||'')!==''`);
   const loading=await state(),before=await camera();
   assert(loading.links.length===2&&loading.links.includes('#item=TBL-001')&&/\bcv\b/.test(loading.cv)&&!/drawn/.test(loading.cv),'#loading: the server\'s SVG with its links: '+JSON.stringify(loading));
   assert(loading.note===label('The editor',0,lang)&&loading.noteTone==='info','#loading: the editor\'s note: '+JSON.stringify(loading.note));
   assert(before&&before.zoom===1,'The picture opens at 100 per cent: '+JSON.stringify(before));
   await drag(loading.frame[0]+120,loading.frame[1]+300,60,40);const moved=await camera();
   assert(Math.abs(moved.x-before.x-60)<=1&&Math.abs(moved.y-before.y-40)<=1,'The SVG moves before the editor: '+JSON.stringify({before,moved}));
   const loadingShot=await shot(`loading-${width}-${lang}-${theme}`);
   await release();await waitFor(`!!document.querySelector('.pf > .cv.drawn')`,20000);await waitFor(`(document.querySelector('.pf .fnote')?.textContent||'')===''`);await paint();
   const normal=await state(),now=await camera();
   assert(now.zoom===1&&Math.abs(now.x-moved.x)<=1&&Math.abs(now.y-moved.y)<=1,'The editor keeps the view where the user left it: '+JSON.stringify({moved,now}));
   assert(!normal.head.includes('②')&&!/\bEdit\b|편집/.test(normal.head),'No "Edit" and no "Phase ②" in the head: '+normal.head);
   if(width>=1024){
    assert(normal.pct==='100%','The zoom says 100%: '+normal.pct);
    assert(Math.abs(normal.countsRight-normal.headRight)<=1,'The counts reach the head\'s right end: '+JSON.stringify({counts:normal.countsRight,head:normal.headRight}));
    assert(normal.marks>=3,'The marks of the comment, the proposal and the accepted reflection: '+normal.marks);
   }
   assert(normal.views.length===2&&normal.views[0].pressed==='true','Picture and List, and no third place: '+JSON.stringify(normal.views));
   assert(normal.scrollWidth<=normal.width,'Nothing scrolls sideways: '+JSON.stringify([normal.scrollWidth,normal.width]));
   const grounds=[];
   for(const stage of['05-erd','07-sitemap']){
    if(stage!=='05-erd')await open(page(project,stage,lang));
    const spot=await evaluate(GROUND);assert(spot,'A point of the ground in '+stage);
    const seen=await pixel(spot.x,spot.y),want=hex(spot.token);
    grounds.push({stage,at:[spot.x,spot.y],seen,token:spot.token});
    assert(seen.every((v,i)=>Math.abs(v-want[i])<=3),`The ${theme} ground of ${stage} is the token ${spot.token}: `+JSON.stringify(seen));
   }
   return{evidence:'fixture page; the editor\'s code held by the suite, then released',loading:{note:loading.note,links:loading.links.length},grounds,screenshots:[loadingShot,await shot(`normal-${width}-${lang}-${theme}`)]};
  });
 }

 // TC-1765: the addresses of the two places that wait for editing show the picture.
 for(const [width,lang]of[[1440,'en'],[1440,'ko'],[390,'en'],[390,'ko']]){
  await test(`addresses-${width}-${lang}`,async()=>{
   await setting({width});const seen={};
   for(const hash of['#view=edit','#view=board','#view=list']){
    await open(page(project,'05-erd',lang,hash),{drawn:hash!=='#view=list'});const s=await state();seen[hash]={mode:s.mode,views:s.views,tools:s.tools.map(t=>t.part)};
    assert(s.mode===(hash==='#view=list'?'list':'picture'),hash+' shows the '+(hash==='#view=list'?'list':'picture')+': '+JSON.stringify(s.mode));
    assert(s.views.length===2&&s.views.find(v=>v.pressed==='true')?.view===s.mode,'Picture and List, with the view pressed: '+JSON.stringify(s.views));
    assert(!s.head.includes('②')&&!/\bEdit\b|편집/.test(s.head)&&s.headEnd!==null,'No place for editing in the head: '+s.head);
    if(width>=1024)assert(Math.abs(s.countsRight-s.headRight)<=1,'The counts reach the head\'s right end: '+JSON.stringify([s.countsRight,s.headRight]));
   }
   return{evidence:'fixture pages',seen,screenshot:await shot(`addresses-${width}-${lang}`)};
  });
 }

 // TC-1770: at 1,280 pixels the stage is 632 pixels wide; the tools' line holds Picture and List,
 // the picture's tools and Stage record on one line, the steps a line under it; the list's line
 // holds no picture's tools; longer words wrap inside the column.
 for(const lang of['en','ko']){
  await test(`tools-line-1280-${lang}`,async()=>{
   await setting({width:1280});await open(page(project,'01-domain',lang));
   const s=await state(),line=s.tools.filter(t=>t.box);
   assert(s.stage[2]-s.stage[0]===632,'The stage is 632 pixels wide: '+JSON.stringify(s.stage));
   assert(line.map(t=>t.part).join()==='seg,zoom,fit,goto,rec'&&line.every(t=>t.box[1]<line[0].box[3]&&t.box[3]>line[0].box[1]),'One line: Picture and List, the zoom, Fit, Go to and Stage record: '+JSON.stringify(line));
   assert(line.every(t=>inside(t.box,s.stage))&&s.steps&&s.steps[1]>=Math.max(...line.map(t=>t.box[3])),'Inside the column, and the steps on a line of their own under it: '+JSON.stringify({line,steps:s.steps}));
   await click('.ptools [data-nx-view="list"]');await waitFor(`!!document.querySelector('.stage .lw')`);
   const list=await state();
   assert(list.tools.filter(t=>t.box).map(t=>t.part).join()==='seg,rec'&&!list.steps,'The list: no picture\'s tools and no steps: '+JSON.stringify(list.tools));
   await click('.ptools [data-nx-view="picture"]');await waitFor(`!!document.querySelector('.pf > .cv.drawn')`,20000);
   // Longer words: each label of the line three times as long.
   await evaluate(`document.querySelectorAll('.ptools .seg span, .ptools .lbl, .ptools [data-nx-act=record] span').forEach(e=>{e.textContent=(e.textContent+' ').repeat(3).trim();})`);await paint();
   const long=await evaluate(`(()=>{const stage=document.querySelector('.stage').getBoundingClientRect(),line=document.querySelector('.ptools');return{tops:[...new Set([...line.children].map(e=>Math.round(e.getBoundingClientRect().top)))].length,outside:[...line.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.left<stage.left-0.5||b.right>stage.right+0.5);}).length,overflow:line.scrollWidth-line.clientWidth};})()`);
   assert(long.tops>1&&long.outside===0&&long.overflow<=0,'Longer words wrap inside the column: '+JSON.stringify(long));
   return{evidence:'fixture page, words lengthened in the page',line,long,screenshot:await shot(`tools-line-1280-${lang}`)};
  });
 }

 // Fit, the zoom, the map, Go to and a DDD board's steps at both widths.
 for(const [width,lang,theme]of[[1440,'en','light'],[390,'ko','dark']]){
  await test(`tools-${width}-${lang}`,async()=>{
   await setting({width,theme});await open(page(project,'07-sitemap',lang));
   let s=await state();
   await click('.ptools [data-nx-act="fit"]');const fitted=await camera(),boxes=[];
   for(const id of['SCR-001','SCR-002'])boxes.push(await nodeBox(id));
   assert(boxes.every(b=>inside(b,s.frame)),'Fit shows the picture whole: '+JSON.stringify({boxes,frame:s.frame,fitted}));
   for(let i=0;i<4;i++)await zoomIn();
   s=await state();const zoomed=await camera();
   assert(zoomed.zoom>fitted.zoom&&s.map,'Zoomed in, the map shows: '+JSON.stringify({zoomed,map:s.map}));
   await clickAt(s.map[2]-6,s.map[1]+(s.map[3]-s.map[1])/2);await paint();const mapped=await camera();
   assert(mapped.zoom===zoomed.zoom&&mapped.x<zoomed.x,'A press on the map moves the view there: '+JSON.stringify({zoomed,mapped}));
   await click('.ptools .goto > summary');await waitFor(`document.querySelector('.ptools .goto').open`);
   await click('.ptools .goto [data-nx-goto="1"]');await paint();
   const gone=await evaluate(`document.querySelector('.ptools .goto').open`),box=await nodeBox('SCR-002'),centre=[(box[0]+box[2])/2,(box[1]+box[3])/2],middle=[(s.frame[0]+s.frame[2])/2,(s.frame[1]+s.frame[3])/2];
   assert(!gone&&inside(box,s.frame)&&Math.abs(centre[0]-middle[0])<=2&&Math.abs(centre[1]-middle[1])<=2,'Go to centres SCR-002 and fits it: '+JSON.stringify({box,frame:s.frame,open:gone}));
   // The steps of the DDD board: Previous, the list, Next and the whole board.
   await open(page(project,'01-domain',lang));const steps=[];
   await click('.stage .steps [data-nx-key="back"]');steps.push(await state());
   await evaluate(`(()=>{const s=document.querySelector('.stage select[name=step]');s.value='1-b';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);await paint();steps.push(await state());
   await click('.stage .steps [data-nx-key="next"]');steps.push(await state());
   await evaluate(`(()=>{const s=document.querySelector('.stage select[name=step]');s.value=s.options[s.options.length-1].value;s.dispatchEvent(new Event('change',{bubbles:true}));})()`);await paint();steps.push(await state());
   assert(steps.map(x=>x.hash).join()==='#step=8-a,#step=1-b,#step=2,'&&steps.map(x=>x.step).join()==='8-a,1-b,2,8-b–9','The steps follow Previous, the list and Next, and the whole board has no step in the address: '+JSON.stringify(steps.map(x=>[x.hash,x.step])));
   return{evidence:'fixture pages',fitted,zoomed,mapped,steps:steps.map(x=>x.hash),screenshot:await shot(`tools-${width}-${lang}`)};
  });
 }

 // SPEC-209 (the picture's side of TC-1492): an item that the address selects comes into sight
 // at the same zoom and is outlined; one that the DDD board's step does not hold shows on the
 // whole board, at the zoom that fits it.
 await test('select-item',async()=>{
  await setting({width:1440});await open(page(project,'07-sitemap','en'));
  await zoomIn();await zoomIn();const zoom=(await camera()).zoom,s=await state();
  await drag(s.frame[0]+200,s.frame[1]+300,-500,-400);
  assert(!inside(await nodeBox('SCR-002'),s.frame,0),'SCR-002 is out of sight first');
  await evaluate(`location.hash='#item=SCR-002'`);await waitFor(`!!document.querySelector('.pf svg.mks .mk-sel')`);await paint();
  const now=await camera(),box=await nodeBox('SCR-002'),picked=await state();
  assert(now.zoom===zoom&&inside(box,s.frame)&&inside(box,picked.selected,4)&&picked.hash==='#item=SCR-002','In sight at the same zoom, outlined, and the address holds it: '+JSON.stringify({zoom,now,box,outline:picked.selected,hash:picked.hash}));
  // TERM-001, the aggregate Order, comes at step 6: at step 2 the whole board shows it.
  await open(page(project,'01-domain','en','#step=2'));
  await evaluate(`location.hash='#step=2&item=TERM-001'`);await waitFor(`!!document.querySelector('.pf svg.mks .mk-sel')`);await paint();
  const whole=await state(),fit=await camera(),boxes=await evaluate(`[...document.querySelectorAll('.pf svg.board a[href="#item=TERM-001"] rect')].map(r=>{const b=r.getBoundingClientRect();return[b.left,b.top,b.right,b.bottom];})`);
  assert(whole.hash==='#item=TERM-001'&&whole.step==='8-b–9'&&boxes.length===2&&boxes.every(b=>inside(b,whole.frame)),'The whole board, with both boxes of TERM-001 in sight: '+JSON.stringify({hash:whole.hash,step:whole.step,fit,boxes}));
  return{evidence:'fixture pages; the talk that picks an item comes with TASK-276',screenshot:await shot('select-item')};
 });

 // #code-failed: the editor's code fails; the SVG, moving, zooming, the map and the list stay.
 for(const [width,lang]of[[1440,'en'],[390,'ko']]){
  await test(`code-failed-${width}-${lang}`,async()=>{
   await setting({width});failing=[editorCode];await open(page(project,'05-erd',lang),{drawn:false});
   await waitFor(`!!document.querySelector('.pf .fnote .msg.warn')`,15000);
   const s=await state(),before=await camera();
   assert(s.note===label('The editor',1,lang)&&!/drawn/.test(s.cv)&&s.links.length===2,'The note, and the SVG with its links: '+JSON.stringify({note:s.note,cv:s.cv,links:s.links}));
   await drag(s.frame[0]+120,s.frame[1]+300,40,30);const moved=await camera();await zoomIn();const zoomed=await camera();
   assert(Math.abs(moved.x-before.x-40)<=1&&zoomed.zoom>moved.zoom,'Moving and zooming stay: '+JSON.stringify({before,moved,zoomed}));
   await click('.ptools [data-nx-view="list"]');await waitFor(`!!document.querySelector('.stage .lw .li')`);
   const list=await state();
   await click('.ptools [data-nx-view="picture"]');await waitFor(`!!document.querySelector('.pf .fnote .msg.warn')`,15000);
   return{evidence:'fixture page; the editor\'s code failed by the suite',list:list.mode,screenshot:await shot(`code-failed-${width}-${lang}`)};
  });
 }

 // #empty, #stale (not current) and #large, the fixture's own states.
 for(const [width,lang,theme]of[[1440,'en','light'],[390,'ko','dark']]){
  await test(`states-${width}-${lang}`,async()=>{
   await setting({width,theme});const shots=[];
   await open(page(states,'05-erd',lang),{drawn:false});let s=await state();
   assert(s.empty===words('picture_not_found:size',lang)&&s.tools.filter(t=>t.box).map(t=>t.part).join()===(width>=1024?'seg,rec':'seg'),'#empty: why, and no picture\'s tools: '+JSON.stringify({empty:s.empty,tools:s.tools}));
   shots.push(await shot(`empty-${width}-${lang}`));
   await click('.pf .empty-p [data-nx-act="view"]');await waitFor(`!!document.querySelector('.stage .lw')`);
   assert((await state()).hash==='#view=list','#empty: List shows the list');
   await open(page(states,'01-domain',lang));s=await state();
   assert(s.bars.length===1&&s.bars[0].tone==='warn'&&s.bars[0].text===notCurrentWhy('source-gone','aaaaaaa',lang),'#stale: the commit that the picture shows, and why: '+JSON.stringify(s.bars));
   const before=await camera();await drag(s.frame[0]+150,s.frame[1]+250,30,20);const after=await camera();
   assert(Math.abs(after.x-before.x-30)<=1,'The picture stays usable: '+JSON.stringify({before,after}));shots.push(await shot(`not-current-${width}-${lang}`));
   await open(page(states,'07-sitemap',lang));s=await state();
   assert(s.bars.length===1&&s.bars[0].tone==='info'&&s.bars[0].text===words('Large',lang,{n:320}),'#large: '+JSON.stringify(s.bars));
   shots.push(await shot(`large-${width}-${lang}`));
   return{evidence:'fixture pages',screenshots:shots};
  });
 }

 // Reading again after a pass: refused (#permission), failed (#error) with Try again, and a
 // newer picture with Show it (#stale), while the drawn picture stays.
 await test('read-again-1440',async()=>{
  await setting({width:1440});await open(page(project,'05-erd','en'));
  const pictures=pictureApi(project,'05-erd'),first=await state();
  await click('.ptools [data-nx-act="record"]');await waitFor(`document.querySelector('.ws')?.dataset.nxOpen==='record'`);
  const pass=()=>click('.side .rec .r2 [data-nx-act="pass"]');
  responses.push({method:'GET',pattern:pictures,...problem(403,'access_missing')});
  await pass();await waitFor(`!!document.querySelector('.stage .notes .bar')`);
  const refused=await state();
  assert(refused.notes[0]?.tone==='warn'&&refused.notes[0].text.startsWith(codeMessage('access_missing','en'))&&refused.notes[0].trace===codeMessage('Trace ID','en',{traceId:'tr_qa_access_missing'})&&refused.key===first.key,'#permission: the code\'s message and its trace ID, the picture as drawn: '+JSON.stringify(refused.notes));
  responses.push({method:'GET',pattern:pictures,...problem(500,'internal')});
  await pass();await waitFor(`!!document.querySelector('.stage .notes [data-nx-act="read"]')`);
  const failed=await state();
  assert(failed.notes[0]?.tone==='err'&&failed.notes[0].text===codeMessage('Could not update','en')&&failed.key===first.key,'#error: Could not update with Try again, the picture as drawn: '+JSON.stringify(failed.notes));
  const answer=await (await fetch(origin+'/api/spaces/'+project+'/pictures/'+part+'/05-erd',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)})).json();
  answer.picture.drawn_at=new Date(Date.parse(answer.picture.drawn_at)+60000).toISOString();
  responses.push({method:'GET',pattern:pictures,status:200,headers:[{name:'Content-Type',value:'application/json'}],body:JSON.stringify(answer)});
  await click('.stage .notes [data-nx-act="read"]');await waitFor(`!!document.querySelector('.stage .pbars [data-nx-act="newer"]')`);
  const offered=await state();
  assert(offered.bars[0]?.text===labels('A newer picture','en')[0]&&!offered.notes.length&&offered.key===first.key,'A newer picture is offered, not drawn under the user: '+JSON.stringify(offered.bars));
  await click('.stage .pbars [data-nx-act="newer"]');await waitFor(`!document.querySelector('.stage .pbars [data-nx-act="newer"]')&&!!document.querySelector('.pf > .cv.drawn')`,20000);
  const shown=await state();
  assert(shown.key!==first.key&&shown.key.includes(answer.picture.drawn_at),'Show it draws the newer picture: '+JSON.stringify({before:first.key,after:shown.key}));
  return{evidence:'fixture page and passes; the picture\'s three readings answered by the suite (mocked)',screenshot:await shot('read-again-1440')};
 });

 assert(!report.eventError,'CDP interception error: '+report.eventError);
 assert(!report.blockedExternalOrigins.length,'The page asked another origin: '+report.blockedExternalOrigins.join());
 assert(!report.runtimeExceptions.length,'The page threw: '+JSON.stringify(report.runtimeExceptions));
 const expected=4+4+2+2+1+2+2+1;
 report.status=report.tests.length===expected&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 closing=true;
 try{if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();await browser.stop();report.browserExited=true;}catch(error){report.shutdownError=String(error);report.status='blocked';}
 try{await browser.removeProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);report.status='blocked';}
 report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);
 console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
