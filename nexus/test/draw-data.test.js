// TASK-312: the project's data (SCR-130, SPEC-201 to SPEC-203) as the stage page's code draws it
// over the stage: its nine states, read as text. The answers behind it are api-project-data's
// (API-177, API-178, API-108); the browser suite data.mjs runs the panel on a page, with the
// export, the removal and the first page's bar after it (SCR-110#removed).
import test from "node:test";
import assert from "node:assert/strict";
import {esc,clock} from "../src/draw/html.js";
import {label,labels,codeMessage} from "../src/draw/words.js";
import {drawData,KINDS,OPEN_LISTS} from "../src/draw/data.js";
import {drawParts,PAGE_SCHEMAS} from "../src/draw/page.js";
import {wholeExport,exportName,fragment} from "../ui/data.js";

const AT="2026-11-20T09:00:00.000Z";
const id=(prefix,n)=>prefix+String(n).padStart(12,"0").replace(/[ilou]/g,"0");
// An answer of API-177: a project with a space, read by a session, with what a removal deletes.
function answer(over={}){
  const open=(prefix,total,shown=Math.min(total,20))=>({total,ids:Array.from({length:shown},(_,n)=>id(prefix,n+1))});
  return{project:"acme",title:"Acme",repository:"https://github.com/example/acme",commit:"abc1234"+"0".repeat(33),revision:3,generated_at:"2026-11-20T07:50:00+09:00",pushed_at:"2026-11-20T08:30:00.000Z",
    space:true,read_at:"2026-11-20T08:35:00.000Z",read_session:"claude-code-4f2a91",unread_since:null,
    removal:{project:"acme",deletes:{snapshot:true,space:true,pictures:3,discrepancies:21,comments:23,replies:40,decisions:6,proposals:5,edits:3,checkpoints:4},
      open:{comments:open("nc_",25),proposals:open("np_",1),reflections:open("ne_",0),checkpoints:open("nk_",1)}},...over};
}
const state=(over={})=>({open:true,project:"acme",answer:answer(),at:AT,reading:false,note:null,gone:null,exporting:false,file:null,exportNote:null,confirm:false,stale:false,ready:false,removing:false,removeNote:null,...over});
const between=(html,from,to)=>{const start=html.indexOf(from);assert.ok(start>=0,from);return html.slice(start,html.indexOf(to,start)+to.length);};
const button=(html,act)=>html.match(new RegExp(`<button[^>]*data-nx-act="${act}"[^>]*>`))?.[0]||"";
const off=element=>/ aria-disabled="true"/.test(element);

test("the panel is the code's: the server draws it closed, and it opens as a dialog with its head (SCR-130)",()=>{
  assert.equal(drawData(undefined,"en"),"");assert.equal(drawData({open:false},"en"),"");
  for(const lang of["en","ko"]){
    const html=drawData(state(),lang),words=labels("The project's data",lang);
    assert.ok(html.startsWith('<section class="dp" role="dialog" aria-modal="true" aria-labelledby="dp-h" data-nx-key="dp" data-nx-sub><span class="handle only-ph" data-nx-key="hd" aria-hidden="true"></span>'),"a dialog named by its heading, with the sheet's handle under 1,024 pixels");
    assert.ok(html.includes(`<h2 id="dp-h" tabindex="-1" data-nx-focus="dp-h">${esc(words[0])}</h2><span class="mu sm clip">acme</span>`),"Project data with the project's name");
    assert.ok(html.includes(`data-nx-act="data-close" data-nx-focus="data-close"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-close"/></svg><span class="sr">${esc(labels("Top bar",lang)[5])}</span></button>`),"Close, named for screen readers");
    // Every state keeps the dialog's own attributes, so that the code compares its inside and the
    // focus and the typed name stay (../ui/reconcile.js).
    for(const other of[state({answer:null,reading:true}),state({confirm:true}),state({gone:"read"})])assert.ok(drawData(other,lang).startsWith('<section class="dp" role="dialog" aria-modal="true" aria-labelledby="dp-h" data-nx-key="dp" data-nx-sub>'));
  }
});

