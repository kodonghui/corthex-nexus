// Node transport only. Compress private HTML before it enters the Tunnel.
import {brotliCompress,gzip,constants} from "node:zlib";
import {promisify} from "node:util";
import {acceptedCoding} from "./code-compression.js";
import {takeHTML} from "./html-body.js";
const br=promisify(brotliCompress),gz=promisify(gzip);
export const MAX_COMPRESSED_HTML=8*1024*1024;
export async function compressedHTML(request,response){
  const source=takeHTML(response);
  if(typeof source!=="string"||response.status!==200||!["GET","HEAD"].includes(request.method)||response.headers.get("Cache-Control")!=="no-store"||!/^text\/html(?:;|$)/.test(response.headers.get("Content-Type")||""))return null;
  const length=Buffer.byteLength(source);
  // Large documents retain streaming; never make an extra unbounded byte copy.
  if(length>MAX_COMPRESSED_HTML)return null;
  const bytes=Buffer.from(source),encoding=length>=1024?acceptedCoding(request.headers.get("Accept-Encoding")):null;
  const body=encoding==="br"?await br(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:4}}):encoding==="gzip"?await gz(bytes,{level:4}):bytes;
  return{encoding,body};
}
