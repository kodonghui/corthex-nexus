import { readFileSync } from "node:fs";
import { rebuildHeaders, sha256 } from "./rebuild-http.js";

const design = new URL("../../design/rebuild/", import.meta.url);
const tokens = (path) => JSON.parse(readFileSync(new URL(path, design), "utf8"));

function cssValues(groups) {
  return Object.entries(groups).flatMap(([group, entries]) => Object.entries(entries).map(([name, token]) => {
    const value = token.$value;
    const css = token.$type === "color" ? `rgb(${value.components.map((v) => Math.round(v * 255)).join(" ")})`
      : token.$type === "dimension" || token.$type === "duration" ? `${value.value}${value.unit}`
        : token.$type === "fontFamily" ? value.map((font) => /\s/.test(font) ? JSON.stringify(font) : font).join(",")
          : token.$type === "cubicBezier" ? `cubic-bezier(${value.join(",")})` : null;
    if (css === null) throw new Error("Unsupported rebuild token type");
    return `--${group}-${name}:${css};`;
  })).join("");
}

const styles = `:root{color-scheme:light;${cssValues(tokens("base.tokens.json"))}${cssValues(tokens("theme/light.tokens.json"))}}` +
  `:root[data-theme=dark]{color-scheme:dark;${cssValues(tokens("theme/dark.tokens.json"))}}` +
  readFileSync(new URL("./rebuild-assets/shell.css", import.meta.url), "utf8");
const script = readFileSync(new URL("./rebuild-assets/shell.js", import.meta.url), "utf8");
const cssPath = `/assets/rebuild-${sha256(styles).slice(0, 20)}.css`;
const jsPath = `/assets/rebuild-${sha256(script).slice(0, 20)}.js`;
const assets = new Map([[cssPath, ["text/css; charset=utf-8", styles]], [jsPath, ["text/javascript; charset=utf-8", script]]]);

const copy = {
  ko: {
    title: "산출물을 보고, 함께 묻고, 직접 결정하세요.", intro: "아이디어부터 발표까지 13단계. 산출물을 살펴보고, 항목에 대해 AI와 대화하고, 검토한 버전의 체크포인트를 통과시키세요.",
    signIn: "로그인하고 시작하기", continue: "프로젝트 열기", signOut: "로그아웃", sample: "샘플 먼저 보기", private: "프로젝트는 본인만 볼 수 있습니다.",
    flow: "한 프로젝트의 흐름", steps: [["도메인 탐색", "그림으로 검토"], ["PRD", "항목에 질문"], ["유저 플로우", "사용자가 결정"]],
    features: [["산출물을 그림으로 검토", "도메인, 플로우, ERD, 사이트맵을 원본과 함께 봅니다."], ["항목에 질문", "어떤 항목의 어떤 버전을 두고 대화했는지 확인합니다."], ["체크포인트 결정", "검토할 버전을 확인한 사용자가 직접 통과시킵니다."]],
    projects: "프로젝트", connect: "프로젝트 연결", search: "프로젝트 검색", createIntro: "검토할 GitHub 저장소를 연결합니다.",
    projectsIntro: "각 프로젝트에서 검토하던 단계를 이어서 확인하세요.", name: "프로젝트 이름", slug: "프로젝트 ID", repo: "GitHub 저장소 주소", branch: "기본 브랜치", more: "더 보기",
    versions: "버전 이력", publications: "게시 상태", credentials: "게시 자격 증명", preview: "목업 미리 보기",
    cancel: "취소", sampleTitle: "공개 샘플", sampleIntro: "샘플 원본과 항목을 확인하세요.", workspace: "단계 검토", stage: "단계", skip: "본문으로 이동", theme: "다크 테마", loading: "불러오는 중입니다.",
  },
  en: {
    title: "See the work. Ask together. Decide yourself.", intro: "Thirteen stages from discovery to presentation. See each artifact, ask an AI about its items, and pass the checkpoint for the version you reviewed.",
    signIn: "Sign in to start", continue: "Open projects", signOut: "Sign out", sample: "Explore the sample", private: "Your projects are private to your account.",
    flow: "One project, step by step", steps: [["Domain discovery", "Review a diagram"], ["PRD", "Ask about an item"], ["User flow", "Make the decision"]],
    features: [["Review work visually", "See the domain, flows, ERD and sitemap alongside the source."], ["Ask about an item", "Keep each conversation with the item and version it concerns."], ["Decide on a checkpoint", "Pass a checkpoint yourself after reviewing its version."]],
    projects: "Projects", connect: "Connect project", search: "Search projects", createIntro: "Connect the GitHub repository you want to review.",
    projectsIntro: "Pick up where you left off in each project.", name: "Project title", slug: "Project ID", repo: "GitHub repository URL", branch: "Default branch", more: "Load more",
    versions: "Version history", publications: "Publications", credentials: "Publication credentials", preview: "Preview mockup",
    cancel: "Cancel", sampleTitle: "Public sample", sampleIntro: "Review the sample source and its items.", workspace: "Review stage", stage: "Stage", skip: "Skip to content", theme: "Dark theme", loading: "Loading…",
  },
};

