// Executes the real hub script and DOM builders with a small DOM double;
// browser geometry, theme and screenshots are verified separately.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

class Element{
 constructor(tag){this.tagName=tag;this.children=[];this._text="";}
 set textContent(value){this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(n=>typeof n==="string"?n:n.textContent).join("");}
 appendChild(value){this.children.push(value);return value;}
 setAttribute(name,value){this[name]=String(value);}
 addEventListener(){}
}
function hub(lang){
 const project={project:{name:"synthetic",title:"Synthetic project"},items:[
  {id:"SCR-001",kind:"screen",stage:"07-sitemap",title:"Order screen",states:["normal","empty"],screen_doc:"docs/screen.md:1"},
  {id:"REQ-001",kind:"requirement",stage:"02-prd",title:"Order requirement"}],ids:{SCR:"screen",REQ:"requirement"}};
 const data={schema:"corthex-hub-page/0.2",origin:"server",lang,projects:[project],missing:[]},document={documentElement:{lang},getElementById:id=>id==="hub-data"?{textContent:JSON.stringify(data)}:null,createElement:tag=>new Element(tag),createTextNode:value=>String(value)};
 const html=readFileSync(new URL("../src/hub.html",import.meta.url),"utf8"),start=html.lastIndexOf("<script>")+8,script=html.slice(start,html.indexOf("</script>",start));
 const exposed=script.replace(/  render\(\);\s*\}\)\(\);\s*$/, "globalThis.actualHub={searchView,traceView,projects,S,stageName};})();");
 assert.notEqual(exposed,script,"expose the real render functions without running the page's navigation");
 const context={document,URLSearchParams};runInNewContext(exposed,context,{timeout:2000});return context.actualHub;
}

test("screen trace shows a string state heading while progress translations remain an object",()=>{
 for(const lang of["en","ko"]){const h=hub(lang),panel=h.traceView(h.projects[0],"SCR-001"),text=panel.textContent;assert.ok(text.includes(lang==="ko"?"화면 상태":"Screen states"));assert.ok(text.includes("normal, empty"));assert.doesNotMatch(text,/\[object Object\]/);assert.equal(typeof h.S.states,"object");assert.equal(typeof h.S.states.done,"string");}
});

test("word-search rows retain each ID, title, localized kind, stage and project",()=>{
 for(const lang of["en","ko"]){const h=hub(lang),panel=h.searchView("Order"),rows=panel.children.find(n=>n.tagName==="ul").children;assert.equal(rows.length,2);
  for(const [index,id,kind,stage]of[[0,"SCR-001","screen","07-sitemap"],[1,"REQ-001","requirement","02-prd"]]){const text=rows[index].textContent;assert.ok(text.includes(id));assert.ok(text.includes("Order"));assert.ok(text.includes(h.S.kinds[kind]));assert.ok(text.includes(h.stageName(stage)));assert.ok(text.includes("Synthetic project"));}
 }
});
