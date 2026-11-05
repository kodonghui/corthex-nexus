import {ApiClient,NexusProblem,Drafts,PendingWrites,LatestReads,characters} from "./state.js";
import {pictureLayout,sceneItems,itemMarks,itemIdentity,commentTarget,STEPS,stepIndex} from "./layout.js";
import {words} from "./messages.js";
import {drawPicture} from "./picture.js";
import {mountPreview} from "./preview.js";
import {pictureLimitMessage} from "../src/preview.js";
import {stylesheetReady} from "./styles.js";
import "./view.css";

const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(className)n.className=className;return n;};
const put=(parent,...children)=>{parent.append(...children.filter(Boolean));return parent;};
const date=value=>{if(!value)return"";const d=new Date(value);return Number.isNaN(d.valueOf())?String(value):new Intl.DateTimeFormat(document.documentElement.lang,{dateStyle:"medium",timeStyle:"short"}).format(d);};
const count=value=>value>999?"999+":String(value||0);
const entries=value=>Array.isArray(value)?value:value?.entries||[];
const safeLink=(label,href)=>{const a=node("a",label,"control");try{const u=new URL(href,location.href);if(u.origin===location.origin&&!u.search)u.search=location.search;if(!["https:","http:"].includes(u.protocol)||u.username||u.password)return node("span",label);a.href=u.href;if(u.origin!==location.origin){a.target="_blank";a.rel="noopener noreferrer";}return a;}catch{return node("span",label);}};
const previewPainted=new WeakSet();
export function startView(payload){
  if(payload?.schema!=="corthex-view-page/0.2"||!["picture","overview"].includes(payload.view)||!["en","ko"].includes(payload.lang))throw new Error("Unreadable view data");
  const initialRoot=document.getElementById("view");
  if(payload.view==="picture"&&initialRoot?.querySelector?.(".preview-container [data-nexus-preview]")&&!previewPainted.has(initialRoot)){
    // A fast cached module must not remove the server SVG before its first paint.
    previewPainted.add(initialRoot);requestAnimationFrame(()=>requestAnimationFrame(()=>startView(payload)));return;
  }
  const styled=()=>Boolean(getComputedStyle(document.documentElement).getPropertyValue("--nx-size-target").trim());
  if(!styled()){stylesheetReady("view",{required:true}).then(ready=>{if(ready&&styled())startView(payload);});return;}
  const lang=payload.lang,ko=lang==="ko",say=(en,kr)=>ko?kr:en,t=(key,values={})=>words(key,lang,values);
  document.documentElement.lang=lang;
  const route=location.pathname.split("/").slice(2).map(decodeURIComponent),project=route[0],part=route[1]==="_"?"":route[1],stage=route[2],place=[project,part||"_",stage].map(encodeURIComponent).join("/");
  const api=new ApiClient(location.origin),drafts=new Drafts(),pending=new PendingWrites(),reads=new LatestReads(),writeErrors=new Map(),replyBaselines=new Map(),base="/api/spaces/"+encodeURIComponent(project);
  let data=payload.data,drawn=payload.data?.picture,scene,renderer,drawGeneration=0,drawAbort,localItem=null,panelTarget=null,previousFocus=null,lastStep=null,commentTransfer=null,panelVersion=0;
  const commentTransfers=new Map();
  const root=document.getElementById("view");root.replaceChildren();root.className="view";
  const top=node("header",null,"topbar"),title=node("h1",[project,part,stage].filter(Boolean).join(" / "));
  put(top,safeLink(say("Hub page","허브 페이지"),"/"),title,safeLink(payload.view==="picture"?say("Stage overview","단계 현황"):say("Picture view","그림 보기"),(payload.view==="picture"?"/overview/":"/pictures/")+place));
  if(payload.view==="overview"&&!["01-domain","05-erd","07-sitemap"].includes(stage))top.lastChild.remove();
  const meta=node("div",null,"subbar"),content=node("main",null,"content"),status=node("div"),body=node("div"),panel=node("section",null,"panel"),scrim=node("div",null,"scrim");
  status.setAttribute("aria-live","polite");status.setAttribute("role","status");panel.hidden=true;scrim.hidden=true;panel.setAttribute("role","dialog");panel.setAttribute("aria-labelledby","panel-heading");
  root.append(top,meta,content,scrim,panel);put(content,status,body);
  function button(label,act,className){const b=node("button",label,className);b.type="button";b.addEventListener("click",act);return b;}
  function notice(text,kind=""){return node("div",text,"notice "+kind);}
  function errorBox(error,retry){
    const code={sign_in_expired:"Sign-in expired",network:"No connection",timeout:"No answer in time",busy:"Busy"}[error.code]||error.code;
    const values={...error,state:stateName(error.state)},box=notice(t(error.code==="picture_not_found"?code+":"+(error.why||"not-drawn"):code,values),"error");box.dataset.code=error.code||"internal";
    if(error.traceId)box.append(node("small",t("Trace ID",{traceId:error.traceId}),"meta"));
    if(error.code==="sign_in_expired")box.append(button(say("Sign in again","다시 로그인"),()=>location.reload()));
    else if(retry)box.append(button(say("Try again","다시 시도"),retry));
    if(error.code==="cross_site")box.append(safeLink(say("Open this page","이 페이지 열기"),location.origin+location.pathname+location.hash));
    if(/(?:project|space|part)_not_found/.test(error.code))box.append(safeLink(say("Hub page","허브 페이지"),"/"));
    return box;
  }
  function stateName(value){const en={open:"open",accepted:"accepted",dismissed:"dismissed",withdrawn:"withdrawn",pending:"not yet reflected","in-review":"in review","needs-user":"waiting for the user",closed:"reflected",done:"done",in_progress:"in progress",not_started:"not started",skipped:"skipped",unknown:"unknown"},kr={open:"열림",accepted:"받음",dismissed:"버림",withdrawn:"철회됨",pending:"반영 전","in-review":"검토 중","needs-user":"사용자를 기다림",closed:"반영됨",done:"완료",in_progress:"진행 중",not_started:"시작 전",skipped:"건너뜀",unknown:"알 수 없음"};return(ko?kr:en)[value]||value||"";}
  function dataPath(){return base+(payload.view==="picture"?"/pictures/":"/overview/")+[part||"_",stage].map(encodeURIComponent).join("/");}
  function setMeta(){meta.replaceChildren();if(drawn)put(meta,node("span",say("Commit ","커밋 ")+drawn.commit),node("time",date(drawn.committed_at)));else meta.append(node("time",date(payload.generated_at)));}
  async function refresh({panel:refreshPanel=true}={}){
    status.replaceChildren(notice(t("Updating")));
    try{await reads.run("page",()=>api.call("GET",dataPath()),fresh=>{data=fresh;status.replaceChildren();if(payload.view==="overview")renderOverview();else{
      if(!drawn||fresh.picture.commit!==drawn.commit){const newer=notice(t("Newer version").split(ko?" 보기":" Show it")[0]);newer.append(button(say("Show it","보기"),()=>{drawn=fresh.picture;renderPicture();openFromHash();}));status.append(newer);}
      renderLists();renderer?.update(fresh);
    }if(panelTarget&&refreshPanel)openFromHash();});}
    catch(error){status.replaceChildren(notice(t("Could not update"),"warn"),errorBox(error,refresh));}
  }
  function hash(){return new URLSearchParams(location.hash.slice(1));}
  function open(kind,id,item,transfer=null){
    const h=hash();for(const k of["item","comment","proposal"])h.delete(k);localItem=kind==="item"&&!id?item:null;
    commentTransfer=kind==="item"?transfer:null;
    if(id)h.set(kind,id);else if(!localItem)return;
    previousFocus=document.activeElement;history.pushState({nexusPanel:true},"",location.pathname+location.search+(h.size?"#"+h:""));openFromHash();
  }
  function closePanel(){
    commentTransfer=null;
    if(history.state?.nexusPanel){history.back();return;}
    const h=hash();for(const k of["item","comment","proposal"])h.delete(k);localItem=null;history.replaceState(null,"",location.pathname+location.search+(h.size?"#"+h:""));openFromHash();
  }
  function panelFrame(heading){
    const active=document.activeElement,editing=active?.tagName==="TEXTAREA"&&panel.contains(active)?{id:active.id,start:active.selectionStart,end:active.selectionEnd}:null;
    panel.replaceChildren();panel.hidden=false;scrim.hidden=false;document.body.classList.add("panel-open");
    panel.setAttribute("aria-modal",String(matchMedia("(max-width:1023px)").matches));
    const handle=node("div",null,"handle"),head=node("div",null,"panel-head"),h=node("h2",heading);h.id="panel-heading";h.tabIndex=-1;
    put(head,h,button(say("Close","닫기"),closePanel));put(panel,handle,head);queueMicrotask(()=>{const input=editing&&document.getElementById(editing.id);if(input&&panel.contains(input)){input.focus();input.setSelectionRange(editing.start,editing.end);}else h.focus();});return panel;
  }
  function entryLink(kind,id,text){return button(text,()=>open(kind,id));}
  function listBlock(parent,title,entries,render,total=entries.length,empty=say("None","없음")){const section=node("section",null,"card");section.append(node("h2",title));if(total>entries.length)section.append(node("p",say(`${entries.length} of ${total}`,`${total}개 중 ${entries.length}개`),"muted"));const list=node("ul",null,"entries");for(const item of entries){const row=node("li",null,"entry");render(row,item);list.append(row);}if(!entries.length)list.append(node("li",empty,"muted"));section.append(list);parent.append(section);return section;}
  function renderCommentRow(row,c){put(row,entryLink("comment",c.id,c.text||c.quote||c.id),node("small",[c.item,c.author==="agent"?say("Agent","에이전트"):say("User","사용자"),commentState(c),date(c.last_at)].filter(Boolean).join(" · "),"meta"));const replies=Array.isArray(c.replies)?c.replies.length:c.replies;if(Number.isInteger(replies))row.append(node("small",t(replies===1?"One reply":"Reply count",{n:replies}),"meta"));if(c.last_reply)row.append(node("p",c.last_reply.text));}
  function renderProposalRow(row,value){const p=typeof value==="string"?(data.proposals||[]).find(p=>p.id===value)||{id:value}:value;put(row,node("p",p.reason||p.id),p.state?node("small",stateName(p.state),"meta"):null,entryLink("proposal",p.id,say("Open","열기")));}
  function commentState(c){if(c.state==="closed")return c.closed_as==="answered"?say("Closed as answered.","답이 나서 닫힘."):say("Closed with a decision.","결정으로 닫힘.");if(c.settled)return say("Settled by the user, waiting for the agent's record.","사용자가 정함, 에이전트의 기록을 기다림.");if(c.dismissed)return say("A proposal was dismissed.","제안을 버림.");return c.waits==="user"?say("Waiting for the user.","사용자를 기다림."):say("Waiting for the agent.","에이전트를 기다림.");}
  function transferReply(c,failed){
    const scope="comment-from-reply:"+c.id+":"+failed.write,key=project+":"+scope,sourceScope=project+":reply:"+c.id,source=drafts.read(sourceScope);
    let transfer=commentTransfers.get(scope);
    if(!transfer){
      const target={part:c.part,stage:c.stage,item:c.item||"",...(typeof c.quote==="string"?{quote:c.quote}:{}),commit:c.commit};
      const item=typeof c.quote==="string"?{id:"",owner:c.item||"",text:c.quote,key:"reply-transfer-"+c.id}:{id:c.item||"",text:c.item||say("Picture","그림"),key:"reply-transfer-"+c.id};
      transfer={scope,sourceScope,source,target,item};commentTransfers.set(scope,transfer);
    }
    // A transfer is a new, explicitly chosen comment; never reuse its reply ID
    // or overwrite a normal item draft or an already edited transfer draft.
    if(!drafts.has(key))drafts.save(key,{...drafts.read(key),text:source.text,settles:false});
    open("item",c.item||"",transfer.item,transfer);
  }
  function writeForm(parent,{scope,label,fieldLabel=label,max=4000,settles=false,optional=false,waiting=false,endpoint,makeBody,onSuccess,onReplyLimit,gone,recoverScope,recoverId}){
    const key=project+":"+scope,hasDraft=drafts.has(key),recoveryKey=recoverScope?project+":"+recoverScope:null;
    let initial=drafts.read(key),recovery=null;
    if(recoveryKey){const previous=drafts.read(recoveryKey);if(previous.text&&(!hasDraft||initial.text===previous.text)){recovery=previous;if(!hasDraft)initial=drafts.save(key,{...initial,text:previous.text});}}
    const form=node("form"),labelNode=node("label",fieldLabel),textarea=node("textarea"),remaining=node("small",null,"meta"),errors=node("div"),submit=node("button",say("Send","보내기"),"primary");
    if(recovery)parent.append(notice(t("Recovered draft",{id:recoverId})));
    textarea.value=initial.text;textarea.id="draft-"+scope.replace(/[^a-z0-9-]/gi,"-");labelNode.htmlFor=textarea.id;submit.type="submit";errors.setAttribute("aria-live","polite");remaining.id=textarea.id+"-remaining";textarea.setAttribute("aria-describedby",remaining.id);
    let checkbox;if(settles){checkbox=node("input");checkbox.type="checkbox";checkbox.checked=initial.settles;const check=node("label",null,"check");put(check,checkbox,node("span",t("Settles it")));form.append(check);}
    function keep(){return drafts.update(key,{text:textarea.value,settles:checkbox?.checked||false});}
    function update(){const n=characters(textarea.value),busy=pending.has(key);remaining.textContent=n>=max*.9?t("Characters left",{n:max-n}):"";textarea.readOnly=busy;if(checkbox)checkbox.disabled=busy;submit.disabled=waiting||busy||n>max||(!optional&&!textarea.value.trim());submit.textContent=busy?t("Sending"):label;form.setAttribute("aria-busy",String(waiting||busy));}
    textarea.addEventListener("input",()=>{keep();update();});checkbox?.addEventListener("change",()=>{keep();update();});
    const showError=()=>{errors.replaceChildren();const error=writeErrors.get(key);if(error)errors.append(errorBox(error,()=>form.requestSubmit()));};
    const unsubscribe=pending.subscribe(which=>{if(!form.isConnected){unsubscribe();return;}if(which===key){update();showError();}});showError();
    form.addEventListener("submit",async event=>{event.preventDefault();update();if(submit.disabled)return;const locationAtSend=location.href,draft=drafts.ensure(key);writeErrors.delete(key);errors.replaceChildren();
      try{const result=await pending.run(key,()=>api.call("POST",endpoint,{body:makeBody(draft),write:draft.write}));drafts.clear(key,draft.write);if(recovery&&drafts.read(recoveryKey).text===recovery.text)drafts.clear(recoveryKey,recovery.write);if(form.isConnected){textarea.value=drafts.read(key).text;update();}if(location.href===locationAtSend&&form.isConnected)await onSuccess?.(result);await refresh();}
      catch(error){if(error.code==="write_id_reused")drafts.renew(key);writeErrors.set(key,error);pending.notify(key,false);if(error.field==="text"||error.field==="words")textarea.setAttribute("aria-invalid","true");if(error.code==="reply_limit"&&onReplyLimit)errors.append(button(say("Leave a new comment","새 의견 남기기"),()=>onReplyLimit(draft)));if(gone?.codes.includes(error.code))await gonePanel(gone,error);else if(["proposal_not_open","edit_state","checkpoint_recorded","picture_not_found","discrepancy_not_found","project_not_found","space_not_found"].includes(error.code))await refresh();}finally{update();}
    });
    put(form,labelNode,textarea,remaining,errors,submit);parent.append(form);update();return form;
  }
  async function gonePanel({kind,target,reply},error){
    if(panelTarget===target){
      reads.invalidate("panel");panelVersion++;
      const frame=panelFrame(t(kind+"_not_found"));put(frame,errorBox(error),button(t("Back to the picture"),closePanel));
      if(kind==="comment"&&/^nc_[0-9a-hjkmnp-tv-z]{12}$/.test(reply?.id||"")){
        const key=project+":reply:"+reply.id;writeErrors.delete(key);
        if(drafts.has(key)&&drafts.read(key).text)writeForm(frame,{scope:"reply:"+reply.id,label:reply.state==="closed"?t("Open again"):say("Reply","답글 남기기"),settles:true,waiting:true,endpoint:base+"/comments/"+encodeURIComponent(reply.id)+"/replies",makeBody:d=>({text:d.text,settles:d.settles})});
      }
    }
    // A target refusal refreshes only the picture, never the missing target.
    await refresh({panel:false});
  }
  function action(parent,{scope,label,endpoint,done,gone,waiting=false}){
    const key=project+":"+scope,group=node("div",null,"action"),errorArea=node("div"),b=button(label,send);put(group,errorArea,b);parent.append(group);
    const update=()=>{b.disabled=waiting||pending.has(key);b.textContent=pending.has(key)?t("Sending"):label;};pending.subscribe(which=>{if(which===key&&b.isConnected)update();});update();
    async function send(){if(waiting||pending.has(key))return;errorArea.replaceChildren();const locationAtSend=location.href,draft=drafts.ensure(key);try{const value=await pending.run(key,()=>api.call("POST",endpoint,{body:{},write:draft.write}));drafts.clear(key,draft.write);await refresh();if(location.href===locationAtSend)done?.(value);}catch(error){if(error.code==="write_id_reused")drafts.renew(key);if(gone?.codes.includes(error.code))await gonePanel(gone,error);else if(["proposal_not_open","edit_state","checkpoint_recorded","checkpoint_not_found","project_not_found"].includes(error.code)){await refresh();if(location.href===locationAtSend)status.append(errorBox(error));}else errorArea.replaceChildren(errorBox(error,send));}finally{update();}}
  }
  function renderItem(id,provided){
    const items=sceneItems(scene?.limited?scene:pictureLayout(drawn?.source||{},stage));
    const transfer=commentTransfer;
    let item=transfer?.item||provided||items.find(n=>n.id===id);
    const title=item?.raw?.name||item?.text,p=panelFrame(item?.id?[item.id,title!==item.id?title:""].filter(Boolean).join(" "):id||provided?.text||say("Part without an ID","ID 없는 부분"));
    if(!item){
      put(p,notice(t("Not in the picture",{id})),button(t("Back to the picture"),closePanel));
      const key=project+":comment:"+place+":"+id;
      const hasComments=id&&(data.comments?.entries||[]).some(c=>c.item===id);
      let hasDraft=false;
      try{hasDraft=Boolean(id)&&drafts.has(key)&&Boolean(drafts.read(key).text);}
      catch{return;} // An overlong address cannot name a valid draft scope.
      if(!hasComments&&!hasDraft)return;
      // A removed stable ID still owns its open comments and existing draft.
      // Reuse the original form scope and write ID without inventing source data.
      item={id,text:id};
    }
    const target=transfer?{item:transfer.target.item,...(typeof transfer.target.quote==="string"?{quote:transfer.target.quote}:{})}:commentTarget(item),ownedPart=!item.id&&Boolean(item.owner),foreign=transfer&&(transfer.target.part!==part||transfer.target.stage!==stage);
    p.append(node("p",item.text));if(!item.id)p.append(notice(t(ownedPart?"Held part":"No ID",{id:target.item})));
    if(foreign)p.append(safeLink(say("Picture view","그림 보기"),"/pictures/"+[project,transfer.target.part||"_",transfer.target.stage].map(encodeURIComponent).join("/")));
    if(item.raw){for(const field of["context","terms","primary_key","unique","foreign_keys","path","flows","purpose"]){if(item.raw[field]!==undefined)put(p,node("h3",field),node("pre",typeof item.raw[field]==="object"?JSON.stringify(item.raw[field],null,2):item.raw[field]));}}
    if(!foreign){
    const mark=itemMarks(item,data);listBlock(p,say(`Proposals (${count(mark.proposals.length)})`,`제안 (${count(mark.proposals.length)})`),mark.proposals,renderProposalRow);
    for(const mismatch of mark.discrepancies){const n=notice([mismatch.term,mismatch.item,...mismatch.reasons.map(r=>r.kind)].filter(Boolean).join(" · "),"warn");if(mismatch.waiting)n.append(node("p",t("Waits")));p.append(n);}
    listBlock(p,say(`Comments (${count(mark.comments.length)})`,`의견 (${count(mark.comments.length)})`),mark.comments,renderCommentRow);
    const closed=(data.closed_comments?.entries||[]).filter(c=>c.item===target.item),closedLabel=ownedPart?t("Closed on",{id:target.item}):say("Closed","닫힌 의견");listBlock(p,`${closedLabel} (${count(closed.length)})`,closed,(row,c)=>put(row,entryLink("comment",c.id,c.id),node("small",commentState({...c,state:"closed"}),"meta")));
    if(!mark.comments.length)p.append(node("p",t("No comments",{id:item.id||item.text})));
    }
    const legacyScope="comment:"+place+":"+(item.id||item.text);
    writeForm(p,{scope:transfer?.scope||(ownedPart?"comment-part:"+place+":"+itemIdentity(item):legacyScope),recoverScope:!transfer&&ownedPart?legacyScope:null,recoverId:target.item,fieldLabel:t("Comment on",{id:item.id||item.text}),label:say("Send","보내기"),endpoint:base+"/comments",makeBody:draft=>({... (transfer?transfer.target:{part,stage,...target,commit:drawn.commit}),text:draft.text}),onSuccess:transfer?()=>{const source=drafts.read(transfer.sourceScope);if(source.write===transfer.source.write&&source.text===transfer.source.text)drafts.clear(transfer.sourceScope,transfer.source.write);commentTransfers.delete(transfer.scope);if(commentTransfer===transfer&&!foreign)commentTransfer=null;}:undefined});
  }
  function renderThread(c,{focus=true}={}){
    panelVersion++;const gone={kind:"comment",target:"comment:"+c.id,reply:c,codes:["comment_not_found","project_not_found","space_not_found"]};
    const p=focus?panelFrame((c.item||c.quote||c.id)+" · "+commentState(c)):panel;if(c.text!==undefined)p.append(node("p",c.text));p.append(node("p",commentState(c),"muted"));
    if(c.author!==undefined)put(p,node("small",(c.author==="agent"?say("Agent","에이전트"):say("User","사용자"))+" · "+date(c.made_at),"meta"));if(c.item)p.append(entryLink("item",c.item,c.item));if(c.quote)p.append(node("blockquote",c.quote));
    const loaded=Array.isArray(c.replies);
    const shownReplies=loaded?c.replies:c.last_reply?[c.last_reply]:[];if(!replyBaselines.has(c.id))replyBaselines.set(c.id,Math.max(0,...shownReplies.map(r=>r.seq)));
    if(!loaded)p.append(node("div",t("Loading the replies"),"skeleton"));
    else if(!c.replies.length)p.append(node("p",t("No replies")));
    for(const reply of shownReplies){const row=node("article",null,"entry");put(row,node("p",reply.text),node("small",(reply.author==="agent"?say("Agent","에이전트"):say("User","사용자"))+" · "+date(reply.made_at)+(reply.settles?" · "+t("Settles it"):""),"meta"));if(reply.author==="agent"&&reply.seq>replyBaselines.get(c.id))row.append(node("span",say("New","새로 옴"),"badge"));p.append(row);}
    if(c.part!==undefined&&(c.part!==part||c.stage!==stage))p.append(safeLink(say("Picture view","그림 보기"),"/pictures/"+[project,c.part||"_",c.stage].map(encodeURIComponent).join("/")+"#comment="+encodeURIComponent(c.id)));
    for(const decision of Array.isArray(c.decisions)?c.decisions:[])put(p,safeLink(decision.text||decision.link,decision.link),node("small",date(decision.made_at),"meta"));
    if(c.proposals?.length)listBlock(p,say("Proposals","제안"),c.proposals,renderProposalRow);
    writeForm(p,{scope:"reply:"+c.id,label:c.state==="closed"?t("Open again"):say("Reply","답글 남기기"),settles:true,waiting:!loaded,endpoint:base+"/comments/"+encodeURIComponent(c.id)+"/replies",makeBody:d=>({text:d.text,settles:d.settles}),onReplyLimit:failed=>transferReply(c,failed),gone});
    if(c.state==="open")action(p,{scope:"answered:"+c.id,label:say("Answered","답이 나옴"),waiting:!loaded,endpoint:base+"/comments/"+encodeURIComponent(c.id)+"/answered",gone,done:value=>{if(value.changed===false)status.replaceChildren(notice(t("Already closed")));}});
  }
  function reflectionState(parent,edit){
    const key=edit.state==="pending"?"Reflection pending":edit.state==="in-review"?"Reflection in review":edit.state==="needs-user"?"Reflection needs user":edit.state==="dismissed"?"Reflection dismissed":edit.state==="closed"?(edit.pull_request?"Reflection by pull request":"Reflection already in source"):null;
    if(!key){parent.append(node("p",stateName(edit.state)));return;}
    const message=t(key,{commit:edit.closed_commit||""}),marker="{pull request}",at=message.indexOf(marker),line=node("p");
    if(at>=0&&edit.pull_request)put(line,node("span",message.slice(0,at)),safeLink(edit.pull_request,edit.pull_request),node("span",message.slice(at+marker.length)));
    else line.textContent=message.replace(marker,edit.pull_request||"");
    parent.append(line);
  }
  async function renderProposal(p){
    const version=++panelVersion,gone={kind:"proposal",target:"proposal:"+p.id,codes:["proposal_not_found","project_not_found"]};
    const frame=panelFrame(say("Proposal on ","제안: ")+p.items.join(", ")),headings=say("Change · Reason · Stage source text · Made on commit {commit} · Answers","변경 · 까닭 · 단계 원본의 글 · 커밋 {commit}에서 낸 제안 · 답하는 의견").split(" · ");
    for(const [i,value]of[p.change,p.reason,p.source_text].entries()){frame.append(node("h3",headings[i]));if(value===undefined)frame.append(node("div",t("Loading the source text"),"skeleton"));else frame.append(node(i===2?"pre":"p",value||""));}
    const sourceChars=p.source_text_chars??(p.source_text===undefined?null:characters(p.source_text||""));if(sourceChars!==null)frame.append(node("small",say(`${sourceChars} characters`,`${sourceChars}자`),"meta"));
    frame.append(node("p",headings[3].replace("{commit}",p.commit),"muted"));if(drawn&&p.commit!==drawn.commit)frame.append(notice(t("Earlier picture",{commit:p.commit}),"warn"));
    if(p.comment)frame.append(entryLink("comment",p.comment,p.comment));if(p.discrepancy){const d=entries(data.discrepancies).find(d=>d.id===p.discrepancy);if(d)frame.append(entryLink("item",d.item||d.term,d.item||d.term));}
    for(const id of p.items)frame.append(entryLink("item",id,id));
    if(p.state==="open"){action(frame,{scope:"accept:"+p.id,label:say("Accept","받기"),waiting:p.source_text===undefined,endpoint:base+"/proposals/"+encodeURIComponent(p.id)+"/accept",gone});action(frame,{scope:"dismiss-proposal:"+p.id,label:say("Dismiss","버리기"),waiting:p.source_text===undefined,endpoint:base+"/proposals/"+encodeURIComponent(p.id)+"/dismiss",gone});}
    else if(p.state==="accepted"){
      let edit=entries(data.reflections).find(e=>e.id===p.edit||e.proposal?.id===p.id);
      if(p.edit&&!edit)try{edit=await api.call("GET",base+"/edits/"+encodeURIComponent(p.edit));if(panelTarget!=="proposal:"+p.id||version!==panelVersion)return;}catch(error){if(panelTarget!=="proposal:"+p.id||version!==panelVersion)return;if(["edit_not_found","project_not_found"].includes(error.code)){await gonePanel({...gone,kind:"edit"},error);return;}frame.append(errorBox(error,()=>openFromHash()));}
      if(edit){reflectionState(frame,edit);if(edit.pull_request&&!["in-review","closed"].includes(edit.state))frame.append(safeLink(edit.pull_request,edit.pull_request));if(edit.closed_commit&&(edit.state!=="closed"||edit.pull_request))frame.append(node("p",edit.closed_commit,"meta"));if(edit.state==="needs-user")action(frame,{scope:"dismiss-edit:"+edit.id,label:say("Dismiss the reflection","반영 버리기"),endpoint:base+"/edits/"+encodeURIComponent(edit.id)+"/dismiss",gone:{...gone,kind:"edit",codes:["edit_not_found","project_not_found"]},done:v=>{if(!v.changed)status.replaceChildren(notice(t("Already dismissed")));}});}
      else frame.append(node("p",t("Accepted")));
    }else if(p.state==="dismissed"||p.state==="withdrawn"){frame.append(node("p",t(p.state==="dismissed"?"Proposal dismissed":"Proposal withdrawn",{date:date(p.closed_at)})));if(p.state==="dismissed"&&p.comment)frame.append(entryLink("comment",p.comment,say("Reply to say why","답글로 까닭 남기기")));}
  }
  async function openFromHash(){
    panelVersion++;
    const h=hash(),kind=["item","comment","proposal"].find(k=>h.has(k)),id=kind?h.get(kind):"",target=kind?kind+":"+id:localItem?"local:"+localItem.key:null;
    reads.invalidate("panel");if(target!==panelTarget&&kind==="comment")replyBaselines.delete(id);panelTarget=target;
    if(!target){panel.hidden=true;scrim.hidden=true;document.body.classList.remove("panel-open");previousFocus?.isConnected&&previousFocus.focus();return;}
    if(kind==="item"||localItem){renderItem(id,localItem);return;}
    panelFrame(say("Loading…","불러오는 중…")).append(node("div",kind==="comment"?t("Loading the replies"):t("Loading the source text"),"skeleton"));
    const closed=kind==="comment"?data.closed_comments?.entries?.find(c=>c.id===id):null;
    const cached=kind==="comment"?data?.comments?.entries?.find(c=>c.id===id)||(closed?{...closed,state:"closed"}:null):(data?.proposals||[]).find(p=>p.id===id)||entries(data.reflections).find(e=>e.proposal?.id===id)?.proposal;
    if(cached){if(kind==="comment")renderThread(cached);else renderProposal(cached);}
    try{await reads.run("panel",()=>api.call("GET",base+"/"+(kind==="comment"?"comments/":"proposals/")+encodeURIComponent(id)),value=>{if(kind==="comment")renderThread(value);else renderProposal(value);});}
    catch(error){if(panelTarget!==target)return;if((kind==="comment"?["comment_not_found","project_not_found"]:["proposal_not_found","project_not_found"]).includes(error.code)){await gonePanel({kind,target,reply:cached||{id}},error);return;}const context=t("Could not load").split(ko?" 또는: ":" Or: ")[kind==="comment"?0:1];panel.querySelectorAll(".skeleton").forEach(n=>n.remove());if(!cached){panel.querySelector("h2").textContent=context;if(kind==="comment"&&/^nc_[0-9a-hjkmnp-tv-z]{12}$/.test(id))writeForm(panel,{scope:"reply:"+id,label:say("Reply","답글 남기기"),waiting:true,endpoint:base+"/comments/"+encodeURIComponent(id)+"/replies",makeBody:d=>({text:d.text,settles:d.settles})});}panel.append(notice(context,"error"),errorBox(error,openFromHash));}
  }
  let lists;
  function renderLists(){
    if(!lists||!scene)return;lists.replaceChildren();const items=sceneItems(scene),marked=items.filter(n=>itemMarks(n,data).total),rest=items.filter(n=>!itemMarks(n,data).total);
    const section=node("section",null,"items"),heading=node("h2",say("Items as a list","항목 목록"));section.id="items";section.append(heading);
    for(const [label,group]of[[say("With marks","표시가 있는 것"),marked],[say("The rest","나머지"),rest]]){section.append(node("h3",`${label} (${count(group.length)})`));const ul=node("ul");for(const item of group){const li=node("li"),mark=itemMarks(item,data);li.append(button([item.id||item.owner||say("Part without an ID","ID 없는 부분"),item.text,mark.total?"("+count(mark.total)+")":""].filter(Boolean).join(" · "),()=>open("item",item.id,item)));ul.append(li);}section.append(ul);}
    lists.append(section);const ids=new Set(items.map(n=>n.id).filter(Boolean)),quotes=new Set(items.filter(n=>!n.id).map(n=>{const c=commentTarget(n);return JSON.stringify([c.item,c.quote]);})),apart=(data.comments?.entries||[]).filter(c=>!ids.has(c.item)&&!quotes.has(JSON.stringify([c.item,c.quote])));listBlock(lists,t("Apart",{n:apart.length}),apart,renderCommentRow);
    const legend=node("div",null,"legend");legend.setAttribute("aria-label",t("Legend"));for(const label of[say("Comments","의견"),say("Proposals","제안"),say("Discrepancies","어긋남"),t("Accepted"),t("Waits")])legend.append(node("span",label,"badge"));lists.append(legend);
  }
  async function renderPicture(){
    const generation=++drawGeneration;drawAbort?.abort();drawAbort=new AbortController();renderer?.destroy();renderer=null;body.replaceChildren();setMeta();
    if(!drawn){body.append(errorBox(new NexusProblem(payload.problem?.code||"picture_not_found",404,payload.problem||{}),refresh));return;}
    scene=pictureLayout(drawn.source,stage,hash().get("step"));lastStep=scene.step;
    if(drawn.not_current){const versions=t("Not current",{commit:drawn.commit}).split(ko?" 또는: ":" Or: "),index={size:0,"source-gone":1,"other-repository":2}[drawn.not_current]||0;body.append(notice(index===0?versions[0]:say(`This picture shows commit ${drawn.commit}: `,`이 그림은 커밋 ${drawn.commit}의 그림입니다. `)+versions[index],"warn"));}
    if(stage==="01-domain"){
      if(!drawn.source.timeline?.length)body.append(notice(t("No timeline")));
      else{const controls=node("nav",null,"controls"),labels=t("Steps").split(" · "),select=node("select");select.setAttribute("aria-label",labels[2]);for(const [i,key]of STEPS.entries()){const option=node("option",labels[i+3]);option.value=key;select.append(option);}select.value=STEPS[scene.step];function stepChange(index){const h=hash();h.set("step",STEPS[index]);history.pushState(null,"",location.pathname+location.search+"#"+h);renderPicture();openFromHash();}select.addEventListener("change",()=>stepChange(STEPS.indexOf(select.value)));const prev=button(labels[0],()=>stepChange(scene.step-1)),next=button(labels[1],()=>stepChange(scene.step+1));prev.disabled=scene.step===0;next.disabled=scene.step===8;put(controls,prev,select,next);body.append(controls);}
    }
    const tools=node("div",null,"controls");if(!scene.limited)put(tools,button(say("Zoom out","축소"),()=>renderer?.zoom(.8)),button(say("Zoom in","확대"),()=>renderer?.zoom(1.25)),button(say("Whole picture","그림 전체"),()=>renderer?.fit()));put(tools,safeLink(say("Items as a list","항목 목록"),"#items"),button(say("Refresh","새로 읽기"),refresh));body.append(tools);
    if(scene.limited){const warning=notice(pictureLimitMessage(scene,lang),"warn");warning.dataset.previewLimited="true";lists=node("div",null,"after-picture");lists.dataset.fallback="true";body.append(warning,lists);renderLists();return;}
    if(scene.nodes.length>300)body.append(notice(t("Large",{n:scene.nodes.length})));
    const loading=notice(say("The editor is loading. You can already read and move the picture.","편집기를 불러오는 중입니다. 그림은 바로 읽고 이동할 수 있습니다.")),target=node("div",null,"picture-shell");loading.classList.add("picture-loading");target.setAttribute("aria-label",say("Read-only picture","읽기 전용 그림"));body.append(target);lists=node("div",null,"after-picture");body.append(lists);renderLists();
    if(!scene.nodes.length){loading.remove();target.remove();return;}
    const preview=mountPreview(target,scene,{data,lang,onSelect:open});renderer=preview;target.dataset.previewReady="true";target.dataset.previewActive="true";target.dataset.editorReady="false";target.append(loading);
    try{const created=await drawPicture(target,scene,{stage,data,lang,signal:drawAbort.signal,initialView:()=>preview.view(),onSelect:open,onReady:()=>{if(generation===drawGeneration){preview.destroy();loading.remove();target.dataset.previewActive="false";target.dataset.ready="true";target.dataset.editorReady="true";}}});if(generation!==drawGeneration)created?.destroy();else if(created){renderer=created;renderer.update(data);}}
    catch{if(generation!==drawGeneration)return;loading.remove();const warning=notice(say("The editor could not load. The picture and item list remain available.","편집기를 불러오지 못했습니다. 그림과 항목 목록은 계속 사용할 수 있습니다."),"warn");target.after(warning);lists.dataset.fallback="true";}
  }
  function renderOverview(){
    body.replaceChildren();setMeta();if(!data)return;const wrap=node("div",null,"overview"),record=node("section",null,"card wide");put(record,node("h2",say("Recorded state","기록된 상태")),node("span",stateName(data.record?.state||"unknown"),"stage-state "+(data.record?.state||"unknown")));
    if(data.record){put(record,node("p",data.record.next),node("small",date(data.record.updated)+" · "+(data.record.from==="repository"?say("from the default branch","기본 브랜치의 기록"):say("from this device","이 기기의 기록")),"meta"));for(const cp of data.record.checkpoints||[])put(record,node("p",cp.words||cp.date),cp.where?safeLink(cp.where,cp.where):null);}
    if(!data.read)record.append(notice(t("Not read",{why:data.source_state})));
    for(const pic of data.pictures||[])record.append(safeLink(say("Picture view","그림 보기")+" · "+pic.stage,"/pictures/"+[project,part||"_",pic.stage].map(encodeURIComponent).join("/")));
    for(const warning of data.warnings||[])record.append(notice(t("Withdrawn, recorded"),"warn"));if(data.not_opened)record.append(notice(t("Not opened",{n:data.not_opened}),"warn"));wrap.append(record);
    if(data.discrepancies.total===0&&data.comments.total===0&&data.reflections.total===0)wrap.prepend(notice(t("Nothing left")));
    else{
      listBlock(wrap,say(`Discrepancies (${count(data.discrepancies.total)})`,`어긋남 (${count(data.discrepancies.total)})`),data.discrepancies.entries,(row,d)=>{const target=d.compares==="aggregate-table"?"05-erd":"07-sitemap",link="/pictures/"+[project,part||"_",target].map(encodeURIComponent).join("/")+"#item="+encodeURIComponent(d.item||d.term);put(row,safeLink([d.term,d.item].filter(Boolean).join(" · "),link),node("p",d.reasons.map(r=>r.kind).join(" · ")));if(d.waiting)row.append(node("p",t("Waits")));},data.discrepancies.total);
      listBlock(wrap,say(`Comments (${count(data.comments.total)})`,`의견 (${count(data.comments.total)})`),data.comments.entries,(row,c)=>row.append(safeLink(c.text,"/pictures/"+[project,c.part||"_",c.stage].map(encodeURIComponent).join("/")+"#comment="+encodeURIComponent(c.id))),data.comments.total);
      listBlock(wrap,say(`Pending reflections (${count(data.reflections.total)})`,`반영 대기 (${count(data.reflections.total)})`),data.reflections.entries,(row,e)=>put(row,safeLink(e.proposal?.reason||e.id,"/pictures/"+[project,e.part||"_",e.stage].map(encodeURIComponent).join("/")+"#proposal="+encodeURIComponent(e.proposal?.id||"")),node("small",stateName(e.state),"meta")),data.reflections.total);
    }
    const checkpoints=node("section",null,"card");checkpoints.append(node("h2",say("Checkpoints","확인 지점")));for(const cp of data.checkpoints){const item=node("article",null,"entry");put(item,node("p",cp.words),node("p",cp.state==="withdrawn"?t("Withdrawn",{date:date(cp.withdrawn_at)}):t("Waiting for its record",{date:date(cp.passed_at)})));if(cp.pull_request)item.append(safeLink(cp.pull_request,cp.pull_request));if(cp.state==="passed"&&!cp.recorded_commit)action(item,{scope:"withdraw-checkpoint:"+cp.id,label:say("Withdraw","철회"),endpoint:base+"/checkpoints/"+encodeURIComponent(cp.id)+"/withdraw",done:value=>status.replaceChildren(notice(value.changed?t("Withdrawn",{date:date(value.checkpoint.withdrawn_at)}):t("Already withdrawn")))});checkpoints.append(item);}
    checkpoints.append(node("h3",say("Pass the checkpoint","확인 지점 통과")));
    writeForm(checkpoints,{scope:"checkpoint:"+place,label:data.checkpoints.some(cp=>cp.state==="passed"&&!cp.recorded_commit)?t("Pass again"):say("Pass","통과"),fieldLabel:t("Overview's headings").split(" · ").at(-1),max:2000,optional:true,endpoint:base+"/checkpoints",makeBody:d=>({part,stage,...(d.text.trim()?{words:d.text}:{})})});wrap.append(checkpoints);
    listBlock(wrap,say("Checks","점검"),data.checks,(row,c)=>put(row,node("strong",c.rule),node("p",c.message||c.rule)),data.checks.length,t("No checks"));
    body.append(wrap);
  }
  scrim.addEventListener("click",closePanel);document.addEventListener("keydown",event=>{if(panel.hidden)return;if(event.key==="Escape"){event.preventDefault();closePanel();}if(event.key==="Tab"&&matchMedia("(max-width:1023px)").matches){const focusable=[...panel.querySelectorAll("button:not(:disabled),a[href],textarea,input,select")].filter(n=>!n.hidden),first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&[first,panel.querySelector("h2")].includes(document.activeElement)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
  window.addEventListener("hashchange",()=>{localItem=null;commentTransfer=null;if(payload.view==="picture"&&drawn&&stage==="01-domain"&&stepIndex(hash().get("step"),drawn.source)!==lastStep)renderPicture();openFromHash();});
  window.addEventListener("popstate",()=>{localItem=null;commentTransfer=null;openFromHash();});
  matchMedia("(max-width:1023px)").addEventListener("change",event=>{if(!panel.hidden)panel.setAttribute("aria-modal",String(event.matches));});
  if(payload.view==="picture")renderPicture();else renderOverview();openFromHash();
  return{refresh,close:()=>{drawGeneration++;drawAbort?.abort();renderer?.destroy();reads.invalidate("page");reads.invalidate("panel");}};
}
try{const source=document.getElementById("view-data");if(source)startView(JSON.parse(source.textContent));}catch{/* The localized static loading line is retained when bootstrap fails. */}
