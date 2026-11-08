# NEXUS browser build

[한국어](README.ko.md)

The picture view and stage overview use the stage 08 words and stage 09's frozen tokens. The browser-only dependencies in this folder are the explicit exception approved for the editor trial: Excalidraw 0.18.1, ERD Editor 5.1.0 and React/React DOM 18.3.1. The redesign's checkpoint 3 of 2026-11-08 added the font packages `@fontsource/ibm-plex-sans-kr` and `@fontsource/ibm-plex-mono` 5.3.0, for stage 09's IBM Plex Sans KR and IBM Plex Mono. The Worker and hub have no runtime package dependencies. Their package keeps Wrangler as its only development dependency.

## Rebuild

The committed files under `../src/view-code/` run without an npm install or a build tool on the server. To reproduce them:

1. In this folder run `npm ci --ignore-scripts` against the committed lockfile. Do not update the pins.
2. Install **esbuild 0.28.2 in an external scratch folder**, with `npm install --ignore-scripts --save-exact --prefix <scratch> esbuild@0.28.2`. Do not add it to this repository's dependencies.
3. From the repository root, run `node nexus/tools/build-ui.mjs --dependencies <absolute-browser-node_modules> --tool <absolute-scratch-node_modules/esbuild/lib/main.js>`.
4. Run `node nexus/tools/hub-style.mjs --write` to embed the frozen tokens into the product copy. Pair any template change with an upstream hub PR and update the exact hub pin; this command never edits the external checkout.
5. Run the required AGENTS.md checks. Browser agents inspect actual drawings and walk the stage 03 flows before the UI bundle is accepted.

`sizes.json` records each final payload's SHA256, raw/gzip bytes, the canonical module graph and hashes of source inputs. URLs use a digest of the complete graph, so a changed dependency invalidates its importers too. Files are Worker Text modules for JS/CSS and Data modules for WOFF2, delivered only through the Access-checked `/code/` operation. No static assets or CDN are used. After a successful build the script removes only obsolete generated payload filenames in that exact directory; it never recursively deletes a directory.

Build twice with the same pins and compare `sizes.json` and `manifest.js`. Record browser measurements against the actual deployment and exact bundle; a ready flag alone is not evidence that a picture is readable. The prototype's timing result does not accept the completed screens.

## Modifications and licenses

The pinned MIT ERD Viewer has two bounded modifications: fit overview labels inside their rectangles without truncating names, and expose read-only navigation/geometry plus a viewport event. Its closed shadow remains private. Source hashes and patch names are recorded. The viewer is read-only and no layout is persisted or added to the snapshot contract.

Excalidraw's fonts and optional fallback use authenticated same-origin hashed URLs. Its older optional Liberation font is replaced with unmodified Liberation Sans 2.1.5 under OFL 1.1, converted to WOFF2 with external fontTools 4.60.2/brotli 1.1.0. `vendor/liberation-2.1.5.json` pins the source and converted bytes. The older font is not distributed. `../NOTICE` preserves CORTHEX's own notice, the actual bundled package/font notices and generated legal comments; `vendor/license-inventory.json` names the package versions and any provenance limits.

IBM Plex Sans KR (weights 400, 500 and 600) and IBM Plex Mono (400 and 500) come from their @fontsource packages under OFL 1.1. Each package's Unicode-range slices are served unmodified at authenticated same-origin hashed URLs, and one hashed stylesheet, `fonts-css` in the manifest, holds their faces without the WOFF fallback. The view pages hold its link in an inert template and activate it after the first paint, as they do the editor's assets: the first paint waits for no font, the faces swap in as their slices arrive, and a browser fetches only the slices of the characters on its page, once. A refusal page keeps the system fonts, and so does the hub page for now, since its policy allows no font.

The pinned Excalidraw build replaces its upstream hosted Firebase configuration with an empty object. NEXUS's read-only viewer uses no hosted collaboration; the exact input hash and the `excalidraw-no-hosted-firebase` modification are recorded in `sizes.json`. The bundle check refuses a distributed hosted Firebase key.

## Local synthetic browser fixture

`node nexus/test/view-server.mjs` from the repository root prints a loopback address. It uses the actual handler/Store with in-memory SQLite and synthetic Access, then exits when stdin closes. `--keep-open` is for a supervised local browser run. Projects `qa-views`, `qa-views-reply` and `qa-views-overview` are independent synthetic seeds. `/__qa/receipts` reports synthetic write bodies/IDs for effect checks. This test server must never be deployed; no real credentials or repository content are read.

After a source/handler change restart the fixture. Browser payload rebuilds can be picked up without a restart; old modules are retained in the fixture's memory for already open tabs. A final browser run names the frozen source/build hashes and uses a restarted fixture.
