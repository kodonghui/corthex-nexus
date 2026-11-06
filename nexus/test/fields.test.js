import test from "node:test";
import assert from "node:assert/strict";
import {FIELDS,itemFields,reasonText} from "../ui/fields.js";
import {messages} from "../ui/messages.js";

const table={id:"TBL-001",name:"orders",context:"CTX-002",terms:["TERM-001"],primary_key:["id"],unique:[{columns:["email"],partial:false},{columns:["code"],partial:true}],
  foreign_keys:[{columns:["buyer_id"],table:"buyers",references:["id"],on_delete:"cascade"},{columns:["shop_id"],table:"shops",references:[],on_delete:""}],columns:[{name:"id",type:"INTEGER"}]};

test("0.2.3 words come from stage 08, never the internal fallback",()=>{
  for(const key of ["Item fields","Item values","Foreign key","On delete","No 01 term","Not on the board","Other context","Removed","No table","No screen","Wheel hint","Removed mark"])assert.ok(Object.hasOwn(messages,key),key);
  for(const lang of [0,1])assert.equal(messages["Item fields"][lang].split(" · ").length,FIELDS.length);
  assert.equal(messages["On delete"][0].split(" · ").length,5);assert.equal(messages["On delete"][1].split(" · ").length,5);
});

test("source fields read as words in both languages, with no JSON or field codes",()=>{
  const en=itemFields(table,"en"),ko=itemFields(table,"ko");
  assert.deepEqual(en.map(f=>f.field),["context","terms","primary_key","unique","foreign_keys"]);
  assert.deepEqual(en.map(f=>f.name),["Context","Terms","Primary key","Unique","Foreign keys"]);
  assert.deepEqual(ko.map(f=>f.name),["컨텍스트","용어","기본 키","고유","외래 키"]);
  assert.equal(en[3].text,"email; code, on some rows only");
  assert.equal(ko[4].text,"buyer_id → buyers (id). 가리키는 행을 지우면 이 행도 지워집니다. shop_id → shops. 가리키는 행을 지우면 거부됩니다.");
  assert.equal(en[4].text,"buyer_id → buyers (id). Deleting the referenced row also deletes this row. shop_id → shops. Deleting the referenced row is refused.");
  for(const f of [...en,...ko])assert.ok(!/[[\]{}"]|primary_key|foreign_keys|on_delete/.test(f.text),f.text);
  const empty=itemFields({context:"",primary_key:[],unique:[],foreign_keys:[],purpose:"  "},"ko");
  assert.deepEqual(empty.map(f=>f.text),["없음","없음","없음","없음","없음"]);
  assert.deepEqual(itemFields(null,"en"),[]);
});

test("names holding the label mark and unknown delete actions stay as written",()=>{
  const [fk]=itemFields({foreign_keys:[{columns:["a · b"],table:"x · y",references:["id"],on_delete:"invented"}]},"en");
  assert.equal(fk.text,"a · b → x · y (id). Deleting the referenced row invented");
  assert.equal(reasonText({kind:"other-context",contexts:["Order · Pay","CTX-002"]},"aggregate-table","en"),"The 01 board puts this term in Order · Pay, and this table is in CTX-002.");
});

test("each discrepancy reason is one sentence, by table or screen",()=>{
  const cases=[
    [{kind:"no-term"},"aggregate-table","ko","이 표에 맞는 01 용어가 없습니다."],
    [{kind:"no-term"},"read-model-screen","en","This screen names no 01 term."],
    [{kind:"not-on-board"},"aggregate-table","en","The 01 board has no such term."],
    [{kind:"other-context",contexts:["CTX-001","CTX-002"]},"read-model-screen","ko","01 보드는 이 용어를 CTX-001에 두고, 이 화면은 CTX-002에 있습니다."],
    [{kind:"other-context"},"aggregate-table","en","The 01 board puts this term in None, and this table is in None."],
    [{kind:"removed",side:"term"},"read-model-screen","en","The 01 board marks this term removed."],
    [{kind:"removed",side:"item"},"aggregate-table","ko","이 표는 지운 것으로 표시되어 있습니다."],
    [{kind:"removed",side:"item"},"read-model-screen","en","This screen is marked removed."],
    [{kind:"no-table"},"aggregate-table","ko","이 애그리거트를 쓰는 05 표가 없습니다."],
    [{kind:"no-screen"},"read-model-screen","en","No 07 screen names this read model."],
    [{kind:"invented-kind"},"aggregate-table","ko","invented-kind"],
  ];
  for(const [reason,compares,lang,expected]of cases)assert.equal(reasonText(reason,compares,lang),expected,JSON.stringify(reason));
});
