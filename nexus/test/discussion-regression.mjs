/**
 * NEXUS synthetic discussion and checkpoint regressions. Node 24 built-ins only.
 * Required environment:
 *   NEXUS_CHROME     absolute path to an installed Chromium/Chrome executable
 *   NEXUS_QA_ORIGIN  loopback origin of nexus/test/view-server.mjs
 * Uses only project qa-views and a new, owned browser profile. Never production.
 * Writes only its owned synthetic fixture; never accesses production.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {viewItemHeading} from './view-fixtures.js';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';

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
const folder=await fs.mkdtemp(path.join(artifactBase,'run-'));
const profile=await fs.mkdtemp(path.join(folder,'profile-'));
const report={schema:'nexus-discussion-browser-regression/1',startedAt:new Date().toISOString(),origin,node:process.version,tests:[],posts:[],blockedExternalOrigins:[]};
let child,ws,session,seq=0,hold=null;
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
async function test(name,fn){const startedAt=new Date().toISOString();try{const evidence=await fn();report.tests.push({name,verdict:'works',startedAt,finishedAt:new Date().toISOString(),...evidence});console.log('PASS '+name);}catch(error){let screenshot;try{screenshot=await shot(name+'-failure');}catch{}report.tests.push({name,verdict:error instanceof CheckFailure?'fails':'blocked',startedAt,finishedAt:new Date().toISOString(),error:String(error),screenshot});console.error('FAIL '+name+': '+error);}await out('results.json',report);}
async function onPaused(event){const url=new URL(event.request.url),response=event.responseStatusCode!==undefined||event.responseErrorReason;
 if(url.origin!==origin&&!['about:','data:'].includes(url.protocol)){report.blockedExternalOrigins.push(url.origin);await command('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
 if(hold&&response&&event.request.method==='POST'&&url.pathname===api+'/comments'&&!hold.paused){hold.paused={at:new Date().toISOString(),requestId:event.requestId,status:event.responseStatusCode,body:event.request.postData};return;}
 await command('Fetch.continueRequest',{requestId:event.requestId});
}
async function closeOwnedBrowser(){
 if(ws?.readyState===1){try{await command('Browser.close',{},false,3000);}catch{}ws.close();}
 const running=()=>child&&child.exitCode===null&&child.signalCode===null;
 async function waitExit(ms){
  if(!running())return;
  await new Promise(resolve=>{const done=()=>{clearTimeout(timer);child.off('exit',done);resolve();};const timer=setTimeout(done,ms);child.once('exit',done);if(!running())done();});
 }
 await waitExit(2500);if(running()){child.kill();await waitExit(5000);}
 for(const call of pending.values())call.reject(Error('Owned browser closed'));pending.clear();
 if(running())throw Error('Owned Chrome has not exited; preserve its generated profile');
 report.browserExited=true;
}
async function removeOwnedProfile(){if(child&&child.exitCode===null&&child.signalCode===null)throw Error('Owned Chrome still running; profile preserved');const realFolder=await fs.realpath(folder),realProfile=await fs.realpath(profile);const relative=path.relative(realFolder,realProfile);if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!path.basename(realProfile).startsWith('profile-'))throw Error('Refusing profile cleanup outside the generated run folder');await fs.rm(realProfile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}

try{
 const fixture=await fetch(origin+'/__qa/receipts').then(async r=>({status:r.status,data:await r.json()}));
 assert(fixture.status===200&&Array.isArray(fixture.data.writes)&&/^nc_/.test(fixture.data.comment||'')&&/^np_/.test(fixture.data.proposal||''),'The origin is not the expected synthetic view-server fixture');
 const browserEnv={...process.env};for(const key of Object.keys(browserEnv))if(/(?:TOKEN|SECRET|PASSWORD|API_KEY)|^(?:NEXUS_DEV_|CORTHEX_NEXUS_)/.test(key))delete browserEnv[key];
 child=spawn(chrome,['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost','about:blank'],{stdio:'ignore',windowsHide:true,env:browserEnv});
 let endpoint;for(let i=0;i<100;i++){try{endpoint=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{await sleep(100);}}
 if(!endpoint)throw Error('The owned Chrome process did not publish a CDP endpoint');
 ws=new WebSocket('ws://127.0.0.1:'+endpoint[0]+endpoint[1]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=message=>{const m=JSON.parse(message.data);if(m.id){const call=pending.get(m.id);pending.delete(m.id);if(call)m.error?call.reject(Error(JSON.stringify(m.error))):call.resolve(m.result);}else if(m.sessionId===session){if(m.method==='Fetch.requestPaused')onPaused(m.params).catch(error=>{report.eventError=String(error);});if(m.method==='Network.requestWillBeSent'&&m.params.request.method==='POST'&&m.params.request.url.startsWith(origin)){report.posts.push({at:new Date().toISOString(),path:new URL(m.params.request.url).pathname,body:m.params.request.postData});}}};
 ws.onclose=()=>{for(const call of pending.values())call.reject(Error('Owned CDP connection closed'));pending.clear();};
 report.browserPid=child.pid;report.nodePid=process.pid;report.browser=await command('Browser.getVersion',{},false);
 const tab=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:tab.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'},{urlPattern:origin+api+'/comments',requestStage:'Response'}]});
 await size(1440,1000);

 const seed=fixture.data,discard=process.argv.includes('--dismiss');
 report.scenario=discard?'fresh-proposal-dismiss':'fresh-discussion-accept';
 async function get(route){return evaluate('fetch('+JSON.stringify(route)+').then(async r=>({status:r.status,data:await r.json()}))');}
 async function panel(kind,id,stage='01-domain'){const url=origin+'/pictures/qa-views/sample/'+stage+'?lang=en#'+kind+'='+id;await command('Page.navigate',{url});await waitFor('location.pathname==='+JSON.stringify(new URL(url).pathname)+'&&document.querySelector(".picture-shell")?.dataset.ready==="true"&&!document.querySelector(".panel").hidden&&!document.querySelector(".panel .skeleton")');await waitFor('!document.querySelector(".panel").getAnimations().some(a=>a.playState==="running")');await settled();}
 async function click(selector){await waitFor('!document.querySelector(".panel")?.getAnimations().some(a=>a.playState==="running")');const b=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.disabled)throw Error("No enabled control");e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await nativePoint(b.x,b.y);await sleep(100);}
 async function input(text,selector='.panel textarea'){await waitFor('!document.querySelector(".panel")?.getAnimations().some(a=>a.playState==="running")');const b=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.readOnly)throw Error("No writable control");e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await nativePoint(b.x,b.y);await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await command('Input.insertText',{text});await waitFor('document.querySelector('+JSON.stringify(selector)+')?.value==='+JSON.stringify(text));}
 async function reply(text,settles=false){await input(text);if(await evaluate('document.querySelector(".panel input[type=checkbox]").checked')!==settles)await click('.panel label.check');await click('.panel button[type=submit]');await waitFor('document.querySelector(".panel textarea")?.value===""');await settled();}
 async function overview(){const url=origin+'/overview/qa-views/sample/05-erd?lang=en';await command('Page.navigate',{url});await waitFor('location.href==='+JSON.stringify(url)+'&&!!document.querySelector(".overview form textarea")');await settled();}
 await navigate();
 const initialProposal=await get(api+'/proposals/'+seed.proposal);assert(initialProposal.data.state==='open','A fresh fixture with an open DDD proposal is required');
 if(discard){
  await test('dismiss-open-proposal-leaves-comment-open',async()=>{await panel('proposal',seed.proposal);await clickText('Dismiss','.panel button');await waitFor('document.querySelector(".panel").innerText.includes("Reply to say why")');const proposal=await get(api+'/proposals/'+seed.proposal),comment=await get(api+'/comments/'+seed.comment);assert(proposal.data.state==='dismissed'&&comment.data.state==='open'&&comment.data.dismissed,'Dismissed proposal/comment state mismatch');await clickText('Reply to say why','.panel button');await waitFor('!!document.querySelector(".panel textarea")');return{proposal,comment,state:await state(),screenshot:await shot('dismiss-open-proposal-leaves-comment-open')};});
 }else{
  await test('reply-settle-answer-reopen',async()=>{await panel('comment',seed.comment);const initial=await get(api+'/comments/'+seed.comment),plain='QA regression user reply '+Date.now();await reply(plain);const replied=await get(api+'/comments/'+seed.comment);assert(replied.data.replies.length===initial.data.replies.length+1&&replied.data.replies.at(-1).author==='user'&&replied.data.waits==='agent','User reply did not persist');const choice='QA regression user choice '+Date.now();await reply(choice,true);const settledReply=await get(api+'/comments/'+seed.comment);assert(settledReply.data.state==='open'&&settledReply.data.settled&&settledReply.data.replies.at(-1).settles,'Settling reply did not leave an open settled comment');await clickText('Answered','.panel button');await waitFor('document.querySelector(".panel button[type=submit]")?.textContent.includes("open again")');const closed=await get(api+'/comments/'+seed.comment);assert(closed.data.state==='closed'&&closed.data.closed_as==='answered','Answered did not close the comment');const reopen='QA regression reopen '+Date.now();await reply(reopen,false);const opened=await get(api+'/comments/'+seed.comment);assert(opened.data.state==='open'&&opened.data.waits==='agent'&&opened.data.replies.at(-1).text===reopen,'The user reply did not reopen it');return{initial,replied,settledReply,closed,opened,screenshot:await shot('reply-settle-answer-reopen')};});
  await test('accept-proposal-keeps-source-and-one-pending-reflection',async()=>{const before=await get(api+'/pictures/sample/01-domain');await panel('proposal',seed.proposal);await clickText('Accept','.panel button');await waitFor('document.querySelector(".panel").innerText.includes("not yet reflected")');const proposal=await get(api+'/proposals/'+seed.proposal),edit=await get(api+'/edits/'+proposal.data.edit),after=await get(api+'/pictures/sample/01-domain'),overview=await get(api+'/overview/sample/01-domain');assert(proposal.data.state==='accepted'&&edit.data.state==='pending'&&overview.data.reflections.total===1,'Acceptance did not create exactly one pending reflection');assert(JSON.stringify(before.data.picture.source)===JSON.stringify(after.data.picture.source)&&before.data.picture.commit===after.data.picture.commit,'Acceptance changed the picture');return{before,proposal,edit,after,overview,screenshot:await shot('accept-proposal-keeps-source-and-one-pending-reflection')};});
  await test('dismiss-needs-user-reflection',async()=>{await panel('proposal',seed.erdProposal,'05-erd');const before=await get(api+'/edits/'+seed.edit);await clickText('Dismiss the reflection','.panel button');await waitFor('!document.querySelector(".panel").innerText.includes("Dismiss the reflection")');const after=await get(api+'/edits/'+seed.edit),overview=await get(api+'/overview/sample/05-erd');assert(before.data.state==='needs-user'&&after.data.state==='dismissed'&&overview.data.reflections.total===0,'Reflection dismissal state/count mismatch');return{before,after,overview,screenshot:await shot('dismiss-needs-user-reflection')};});
  await test('checkpoint-pass-again-withdraw-date',async()=>{await overview();const before=await get(api+'/overview/sample/05-erd');await input('','.overview form textarea');await click('.overview form button[type=submit]');await waitFor('document.querySelector(".overview form button[type=submit]")?.textContent==="Pass again"');const first=await get(api+'/overview/sample/05-erd'),note='QA regression second checkpoint '+Date.now();await input(note,'.overview form textarea');await click('.overview form button[type=submit]');await waitFor('document.querySelector(".overview form textarea")?.value===""');await settled();const second=await get(api+'/overview/sample/05-erd'),target=second.data.checkpoints.find(c=>c.words===note);assert(first.data.checkpoints.length===before.data.checkpoints.length+1&&second.data.checkpoints.length===first.data.checkpoints.length+1&&target,'Pass again did not create a distinct checkpoint');const b=await evaluate('(()=>{const a=[...document.querySelectorAll("article.entry")].find(a=>a.innerText.includes('+JSON.stringify(note)+'));const e=[...a.querySelectorAll("button")].find(e=>e.textContent==="Withdraw");e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await nativePoint(b.x,b.y);await waitFor('document.querySelector("[role=status]").innerText.includes("Withdrawn on")');const effect=await get(api+'/checkpoints/'+target.id),after=await get(api+'/overview/sample/05-erd'),ui=await evaluate('document.querySelector("[role=status]").innerText');const date=await evaluate('new Intl.DateTimeFormat("en",{dateStyle:"medium",timeStyle:"short"}).format(new Date('+JSON.stringify(effect.data.withdrawn_at)+'))');assert(effect.data.state==='withdrawn'&&ui.includes(date)&&after.data.record.state==='in_progress'&&!after.data.checkpoints.some(c=>c.id===target.id),'Withdrawal state/date/record mismatch');return{before,first,second,effect,after,ui,screenshot:await shot('checkpoint-pass-again-withdraw-date')};});
 }
 report.receipts=await get('/__qa/receipts');await out('receipts-final.json',report.receipts);
 assert(!report.eventError,'CDP interception error: '+report.eventError);
 report.status=report.tests.length===(process.argv.includes("--dismiss")?1:4)&&report.tests.every(t=>t.verdict==='works')?'works':'fails';
}catch(error){report.status='blocked';report.fatal=String(error);console.error(error);}
finally{
 try{await closeOwnedBrowser();}catch(error){report.shutdownError=String(error);}
 try{await removeOwnedProfile();report.profileRemoved=true;}catch(error){report.profileRemoved=false;report.profileCleanupError=String(error);}
 report.browserExitCode=child?.exitCode;report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);await out('results.json',report);console.log(JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,elapsedMs:report.elapsedMs,results:path.join(folder,'results.json'),profileRemoved:report.profileRemoved}));if(report.status!=='works')process.exitCode=1;
}
