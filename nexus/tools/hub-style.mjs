import{readFileSync,writeFileSync}from"node:fs";
import{fileURLToPath}from"node:url";
import{compileTokens}from"./tokens.mjs";
// The hub template is owned upstream. Styling this product's copy never edits
// a pinned external checkout; equality is checked by the Python bridge suite.
const copy=new URL("../src/hub.html",import.meta.url),source=copy;
export function styledHub(){const current=readFileSync(source,"utf8"),style=compileTokens().css+"\n"+readFileSync(new URL("../ui/hub.css",import.meta.url),"utf8");if(current.split("<style>").length!==2||current.split("</style>").length!==2)throw new Error("Hub style anchor changed");return current.replace(/<style>[\s\S]*?<\/style>/,"<style>\n"+style+"\n</style>");}
if(process.argv[1]===fileURLToPath(import.meta.url)){const generated=styledHub();if(process.argv.includes("--write")){writeFileSync(copy,generated);}else if(readFileSync(copy,"utf8")!==generated)throw new Error("Regenerate the frozen-token hub stylesheet; pair changes with an upstream template PR");}