test("SCR-130#loading: grey lines in the layout of the data, words for screen readers, and the acts off (TC-1723)",()=>{
  for(const lang of["en","ko"]){
    const html=drawData(state({answer:null,reading:true}),lang);
    assert.ok(html.includes('<div class="dsk" aria-hidden="true" data-nx-key="sk">'),"the grey lines, unseen by screen readers");
    assert.equal(html.match(/class="dcnt"/g).length,6,"a grey row for each of the six kinds");
    assert.ok(html.includes(`<p class="sr" role="status" data-nx-key="ld">${esc(labels("The project's data",lang)[13])}</p>`));
    assert.ok(off(button(html,"data-export"))&&off(button(html,"data-remove")),"Export and Remove this project show disabled");
    assert.ok(!html.includes("<time"),"no time before the data");
    assert.doesNotMatch(html,/\sstyle=/,"the grey lines' widths are the stylesheet's");
  }
});

test("SCR-130#normal: the two times with the commit and the session's label, the counts, and the two acts (TC-1724)",()=>{
  for(const lang of["en","ko"]){
    const words=labels("The project's data",lang),html=drawData(state(),lang);
    const push=between(html,'<div class="drow" data-nx-key="push">','</span></span></div>');
    assert.ok(push.includes(`<span class="dk">${esc(words[1])}</span>`)&&push.includes(`<time datetime="2026-11-20T08:30:00.000Z">${clock("2026-11-20T08:30:00.000Z")}</time> (<span data-nx-ago="2026-11-20T08:30:00.000Z">${esc(label("How long ago",1,lang,{n:30}))}</span>)`),"Last push, as a date and time with how long ago (rule 19)");
    assert.ok(push.includes(`<span class="dv2"><span class="sep" aria-hidden="true"> · </span>${esc(label("The head",2,lang,{commit:"@"})).replace("@",'<span class="mono">abc1234</span>')}</span>`),"the commit's first 7 characters");
    const read=between(html,'<div class="drow" data-nx-key="read">','</div>');
    assert.ok(read.includes(`<span class="dk">${esc(words[2])}</span>`)&&read.includes('<time datetime="2026-11-20T08:35:00.000Z">'),"Last read by the agent, with its time");
    assert.ok(read.includes(esc(label("The project's data",3,lang,{label:"claude-code-4f2a91"}))),"the session's label of the last read, which only this screen shows (SPEC-188)");
    assert.ok(drawData(state({answer:answer({read_session:null})}),lang).includes(`<span class="dv2"><span class="sep" aria-hidden="true"> · </span>${esc(words[4])}</span>`),"a read that named no session");
    assert.ok(drawData(state({answer:answer({read_at:null,read_session:null})}),lang).includes(`<span class="dv"><span>${esc(words[5])}</span></span>`),"Not read yet, in the time's place");
    assert.ok(drawData(state({answer:answer({commit:null})}),lang).includes(`<span class="sep" aria-hidden="true"> · </span>${esc(label("The last push",1,lang))}</span>`),"No commit");
    // The counts, a row for each kind, and their heading.
    assert.ok(html.includes(`<h3 data-nx-key="ch">${esc(words[6])}</h3>`));
    const rows=[...between(html,'<div class="dcnts" data-nx-key="cnts">','</div></div>').matchAll(/<div class="dcnt"><span>([^<]*)<\/span><b>([^<]*)<\/b><\/div>/g)].map(([,name,n])=>[name,n]);
    assert.deepEqual(rows,KINDS.map(([key,index])=>[esc(words[index]),String(answer().removal.deletes[key])]),"comments, replies, recorded decisions, proposals, reflections and checkpoints, as the dry run counts them");
    assert.ok(drawData(state({answer:answer({removal:{...answer().removal,deletes:{...answer().removal.deletes,replies:1000}}})}),lang).includes("<b>999+</b>"),"a count over 999 (rule 12)");
    // The two acts, each with its line, and no mark while nothing waits long.
    const exportButton=button(html,"data-export"),removeButton=button(html,"data-remove");
    assert.ok(!off(exportButton)&&!off(removeButton),"both acts work");
    assert.ok(html.includes(`<div class="dact" data-nx-key="ax"><span class="dl">${esc(labels("The export",lang)[1])}</span>`)&&html.includes(`<div class="dact" data-nx-key="ar"><span class="dl">${esc(labels("The removal",lang)[1])}</span>`));
    assert.ok(removeButton.includes('class="btn sm danger"'),"the removal is drawn as a danger");
    assert.ok(!html.includes('class="m24w"'),"no mark while nothing has waited long");
  }
});

