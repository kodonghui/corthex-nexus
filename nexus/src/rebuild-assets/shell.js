(() => {
  "use strict";
  const root = document.documentElement;
  const page = document.body.dataset.page;
  const $ = (id) => document.getElementById(id);
  const ko = root.lang === "ko";
  const words = {
    loading: ko ? "불러오는 중입니다." : "Loading…",
    signIn: ko ? "로그인하면 이 프로젝트를 볼 수 있습니다." : "Sign in to see this project.",
    signingIn: ko ? "로그인 제공자에 연결하고 있습니다." : "Connecting to the sign-in provider…",
    unavailable: ko ? "로그인 제공자에 연결할 수 없습니다. 다시 시도해 주세요." : "The sign-in provider is unavailable. Try again.",
    gone: ko ? "프로젝트를 열 수 없습니다. 프로젝트 목록을 확인하세요." : "This project is unavailable. Check your projects.",
    failed: ko ? "요청을 완료하지 못했습니다. 다시 시도해 주세요." : "The request could not be completed. Try again.",
    empty: ko ? "프로젝트가 없습니다. 저장소를 연결해 시작하세요." : "You have no projects yet. Connect a repository to start.",
    filtered: ko ? "현재 불러온 프로젝트에서 일치하는 항목이 없습니다." : "No loaded projects match the search.",
    version: ko ? "버전" : "Version",
    waiting: ko ? "첫 게시 대기" : "Waiting for the first publication",
    confirmed: ko ? "원본 연결됨" : "Source connected",
    noSource: ko ? "이 단계의 산출물이 아직 게시되지 않았습니다." : "This stage has no publication yet.",
    unsupported: ko ? "이 산출물의 형식을 표시할 수 없습니다." : "This artifact format cannot be displayed.",
    present: ko ? "산출물이 게시되었습니다." : "This artifact has been published.",
  };
  const stages = ko ? ["도메인 탐색", "PRD", "유저 플로우", "기능 명세", "ERD", "API 계약", "사이트맵", "화면 정의", "목업", "WBS", "개발", "QA", "발표"]
    : ["Domain discovery", "PRD", "User flows", "Functional spec", "ERD", "API contract", "Sitemap", "Screen states", "Mockup", "WBS", "Development", "QA", "Presentation"];
  const status = $("status");
  const visible = (node, show) => { if (node) node.hidden = !show; };
  const label = (tag, text, className) => {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const safePath = (input) => {
    try {
      const url = new URL(input || "/projects", location.origin);
      if (url.origin === location.origin && !url.pathname.startsWith("/api/") && url.pathname !== "/") return url.pathname + url.search;
    } catch { /* Return to the project list. */ }
    return "/projects";
  };
  const route = (project, part = "main", stage = "01-domain") => `/p/${[project, part, stage].map(encodeURIComponent).join("/")}`;
  const stageTitle = (stage) => stages[Number(stage.slice(0, 2)) - 1] || stage;
  const statusMessage = (message = "", error = false) => {
    status.textContent = message;
    status.classList.toggle("error", error);
    visible(status, Boolean(message));
  };

  const theme = $("theme");
  function setTheme(value) {
    root.dataset.theme = value;
    theme.setAttribute("aria-pressed", String(value === "dark"));
  }
  try { if (localStorage.getItem("nexus.rebuild.theme") === "dark") setTheme("dark"); } catch { /* Light remains usable without storage. */ }
  theme.addEventListener("click", () => {
    const value = root.dataset.theme === "dark" ? "light" : "dark";
    setTheme(value);
    try { localStorage.setItem("nexus.rebuild.theme", value); } catch { /* Use the current document preference. */ }
  });

  let currentSession = null;
  let currentProjects = [];
  let nextPage = null;
  let pending = null;
  let generation = 0;
  function clearPrivate() {
    generation += 1;
    currentSession = null;
    currentProjects = [];
    nextPage = null;
    pending = null;
    $("project-list")?.replaceChildren();
    $("stage-list")?.replaceChildren();
    $("stage-blockers")?.replaceChildren();
    for (const id of ["workspace-title", "stage-title", "stage-state"]) if ($(id)) $(id).textContent = "";
    const content = $("private-content");
    if (content instanceof HTMLFormElement) content.reset();
    visible(content, false);
    for (const id of ["project-nav", "sign-out", "continue"]) visible($(id), false);
  }

  function failure(result) {
    const message = result.status === 401 ? words.signIn : result.status === 404 ? words.gone
      : ["authentication_unavailable", "upstream_timeout"].includes(result.value?.code) ? words.unavailable : words.failed;
    const hint = result.value?.traceId ? ` (${result.value.code} · ${result.value.traceId})` : "";
    statusMessage(message + hint, true);
    if (result.status === 401) {
      clearPrivate();
      $("return-to-sign-in").href = `/?${new URLSearchParams({ next: safePath(location.pathname + location.search) })}`;
      visible($("recover"), true);
    }
  }

  async function api(path, init) {
    try {
      const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store", redirect: "error" });
      const value = response.status === 204 ? null : await response.json();
      return { ok: response.ok, status: response.status, value };
    } catch { return { ok: false, status: 0, value: null }; }
  }

  function renderProjects() {
    const text = $("project-search").value.trim().toLowerCase();
    const results = currentProjects.filter((item) => `${item.title} ${item.slug}`.toLowerCase().includes(text));
    const cards = results.map((item) => {
      const link = label("a", "", "card");
      link.href = route(item.id);
      link.append(label("p", item.synthetic ? (ko ? "비공개 · 샘플" : "Private · Sample") : (ko ? "비공개" : "Private"), "eyebrow"),
        label("h2", item.title), label("p", `${words.version} ${item.revision}`, "muted"),
        label("span", item.verification_state === "ready" ? words.confirmed : words.waiting, "badge"));
      return link;
    });
    $("project-list").replaceChildren(...cards);
    $("project-empty").textContent = text ? words.filtered : words.empty;
    visible($("project-empty"), cards.length === 0);
    visible($("more-projects"), Boolean(nextPage));
  }

  async function listProjects(cursor) {
    const read = generation;
    const params = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) });
    $("more-projects").disabled = true;
    const result = await api(`/api/v2/projects?${params}`);
    if (read !== generation) return;
    $("more-projects").disabled = false;
    if (!result.ok) { failure(result); return; }
    currentProjects = cursor ? [...currentProjects, ...result.value.projects] : result.value.projects;
    nextPage = result.value.next_cursor;
    statusMessage();
    renderProjects();
  }

  async function loadWorkspace() {
    const [, , project, rawPart, rawStage] = location.pathname.split("/");
    let part, stage;
    try { part = decodeURIComponent(rawPart); stage = decodeURIComponent(rawStage); }
    catch { statusMessage(words.gone, true); return; }
    const read = generation;
    const result = await api(`/api/v2/projects/${encodeURIComponent(project)}`);
    if (read !== generation) return;
    if (!result.ok) { failure(result); return; }
    const rows = result.value.stages;
    const selected = rows.find((item) => item.part === part && item.stage === stage);
    if (!selected) {
      if (rows.length) location.replace(route(project, rows[0].part, rows[0].stage));
      else statusMessage(words.gone, true);
      return;
    }
    $("workspace-title").textContent = result.value.project.title;
    $("stage-title").textContent = `${selected.stage.slice(0, 2)} ${stageTitle(selected.stage)}`;
    $("stage-state").textContent = selected.artifact_state === "missing" ? words.noSource
      : selected.artifact_state === "unsupported" ? words.unsupported : words.present;
    $("stage-blockers").replaceChildren(...selected.blockers.map((blocker) => label("li", blocker)));
    $("stage-list").replaceChildren(...rows.filter((item) => item.part === part).map((item) => {
      const entry = label("li", "");
      const link = label("a", `${item.stage.slice(0, 2)} ${stageTitle(item.stage)}`);
      link.href = route(project, part, item.stage);
      if (item.stage === stage) link.setAttribute("aria-current", "page");
      entry.append(link);
      return entry;
    }));
    statusMessage();
    visible($("private-content"), true);
  }

  $("sign-in")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    statusMessage(words.signingIn);
    const return_path = safePath(new URL(location.href).searchParams.get("next"));
    const result = await api("/api/v2/auth/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ return_path }) });
    if (result.ok) {
      const target = new URL(result.value.authorize_url);
      if (target.protocol === "https:") { location.assign(target.href); return; }
    }
    failure(result);
    $("sign-in").disabled = false;
  });

  $("sign-out").addEventListener("click", async () => {
    if (!currentSession) return;
    $("sign-out").disabled = true;
    const result = await api("/api/v2/session/logout", { method: "POST", headers: { "X-CSRF-Token": currentSession.csrf_token } });
    if (result.ok || result.status === 401) { clearPrivate(); location.replace("/"); return; }
    $("sign-out").disabled = false;
    failure(result);
  });

  $("project-search")?.addEventListener("input", renderProjects);
  $("more-projects")?.addEventListener("click", () => { if (nextPage) listProjects(nextPage); });
  if (page === "connect") $("private-content").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentSession) return;
    const form = event.currentTarget;
    const submit = form.querySelector("button[type=submit]");
    const body = JSON.stringify(Object.fromEntries(new FormData(form)));
    if (!pending || pending.body !== body) pending = { body, key: crypto.randomUUID() };
    submit.disabled = true;
    statusMessage(words.loading);
    const result = await api("/api/v2/projects", { method: "POST", headers: {
      "Content-Type": "application/json", "X-CSRF-Token": currentSession.csrf_token, "Idempotency-Key": pending.key,
    }, body });
    if (result.ok) { pending = null; location.assign(route(result.value.id)); return; }
    submit.disabled = false;
    failure(result);
  });

  async function start() {
    if (page === "sample") {
      const result = await api("/api/v2/sample");
      $("sample-content").setAttribute("aria-busy", "false");
      if (!result.ok) failure(result);
      else $("sample-content").replaceChildren(...result.value.source_files.flatMap((source) => [label("h2", source.path), label("pre", source.content_utf8)]));
    }
    if (page !== "welcome" && page !== "sample") statusMessage(words.loading);
    const result = await api("/api/v2/session");
    if (!result.ok) {
      if (!["welcome", "sample"].includes(page) || result.status !== 401) failure(result);
      return;
    }
    currentSession = result.value;
    visible($("project-nav"), true);
    visible($("sign-out"), true);
    visible($("continue"), true);
    if (page === "projects") { visible($("private-content"), true); await listProjects(null); }
    else if (page === "connect") { statusMessage(); visible($("private-content"), true); }
    else if (page === "workspace") await loadWorkspace();
  }
  addEventListener("pageshow", (event) => { if (event.persisted) { clearPrivate(); location.reload(); } });
  start();
})();
