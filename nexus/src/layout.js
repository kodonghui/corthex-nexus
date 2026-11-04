// Deterministic server/browser geometry. Source objects are never mutated.
export const STEPS=Object.freeze(["1-b","2","3","4","5","6","7","8-a","8-b–9"]);
export const MAX_PICTURE_NODES=20000,MAX_SOURCE_ITEMS=3000,MAX_PICTURE_WORK=200000,MAX_PICTURE_TEXT_WORK=1000000;
export const itemIdentity=node=>node.id?"id:"+node.id:"text:"+node.text;
class PictureLimit extends Error{constructor(reason,work,textWork=0){super("Picture complexity limit");this.reason=reason;this.work=work;this.textWork=textWork;}}
export function stepIndex(key,source){return source.timeline?.length?Math.max(0,STEPS.indexOf(key)<0?8:STEPS.indexOf(key)):8;}
const box=(key,text,x,y,{id="",context="",kind="item",where=null,width=220,height=100,...rest}={})=>({key,id,text:String(text),x,y,width,height,context,kind,where,...rest});
const bounds=nodes=>{if(!nodes.length)return{x:0,y:0,width:220,height:100};let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;for(const n of nodes){x=Math.min(x,n.x);y=Math.min(y,n.y);right=Math.max(right,n.x+n.width);bottom=Math.max(bottom,n.y+n.height);}return{x,y,width:right-x,height:bottom-y};};

export function sitemapLayout(source){
  const depths=new Map(),visiting=new Set(),screens=source.screens||[];
  function depth(i){if(depths.has(i))return depths.get(i);if(visiting.has(i))return 0;visiting.add(i);const p=screens[i]?.parent;const d=Number.isInteger(p)&&p>=0&&p<screens.length&&p!==i?1+depth(p):0;visiting.delete(i);depths.set(i,Math.min(d,screens.length));return depths.get(i);}
  const rows=new Map(),nodes=screens.map((s,i)=>{const d=depth(i),row=rows.get(d)||0;rows.set(d,row+1);return box("screen-"+i,[s.id,s.name,s.path,s.access].filter(Boolean).join("\n"),d*340,row*160,{id:s.id,context:s.context,kind:"screen",where:s.where,raw:s,removed:s.removed,height:120});});
  const edges=screens.flatMap((s,i)=>Number.isInteger(s.parent)&&nodes[s.parent]&&s.parent!==i?[{from:nodes[s.parent].key,to:nodes[i].key,text:""}]:[]);
  return{nodes,edges,bounds:bounds(nodes),contexts:[]};
}

export function erdLayout(source){
  const tables=source.tables||[],across=Math.max(1,Math.ceil(Math.sqrt(tables.length))),nodes=[];let y=0;
  for(let start=0;start<tables.length;start+=across){let rowHeight=0,x=0;for(let i=start;i<Math.min(tables.length,start+across);i++){
    const t=tables[i],width=Math.max(300,Math.min(900,Math.max(...[t.name,...t.columns.map(c=>c.name+" "+c.type)].map(s=>Array.from(s).length))*10+100)),height=90+t.columns.length*32;
    nodes.push(box("table-"+i,t.name,x,y,{width,height,id:t.id,context:t.context,kind:"table",where:t.where,raw:t,removed:t.removed}));x+=width+100;rowHeight=Math.max(rowHeight,height);
  }y+=rowHeight+130;}
  const byName=new Map(nodes.map(n=>[n.raw.name,n]));
  const edges=nodes.flatMap(n=>n.raw.foreign_keys.flatMap((fk,i)=>byName.has(fk.table)?[{from:n.key,to:byName.get(fk.table).key,text:fk.columns.join(", ")+" → "+fk.references.join(", ")+" "+fk.on_delete,foreignKey:fk,key:n.key+"-fk-"+i}]:[]));
  return{nodes,edges,bounds:bounds(nodes),contexts:[...new Set(nodes.map(n=>n.context))]};
}

