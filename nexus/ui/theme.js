// The page's theme (2026-11-17): the light one unless the user pressed the top bar's switch, which
// marks the page with data-theme="dark" (../src/app.js reads the same choice from its cookie). The
// pictures and editors follow it through this media-query-like object instead of the system's
// prefers-color-scheme.
const root=()=>document.documentElement;
export const isDark=()=>root().dataset.theme==="dark";
export function themeQuery(){
  return{get matches(){return isDark();},addEventListener:(type,listener)=>document.addEventListener("nx-theme",listener),removeEventListener:(type,listener)=>document.removeEventListener("nx-theme",listener)};
}
// The switch: presses show the theme, a press changes it for a year on this browser.
export function startTheme(){
  const show=()=>{for(const button of document.querySelectorAll(".thm"))button.setAttribute("aria-pressed",String(isDark()));};
  for(const button of document.querySelectorAll('[data-nx-wait="theme"]')){button.disabled=false;button.removeAttribute("data-nx-wait");}
  show();
  document.addEventListener("click",event=>{
    const button=event.target instanceof Element?event.target.closest(".thm"):null;
    if(!button||button.disabled)return;
    const dark=!isDark();
    if(dark)root().dataset.theme="dark";else delete root().dataset.theme;
    document.cookie=`nx-theme=${dark?"dark":"light"}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
    show();document.dispatchEvent(new Event("nx-theme"));
  });
}
