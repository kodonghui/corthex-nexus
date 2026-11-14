// TASK-287: the folds of the workspace's columns (SPEC-210, SCR-111#folded), kept in the
// browser's storage as nothing, folded or shown, and applied on .ws in one step. These tests
// run ../ui/folds.js on a stand-in for .ws and for the storage; the browser suite
// folds-regression.mjs runs the page.
import test from "node:test";
import assert from "node:assert/strict";
import {createFolds,FOLD_KEYS,FOLD_VALUES} from "../ui/folds.js";

// A storage like the browser's, which can refuse to read or to write.
function storage(start={},{read=true,write=true}={}){
  const items=new Map(Object.entries(start)),writes=[];
  return{items,writes,get:()=>({
    getItem:key=>{if(!read)throw new Error("SecurityError");return items.has(key)?items.get(key):null;},
    setItem:(key,value)=>{if(!write)throw new Error("QuotaExceededError");writes.push([key,value]);items.set(key,String(value));},
  })};
}
const ws=()=>({dataset:{}});

test("the folds keep three values for the device, under the redesign's keys",()=>{
  assert.deepEqual(FOLD_KEYS,{stages:"nexus0.3:fold-stages",talk:"nexus0.3:fold-talk"});
  assert.deepEqual(FOLD_VALUES,["folded","shown"]);
});

test("nothing kept is a first visit: nothing on .ws, so that the stylesheet decides by the width",()=>{
  const place=ws(),folds=createFolds(place,{storage:storage().get});
  folds.apply();
  assert.deepEqual(place.dataset,{});
  assert.equal(folds.value("stages"),null);assert.equal(folds.value("talk"),null);
});

test("kept values are applied in one step: a folded list, and the talk folded or shown",()=>{
  const place=ws(),kept=storage({[FOLD_KEYS.stages]:"folded",[FOLD_KEYS.talk]:"shown"});
  createFolds(place,{storage:kept.get}).apply();
  assert.deepEqual(place.dataset,{nxStages:"folded",nxTalk:"shown"});
  const other=ws();createFolds(other,{storage:storage({[FOLD_KEYS.stages]:"shown",[FOLD_KEYS.talk]:"folded"}).get}).apply();
  assert.deepEqual(other.dataset,{nxTalk:"folded"},"a list kept shown shows as on a first visit");
});

test("a value that is not one of the three counts as nothing",()=>{
  for(const odd of["yes","FOLDED","","{}","shown "]){
    const place=ws(),folds=createFolds(place,{storage:storage({[FOLD_KEYS.stages]:odd,[FOLD_KEYS.talk]:odd}).get});
    folds.apply();
    assert.deepEqual(place.dataset,{},odd);
  }
});

test("folding and showing write the storage and change .ws at once",()=>{
  const place=ws(),kept=storage(),folds=createFolds(place,{storage:kept.get});
  folds.apply();
  folds.keep("stages","folded");folds.keep("talk","folded");
  assert.deepEqual(place.dataset,{nxStages:"folded",nxTalk:"folded"});
  folds.keep("stages","shown");folds.keep("talk","shown");
  assert.deepEqual(place.dataset,{nxTalk:"shown"});
  assert.deepEqual(kept.writes,[[FOLD_KEYS.stages,"folded"],[FOLD_KEYS.talk,"folded"],[FOLD_KEYS.stages,"shown"],[FOLD_KEYS.talk,"shown"]]);
  // Another page reads what this one kept: the folds are the device's, not a project's.
  const next=ws();createFolds(next,{storage:kept.get}).apply();
  assert.deepEqual(next.dataset,{nxTalk:"shown"});
  folds.keep("talk","open");folds.keep("width","folded");
  assert.equal(kept.writes.length,4,"nothing else is kept");
});

test("storage that cannot be read shows a first visit, and a fold lasts for the visit",()=>{
  const place=ws(),kept=storage({[FOLD_KEYS.talk]:"folded"},{read:false,write:false}),folds=createFolds(place,{storage:kept.get});
  folds.apply();
  assert.deepEqual(place.dataset,{},"as on a first visit");
  folds.keep("talk","folded");folds.keep("stages","folded");
  assert.deepEqual(place.dataset,{nxStages:"folded",nxTalk:"folded"},"the fold holds on the page");
  assert.equal(folds.value("talk"),"folded");
  const next=ws();createFolds(next,{storage:kept.get}).apply();
  assert.deepEqual(next.dataset,{},"and is gone with the visit");
  const none=ws();const missing=createFolds(none,{storage:()=>undefined});missing.apply();missing.keep("talk","folded");
  assert.deepEqual(none.dataset,{nxTalk:"folded"},"a browser without storage folds for the visit too");
});

test("storage that reads but cannot be written keeps the fold for the visit",()=>{
  const place=ws(),kept=storage({[FOLD_KEYS.talk]:"shown"},{write:false}),folds=createFolds(place,{storage:kept.get});
  folds.apply();
  assert.deepEqual(place.dataset,{nxTalk:"shown"});
  folds.keep("talk","folded");
  assert.deepEqual(place.dataset,{nxTalk:"folded"});
  assert.equal(kept.items.get(FOLD_KEYS.talk),"shown","the storage keeps what it held");
});
