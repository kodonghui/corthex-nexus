import test from "node:test";
import assert from "node:assert/strict";
import {STEPS,domainLayout,pictureLayout,sitemapLayout,erdLayout,sceneItems,itemMarks,itemIdentity,commentTarget} from "../ui/layout.js";
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
test("contexts without items stand side by side below the board at the whole picture",()=>{
 const overlap=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
 const bare=id=>({id,name:"Context "+id,purpose:"Synthetic purpose",rows:[],where});
 const mixed={...source,contexts:[...source.contexts,bare("CTX-002"),bare("CTX-003"),bare("CTX-004")],dependencies:[{from:"CTX-002",to:"CTX-003",kind:"customer-supplier",where}]};
 const only={format:1,contexts:["CTX-001","CTX-002","CTX-003","CTX-004","CTX-005"].map(bare),aggregates:[],read_models:[],dependencies:[],hotspots:[]};
 for(const s of [mixed,only]){
  const before=JSON.stringify(s),scene=domainLayout(s,STEPS[8]),frames=scene.nodes.filter(n=>n.kind==="context"),items=scene.nodes.filter(n=>n.kind!=="context");
  const empty=frames.filter(f=>!items.some(n=>n.context===f.context));
  assert.equal(frames.length,s.contexts.length);assert.equal(empty.length,s===mixed?3:5);
  for(const [i,a]of frames.entries())for(const b of frames.slice(i+1))if(empty.includes(a)||empty.includes(b))assert.ok(!overlap(a,b),a.id+" and "+b.id+" overlap");
  for(const frame of empty)for(const item of items)assert.ok(!overlap(frame,item),frame.id+" covers "+(item.id||item.text));
  assert.ok(empty.every(f=>f.x>=scene.bounds.x&&f.y>=scene.bounds.y&&f.x+f.width<=scene.bounds.x+scene.bounds.width&&f.y+f.height<=scene.bounds.y+scene.bounds.height));
  assert.equal(JSON.stringify(domainLayout(s,STEPS[8])),JSON.stringify(scene));assert.equal(JSON.stringify(s),before);
 }
 assert.equal(domainLayout(mixed,STEPS[8]).edges.filter(e=>e.from.startsWith("context-")).length,1,"a dependency between item-less contexts is still drawn");
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
test("Picture drawn belongs to its declared context; identical events and legacy picture comments stay separate",()=>{
 const contexts=["CTX-012","CTX-014"].map(id=>({id,name:id,rows:[{...row,events:["Picture drawn"]}],where})),s={...source,contexts,timeline:undefined},before=JSON.stringify(s);
 const events=sceneItems(domainLayout(s)).filter(n=>n.kind==="event"&&n.text==="Picture drawn");
 assert.equal(events.length,2,"the list must retain the event in both contexts");
 assert.notEqual(itemIdentity(events[0]),itemIdentity(events[1]));
 assert.deepEqual(commentTarget(events[0]),{item:"CTX-012",quote:"Picture drawn"});
 const data={comments:{entries:[{id:"first",item:"CTX-012",quote:"Picture drawn"},{id:"second",item:"CTX-014",quote:"Picture drawn"},{id:"legacy",item:"",quote:"Picture drawn"}]}};
 assert.deepEqual(itemMarks(events[0],data).comments.map(c=>c.id),["first"]);
 assert.deepEqual(itemMarks(events[1],data).comments.map(c=>c.id),["second"]);
 assert.deepEqual(itemMarks({id:"CTX-012"},data).comments.map(c=>c.id),["first"],"the holding item still counts its quoted comment");
 assert.deepEqual(itemMarks({id:"",text:"Picture drawn"},data).comments.map(c=>c.id),["legacy"],"old picture-scoped comments are not reassigned");
 assert.equal(JSON.stringify(s),before);
});
test("a context name that looks like an ID remains anonymous, including limited source lists",()=>{
 const anonymous={...source,contexts:[{id:"CTX-014",name:"Declared",rows:[],where},{name:"CTX-014",rows:[{...row,events:["Picture drawn"]}],where}],timeline:undefined};
 const event=domainLayout(anonymous).nodes.find(n=>n.kind==="event");
 assert.deepEqual(commentTarget(event),{item:"",quote:"Picture drawn"});
 assert.equal(itemIdentity({id:"TERM-001",text:"Order",owner:"CTX-012"}),"id:TERM-001");
 assert.equal(itemIdentity({id:"",text:"Picture drawn"}),"text:Picture drawn");
 const crowded={...anonymous,timeline:[{lane:"Repeated",places:[Array(20001).fill("Picture drawn")],where}]},before=JSON.stringify(crowded);
 // The public bounded path must retain the same anonymous ownership rule.
 const limited=pictureLayout(crowded,"01-domain");
 assert.equal(limited.limited,true);assert.ok(sceneItems(limited).filter(n=>n.kind==="event").every(n=>commentTarget(n).item===""));
 assert.equal(JSON.stringify(crowded),before);
});
test("all UI error words and nine step labels are generated from the frozen screen source",()=>{
 assert.equal(readFileSync(new URL("../ui/messages.js",import.meta.url),"utf8"),compileMessages());
});
