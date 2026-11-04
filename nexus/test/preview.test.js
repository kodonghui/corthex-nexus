import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createViews} from "../src/views.js";
import {renderView} from "../src/app.js";
import {viewSnapshot} from "./view-fixtures.js";

const folder=new URL("../src/view-code/",import.meta.url);
const metadata=JSON.parse(readFileSync(new URL("sizes.json",folder)));
const code=Object.fromEntries(metadata.files.map(file=>[file.name,{type:file.type,body:readFileSync(new URL(file.path,folder))}]));
const views=createViews(code,metadata.entries);
function page(name="한국어 화면"){
 const source={format:1,screens:Array.from({length:300},(_,index)=>({id:"SCR-"+String(index+1).padStart(3,"0"),name:name+" "+index,path:"/screen-"+index,access:"user",context:"",flows:[],terms:[],removed:false,where:"docs/screens.yaml:"+(index+1),...(index?{parent:0}:{})})),without_screen:[]};
 return{schema:"corthex-view-page/0.2",view:"picture",lang:"ko",data:{project:"qa-preview",part:"sample",stage:"07-sitemap",picture:{commit:"a".repeat(40),committed_at:"2026-11-03T00:00:00Z",drawn_at:"2026-11-03T00:00:00Z",not_current:null,source},comments:{total:0,entries:[]},closed_comments:{total:0,entries:[]},proposals:[],reflections:[],discrepancies:[]},problem:null};
}

test("server delivers all300 preview nodes without running the view or editor",()=>{
 const payload=page(),html=renderView(views.template(payload),payload);
 assert.ok(html.includes('data-preview-ready="true"'),"first picture must exist in checked HTML");
 assert.equal((html.match(/data-nexus-node=/g)||[]).length,300,"all nodes belong to the initial picture");
 assert.ok(html.includes("data-preview-complete"),"completion marker follows the complete SVG");
 assert.ok(html.includes('<style data-nexus-css="view">'),"trusted view CSS must not block the first picture on another request");
 assert.ok(html.includes("한국어 화면"));
});

test("native requests remain inert until after the first preview paint",()=>{
 const html=views.template(page());
 const inert=html.match(/<template id="nexus-editor-assets">([\s\S]*?)<\/template>/);
 assert.ok(inert,"native preloads must be deferred, not discarded");
 assert.ok(inert[1].includes(metadata.entries["excalidraw-js"]));
 const active=html.replace(inert[0],"");
 assert.ok(!active.includes(metadata.entries["excalidraw-js"]),"native graph must not compete with the initial HTML");
 assert.ok(!active.includes('rel="stylesheet"'),"critical CSS is inline");
});

test("preview text cannot create markup or duplicate the bootstrap placeholder",()=>{
 const payload=page('</style><script>window.QA_TITLE_EXECUTED=1</script> __CORTHEX_VIEW_DATA__ $&');
 const template=views.template(payload);
 assert.equal(template.split("__CORTHEX_VIEW_DATA__").length,2,"only the real bootstrap placeholder remains literal");
 const html=renderView(template,payload),svg=html.match(/<svg[^>]*data-nexus-preview[\s\S]*?<\/svg>/)?.[0];
 assert.ok(svg,"a preview must still be present for hostile text");
 assert.ok(!/<script\b|<foreignObject\b|\son\w+=/i.test(svg));
 assert.ok(svg.includes("&lt;script&gt;"));
 assert.equal((html.match(/<script\b/g)||[]).length,2,"JSON bootstrap and the same-origin module only");
});

test("static picture preserves stale reasons and the DDD step row before the view module runs",()=>{
 const payload=page();payload.data.picture.not_current="source-gone";
 const html=views.template(payload);
 assert.ok(html.includes("data-preview-stale"));
 assert.ok(html.includes(payload.data.picture.commit));
 assert.ok(html.includes("사라")||html.includes("없"),"the localized stale reason remains in static HTML");
 const source=viewSnapshot("qa-views").pictures.find(p=>p.stage==="01-domain").source;
 payload.data.stage="01-domain";payload.data.picture.source=source;
 const ddd=views.template(payload);
 assert.ok(source.timeline?.length,"the regression fixture must exercise timeline controls");
 assert.ok(ddd.includes("data-preview-steps"));
 assert.ok(ddd.includes("새로 읽기"),"reserve the same control wrapping as the active view");
});
