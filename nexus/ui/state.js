// Browser-only state and transport. No account/service credentials enter here.
const ALPHABET="0123456789abcdefghjkmnpqrstvwxyz";
const WRITE=/^nw_[0-9a-hjkmnp-tv-z]{12}$/;
export const characters=text=>Array.from(String(text)).length;
export function writeId() {
  const bytes=globalThis.crypto.getRandomValues(new Uint8Array(12));
  return "nw_"+Array.from(bytes,value=>ALPHABET[value&31]).join("");
}
export class NexusProblem extends Error {
  constructor(code,status=0,source={}) {
    super(code);this.name="NexusProblem";
    this.code=/^[a-z][a-z0-9_-]{0,79}$/.test(code)?code:"internal";
    this.status=status;
    for(const key of ["traceId","field","state","why"])if(typeof source?.[key]==="string"&&source[key].length<=120)this[key]=source[key];
    if(Number.isSafeInteger(source?.limit)&&source.limit>=0)this.limit=source.limit;
    // The commit that the project now shows, which a pass refused by snapshot_changed names (SPEC-194).
    if(typeof source?.held_commit==="string"&&/^[0-9a-f]{40}$/.test(source.held_commit))this.held_commit=source.held_commit;
  }
}
export class ApiClient {
  constructor(origin,{fetcher=(...args)=>globalThis.fetch(...args),deadline=30000}={}) {
    const url=new URL(origin);
    if(url.pathname!=="/"||url.search||url.hash||url.username||url.password)throw new Error("Use the page's origin");
    this.origin=url.origin;this.fetcher=fetcher;this.deadline=deadline;
  }
  // A request's JSON answer. A write sends its body with its original ID, but for once: the
  // removal of a project (API-108), which the server does once and answers 404 the second time,
  // goes with neither.
  async call(method,path,{body,write,once=false}={}) {
    return (await this.send(method,path,{body,write,once},response=>response.json())).data;
  }
  // The export (API-178): the file whole, its text as the server wrote it and what it holds,
  // with the reply's Content-Disposition, which the page checks before the browser saves the
  // text (SCR-130). A reply cut on its way is no JSON, and no file is made.
  async file(path) {
    let text="";
    const {data,response}=await this.send("GET",path,{},async response=>{text=await response.text();return JSON.parse(text);});
    return {data,text,disposition:response.headers?.get?.("Content-Disposition")||""};
  }
  async send(method,path,{body,write,once=false},parse) {
    const url=new URL(path,this.origin);
    if(!path.startsWith("/")||path.startsWith("//")||url.origin!==this.origin||url.username||url.password||url.hash)throw new NexusProblem("cross_site",403);
    const headers={Accept:"application/json"},options={method,headers,redirect:"manual",credentials:"same-origin",cache:"no-store"};
    if(method!=="GET"&&method!=="HEAD"&&!(once&&method==="DELETE")) {
      if(!WRITE.test(write||""))throw new Error("A write needs its original ID");
      headers["Content-Type"]="application/json";headers["Idempotency-Key"]=JSON.stringify(write);
      options.body=JSON.stringify(body??{});
    }
    const controller=new AbortController();options.signal=controller.signal;
    let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new NexusProblem("timeout"));},this.deadline);});
    const operation=(async()=>{
      let response;
      try {response=await this.fetcher(url.href,options);}
      catch(error) {if(error instanceof NexusProblem)throw error;throw new NexusProblem(controller.signal.aborted?"timeout":"network");}
      if(response.type==="opaqueredirect"||response.status===401)throw new NexusProblem("sign_in_expired",401);
      if(response.status===429||response.status===503)throw new NexusProblem("busy",response.status);
      let data;
      try {data=method==="HEAD"&&response.ok?null:await parse(response);}
      catch {throw new NexusProblem("internal",response.status);}
      if(!response.ok)throw new NexusProblem(typeof data?.code==="string"?data.code:"internal",response.status,data);
      if(method!=="HEAD"&&(!data||typeof data!=="object"||Array.isArray(data)))throw new NexusProblem("internal",response.status);
      return {data,response};
    })();
    try{return await Promise.race([operation,timeout]);}
    finally{clearTimeout(timer);}
  }
}

export class Drafts {
  constructor({storage=()=>globalThis.localStorage,makeId=writeId}={}) {
    this.storage=storage;this.makeId=makeId;this.memory=new Map();this.storageAvailable=true;
  }
  key(scope) {
    if(typeof scope!=="string"||scope.length>2048)throw new Error("Invalid draft scope");
    return "nexus0.2:"+scope;
  }
  access(method,...args) {
    if(!this.storageAvailable)return null;
    try {return this.storage()?.[method](...args)??null;}
    catch {this.storageAvailable=false;return null;}
  }
  has(scope) {
    const key=this.key(scope);
    if(this.memory.has(key))return true;
    try {const value=JSON.parse(this.access("getItem",key));return typeof value?.text==="string"&&WRITE.test(value.write||"")&&typeof value.settles==="boolean";}
    catch {return false;}
  }
  read(scope) {
    const key=this.key(scope),raw=this.access("getItem",key);
    if(raw!==null)try {
      const value=JSON.parse(raw);
      if(typeof value?.text==="string"&&WRITE.test(value.write||"")&&typeof value.settles==="boolean")this.memory.set(key,{text:value.text,write:value.write,settles:value.settles});
    }catch{/* An unreadable old draft never becomes executable content. */}
    if(!this.memory.has(key))this.memory.set(key,{text:"",settles:false,write:this.makeId()});
    return {...this.memory.get(key)};
  }
  save(scope,value) {
    const key=this.key(scope),safe={text:String(value.text),settles:Boolean(value.settles),write:value.write};
    if(!WRITE.test(safe.write))throw new Error("Invalid draft write ID");
    this.memory.set(key,safe);this.access("setItem",key,JSON.stringify(safe));return {...safe};
  }
  update(scope,{text,settles=false}) {
    const previous=this.read(scope);
    return this.save(scope,{text,settles,write:previous.text===text&&previous.settles===settles?previous.write:this.makeId()});
  }
  ensure(scope){return this.save(scope,this.read(scope));}
  renew(scope){return this.save(scope,{...this.read(scope),write:this.makeId()});}
  clear(scope,expected) {
    if(this.read(scope).write!==expected)return false;
    const key=this.key(scope);this.access("removeItem",key);this.memory.delete(key);return true;
  }
}

export class PendingWrites {
  constructor(){this.active=new Map();this.listeners=new Set();}
  has(scope){return this.active.has(scope);}
  subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
  notify(scope,value){for(const listener of this.listeners)listener(scope,value);}
  run(scope,send) {
    if(this.active.has(scope))return this.active.get(scope);
    const pending=Promise.resolve().then(send).finally(()=>{
      if(this.active.get(scope)===pending){this.active.delete(scope);this.notify(scope,false);}
    });
    this.active.set(scope,pending);this.notify(scope,true);return pending;
  }
}

export class LatestReads {
  constructor(){this.generations=new Map();}
  invalidate(scope){this.generations.set(scope,(this.generations.get(scope)||0)+1);}
  async run(scope,read,apply) {
    this.invalidate(scope);const generation=this.generations.get(scope);
    let value;
    try {value=await read();}
    catch(error){if(this.generations.get(scope)!==generation)return false;throw error;}
    if(this.generations.get(scope)!==generation)return false;
    apply(value);return true;
  }
}
