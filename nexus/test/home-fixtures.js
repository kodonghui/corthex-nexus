// API-151's answer (HomeData) for the first page's drawing (TASK-273): two synthetic
// projects, my turn's four kinds of entry and the agent to-do, with a title and texts that
// try markup and the page's data marker. Only the members that the drawing reads. The
// answer comes a day after the entries, so that the loop's times say how long ago (TASK-298):
// the agent never read qa-second, and read qa-shop before its oldest unread entry, which
// has waited more than 24 hours.
import {STAGE_KEYS} from "../src/draw/stages.js";

export const AT="2026-11-08T08:30:00.000Z";
export const NOW="2026-11-09T09:30:00.000Z";
export const SHOP_READ={read_at:"2026-11-08T07:00:00.000Z",unread:4,unread_since:"2026-11-08T08:00:00.000Z"};
export const HOME_TITLE=`<b>QA</b> "home" & '__CORTHEX_VIEW_DATA__' 합성 가게`;
const STATES=["done","in_progress","not_started","skipped","unknown"];

// My turn in SPEC-143's order: a proposal, a recommendation, a checkpoint that the agent
// asks for on the stage as a whole, and a question on a part that no item holds.
export function turnEntries(){
  return[
    {kind:"proposal",id:"np_1",project:"qa-shop",part:"sample",stage:"05-erd",item:"TBL-020",title:"index_items",quote:null,text:"Add <b>embedded_at</b> to index_items.",at:AT,asks:null},
    {kind:"comment",id:"nc_2",project:"qa-shop",part:"sample",stage:"07-sitemap",item:"SCR-105",title:"Picture view",quote:null,text:"Keep the address as a redirect. I recommend a permanent one.",at:AT,asks:"recommended"},
    {kind:"comment",id:"nc_3",project:"qa-shop",part:"sample",stage:"12-qa",item:"",title:null,quote:null,text:"Stage 12 is ready for its checkpoint.",at:AT,asks:"checkpoint"},
    {kind:"comment",id:"nc_4",project:"qa-second",part:"",stage:"01-domain",item:"",title:null,quote:"Payment table",text:"Which payment does this table keep?",at:AT,asks:"answer"},
  ];
}

export function homeData({entries=turnEntries(),total=73,agent,projects}={}){
  const shop={name:"qa-shop",title:HOME_TITLE,repository:"https://github.com/example/qa-shop",commit:"0123456789abcdef0123456789abcdef01234567",
    generated_at:AT,pushed_at:"2026-11-08T09:00:00.000Z",items:1500,warnings:3,
    parts:[
      {name:"sample",recorded:true,current:"02-prd",next:"Write the <PRD> again",states:STAGE_KEYS.map((key,i)=>STATES[i%STATES.length])},
      {name:"second",recorded:false,current:"01-domain",next:null,states:STAGE_KEYS.map(()=>"unknown")},
    ],
    stages:STAGE_KEYS.map(key=>({key,items:key==="05-erd"?1500:0})),
    pictures:[
      {part:"sample",stage:"01-domain",commit:"abc1234",committed_at:AT,not_current:null,comments:2,
        drawing:{bounds:[0,0,200,100],boxes:[["context",0,0,200,100],["event",10,10,40,20],["weird",60,10,40,-5]],lines:[[50,20,60,20]]}},
      {part:"sample",stage:"05-erd",commit:"abc1234",committed_at:AT,not_current:"source-gone",comments:1000,drawing:null},
    ]};
  const second={name:"qa-second",title:null,repository:null,commit:null,generated_at:AT,pushed_at:"2026-11-07T09:00:00.000Z",items:0,warnings:0,
    parts:[{name:"",recorded:true,current:null,next:null,states:STAGE_KEYS.map(()=>"done")}],stages:STAGE_KEYS.map(key=>({key,items:0})),pictures:[]};
  const none={total:0,oldest:null};
  return{generated_at:NOW,my_turn:{total:entries.length?total:0,entries},
    agent:agent??[
      {project:"qa-second",comments:none,discrepancies:none,reflections:none,checkpoints:none,taken:0,read_at:null,unread:0,unread_since:null},
      {project:"qa-shop",comments:{total:3,oldest:{part:"sample",stage:"05-erd",entry:"nc_9"}},discrepancies:{total:1500,oldest:{part:"sample",stage:"07-sitemap",entry:"nd_1"}},
        reflections:none,checkpoints:{total:1,oldest:{part:"sample",stage:"12-qa",entry:"nk_1"}},taken:2,...SHOP_READ},
    ],
    // The server's order: by name.
    projects:projects??[second,shop]};
}
