// The search's code (SCR-116, SPEC-152), on every page of the redesign: the top bar's field asks
// the server for every project's items (API-156) from two characters, once the typing pauses for
// 250 milliseconds, and drops an answer to older words than the field holds; the matches show in
// a panel under the field, which the arrow keys, Enter, Escape and a press outside it work; a
// match opens its item at its place (SPEC-149); the words go into the page's address as q=, so
// that a search can be linked. Under 1,024 pixels the search button opens the field over the top
// bar, with Close, and the matches fill the screen under it. It draws with the server's own
// functions (../src/draw/search.js), and the page's code (./home.js, ./stage.js) starts it.
import {drawSearch,matchPath,SEARCH_MIN,SEARCH_MAX} from "../src/draw/search.js";
import {LatestReads,characters} from "./state.js";

export const SEARCH_WAIT=250;
const REFUSED=Object.freeze(["sign_in_expired","access_missing","access_other_app"]);
const readable=answer=>Boolean(answer&&Array.isArray(answer.matches)&&Number.isFinite(Number(answer.total)));

// lang: the page's language; api: the page's ApiClient; address(q): the page's address with the
// words, or without them for "".
export function createSearch({lang,api,address=()=>{}}){
  const top=document.querySelector('[data-nx-part="top"]'),wrap=top?.querySelector(".fw"),input=wrap?.querySelector('input[name="q"]');
  if(!top||!wrap||!input)return null;
  // The panel under the field, the phone's search button and Close, and the page behind the
  // matches, dimmed from 1,024 pixels (stage 09's drawing), as the server draws them (rule 15).
  const panel=wrap.querySelector(".spanel"),button=top.querySelector(".sbtn"),close=top.querySelector(".sclose"),dim=top.querySelector(".sdim");
  if(!panel||!close||!dim)return null;
  const reads=new LatestReads(),st={state:"closed",q:"",matches:[],total:0,active:-1,error:null};
  let timer=0,open=false;
  const [status,list,foot,pad]=[panel.querySelector(".st"),panel.querySelector(".ms"),panel.querySelector(".foot"),panel.querySelector(".pad")];

  function draw(){
    const drawn=drawSearch(st,lang);
    status.innerHTML=drawn.status;status.parentElement.hidden=!drawn.status;
    list.innerHTML=drawn.rows;list.hidden=!drawn.rows;
    foot.innerHTML=drawn.foot;foot.hidden=!drawn.foot;
    pad.innerHTML=drawn.pad;pad.hidden=!drawn.pad;
    const shown=open&&st.state!=="closed";
    panel.hidden=!shown;dim.hidden=!shown;
    input.setAttribute("aria-expanded",String(shown&&Boolean(drawn.rows)));
    if(st.active>=0&&drawn.rows){input.setAttribute("aria-activedescendant","sm-"+st.active);list.querySelector("#sm-"+st.active)?.scrollIntoView({block:"nearest"});}
    else input.removeAttribute("aria-activedescendant");
  }
  function show(){open=true;draw();}
  // The matches close without a mark, which the arrow keys set again.
  function hide(){open=false;st.active=-1;draw();}

  // The words: from two characters to 200, the spaces at their ends left out (SCR-116's Input).
  const wordsOf=()=>input.value.trim().slice(0,SEARCH_MAX);
  async function run(q){
    clearTimeout(timer);
    if(characters(q)<SEARCH_MIN)return;
    st.q=q;st.state="loading";st.error=null;show();
    address(q);
    try{
      await reads.run("search",()=>api.call("GET","/api/search?q="+encodeURIComponent(q)),answer=>{
        if(!readable(answer))throw new Error("Unreadable answer");
        // An answer to older words than the field holds waits for the newer ones.
        if(wordsOf()!==q)return;
        st.matches=answer.matches;st.total=Number(answer.total);st.active=-1;st.state=answer.matches.length?"ready":"empty";
      });
    }catch(error){
      if(wordsOf()!==q)return;
      const code=error?.code||"internal";
      st.state=REFUSED.includes(code)?"refused":"failed";st.error={code,trace:error?.traceId};
    }
    draw();
  }
  function typed(){
    clearTimeout(timer);
    const q=wordsOf(),n=characters(q);
    if(!n){reads.invalidate("search");st.state="closed";st.matches=[];st.active=-1;address("");hide();return;}
    if(n<SEARCH_MIN){reads.invalidate("search");st.state="short";st.active=-1;show();return;}
    timer=setTimeout(()=>run(q),SEARCH_WAIT);
  }
  // A match: its item at its place, a step of the browser's history.
  function go(match){
    if(!match)return;
    const target=new URL(matchPath(match),location.origin);
    hide();phone(false);
    if(target.pathname===location.pathname)location.hash=target.hash;
    else location.assign(target.pathname+target.hash);
  }
  // The field over the phone's top bar, with the keyboard; Close returns to the page.
  function phone(on){
    if(on){top.dataset.nxSearch="open";input.focus();if(st.state!=="closed")show();return;}
    if(top.dataset.nxSearch!=="open")return;
    delete top.dataset.nxSearch;hide();
  }

  input.addEventListener("input",typed);
  input.addEventListener("focus",()=>{if(st.state!=="closed")show();});
  input.addEventListener("keydown",event=>{
    const n=st.state==="ready"||st.state==="loading"?st.matches.length:0,shown=open&&n>0;
    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
      if(st.state==="closed")return;
      event.preventDefault();
      // Closed matches open with the first marked, or the last for Up, as WAI-ARIA's combobox
      // pattern has it; open ones move the mark and wrap.
      if(!open){if(n)st.active=event.key==="ArrowDown"?0:n-1;show();return;}
      if(!n)return;
      st.active=event.key==="ArrowDown"?(st.active+1)%n:(st.active<=0?n-1:st.active-1);draw();
    }else if(event.key==="Enter"){
      event.preventDefault();
      if(shown&&st.active>=0)go(st.matches[st.active]);
      else if(characters(wordsOf())>=SEARCH_MIN)run(wordsOf());
    }else if(event.key==="Escape"){
      // The matches close, and the words stay; then the phone's field closes.
      if(open&&st.state!=="closed"){event.preventDefault();event.stopPropagation();hide();}
      else if(top.dataset.nxSearch==="open"){event.preventDefault();event.stopPropagation();phone(false);button?.focus();}
    }
  });
  panel.addEventListener("click",event=>{
    const row=event.target.closest?.("[data-nx-match]");
    if(row){go(st.matches[Number(row.dataset.nxMatch)]);return;}
    const act=event.target.closest?.("[data-nx-search-act]")?.dataset.nxSearchAct;
    if(act==="retry")run(st.q||wordsOf());
    else if(act==="sign-in")location.reload();
  });
  // A press outside the field and its matches closes them; the words stay. It listens before
  // the press does its own work, so that a press that opens the search, such as "Search all
  // projects for {id}", leaves it open.
  document.addEventListener("click",event=>{
    if(!open||wrap.contains(event.target)||close.contains(event.target)||button?.contains(event.target))return;
    hide();
  },true);
  close.addEventListener("click",()=>{phone(false);button?.focus();});
  button?.addEventListener("click",()=>phone(true));

  // The field and the phone's button work from here on (rule 15).
  for(const control of [input,button,close])if(control){control.disabled=false;control.removeAttribute("data-nx-wait");}
  return{
    // The search with these words at once, as #q= or "Search all projects for {id}" asks.
    openWith(q){
      const text=String(q??"").trim().slice(0,SEARCH_MAX);if(!text)return;
      input.value=text;
      if(matchMedia("(max-width:1023.98px)").matches)phone(true);else input.focus();
      if(characters(text)<SEARCH_MIN){st.state="short";show();return;}
      run(text);
    },
    state:()=>({...st,open}),
  };
}