function welcome(t) {
  return `<section class="hero"><div class="stack"><p class="eyebrow">NEXUS / PROJECT REVIEW</p><h1>${t.title}</h1>
    <p class="hero-copy">${t.intro}</p><div class="row"><button type="button" class="primary" id="sign-in">${t.signIn}</button>
    <a class="button" href="/projects" id="continue" hidden>${t.continue}</a><a class="button" href="/learn/sample">${t.sample}</a></div>
    <p class="small muted">${t.private}</p></div><div class="hero-art stack"><h2>${t.flow}</h2>${t.steps.map(([label, note], i) =>
      `<div class="mini-stage"><span class="mono">0${i + 1}</span><strong>${label}</strong><span class="badge">${note}</span></div>`).join("")}</div></section>
    <section class="features">${t.features.map(([title, detail]) => `<article><h2>${title}</h2><p class="muted">${detail}</p></article>`).join("")}</section>`;
}

function projects(t) {
  return `<div class="page-heading row between"><div><h1>${t.projects}</h1><p class="muted">${t.projectsIntro}</p></div>
    <a class="button primary" href="/projects/new">${t.connect}</a></div><div class="stack" id="private-content" hidden>
    <label class="narrow" for="project-search">${t.search}<input id="project-search" type="search" autocomplete="off"></label>
    <div class="cards" id="project-list"></div><p class="muted" id="project-empty" hidden></p>
    <button type="button" id="more-projects" hidden>${t.more}</button></div>`;
}

function connect(t) {
  return `<div class="page-heading"><h1>${t.connect}</h1><p class="muted">${t.createIntro}</p></div><form class="panel narrow stack" id="private-content" hidden>
    <label for="project-title">${t.name}<input id="project-title" name="title" required maxlength="120"></label>
    <label for="project-slug">${t.slug}<input id="project-slug" name="slug" inputmode="text" required minlength="3" maxlength="64" pattern="[a-z0-9][a-z0-9\\-]{1,62}[a-z0-9]"></label>
    <label for="project-repo">${t.repo}<input id="project-repo" name="repository_url" type="url" required maxlength="2048" placeholder="https://github.com/owner/repository"></label>
    <label for="project-branch">${t.branch}<input id="project-branch" name="default_branch" required maxlength="255" value="main"></label>
    <div class="row"><button class="primary" type="submit">${t.connect}</button><a class="button" href="/projects">${t.cancel}</a></div></form>`;
}

