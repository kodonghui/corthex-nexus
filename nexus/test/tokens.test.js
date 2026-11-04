import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {compileTokens,root} from "../tools/tokens.mjs";
import {styledHub} from "../tools/hub-style.mjs";

test("the generated stylesheet follows the frozen base/theme order without theme gaps",()=>{
  const tokens=compileTokens();
  assert.equal(readFileSync(new URL("../src/hub.html",import.meta.url),"utf8"),styledHub());
  assert.equal(tokens.base.size,46);
  assert.equal(tokens.light.size,78);
  assert.deepEqual([...tokens.light.keys()],[...tokens.dark.keys()]);
  assert.equal(tokens.breakpoint,"1024px");
  assert.equal(readFileSync(resolve(root,"nexus/ui/tokens.css"),"utf8"),tokens.css);
  assert.match(tokens.css,/--nx-color-scrim: rgb\(15 18 22 \/ 0\.32\)/);
  assert.match(tokens.css,/@media \(prefers-color-scheme: dark\)/);
  assert.equal((tokens.css.match(/--nx-size-target:/g)||[]).length,1,"shared dimensions precede the theme override once");
  assert.equal((tokens.css.match(/--nx-color-bg:/g)||[]).length,2,"each color belongs to both explicit themes");
});
