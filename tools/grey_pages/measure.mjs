/**
 * TASK-285: the grey pages, measured in a browser by hand. The builder runs it after drawing a page again, with a
 * Chrome that it has; no test and no dependency of the repository names it. Node 24 built-ins only, and an owned
 * headless Chrome over the DevTools protocol, as nexus/test's regressions run it. The pages are local files: the
 * browser reaches no network, and nothing is written into the checkout.
 *
 *   NEXUS_CHROME=/absolute/path/to/chrome node tools/grey_pages/measure.mjs [page.html ...]
 *
 * With no page, it measures docs/08-screens/nexus/revision-wireframes.html and
 * docs/09-mockup/nexus/picture-stage-views.html. For each page:
 * - the page runs: at widths of 320, 390, 1,280 and 1,440 pixels, in light and dark mode and in English and Korean,
 *   the page does not scroll sideways, shows the language that was picked and the console shows no error;
 * - the frames: each frame at its own size, in English and in Korean, has no element that leaves the frame sideways
 *   or that a column of the frame cuts, and no word wider than its button, tag or tab. A picture's canvas may cut
 *   what it holds, as a picture larger than its view does.
 * It prints each problem and the counts, and exits 1 when it finds a problem.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createBrowserRun} from '../../nexus/test/owned-browser.mjs';

if (Number(process.versions.node.split('.')[0]) < 24) throw Error('Node 24 or newer is required');
const chrome = process.env.NEXUS_CHROME;
if (!chrome || !path.isAbsolute(chrome)) throw Error('NEXUS_CHROME must be an absolute installed executable path');
await fs.access(chrome);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pages = (process.argv.slice(2).length ? process.argv.slice(2) : [
  'docs/08-screens/nexus/revision-wireframes.html',
  'docs/09-mockup/nexus/picture-stage-views.html',
]).map(page => path.resolve(page));
for (const page of pages) await fs.access(page);

// What the page itself says when it runs: whether it scrolls sideways and which language it shows.
const PAGE = `(() => ({sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  lang: document.documentElement.lang}))()`;
// Each frame at its own size: elements that leave the frame or that a column cuts, and words wider than their control.
const FRAMES = `(() => {
  const found = [];
  const clips = element => getComputedStyle(element).overflowX !== 'visible';
  const shown = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  const label = element => (element.innerText || '').trim().slice(0, 60) || element.tagName.toLowerCase() + '.' + [...element.classList].join('.');
  const frames = [...document.querySelectorAll('.wf')].filter(shown);
  for (const frame of frames) {
    const name = (frame.getAttribute('aria-label') || frame.dataset.state || 'a frame');
    for (const element of frame.querySelectorAll('*')) {
      if (!shown(element)) continue;
      let clipper = element.parentElement;
      while (clipper !== frame && !clips(clipper)) clipper = clipper.parentElement;
      if (!clipper.matches('.pc, .pc *')) {
        const box = element.getBoundingClientRect(), edge = clipper.getBoundingClientRect();
        if (box.width && (box.left < edge.left - 1 || box.right > edge.right + 1)) {
          found.push({frame: name, problem: clipper === frame ? 'leaves its frame' : 'cut by its column',
            element: label(element), by: Math.round(Math.max(edge.left - box.left, box.right - edge.right))});
        }
      }
      if (element.matches('.bt, .tag, .tab') && element.scrollWidth > element.clientWidth + 1) {
        found.push({frame: name, problem: 'a word wider than its control', element: label(element),
          by: element.scrollWidth - element.clientWidth});
      }
    }
  }
  return {frames: frames.length, found};
})()`;

const artifactBase = path.join(tmpdir(), 'nexus-grey-pages');
await fs.mkdir(artifactBase, {recursive: true});
const browser = await createBrowserRun(artifactBase, 'measure-');
const pending = new Map(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws, session, seq = 0, errors = [];
function command(method, params = {}, scoped = true) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error('DevTools timeout: ' + method)); }, 30000);
    pending.set(id, {resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); }});
    ws.send(JSON.stringify({id, method, params, ...(scoped ? {sessionId: session} : {})}));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}
async function open(page, {width, scheme, language}) {
  await command('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 1, mobile: false});
  await command('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: scheme}]});
  await command('Page.navigate', {url: 'about:blank'});
  errors = [];
  await command('Page.navigate', {url: pathToFileURL(page).href});
  for (let n = 0; n < 200 && await evaluate('document.readyState') !== 'complete'; n++) await sleep(25);
  await evaluate(`document.querySelector('[data-set-lang="${language}"]').click()`);
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}

let problems = 0;
try {
  browser.launch(chrome, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions',
    '--host-resolver-rules=MAP * ~NOTFOUND', 'about:blank'], {PATH: process.env.PATH || '', HOME: browser.folder});
  let endpoint;
  for (let n = 0; n < 100 && !endpoint; n++) {
    try { endpoint = (await fs.readFile(path.join(browser.profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n'); }
    catch { await sleep(100); }
  }
  if (!endpoint) throw Error('The owned Chrome did not publish its DevTools endpoint');
  ws = new WebSocket('ws://127.0.0.1:' + endpoint[0] + endpoint[1]);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = message => {
    const m = JSON.parse(message.data);
    if (m.id) {
      const call = pending.get(m.id); pending.delete(m.id);
      if (call) m.error ? call.reject(Error(JSON.stringify(m.error))) : call.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map(arg => arg.value ?? arg.description).join(' '));
    } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      errors.push(m.params.entry.text);
    }
  };
  const tab = await command('Target.createTarget', {url: 'about:blank'}, false);
  session = (await command('Target.attachToTarget', {targetId: tab.targetId, flatten: true}, false)).sessionId;
  await command('Page.enable'); await command('Runtime.enable'); await command('Log.enable');
  for (const page of pages) {
    const name = path.relative(root, page);
    let runs = 0, measured = 0, found = 0;
    for (const width of [320, 390, 1280, 1440]) for (const scheme of ['light', 'dark']) for (const language of ['en', 'ko']) {
      await open(page, {width, scheme, language});
      const seen = await evaluate(PAGE);
      runs++;
      if (seen.sideways || seen.lang !== language || errors.length) {
        found++;
        console.log('PROBLEM', name, width, scheme, language, JSON.stringify({...seen, errors: errors.slice(0, 2)}));
      }
    }
    for (const language of ['en', 'ko']) {
      await open(page, {width: 1440, scheme: 'light', language});
      await evaluate(`document.querySelectorAll('.vp').forEach(vp => vp.classList.add('actual')); dispatchEvent(new Event('resize'))`);
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      const seen = await evaluate(FRAMES);
      measured += seen.frames;
      for (const problem of seen.found) {
        found++;
        console.log('PROBLEM', name, language, JSON.stringify(problem));
      }
    }
    problems += found;
    console.log(`${name}: ${runs} runs of the page and ${measured} measurements of frames, ${found} problems`);
  }
} finally {
  try { ws?.close(); } catch {}
  await browser.stop();
  await browser.removeProfile();
  await fs.rm(browser.folder, {recursive: true, force: true});
}
process.exitCode = problems ? 1 : 0;