function workspace(t) {
  return `<div class="page-heading"><h1 id="workspace-title">${t.workspace}</h1>
    <nav class="row workspace-actions" aria-label="${t.workspace}"><a id="versions-link" hidden>${t.versions}</a>
      <a id="publications-link" hidden>${t.publications}</a><a id="credentials-link" hidden>${t.credentials}</a></nav></div>
    <div id="private-content" class="workspace" hidden>
    <nav aria-label="${t.stage}"><select id="part-picker" aria-label="Part" hidden></select><ul class="stage-list" id="stage-list"></ul></nav>
    <section class="panel stack"><h2 id="stage-title"></h2><p id="stage-state" role="status"></p><ul id="stage-blockers"></ul>
      <div class="row"><a class="button" id="provenance-link" hidden></a><a class="button" id="preview-link" hidden>${t.preview}</a></div>
      <div id="artifact-graph" class="artifact-graph" hidden></div><ul id="artifact-items" class="review-items"></ul>
      <button type="button" id="more-items" hidden>${t.more}</button><section id="artifact-detail" hidden></section></section></div>`;
}

function reviewPage(t, page) {
  return `<div class="page-heading row between"><h1>${t[page]}</h1><a id="back-project" href="/projects" class="button">${t.projects}</a></div>
    <section id="private-content" class="panel stack" hidden></section>`;
}

function sample(t) {
  return `<div class="page-heading"><h1>${t.sampleTitle}</h1><p class="muted">${t.sampleIntro}</p></div><section class="panel stack" id="sample-content" aria-busy="true"></section>`;
}

const pages = new Map([["/", ["welcome", welcome]], ["/projects", ["projects", projects]], ["/projects/new", ["connect", connect]],
  ["/learn/sample", ["sample", sample]]]);
const projectPages = [
  [/^\/p\/[A-Za-z0-9_-]{3,80}\/versions$/, "versions"],
  [/^\/p\/[A-Za-z0-9_-]{3,80}\/publications$/, "publications"],
  [/^\/p\/[A-Za-z0-9_-]{3,80}\/settings\/credentials$/, "credentials"],
  [/^\/p\/[A-Za-z0-9_-]{3,80}\/preview\/[A-Za-z0-9_-]{3,80}$/, "preview"],
];
const workspacePath = /^\/p\/[A-Za-z0-9_-]{3,80}\/[^/]+\/[0-9]{2}-[a-z-]+(?:\/items\/[^/]+)?$/;
const csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'";
// srcdoc inherits this policy. The child also receives the stricter fixed
// meta policy and opaque sandbox, while the parent denies frame navigation.
const previewCSP = csp.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
  .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'").replace("img-src 'self'", "img-src 'self' data:; font-src data:");


export function rebuildView(request, language) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const asset = assets.get(url.pathname);
  if (asset) {
    const headers = rebuildHeaders({ "Content-Type": asset[0] });
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return new Response(request.method === "HEAD" ? null : asset[1], { headers });
  }
  const projectPage = projectPages.find(([match]) => match.test(url.pathname))?.[1];
  const selected = pages.get(url.pathname) || (projectPage && [projectPage, (t) => reviewPage(t, projectPage)]) ||
    (workspacePath.test(url.pathname) ? ["workspace", workspace] : null);
  if (!selected) return null;
  const lang = language === "en" ? "en" : "ko";
  const t = copy[lang];
  const [page, render] = selected;
  const html = `<!doctype html><html lang="${lang}" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NEXUS</title>
    <link rel="stylesheet" href="${cssPath}"><script src="${jsPath}" defer></script></head><body data-page="${page}">
    <a class="skip" href="#main">${t.skip}</a><header class="header"><a class="wordmark" href="/">NEXUS</a>
    <nav class="row"><a href="/projects" id="project-nav" hidden>${t.projects}</a><button id="theme" type="button" aria-pressed="false">${t.theme}</button>
    <button id="sign-out" type="button" hidden>${t.signOut}</button></nav></header><main id="main"><p id="status" role="status" class="notice" hidden></p>
    <div id="recover" class="row" hidden><a class="button" id="return-to-sign-in" href="/">${t.signIn}</a></div>${render(t)}</main></body></html>`;
  return new Response(request.method === "HEAD" ? null : html, { headers: rebuildHeaders({ "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": page === "preview" ? previewCSP : csp }) });
}
