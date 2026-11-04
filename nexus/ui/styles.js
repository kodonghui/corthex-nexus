// A failed stylesheet must leave the static page or accessible picture list.
const pendingStyles=new WeakMap();
export function stylesheetReady(role,{required=false,href="",deadline=30000}={}){
  let link=document.querySelector('link[data-nexus-css="'+role+'"]'),created=false;
  if(!link&&href){const url=new URL(href,location.origin);if(url.origin!==location.origin||!/^\/code\/[a-z0-9-]+\.[0-9a-f]{8}\.css$/.test(url.pathname))return Promise.resolve(false);link=document.createElement("link");link.rel="stylesheet";link.href=url.href;link.dataset.nexusCss=role;document.head.append(link);created=true;}
  if(!link)return Promise.resolve(!required);
  const usable=()=>{try{return Boolean(link.sheet&&!link.disabled&&link.sheet.cssRules.length);}catch{return false;}};
  if(usable())return Promise.resolve(true);
  if(pendingStyles.has(link))return pendingStyles.get(link);
  if(document.readyState==="complete"&&!created)return Promise.resolve(false);
  const waiting=new Promise(resolve=>{
    const finish=value=>{clearTimeout(timer);link.removeEventListener("load",loaded);link.removeEventListener("error",failed);window.removeEventListener("load",finished);pendingStyles.delete(link);resolve(value);};
    const loaded=()=>finish(usable()),failed=()=>finish(false),finished=()=>finish(usable());
    const timer=setTimeout(failed,deadline);
    link.addEventListener("load",loaded,{once:true});link.addEventListener("error",failed,{once:true});window.addEventListener("load",finished,{once:true});
  });
  pendingStyles.set(link,waiting);return waiting;
}
