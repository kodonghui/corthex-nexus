import test from "node:test";
import assert from "node:assert/strict";
import {cameraZoom,zoomCamera,fitCamera} from "../ui/camera.js";

test("the observed ERD fractional fit and above-100-percent zoom remain representable at handoff",()=>{
  assert.equal(cameraZoom("05-erd",.25485714285714284),.25);
  assert.equal(cameraZoom("05-erd",1.25),1.25);
  assert.equal(cameraZoom("05-erd",5),1.5);
  assert.equal(cameraZoom("05-erd",.01),.1);
  const fit=fitCamera({x:0,y:0,width:875,height:400},"05-erd",271,600,true);
  assert.deepEqual(fit,{x:26.125,y:250,zoom:.25});
});

test("quantized and bounded zoom preserves the world point under the frame center",()=>{
  const before={x:-34.75,y:197.75,zoom:.25485714285714284},width=271,height=600;
  for(const requested of[before.zoom,1.25,5,.01]){
    const after=zoomCamera(before,"05-erd",requested,width,height);
    for(const [size,axis]of[[width,"x"],[height,"y"]])assert.ok(Math.abs((size/2-before[axis])/before.zoom-(size/2-after[axis])/after.zoom)<1e-9);
  }
  const ready={x:165.5,y:197.75,zoom:1.25};
  assert.deepEqual(zoomCamera(ready,"05-erd",ready.zoom,600,800),ready);
});

test("DDD and sitemap keep their existing zoom range and precision",()=>{
  for(const stage of["01-domain","07-sitemap"]){
    assert.equal(cameraZoom(stage,.25485714285714284),.25485714285714284);
    assert.equal(cameraZoom(stage,5),5);
    assert.equal(cameraZoom(stage,6),5);
  }
});