export function domainLayout(source,key){
  const step=stepIndex(key,source),nodes=[],edges=[],contexts=source.contexts||[],whole=step===8,placed=new Set(),events=new Map();
  let work=0,textWork=0;const spend=(amount=1)=>{if(amount>MAX_PICTURE_WORK-work)throw new PictureLimit("work",work,textWork);work+=amount;};
  const spendText=parts=>{let cost=Math.max(0,parts.length-1)*33;for(const text of parts){cost+=text.length;for(let i=0;i<text.length;i++)if(text.charCodeAt(i)===10)cost+=32;}if(cost>MAX_PICTURE_TEXT_WORK-textWork)throw new PictureLimit("text",work,textWork);textWork+=cost;};
  spend(contexts.length);
  const contextNodes=new Map(contexts.map(c=>[c.id||c.name,[]]));
  const add=(node,atStep=0)=>{if(step<atStep)return;spend();if(nodes.length>=MAX_PICTURE_NODES)throw new PictureLimit("nodes",work,textWork);const prefix=step>=6&&node.context;spendText(prefix?[prefix,node.text]:[node.text]);node.label=prefix?prefix+"\n"+node.text:node.text;nodes.push(node);contextNodes.get(node.context)?.push(node);};
  const rowsByEvent=new Map();for(const c of contexts)for(const r of c.rows){spend();for(const name of r.events){spend();if(!rowsByEvent.has(name))rowsByEvent.set(name,{c,r});}}
  const rowFor=name=>rowsByEvent.get(name)||{};
  let laneY=170;
  for(const [li,lane]of(source.timeline||[]).entries()){
    spend(lane.places.length+1);let tallest=1;for(const place of lane.places)tallest=Math.max(tallest,place.length);const laneHeight=tallest*420+130;
    add(box("lane-"+li,lane.lane,0,laneY-100,{kind:"lane",width:300,height:50,where:lane.where}));
    for(const [pi,place]of lane.places.entries())for(const [ei,name]of place.entries()){
      spend();
      const {c,r}=rowFor(name),ctx=c?.id||c?.name||"",x=720+pi*1000,y=laneY+ei*420,k=`event-${li}-${pi}-${ei}`;
      add(box(k,name,x,y,{context:ctx,kind:"event",where:r?.where}));events.set(name,k);
      if(!r)continue;placed.add(r);
      const title=text=>text,commandX=r.policy?x-550:x-270;
      if(r.command){add(box(k+"-command",title(r.command),commandX,y,{context:ctx,kind:"command",where:r.where}),2);edges.push({from:k+"-command",to:k,text:""});}
      if(r.given_by&&!r.policy)add(box(k+"-actor",title(r.given_by),x-270,y+120,{context:ctx,kind:"actor",height:65,where:r.where}),4);
      if(r.aggregate){spend((source.aggregates||[]).length);const term=(source.aggregates||[]).find(a=>a.context===ctx&&a.name===r.aggregate);add(box(k+"-aggregate",title(r.aggregate),commandX,y-125,{context:ctx,id:term?.term||"",kind:"aggregate",where:term?.where||r.where,raw:term,removed:term?.removed}),5);}
      if(r.policy&&r.given_by){add(box(k+"-policy",title(r.given_by),x-270,y,{context:ctx,kind:"policy",where:r.where}),7);edges.push({from:k+"-command",to:k+"-policy",text:""},{from:k+"-policy",to:k,text:""});}
      if(r.read_model){spend((source.read_models||[]).length);const term=(source.read_models||[]).find(a=>a.context===ctx&&a.name===r.read_model);add(box(k+"-read",title(r.read_model),commandX-270,y+120,{context:ctx,id:term?.term||"",kind:"read-model",where:term?.where||r.where,raw:term,removed:term?.removed}),7);}
    }laneY+=laneHeight;
  }
  if(whole)for(const [ci,c]of contexts.entries())for(const [ri,r]of c.rows.entries()){
    spend();
    if(placed.has(r))continue;const ctx=c.id||c.name,x=720+ri*1000,y=laneY+ci*540;
    spend(r.events.length);const names=[...r.events];if(!names.length)names.push(c.name);
    for(const [i,name]of names.entries())add(box(`unplaced-${ci}-${ri}-${i}`,name,x,y+i*120,{context:ctx,kind:"event",where:r.where}));
    if(r.command)add(box(`unplaced-command-${ci}-${ri}`,r.command,x-270,y,{context:ctx,kind:"command",where:r.where}));
    if(r.given_by)add(box(`unplaced-actor-${ci}-${ri}`,r.given_by,x-540,y,{context:ctx,kind:r.policy?"policy":"actor",where:r.where}));
  }
  // External systems and hotspots belong beside the context's first event.
  const matchedTerms=new Map([["aggregate",new Map()],["read-model",new Map()]]);
  for(const [ci,c]of contexts.entries()){
    spend();
    const ctx=c.id||c.name,first=contextNodes.get(ctx)?.[0],x=(first?.x||720)-650,y=first?.y||laneY+ci*540;
    if(!first&&!whole)continue;
    if(c.external)add(box("external-"+ci,c.external,x,y-140,{context:ctx,kind:"external",where:c.where}),1);
    for(const [hi,h]of(source.hotspots||[]).entries()){spend(h.contexts.length+1);if(h.contexts.includes(c.id))add(box(`hotspot-${ci}-${hi}`,h.text,x,y+hi*135,{context:ctx,kind:"hotspot",where:h.where,raw:h}),3);}
    if(whole)for(const [kind,terms]of[["aggregate",source.aggregates||[]],["read-model",source.read_models||[]]])for(const [ti,t]of terms.entries()){
      spend();if(t.context!==ctx)continue;
      const byContext=matchedTerms.get(kind);let matches=byContext.get(ctx);if(!matches){matches={ids:new Set(),names:new Set()};byContext.set(ctx,matches);}
      if(matches.ids.has(t.term)||matches.names.has(t.name))continue;
      const found=nodes.some(n=>{spend();if(n.kind!==kind||n.context!==ctx)return false;const id=Boolean(n.id&&n.id===t.term),suffix=n.text.endsWith(t.name);if(id)matches.ids.add(t.term);if(suffix)matches.names.add(t.name);return id||suffix;});
      if(!found)add(box(`term-${kind}-${ti}`,t.name,x+ti*260,y+300,{context:ctx,id:t.term||"",kind,where:t.where,raw:t,removed:t.removed}));
      // Only positive matches are cached: nodes are append-only and matching
      // keeps the existing nonempty-ID OR text-suffix semantics.
      if(!found){if(t.term)matches.ids.add(t.term);matches.names.add(t.name);}
    }
  }
  const frames=[];
  if(whole)for(const [i,c]of contexts.entries()){
    if(nodes.length+frames.length>=MAX_PICTURE_NODES)throw new PictureLimit("nodes",work,textWork);
    const ns=contextNodes.get(c.id||c.name)||[];spend(ns.length+1);const b=bounds(ns),text=[c.id,c.name,c.purpose].filter(Boolean);spendText(text);frames.push(box("context-"+i,text.join("\n"),b.x-50,b.y-100,{id:c.id,context:c.id||c.name,kind:"context",where:c.where,raw:c,removed:c.removed,width:b.width+100,height:b.height+160}));
  }
  if(whole)for(const d of source.dependencies||[]){spend(frames.length*2+1);const from=frames.find(n=>n.id===d.from||n.raw.name===d.from),to=frames.find(n=>n.id===d.to||n.raw.name===d.to);if(from&&to)edges.push({from:from.key,to:to.key,text:[d.kind,d.why,d.data].filter(Boolean).join(" · ")});}
  const all=[...frames,...nodes],keys=new Set(all.map(n=>n.key));
  spend(all.length+edges.length+contexts.length);return{nodes:all,edges:edges.filter(e=>keys.has(e.from)&&keys.has(e.to)),bounds:bounds(all),contexts:contexts.map(c=>c.id||c.name),step};
}
function limitedDomain(source,key,reason,work,textWork){
  // Enumerate original source once, never the repeated timeline cross product.
  function* candidates(){
    let index=0;const item=(text,extra={})=>box("source-"+(index++),text,0,0,extra);
    for(const c of source.contexts||[]){
      const context=c.id||c.name;yield item([c.id,c.name,c.purpose].filter(Boolean).join("\n"),{id:c.id,context,kind:"context",where:c.where,raw:c});
      if(c.external)yield item(c.external,{context,kind:"external",where:c.where});
      for(const r of c.rows){for(const event of r.events)yield item(event,{context,kind:"event",where:r.where});for(const [field,kind]of[["command","command"],["given_by",r.policy?"policy":"actor"],["aggregate","aggregate"],["read_model","read-model"]])if(r[field])yield item(r[field],{context,kind,where:r.where});}
    }
    for(const lane of source.timeline||[])for(const place of lane.places)for(const event of place)yield item(event,{kind:"event",where:lane.where});
    for(const [field,kind]of[["aggregates","aggregate"],["read_models","read-model"]])for(const term of source[field]||[])yield item(term.name,{id:term.term,context:term.context,kind,where:term.where,raw:term});
    for(const h of source.hotspots||[])yield item(h.text,{kind:"hotspot",context:h.contexts[0]||"",where:h.where,raw:h});
  }
  const nodes=[],seen=new Set();let listLimited=false;
  for(const node of candidates()){const key=itemIdentity(node);if(seen.has(key))continue;seen.add(key);if(nodes.length>=MAX_SOURCE_ITEMS){listLimited=true;break;}nodes.push(node);}
  return{nodes,edges:[],bounds:bounds(nodes),contexts:[],step:stepIndex(key,source),limited:true,limit:MAX_PICTURE_NODES,workLimit:MAX_PICTURE_WORK,textLimit:MAX_PICTURE_TEXT_WORK,reason,work,textWork,listLimited};
}
export function pictureLayout(source,stage,step){try{return stage==="01-domain"?domainLayout(source,step):stage==="05-erd"?erdLayout(source):sitemapLayout(source);}catch(error){if(!(error instanceof PictureLimit))throw error;return limitedDomain(source,step,error.reason,error.work,error.textWork);}}
export function sceneItems(scene){const seen=new Set();return scene.nodes.filter(n=>{if(n.kind==="lane")return false;const key=itemIdentity(n);if(seen.has(key))return false;seen.add(key);return true;});}
export function itemMarks(item,data){
  const comments=(data.comments?.entries||[]).filter(c=>item.id?c.item===item.id:!c.item&&c.quote===item.text);
  const proposals=(data.proposals||[]).filter(p=>item.id&&p.items.includes(item.id));
  const discrepancies=(data.discrepancies||[]).filter(d=>item.id&&(d.item===item.id||d.term===item.id)||!item.id&&d.item===item.text);
  const reflections=(data.reflections||[]).filter(e=>e.proposal?.items?.includes(item.id));
  return{comments,proposals,discrepancies,reflections,total:comments.length+proposals.length+discrepancies.length+reflections.length};
}
