// Deterministic browser-only geometry. Source objects are never mutated.
export const STEPS=Object.freeze(["1-b","2","3","4","5","6","7","8-a","8-b–9"]);
export function stepIndex(key,source){return source.timeline?.length?Math.max(0,STEPS.indexOf(key)<0?8:STEPS.indexOf(key)):8;}
const box=(key,text,x,y,{id="",context="",kind="item",where=null,width=220,height=100,...rest}={})=>({key,id,text:String(text),x,y,width,height,context,kind,where,...rest});
const bounds=nodes=>nodes.length?{x:Math.min(...nodes.map(n=>n.x)),y:Math.min(...nodes.map(n=>n.y)),width:Math.max(...nodes.map(n=>n.x+n.width))-Math.min(...nodes.map(n=>n.x)),height:Math.max(...nodes.map(n=>n.y+n.height))-Math.min(...nodes.map(n=>n.y))}:{x:0,y:0,width:220,height:100};

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
  const contextNodes=new Map(contexts.map(c=>[c.id||c.name,[]]));
  const add=(node,atStep=0)=>{if(step<atStep)return;node.label=step>=6&&node.context?node.context+"\n"+node.text:node.text;nodes.push(node);contextNodes.get(node.context)?.push(node);};
  const rowFor=name=>{for(const c of contexts){const r=c.rows.find(r=>r.events.includes(name));if(r)return{c,r};}return{};};
  let laneY=170;
  for(const [li,lane]of(source.timeline||[]).entries()){
    const laneHeight=Math.max(1,...lane.places.map(p=>p.length))*420+130;
    add(box("lane-"+li,lane.lane,0,laneY-100,{kind:"lane",width:300,height:50,where:lane.where}));
    for(const [pi,place]of lane.places.entries())for(const [ei,name]of place.entries()){
      const {c,r}=rowFor(name),ctx=c?.id||c?.name||"",x=720+pi*1000,y=laneY+ei*420,k=`event-${li}-${pi}-${ei}`;
      add(box(k,name,x,y,{context:ctx,kind:"event",where:r?.where}));events.set(name,k);
      if(!r)continue;placed.add(r);
      const title=text=>text,commandX=r.policy?x-550:x-270;
      if(r.command){add(box(k+"-command",title(r.command),commandX,y,{context:ctx,kind:"command",where:r.where}),2);edges.push({from:k+"-command",to:k,text:""});}
      if(r.given_by&&!r.policy)add(box(k+"-actor",title(r.given_by),x-270,y+120,{context:ctx,kind:"actor",height:65,where:r.where}),4);
      if(r.aggregate){const term=(source.aggregates||[]).find(a=>a.context===ctx&&a.name===r.aggregate);add(box(k+"-aggregate",title(r.aggregate),commandX,y-125,{context:ctx,id:term?.term||"",kind:"aggregate",where:term?.where||r.where,raw:term,removed:term?.removed}),5);}
      if(r.policy&&r.given_by){add(box(k+"-policy",title(r.given_by),x-270,y,{context:ctx,kind:"policy",where:r.where}),7);edges.push({from:k+"-command",to:k+"-policy",text:""},{from:k+"-policy",to:k,text:""});}
      if(r.read_model){const term=(source.read_models||[]).find(a=>a.context===ctx&&a.name===r.read_model);add(box(k+"-read",title(r.read_model),commandX-270,y+120,{context:ctx,id:term?.term||"",kind:"read-model",where:term?.where||r.where,raw:term,removed:term?.removed}),7);}
    }laneY+=laneHeight;
  }
  if(whole)for(const [ci,c]of contexts.entries())for(const [ri,r]of c.rows.entries()){
    if(placed.has(r))continue;const ctx=c.id||c.name,x=720+ri*1000,y=laneY+ci*540;
    const names=[...r.events];if(!names.length)names.push(c.name);
    for(const [i,name]of names.entries())add(box(`unplaced-${ci}-${ri}-${i}`,name,x,y+i*120,{context:ctx,kind:"event",where:r.where}));
    if(r.command)add(box(`unplaced-command-${ci}-${ri}`,r.command,x-270,y,{context:ctx,kind:"command",where:r.where}));
    if(r.given_by)add(box(`unplaced-actor-${ci}-${ri}`,r.given_by,x-540,y,{context:ctx,kind:r.policy?"policy":"actor",where:r.where}));
  }
  // External systems and hotspots belong beside the context's first event.
  for(const [ci,c]of contexts.entries()){
    const ctx=c.id||c.name,first=contextNodes.get(ctx)?.[0],x=(first?.x||720)-650,y=first?.y||laneY+ci*540;
    if(!first&&!whole)continue;
    if(c.external)add(box("external-"+ci,c.external,x,y-140,{context:ctx,kind:"external",where:c.where}),1);
    for(const [hi,h]of(source.hotspots||[]).entries())if(h.contexts.includes(c.id))add(box(`hotspot-${ci}-${hi}`,h.text,x,y+hi*135,{context:ctx,kind:"hotspot",where:h.where,raw:h}),3);
    if(whole)for(const [kind,terms]of[["aggregate",source.aggregates||[]],["read-model",source.read_models||[]]])for(const [ti,t]of terms.entries())if(t.context===ctx&&!nodes.some(n=>n.kind===kind&&n.context===ctx&&(n.id&&n.id===t.term||n.text.endsWith(t.name))))add(box(`term-${kind}-${ti}`,t.name,x+ti*260,y+300,{context:ctx,id:t.term||"",kind,where:t.where,raw:t,removed:t.removed}));
  }
  const frames=[];
  if(whole)for(const [i,c]of contexts.entries()){
    const ns=contextNodes.get(c.id||c.name)||[],b=bounds(ns);frames.push(box("context-"+i,[c.id,c.name,c.purpose].filter(Boolean).join("\n"),b.x-50,b.y-100,{id:c.id,context:c.id||c.name,kind:"context",where:c.where,raw:c,removed:c.removed,width:b.width+100,height:b.height+160}));
  }
  if(whole)for(const d of source.dependencies||[]){const from=frames.find(n=>n.id===d.from||n.raw.name===d.from),to=frames.find(n=>n.id===d.to||n.raw.name===d.to);if(from&&to)edges.push({from:from.key,to:to.key,text:[d.kind,d.why,d.data].filter(Boolean).join(" · ")});}
  const all=[...frames,...nodes],keys=new Set(all.map(n=>n.key));
  return{nodes:all,edges:edges.filter(e=>keys.has(e.from)&&keys.has(e.to)),bounds:bounds(all),contexts:contexts.map(c=>c.id||c.name),step};
}
export function pictureLayout(source,stage,step){return stage==="01-domain"?domainLayout(source,step):stage==="05-erd"?erdLayout(source):sitemapLayout(source);}
export function sceneItems(scene){const seen=new Set();return scene.nodes.filter(n=>{if(n.kind==="lane")return false;const key=n.id||n.text;if(seen.has(key))return false;seen.add(key);return true;});}
export function itemMarks(item,data){
  const comments=(data.comments?.entries||[]).filter(c=>item.id?c.item===item.id:!c.item&&c.quote===item.text);
  const proposals=(data.proposals||[]).filter(p=>item.id&&p.items.includes(item.id));
  const discrepancies=(data.discrepancies||[]).filter(d=>item.id&&(d.item===item.id||d.term===item.id)||!item.id&&d.item===item.text);
  const reflections=(data.reflections||[]).filter(e=>e.proposal?.items?.includes(item.id));
  return{comments,proposals,discrepancies,reflections,total:comments.length+proposals.length+discrepancies.length+reflections.length};
}
