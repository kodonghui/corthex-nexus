// Actual proposal renderer with DOM/transport doubles; no browser or real Access claim.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {words} from "../ui/messages.js";

class Element{
  constructor(tag,text=""){this.tagName=tag.toUpperCase();this.children=[];this._text=text;}
  append(...values){this.children.push(...values.filter(v=>v!==null&&v!==undefined));}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(v=>typeof v==="string"?v:v.textContent).join("");}
}
const core=readFileSync(new URL("../ui/core.js",import.meta.url),"utf8");
const helper=core.indexOf("  function reflectionState(");
const start=helper<0?core.indexOf("  async function renderProposal("):helper;
const renderer=core.slice(start,core.indexOf("  async function openFromHash(",start));
const stateLine=core.split(/\r?\n/).find(line=>line.includes("function stateName("));
const safeLine=core.split(/\r?\n/).find(line=>line.includes("const safeLink="));
const pr="https://github.example/synthetic/project/pull/1",commit="b".repeat(40);
const definitions=[
  {name:"pending",state:"accepted",edit:{state:"pending"},en:"Accepted, not yet reflected.",ko:"받음, 아직 반영 전."},
  {name:"in review",state:"accepted",edit:{state:"in-review",pull_request:pr},en:`In review: ${pr}.`,ko:`검토 중: ${pr}.`},
  {name:"needs user",state:"accepted",edit:{state:"needs-user"},en:"The change no longer fits the stage source; the agent asks you on its comment.",ko:"단계 원본이 바뀌어 이 변경이 더는 맞지 않습니다. 에이전트가 의견에서 묻습니다."},
  {name:"reflected by PR",state:"accepted",edit:{state:"closed",pull_request:pr,closed_commit:commit},en:`Reflected by ${pr}.`,ko:`${pr}로 반영됨.`},
  {name:"already in source",state:"accepted",edit:{state:"closed",closed_commit:commit},en:`Reflected: already in the stage source at commit ${commit}.`,ko:`반영됨: 커밋 ${commit}의 단계 원본에 이미 있음.`},
  {name:"dismissed reflection",state:"accepted",edit:{state:"dismissed"},en:"The reflection was dismissed.",ko:"반영을 버렸습니다."},
  {name:"dismissed proposal",state:"dismissed",en:"Dismissed on synthetic date; its comment stays open.",ko:"synthetic date에 버림. 의견은 열린 채로 남습니다."},
  {name:"withdrawn proposal",state:"withdrawn",en:"Withdrawn by the agent on synthetic date.",ko:"synthetic date에 에이전트가 철회함."},
];
async function render(definition,lang,fetchClosed){
  const root=new Element("section"),calls=[],actions=[],node=(tag,text="")=>new Element(tag,text??"");
  const proposal={id:"np_aaaaaaaaaaaa",items:["TBL-001"],change:"Rename the synthetic table",reason:"A synthetic reason",source_text:"CREATE TABLE sample(id INT);",commit:"a".repeat(40),comment:"nc_aaaaaaaaaaaa",state:definition.state,closed_at:"2026-11-05T00:00:00.000Z",edit:definition.edit?"ne_aaaaaaaaaaaa":null};
  const edit=definition.edit?{id:proposal.edit,proposal:proposal.id,pull_request:null,closed_commit:null,...definition.edit}:null;
  const before=JSON.stringify({proposal,edit});
  const sandbox={panelVersion:0,URL,location:new URL("https://nexus.example.com/pictures/synthetic/sample/05-erd"),ko:lang==="ko",say:(en,ko)=>lang==="ko"?ko:en,t:(key,values)=>words(key,lang,values),node,put:(parent,...values)=>parent.append(...values),entries:value=>Array.isArray(value)?value:value?.entries||[],panelFrame:()=>root,characters:text=>Array.from(text).length,drawn:{commit:proposal.commit},data:{reflections:fetchClosed?[]:[edit].filter(Boolean)},panelTarget:"proposal:"+proposal.id,base:"/api/snapshots/synthetic",date:()=>"synthetic date",notice:text=>node("p",text),entryLink:(_,id,label)=>node("a",label),action:(parent,value)=>{actions.push(value);parent.append(node("button",value.label));},errorBox:()=>{throw Error("unexpected read refusal");},openFromHash(){},api:{async call(method,path){calls.push({method,path});return edit;}}};
  runInNewContext(stateLine+"\n"+safeLine+"\n"+renderer+"\nglobalThis.draw=renderProposal;",sandbox,{timeout:2000});
  await sandbox.draw(proposal);
  assert.equal(JSON.stringify({proposal,edit}),before,"render must not mutate the read data");
  assert.ok(calls.every(c=>c.method==="GET"));
  const visit=node=>[node,...node.children.filter(n=>typeof n!=="string").flatMap(visit)];
  return {root,calls,actions,elements:visit(root)};
}
for(const lang of ["en","ko"]){
  for(const definition of definitions){
    test(`SCR108 exact ${lang} ${definition.name} label and retained controls`,async()=>{
      for(const fetched of definition.edit?[false,true]:[false]){
        const result=await render(definition,lang,fetched);
        assert.ok(result.root.textContent.includes(definition[lang]),result.root.textContent);
        const links=result.elements.filter(n=>n.tagName==="A"&&n.href===pr);
        assert.equal(links.length,definition.edit?.pull_request?1:0,"one safe PR link");
        if(links.length){assert.equal(links[0].target,"_blank");assert.equal(links[0].rel,"noopener noreferrer");}
        assert.equal(result.actions.length,definition.edit?.state==="needs-user"?1:0);
        if(fetched)assert.deepEqual(result.calls,[{method:"GET",path:"/api/snapshots/synthetic/edits/ne_aaaaaaaaaaaa"}]);
      }
    });
  }
}
