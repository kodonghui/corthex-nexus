import test from "node:test";
import assert from "node:assert/strict";
import {STEPS,domainLayout,sitemapLayout,erdLayout,sceneItems,itemMarks} from "../ui/layout.js";
import {compileMessages} from "../tools/messages.mjs";
import {readFileSync} from "node:fs";
const where={path:"docs/01-domain/sample.md",line:1};
const row={given_by:"Buyer",policy:false,read_model:"Orders",command:"Place order",aggregate:"Order",events:["Order placed"],where};
const source={format:1,contexts:[{id:"CTX-001",name:"Ordering",purpose:"Take orders",external:"Payment provider",rows:[row,{...row,command:"Orphan command",events:["Unplaced event"]}],where}],aggregates:[{name:"Order",context:"CTX-001",term:"TERM-001",where}],read_models:[{name:"Orders",context:"CTX-001",term:"TERM-002",where}],dependencies:[],hotspots:[{text:"What if payment fails?",contexts:["CTX-001"],where}],timeline:[{lane:"Order",places:[["Order placed"]],where}]};
test("nine cumulative DDD steps preserve timeline positions, IDs and whole-board-only orphan rows",()=>{
 const original=JSON.stringify(source),scenes=STEPS.map(s=>domainLayout(source,s));assert.equal(scenes.length,9);
 const expected=["event","external","command","hotspot","actor","aggregate","event","read-model"];
 for(let i=0;i<8;i++)assert.ok(scenes[i].nodes.some(n=>n.kind===expected[i]),STEPS[i]);
 for(const scene of scenes){assert.deepEqual(scene.nodes.find(n=>n.kind==="event").x,scenes[0].nodes.find(n=>n.kind==="event").x);assert.ok(scene.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));}
 assert.ok(scenes.slice(0,8).every(s=>!s.nodes.some(n=>n.text==="Unplaced event")));assert.ok(scenes[8].nodes.some(n=>n.text==="Unplaced event"));
 assert.ok(scenes[6].nodes.filter(n=>n.context).every(n=>n.label.startsWith("CTX-001\n")));assert.ok(scenes.slice(0,8).every(s=>!s.nodes.some(n=>n.kind==="context")));assert.ok(scenes[8].nodes.some(n=>n.id==="CTX-001"));assert.ok(scenes[5].nodes.some(n=>n.id==="TERM-001"));assert.ok(scenes[7].nodes.some(n=>n.id==="TERM-002"));assert.equal(JSON.stringify(source),original);
 assert.equal(domainLayout(source,"invalid").step,8);assert.equal(domainLayout({...source,timeline:undefined},"1-b").step,8);
});
test("sitemap parents produce stable edges and malformed cycles cannot recurse forever",()=>{
 const s={screens:[{id:"SCR-001",name:"Home",path:"/",access:"user",context:"CTX-001",where},{id:"SCR-002",name:"Order",path:"/order",access:"user",parent:0,context:"CTX-002",where}]};
 const scene=sitemapLayout(s);assert.equal(scene.edges.length,1);assert.ok(scene.nodes[1].x>scene.nodes[0].x);assert.equal(scene.nodes[1].context,"CTX-002");
 assert.ok(sitemapLayout({screens:[{...s.screens[0],parent:1},{...s.screens[1],parent:0}]}).nodes.every(n=>Number.isFinite(n.x)));
});
test("ERD keeps composite references, delete actions and a table in another context",()=>{
 const table=(id,name,context)=>({id,name,context,columns:[{name:"id",type:"INTEGER",null:false,where}],primary_key:["id"],unique:[],foreign_keys:[],where});
 const a=table("TBL-001","orders","CTX-001"),b=table("TBL-002","payments","CTX-002");a.foreign_keys.push({columns:["id"],table:"payments",references:["id"],on_delete:"cascade",where});
 const scene=erdLayout({tables:[a,b]});assert.deepEqual(scene.contexts,["CTX-001","CTX-002"]);assert.equal(scene.edges[0].foreignKey.on_delete,"cascade");assert.ok(scene.nodes[1].x>=scene.nodes[0].x+scene.nodes[0].width);
});
test("marks distinguish stable IDs, un-ID quotes and accepted pending reflections",()=>{
 const scene=domainLayout(source),items=sceneItems(scene);assert.equal(items.filter(n=>n.id==="TERM-001").length,1);
 const data={comments:{entries:[{id:"nc_1",item:"TERM-001"},{id:"nc_2",item:"",quote:"Order placed"}]},proposals:[{id:"np_1",items:["TERM-001"]}],discrepancies:[{id:"nd_1",term:"TERM-001",item:"TBL-001"}],reflections:[{id:"ne_1",proposal:{items:["TERM-001"]}}]};
 assert.equal(itemMarks({id:"TERM-001",text:"Order"},data).total,4);assert.equal(itemMarks({id:"",text:"Order placed"},data).comments.length,1);assert.equal(itemMarks({id:"",text:"Another event"},data).total,0);
});
test("all UI error words and nine step labels are generated from the frozen screen source",()=>{
 assert.equal(readFileSync(new URL("../ui/messages.js",import.meta.url),"utf8"),compileMessages());
});