test("the mark of a long wait under the last read, drawn as of the answer's arrival and worked out again by the code (rule 20)",()=>{
  for(const lang of["en","ko"]){
    const late=drawData(state({answer:answer({unread_since:"2026-11-19T08:00:00.000Z"})}),lang),[mark]=labels("The mark of a long wait",lang);
    assert.ok(late.includes(`<div class="dmark" data-nx-key="mark"><div class="m24w" data-nx-since="2026-11-19T08:00:00.000Z"><span class="m24">`)&&late.includes(esc(mark)),"more than 24 hours: the mark with its line");
    assert.ok(drawData(state({answer:answer({unread_since:"2026-11-20T08:00:00.000Z"})}),lang).includes('<div class="m24w" data-nx-since="2026-11-20T08:00:00.000Z" hidden>'),"an hour: drawn hidden, for the code to show later");
  }
});

test("SCR-130#empty: a project without a space has no agent to-do yet, every count 0, and both acts (TC-1725)",()=>{
  const empty=answer({space:false,read_at:null,read_session:null,unread_since:"2026-11-19T08:00:00.000Z",removal:{project:"acme",deletes:{snapshot:true,space:false,pictures:2,discrepancies:0,comments:0,replies:0,decisions:0,proposals:0,edits:0,checkpoints:0},open:{comments:{total:0,ids:[]},proposals:{total:0,ids:[]},reflections:{total:0,ids:[]},checkpoints:{total:0,ids:[]}}}});
  for(const lang of["en","ko"]){
    const html=drawData(state({answer:empty}),lang);
    assert.ok(html.includes(`<span class="dv"><span>${esc(label("The agent's last read",2,lang))}</span></span>`),"No agent to-do yet, in the last read's place");
    assert.deepEqual([...html.matchAll(/<b>(\d+)<\/b>/g)].map(([,n])=>n),["0","0","0","0","0","0"]);
    assert.ok(html.includes(`<p data-nx-key="nosp">${esc(label("No space",0,lang))}</p>`),"why nothing here is missing from Git");
    assert.ok(!html.includes("m24w"),"no space, no agent to-do and no mark");
    assert.ok(!off(button(html,"data-export"))&&!off(button(html,"data-remove")),"Export still gives a file, and the removal deletes the snapshot");
  }
});

test("the export: Preparing the file… in the button's own width, then the file that the browser has (SPEC-201)",()=>{
  for(const lang of["en","ko"]){
    const words=labels("The export",lang),busy=button(drawData(state({exporting:true}),lang),"data-export");
    assert.ok(off(busy),"disabled while it runs, and still focusable");
    const html=drawData(state({exporting:true}),lang);
    assert.ok(html.includes(`<span class="keep"><span class="was" aria-hidden="true">${esc(words[0])}</span><span>${esc(words[2])}</span></span>`),"its own words keep their room (BUG-606)");
    const done=drawData(state({file:"nexus-acme-2026-11-20.json"}),lang);
    assert.ok(done.includes(`<p class="res" role="status" data-nx-key="file">`)&&done.includes(esc(words[3]).replace("{file}",'<span class="mono">nexus-acme-2026-11-20.json</span>')),"Your browser has the file {file}.");
    assert.ok(done.indexOf('data-nx-key="file"')<done.indexOf('data-nx-key="ax"'),"above the acts");
    assert.ok(drawData(state({file:'<img src=x onerror=alert(1)>.json'}),lang).includes("&lt;img src=x onerror=alert(1)&gt;.json"),"a file name is text (rule 1)");
  }
});

