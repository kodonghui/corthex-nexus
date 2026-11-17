import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {compileTokens,root} from "../tools/tokens.mjs";
import {styledHub} from "../tools/hub-style.mjs";

test("the generated stylesheet follows the frozen base/theme order without theme gaps",()=>{
  const tokens=compileTokens();
  assert.equal(readFileSync(new URL("../src/hub.html",import.meta.url),"utf8"),styledHub());
  assert.equal(tokens.base.size,50);
  assert.equal(tokens.light.size,83);
  assert.deepEqual([...tokens.light.keys()],[...tokens.dark.keys()]);
  assert.equal(tokens.breakpoint,"1024px");
  assert.equal(readFileSync(resolve(root,"nexus/ui/tokens.css"),"utf8"),tokens.css);
  assert.match(tokens.css,/--nx-color-scrim: rgb\(29 27 23 \/ 0\.32\)/);
  // The light theme is the default; the dark one only on the user's choice (2026-11-17).
  assert.doesNotMatch(tokens.css,/prefers-color-scheme/);
  assert.match(tokens.css,/:root \{\n  color-scheme: light;\n/);assert.match(tokens.css,/:root\[data-theme="dark"\] \{\n  color-scheme: dark;\n/);
  assert.equal((tokens.css.match(/--nx-size-target:/g)||[]).length,1,"shared dimensions precede the theme override once");
  assert.equal((tokens.css.match(/--nx-color-bg:/g)||[]).length,2,"each color belongs to both explicit themes");
});
