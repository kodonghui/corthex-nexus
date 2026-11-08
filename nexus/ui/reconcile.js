// How the redesign's pages draw again (stage 08's rules 3 to 8, 15): an element's children
// by their data-nx-key, so that the focus, what the user typed and the messages stay where
// they are. The first page (./home.js) and a stage's middle and side (./stage.js) use it.

// A part as the code compares it: the browser's reading of its markup, without what the
// person changed on it before the code ran, such as a <details> that they opened.
export function markup(html){
  const template=document.createElement("template");template.innerHTML=html;
  for(const open of template.content.querySelectorAll("details[open]"))open.removeAttribute("open");
  return template.innerHTML;
}
// What was drawn for each element that the code compares: the markup of the drawing, not of
// the element, whose times the code writes in the browser's time zone.
const drawn=new WeakMap();
const drawnOf=element=>drawn.get(element)??element.outerHTML;
const attributes=element=>[...element.attributes].map(a=>a.name+"="+a.value).join("\n");
// An element and the elements that it holds and the code compares, with their drawing,
// which holds the same elements in the same order.
function remember(element,drawing){
  const nodes=[drawing,...drawing.querySelectorAll("[data-nx-key]")];
  [element,...element.querySelectorAll("[data-nx-key]")].forEach((node,index)=>{if(nodes[index])drawn.set(node,nodes[index].outerHTML);});
}
// Children by their data-nx-key: kept when drawn the same, compared one by one inside a
// data-nx-sub element, changed in place in a data-nx-live one, and otherwise replaced.
export function reconcile(live,next){
  const old=new Map([...live.children].map(element=>[element.dataset.nxKey,element])),kids=[...next.children];
  kids.forEach((child,index)=>{
    const match=old.get(child.dataset.nxKey),html=child.outerHTML;let use=child;
    if(match&&match.tagName===child.tagName){
      if(drawnOf(match)===html){remember(match,child);use=match;}
      else if(child.hasAttribute("data-nx-live")&&attributes(match)===attributes(child)){if(match.innerHTML!==child.innerHTML)match.innerHTML=child.innerHTML;remember(match,child);use=match;}
      // The drawing as it was before its children moved into the page.
      else if(child.hasAttribute("data-nx-sub")&&attributes(match)===attributes(child)){reconcile(match,child);drawn.set(match,html);use=match;}
    }
    if(use===child)remember(child,child);
    if(live.children[index]!==use)live.insertBefore(use,live.children[index]||null);
    if(match&&match!==use)match.remove();
  });
  while(live.children.length>kids.length)live.lastElementChild.remove();
}