test("SCR-130#error, #permission and #gone: each message where its request was made, with what can be done (TC-1729 to TC-1731)",()=>{
  for(const lang of["en","ko"]){
    // Reading the data, before any answer: the message with its trace ID and Try again, the acts off.
    const first=drawData(state({answer:null,note:{tone:"err",text:codeMessage("internal",lang),trace:"8f6c3b2a1d0e9fa1-ICN",retry:"data-read"}}),lang);
    assert.ok(first.includes(`<span class="t">${esc(codeMessage("internal",lang))}</span><span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:"8f6c3b2a1d0e9fa1-ICN"}))}</span>`)&&first.includes('data-nx-act="data-read" data-nx-focus="read:retry"'),"Try again reads again");
    assert.ok(off(button(first,"data-export"))&&off(button(first,"data-remove"))&&!first.includes("dsk"));
    // The export: "No file was made." with the code's message, above the acts that stay.
    const failed=drawData(state({exportNote:{tone:"err",text:`${label("The export failed",0,lang)} ${codeMessage("internal",lang)}`,retry:"data-export"}}),lang);
    assert.ok(failed.includes(`<div data-nx-key="xnote"><div class="msg err" role="alert">`)&&failed.includes(esc(label("The export failed",0,lang))),"No file was made.");
    assert.ok(failed.indexOf('data-nx-key="xnote"')<failed.indexOf('data-nx-key="ax"')&&failed.includes('<b>23</b>'),"the data stays");
    // A refusal of who asked: its message with a lock, and nothing to try again.
    const refused=drawData(state({exportNote:{tone:"err",icon:"i-lock",text:codeMessage("user_only",lang)}}),lang);
    assert.ok(refused.includes('<use href="#i-lock"/>')&&refused.includes(esc(codeMessage("user_only",lang)))&&!refused.includes(":retry"));
    // cross_site: a link to the page at the server's own address.
    assert.ok(drawData(state({exportNote:{tone:"err",text:codeMessage("cross_site",lang),here:"https://nexus.example.com/p/acme/_/02-prd#data"}}),lang).includes(`<a class="lnk" href="https://nexus.example.com/p/acme/&#95;/02-prd#data">${esc(labels("Page buttons",lang)[3])}</a>`));
    // A sign-in that expired: Sign in again (rule 7).
    assert.ok(drawData(state({note:{tone:"warn",text:codeMessage("Sign-in expired",lang),signIn:true}}),lang).includes('data-nx-act="sign-in" data-nx-focus="read:sign-in"'));
    // Gone: the project's message, what the act that found it cannot do, a link to all projects, and the acts off.
    for(const [act,why]of[["read",""],["export",` ${label("The export failed",1,lang)}`],["remove",` ${label("Nothing to remove",0,lang)}`]]){
      const html=drawData(state({gone:act,confirm:act==="remove"}),lang);
      assert.ok(html.includes(`<span class="t">${esc(codeMessage("project_not_found",lang)+why)}</span>`),act);
      assert.ok(html.includes(`<a class="lnk" href="/" data-nx-focus="gone:home">${esc(labels("Top bar",lang)[1])}</a>`),"a link to all projects");
      assert.ok(off(button(html,"data-export"))&&off(button(html,"data-remove"))&&!html.includes("<time")&&!html.includes('class="rmft"'),"nothing else, and the confirmation is gone");
    }
  }
});

