import test from "node:test";
import assert from "node:assert/strict";
import {brotliDecompressSync,gunzipSync} from "node:zlib";
import {rememberHTML,takeHTML} from "../src/html-body.js";
import {compressedHTML,MAX_COMPRESSED_HTML} from "../src/html-compression.js";

test("private HTML compresses per response, including HEAD metadata, without caching across responses",async()=>{
 const source="<!doctype html><p>한국어 그림</p>".repeat(2000);
 for(const [header,coding]of[["br,gzip","br"],["br;q=0,gzip;q=1","gzip"],["br;q=0,gzip;q=0",null],["identity;q=1,br;q=.1",null]]){
  const bytes=[];
  for(const method of["GET","HEAD"]){
   const response=rememberHTML(new Response(method==="HEAD"?null:source,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}}),source);
   const encoded=await compressedHTML(new Request("https://example.com/pictures/synthetic/_/05-erd",{method,headers:{"Accept-Encoding":header}}),response);
   assert.equal(encoded.encoding,coding);bytes.push(encoded.body);
   assert.equal((coding==="br"?brotliDecompressSync(encoded.body):coding==="gzip"?gunzipSync(encoded.body):encoded.body).toString(),source);
   assert.equal(takeHTML(response),undefined,"the private string is removed after selecting transport bytes");
   if(method==="HEAD")assert.equal(await response.text(),"");
  }
  assert.deepEqual(bytes[0],bytes[1]);
 }
 const large="x".repeat(MAX_COMPRESSED_HTML+1),response=rememberHTML(new Response(large,{headers:{"Content-Type":"text/html","Cache-Control":"no-store"}}),large);
 assert.equal(await compressedHTML(new Request("https://example.com/",{headers:{"Accept-Encoding":"br"}}),response),null);
 assert.equal((await response.text()).length,large.length,"an oversized document retains its original stream");
});
