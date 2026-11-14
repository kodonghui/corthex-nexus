// NEXUS: checked Access requests, contract ordering, and D1 transactions.
import {rememberHTML} from "./html-body.js";
import { Refused, readSnapshot } from "./snapshot.js";
import { readSnapshot02 } from "./snapshot02.js";
import { Store } from "./store.js";
import { preflight } from "./preflight.js";
import { jsonBody } from "./body.js";
import { clientKind } from "./client-kind.js";
import { COMMON_HEADERS, Problem, problemDocument, problemResponse } from "./problem.js";
import {words} from "../ui/messages.js";

export const MAX_PROJECTS = 30;
const PLACEHOLDER = "__CORTHEX_HUB_DATA__";
const INPUTS = Object.freeze({comment:"NewComment",reply:"NewReply",decision:"NewDecision",proposal:"NewProposal",
  "report-edit":"EditReport",checkpoint:"NewCheckpoint","report-checkpoint":"CheckpointReport"});
const lang = (env) => String(env.NEXUS_LANGUAGE || "").toLowerCase().startsWith("ko") ? "ko" : "en";
const escaped = (value) => String(value).replace(/[&<>"']/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const dataText = (value) => JSON.stringify(value).replace(/[<>&]/g,(ch)=>({"<":"\\u003c",">":"\\u003e","&":"\\u0026"}[ch]));
export const VIEW_POLICY = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export async function handle(request,env,ctx,template,views={},accessVerifier) {
  env ||= {};
  try {
    const route=await preflight(request,env,ctx,accessVerifier);
    if(!env.DB)throw new Problem("internal","no database is bound as DB");
    const store=new Store(env.DB),p=route.params,head=request.method==="HEAD";
    switch(route.operation) {
      case "pushSnapshot": {
        const {data,text}=await jsonBody(request,null,true);
        let sent;
        if(data?.schema==="corthex-hub/0.2")sent=readSnapshot02(data,Date.now());
        else {
          try {sent=readSnapshot(text,Date.now());}
          catch(error) {
            if(!(error instanceof Refused))throw error;
            const code=error.status===413?"snapshot_too_large":/dated in the future/.test(error.message)?"clock_ahead":"invalid_snapshot";
            throw new Problem(code,error.message,code==="invalid_snapshot"?{field:"body"}:{});
          }
        }
        return json(await store.push(sent));
      }
      case "listSnapshots": return json({projects:await store.list()},200,head);
      case "getSnapshot": {
        const body=await store.body(p.project);
        if(body==null)throw new Problem("project_not_found","no such project");
        return new Response(head?null:body,{headers:jsonHeaders()});
      }
      case "removeProject": {
        if(!await store.remove(p.project))throw new Problem("project_not_found","no such project");
        return json({name:p.project,removed:true});
      }
      case "getHeldCommit": return json(await store.heldCommit(p.project),200,head);
      case "getRemovalDryRun": return json(await store.removalDryRun(p.project),200,head);
      case "getProjectData": return json(await store.projectData(p.project),200,head);
      // The export (API-178) is a download, named by the project and the date of exported_at in UTC.
      case "exportProject": {
        const file=await store.exportProject(p.project);
        return new Response(head?null:JSON.stringify(file),{headers:{...jsonHeaders(),"Content-Disposition":`attachment; filename="nexus-${p.project}-${file.exported_at.slice(0,10)}.json"`}});
      }
      case "getPicture": return json(await store.readPicture(p.project,p.part,p.stage),200,head);
      case "getStageOverview": return json(await store.readOverview(p.project,p.part,p.stage),200,head);
      case "getStage": return json(await store.readStage(p.project,p.part,p.stage,route.query),200,head);
      case "getStageTalk": return json(await store.readTalk(p.project,p.part,p.stage,route.query),200,head);
      case "getItem": return json(await store.readItem(p.project,p.id,route.query.part),200,head);
      case "getHome": return json(await store.readHome(),200,head);
      case "searchItems": return json(await store.searchItems(route.query.q),200,head);
      // A read with the service token records itself (SPEC-187); a person's read and a HEAD do not.
      case "getAgentTodo": return json(await store.readTodo(p.project,route.session,{record:route.kind==="agent"&&!head}),200,head);
      case "getComment": return json(await store.readEntry(p.project,"comment",p.comment),200,head);
      case "getProposal": return json(await store.readEntry(p.project,"proposal",p.proposal),200,head);
      case "getEdit": return json(await store.readEntry(p.project,"edit",p.edit),200,head);
      case "getCheckpoint": return json(await store.readEntry(p.project,"checkpoint",p.checkpoint),200,head);
      case "claimEntry": return json(await store.claimEntry(p.project,p.entry,route.session));
      case "releaseEntry": return json(await store.claimEntry(p.project,p.entry,route.session,true));
      case "getHomePage": {
        // The first page (API-155, SCR-110), with the answer of API-151 as it is now.
        return page(views,{schema:"corthex-home-page/0.3",generated_at:new Date().toISOString(),lang:lang(env),data:await store.readHome()},head);
      }
      case "getProjectPage": {
        // A project leads to its current stage (API-153, SPEC-146); browsers keep no 302,
        // and keep what follows # in the address that the user opened.
        const {part,stage}=await store.projectPlace(p.project);
        return redirect(`/p/${p.project}/${part||"_"}/${stage}`);
      }
      case "getStagePage": {
        // One part's stage (API-154, SCR-111 to SCR-115): API-158, API-152 and, on a
        // pictured stage, API-111 in the page's data, and why the page lacks any of them.
        const {data,talk,picture,problem:missing}=await store.readStagePage(p.project,p.part,p.stage);
        let problem=null;
        if(missing){problem=problemDocument(request,missing);console.error("nexus",{kind:problem.code,traceId:problem.traceId});}
        return page(views,{schema:"corthex-stage-page/0.3",generated_at:new Date().toISOString(),lang:lang(env),data,talk,picture,problem},head);
      }
      case "getHubPage": {
        const [bodies,spaces]=await Promise.all([store.bodies(),store.readSpaces()]);
        const data={schema:"corthex-hub-page/0.2",generated_at:new Date().toISOString(),lang:lang(env),origin:"server",projects:bodies.map(JSON.parse),spaces,missing:[]};
        return html(render(template,JSON.stringify(data)).replace('<html lang="en">',`<html lang="${data.lang}">`),await pagePolicy(template),head);
      }
      case "getViewCode": {
        const file=views.code?.[p.file];
        if(!file)throw new Problem("not_found","no such file of the view's code");
        return new Response(head?null:file.body,{headers:{...COMMON_HEADERS,"Content-Type":file.type,"Cache-Control":"public, max-age=31536000, immutable","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'"}});
      }
      case "getPictureViewPage":
      case "getStageOverviewPage": {
        // 0.2's picture view and stage overview lead to the stage's page (API-102, API-103,
        // SPEC-154), which answers an unknown project or part with its 404. The picture view's
        // 302 has no #, so the browser keeps what follows # in the address that the user opened
        // (RFC 9110, section 10.2.2), and the stage's page reads 0.2's item=, step=, comment= and
        // proposal=; the overview's opens the list. Browsers keep no 302.
        const place=`/p/${p.project}/${p.part||"_"}/${p.stage}`;
        return redirect(route.operation==="getPictureViewPage"?place:place+"#view=list");
      }
      default: {
        if(!route.writeName)throw new Error("unhandled operation");
        const body=INPUTS[route.writeName]?(await jsonBody(request,INPUTS[route.writeName])).data:{};
        const id=p.comment||p.proposal||p.edit||p.checkpoint||null;
        // A pass records the kind of browser and device that its request names, as
        // words of a fixed vocabulary and never the request's text (SPEC-195).
        const client=route.writeName==="checkpoint"||route.writeName==="recommended"?clientKind(request.headers):undefined;
        const result=await store.writeEntry(route.writeName,p.project,id,body,{kind:route.kind,session:route.session,write:route.write,language:lang(env),client});
        return json(result.body,result.status);
      }
    }
  } catch(error) {
    const path=new URL(request.url).pathname;
    if((path==="/"||path==="/hub"||/^\/(?:pictures|overview|p)\//.test(path)) && /(?:^|[,;\s])text\/html(?:[,;\s]|$)/i.test(request.headers.get("Accept")||""))return refusalPage(request,env,error,views,path);
    return problemResponse(request,error);
  }
}

// The way out of a page's message (stage 08's rule 9): Load again, and on the
// redesign's pages all projects, the first page; on 0.2's views the hub page.
// The first page's own message has only Load again (SCR-110#error).
function refusalLinks(path,ko) {
  const again=`<a class="control" href="">${ko?"다시 불러오기":"Load again"}</a>`;
  if(path==="/")return again;
  if(path==="/hub"||path.startsWith("/p/"))return again+`<a class="control" href="/">${escaped(words("All projects",ko?"ko":"en"))}</a>`;
  return again+`<a class="control" href="/hub">${ko?"허브로":"Hub"}</a>`;
}

function refusalPage(request,env,error,views,path) {
  const p=problemDocument(request,error),ko=lang(env)==="ko";
  console.error("nexus",{kind:p.code,traceId:p.traceId});
  const language=ko?"ko":"en",message=words(p.code,language);
  // The factory validates this already compiled, frozen stylesheet. A refusal
  // must stay readable even when no browser code or stylesheet can be loaded.
  const css=views.refusalCSS||"";
  const body=`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NEXUS</title>${css?`<style>${css}\n.refusal h1{word-break:keep-all;overflow-wrap:break-word}</style>`:""}</head><body><main class="content refusal"><h1>${escaped(message)}</h1><p class="meta">${escaped(words("Trace ID",language,{traceId:p.traceId}))}</p><p class="controls">${refusalLinks(path,ko)}</p></main></body></html>`;
  return new Response(request.method==="HEAD"?null:body,{status:p.status,headers:{...COMMON_HEADERS,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",...(error instanceof Problem?error.headers:{})}});
}

export function render(template,data) {
  const at=template.indexOf(PLACEHOLDER);
  if(at<0||template.indexOf(PLACEHOLDER,at+1)>=0)throw new Error("the hub template must hold its placeholder once");
  const payload=data.replace(/</g,"\\u003c").replace(/>/g,"\\u003e").replace(/&/g,"\\u0026");
  return template.slice(0,at)+payload+template.slice(at+PLACEHOLDER.length);
}
export function renderView(template,data) {
  const marker="__CORTHEX_VIEW_DATA__",at=template.indexOf(marker);
  if(at<0 || template.indexOf(marker,at+1)>=0)throw new Error("the view template must hold its placeholder once");
  // A replacement string interprets $', $` and $$ even after HTML escaping.
  // A callback inserts the exact JSON characters without template expansion.
  return template.replace(marker,()=>dataText(data));
}
const policies=new Map();
export async function pagePolicy(template) {
  if(!policies.has(template)) {
    const start=template.lastIndexOf("<script>")+"<script>".length;
    const script=template.slice(start,template.indexOf("</script>",start));
    const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(script)));
    policies.set(template,`default-src 'none'; script-src 'sha256-${btoa(String.fromCharCode(...digest))}'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
  }
  return policies.get(template);
}
// The redesign's pages: drawn by the views from their data, or, for a server
// without the view's build, an empty page that holds the data alone.
function page(views,payload,head) {
  const template=typeof views.page==="function"?views.page(payload):`<!doctype html><html lang="${payload.lang}"><head><meta charset="utf-8"><title>NEXUS</title></head><body><script id="view-data" type="application/json">__CORTHEX_VIEW_DATA__</script></body></html>`;
  return html(renderView(template,payload),VIEW_POLICY,head);
}
function redirect(location) {return new Response(null,{status:302,headers:{...COMMON_HEADERS,Location:location,"Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'"}});}
function html(body,policy,head=false) {return rememberHTML(new Response(head?null:body,{headers:{...COMMON_HEADERS,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":policy,"Cross-Origin-Opener-Policy":"same-origin"}}),body);}
function jsonHeaders() {return {...COMMON_HEADERS,"Content-Type":"application/json; charset=utf-8","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'"};}
function json(data,status=200,head=false) {return new Response(head?null:JSON.stringify(data),{status,headers:jsonHeaders()});}