test("SCR-130#removal: what the removal deletes, by ID up to 20 of each, Export first, and the field (TC-1726)",()=>{
  for(const lang of["en","ko"]){
    const words=labels("The removal's confirmation",lang),kinds=labels("The project's data",lang),html=drawData(state({confirm:true}),lang);
    assert.ok(html.includes(`<h3 class="rmh" id="rm-h" tabindex="-1" data-nx-focus="rm-h" data-nx-key="rmh">${esc(words[0]).replace("{project}",'<span class="pn">acme</span>')}</h3>`),"the heading names the project");
    assert.ok(!html.includes('data-nx-key="push"')&&!html.includes('data-nx-key="ax"'),"in the data's place");
    assert.ok(html.includes(`<p class="b" data-nx-key="del">${esc(words[1])}</p>`));
    assert.ok(html.includes(`<li>${esc(label("The removal's confirmation",2,lang,{n:"3",m:"21"}))}</li>`),"the snapshot with its pictures and discrepancies");
    assert.ok(html.includes(`<li>${esc(words[3])}<span class="mu sm rmc">${KINDS.map(([key,index])=>`${esc(kinds[index])} ${answer().removal.deletes[key]}`).join(" · ")}</span></li>`),"the space with the counts of what Git does not hold");
    const groups=[...between(html,'<div class="idgs" data-nx-key="idgs">','</p></div></div>').matchAll(/<h4>([^<]*) <span class="mu">(\d+)<\/span><\/h4><p class="idl">(.*?)<\/p>/g)];
    assert.deepEqual(groups.map(([,name,total])=>[name,total]),[[esc(words[4]),"25"],[esc(words[5]),"1"],[esc(words[7]),"1"]],"the open lists by kind, without one that holds none");
    assert.equal(groups[0][3].match(/class="mono"/g).length,20,"up to 20 IDs");
    assert.ok(groups[0][3].endsWith(` <span class="mu">${esc(label("The list",9,lang,{n:"20",total:"25"}))}</span>`),"{n} of {total} where more are open (rule 12)");
    assert.ok(!groups[1][3].includes('class="mu"'),"all shown, no count of them");
    assert.ok(html.includes(`data-nx-act="data-export" data-nx-focus="data-export-first">${esc(words[8])}</button>`),"Export first");
    assert.ok(html.includes(`<p class="mu sm" data-nx-key="back">${esc(words[9])}</p>`),"how a removed project comes back");
    assert.equal(OPEN_LISTS.length,4);
    // The foot: the field with its label, and Cancel left of the removal, off until the name is typed.
    const foot=between(html,'<div class="rmft" data-nx-key="rmft" data-nx-sub>','</section>');
    assert.ok(foot.includes(`<label class="lab" for="dp-name" data-nx-key="lab">${esc(words[10]).replace("{project}",'<span class="pn">acme</span>')}</label>`));
    assert.ok(foot.includes('<input id="dp-name" name="confirm" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" maxlength="200" data-nx-focus="data-name">'),"no capitals, corrections or suggestions (SCR-130's Input)");
    assert.ok(foot.indexOf('data-nx-act="data-cancel"')<foot.indexOf('data-nx-act="data-confirm"'),"Cancel first");
    const go=between(foot,'data-nx-act="data-confirm"','</button>');
    assert.ok(off(button(foot,"data-confirm"))&&go.includes(`<span class="sr">${esc(words[11])}</span>`),"off, saying why to screen readers");
    // A project without a space: the snapshot only.
    const bare=drawData(state({confirm:true,answer:answer({space:false,read_at:null,read_session:null,removal:{project:"acme",deletes:{...answer().removal.deletes,space:false,comments:0,replies:0,decisions:0,proposals:0,edits:0,checkpoints:0},open:{comments:{total:0,ids:[]},proposals:{total:0,ids:[]},reflections:{total:0,ids:[]},checkpoints:{total:0,ids:[]}}}})}),lang);
    assert.equal(between(bare,'<ul class="rml" data-nx-key="rml">','</ul>').match(/<li>/g).length,1,"the snapshot only");
    assert.ok(!bare.includes("idgs"));
  }
});

test("SCR-130#removal-ready and #stale: the removal works once the name is typed, says Removing… and keeps the field (TC-1727, TC-1728)",()=>{
  for(const lang of["en","ko"]){
    const words=labels("The removal's confirmation",lang),field=html=>between(html,'<label class="field rmf" data-nx-key="fld">','</label>');
    const typed=drawData(state({confirm:true,ready:true}),lang),go=button(typed,"data-confirm");
    assert.ok(!off(go)&&!between(typed,'data-nx-act="data-confirm"','</button>').includes('class="sr"'),"the name matches: it works");
    assert.ok(off(button(drawData(state({confirm:true,ready:true,reading:true}),lang),"data-confirm")),"off while the panel reads again, so that the user confirms what it then shows");
    const removing=drawData(state({confirm:true,ready:true,removing:true}),lang);
    assert.ok(off(button(removing,"data-confirm"))&&off(button(removing,"data-cancel"))&&removing.includes(`<span>${esc(words[13])}</span></span>`),"Removing…, with Cancel off");
    assert.ok(off(button(removing,"data-export")),"and Export first");
    const stale=drawData(state({confirm:true,stale:true}),lang);
    assert.ok(stale.includes(`<div data-nx-key="stale"><div class="msg warn" role="status"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-reload"/></svg><div><span class="t">${esc(label("The removal changed",0,lang))}</span>`),"what changed, above the lists");
    assert.ok(stale.indexOf('data-nx-key="stale"')<stale.indexOf('data-nx-key="del"'));
    const failed=drawData(state({confirm:true,ready:true,removeNote:{tone:"err",text:codeMessage("internal",lang),trace:"8f6c3b2a1d0e9fa1-ICN",retry:"data-confirm"}}),lang);
    assert.ok(between(failed,'<div class="rnote" data-nx-key="rnote">','</div></div></div>').includes('data-nx-act="data-confirm" data-nx-focus="remove:retry"'),"the removal's failure above the buttons, with Try again");
    // The field's markup is the same in every state, so that the code keeps the element and what
    // the user typed in it (../ui/reconcile.js).
    const fields=new Set([state({confirm:true}),state({confirm:true,ready:true}),state({confirm:true,ready:true,removing:true}),state({confirm:true,stale:true}),state({confirm:true,removeNote:{tone:"err",text:"x"}})].map(other=>field(drawData(other,lang))));
    assert.equal(fields.size,1);
    // A read again that failed while the confirmation is open shows there, over what it lists.
    const unread=drawData(state({confirm:true,note:{tone:"err",text:codeMessage("No connection",lang),retry:"data-read"}}),lang);
    assert.ok(unread.includes('data-nx-act="data-read" data-nx-focus="read:retry"')&&unread.indexOf('data-nx-key="note"')<unread.indexOf('data-nx-key="del"'));
  }
});

test("the page's code saves only a whole export under its own name, and writes data bare in the address (SPEC-201, stage 07)",()=>{
  const file={format:1,project:"acme",commit:null,exported_at:"2026-11-14T01:02:03.000Z",read_at:null,space:true,
    counts:{comments:2,replies:3,decisions:1,proposals:1,edits:0,checkpoints:1},
    comments:[{id:"nc_1",replies:[{},{}],decisions:[{}]},{id:"nc_2",replies:[{}],decisions:[]}],proposals:[{}],edits:[],checkpoints:[{}]};
  assert.equal(wholeExport(file,"acme"),true);
  for(const other of[{...file,project:"other"},{...file,format:2},{...file,counts:{...file.counts,replies:2}},{...file,counts:{...file.counts,comments:3}},{...file,edits:undefined},{...file,comments:[{id:"nc_1"}]},null,[file]])
    assert.equal(wholeExport(other,"acme"),false,"a file cut on its way, or another project's, is not saved");
  const disposition='attachment; filename="nexus-acme-2026-11-14.json"';
  assert.equal(exportName(disposition,file,"acme"),"nexus-acme-2026-11-14.json");
  for(const other of['attachment; filename="nexus-acme-2026-11-13.json"','attachment; filename="../nexus-acme-2026-11-14.json"','inline; filename="nexus-acme-2026-11-14.json"',"",null])
    assert.equal(exportName(other,file,"acme"),null);
  assert.equal(exportName(disposition,file,"acm"),null);
  const keys=value=>new URLSearchParams(value);
  assert.equal(fragment(keys("item=REQ-107&data=")),"item=REQ-107&data");
  assert.equal(fragment(keys("data=")),"data");
  assert.equal(fragment(keys("data=&talk=nc_000000000001")),"data&talk=nc_000000000001");
  assert.equal(fragment(keys("q=data%3D&item=REQ-107")),"q=data%3D&item=REQ-107","words that hold data= stay as they are");
});

test("the panel's text is text, and the stage page's parts hold it only when the code opens it (rule 1)",()=>{
  const html=drawData(state({project:"acme",answer:answer({read_session:"a<b>_c",removal:{...answer().removal,open:{...answer().removal.open,comments:{total:1,ids:['nc_<script>']}}}}),confirm:false}),"en");
  assert.ok(html.includes("a&lt;b&gt;&#95;c")&&!html.includes("<b>_c"),"a session's label");
  assert.ok(drawData(state({confirm:true,answer:answer({removal:{...answer().removal,open:{...answer().removal.open,comments:{total:1,ids:['nc_<script>']}}}})}),"en").includes("nc&#95;&lt;script&gt;"),"an ID");
  const payload={schema:PAGE_SCHEMAS.stage,generated_at:AT,lang:"en",data:{project:{name:"acme",title:"Acme",repository:null,commit:null,generated_at:AT,pushed_at:AT,space:true,read_at:null,unread_since:null,parts:["sample"]},part:"sample",stage:"02-prd",
    head:{key:"02-prd",state:"in_progress",checkpoint:null,commit:null,time:AT,reads:true,source_state:"found",counts:{items:0,kinds:[],priorities:[],hotspots:null},picture:false},
    record:{project:"acme",part:"sample",stage:"02-prd",record:{state:"in_progress",checkpoints:[],next:null,from:"snapshot"},source_state:"found",read:true,checks:[],pictures:[],discrepancies:{total:0,entries:[]},comments:{total:0,entries:[]},reflections:{total:0,entries:[]},checkpoints:[],warnings:[],not_open:[]},
    stages:[],items:{group:"none",filter:"all",q:null,total:0,after:0,counts:{all:0,talk:0,mine:0,left:0},groups:[],entries:[]}},talk:null,picture:null,problem:null};
  assert.equal(drawParts(payload).data,"");
  assert.equal(drawParts(payload,{code:true,data:state()}).data,drawData(state(),"en"));
});
