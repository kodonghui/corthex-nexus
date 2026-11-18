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
    notConnected: ko ? "저장소 연결 안 됨" : "Repository not connected",
    waiting: ko ? "첫 게시 대기" : "Waiting for the first publication",
    confirmed: ko ? "원본 연결됨" : "Source connected",
    noSource: ko ? "이 단계의 산출물이 아직 게시되지 않았습니다." : "This stage has no publication yet.",
    unsupported: ko ? "이 산출물의 형식을 표시할 수 없습니다." : "This artifact format cannot be displayed.",
    more: ko ? "더 보기" : "Load more",
    removed: ko ? "현재 버전에서 제거됨" : "Removed in this version",
    preview: ko ? "목업 미리 보기" : "Mockup preview",
    reviewConsent: ko ? "전송할 원본과 커밋을 검토한 뒤 게시 도구에 표시된 다이제스트로 동의하세요." : "Review the source and commit in your publication preview, then confirm its digest.",
    digest: ko ? "게시 미리 보기 다이제스트" : "Publication preview digest",
    consent: ko ? "첫 게시 동의" : "Consent to first publication",
    consentRecorded: ko ? "첫 게시 동의 ID" : "First-publication consent ID",
    label: ko ? "자격 증명 이름" : "Credential label",
    role: ko ? "역할" : "Role",
    publisher: ko ? "게시" : "Publisher",
    agent: ko ? "에이전트" : "Agent",
    revoke: ko ? "폐기" : "Revoke",
    revoked: ko ? "폐기됨" : "Revoked",
    issue: ko ? "자격 증명 발급" : "Issue credential",
    singleSecret: ko ? "한 번 표시되는 비밀값" : "One-time secret",
    issued: ko ? "같은 요청에서 이미 발급했습니다." : "This request already issued a credential.",
    checkpoint: ko ? "체크포인트 검토" : "Review checkpoint",
    requestCheckpoint: ko ? "체크포인트 요청" : "Request checkpoint",
    openReviewedVersion: ko ? "검토 원본 열기" : "Open reviewed version",
    refresh: ko ? "새로고침" : "Refresh",
    recordDecision: ko ? "결정 기록" : "Record decision",
    decision: ko ? "결정" : "Decision",
    reason: ko ? "사유" : "Reason",
    chooseDecision: ko ? "결정 선택" : "Choose a decision",
    pending: ko ? "검토 대기" : "Awaiting review",
    pass: ko ? "통과" : "Pass",
    passed: ko ? "통과됨" : "Passed",
    changesRequested: ko ? "변경 요청" : "Request changes",
    withdraw: ko ? "결정 철회" : "Withdraw decision",
    withdrawn: ko ? "철회됨" : "Withdrawn",
    superseded: ko ? "새 버전이 게시됨" : "A newer version was published",
    discussions: ko ? "대화" : "Discussions",
    openDiscussion: ko ? "검토 중인 대화" : "Open discussion",
    resolved: ko ? "결정된 대화" : "Resolved discussion",
    owner: ko ? "소유자" : "Owner",
    earlier: ko ? "이전 기록" : "Earlier record",
    queued: ko ? "에이전트 응답 대기" : "Waiting for an agent reply",
    claimed: ko ? "에이전트 처리 중" : "Agent is working",
    answered: ko ? "응답 완료" : "Answered",
    cancelled: ko ? "취소됨" : "Cancelled",
    proposal: ko ? "변경 제안" : "Change proposal",
    accept: ko ? "수락" : "Accept",
    reject: ko ? "거절" : "Reject",
    accepted: ko ? "수락됨" : "Accepted",
    rejected: ko ? "거절됨" : "Rejected",
    inReview: ko ? "검토 중" : "In review",
    reflected: ko ? "원본에 반영됨" : "Reflected in source",
    recorded: ko ? "기록됨" : "Recorded",
    unverified: ko ? "원본 확인 대기" : "Source unverified",
    noDiscussions: ko ? "대화 기록이 없습니다." : "No discussions yet.",
    askAI: ko ? "AI 에이전트에 질문" : "Ask an AI agent",
    question: ko ? "질문" : "Question",
    sendQuestion: ko ? "질문 기록" : "Record question",
    saveSample: ko ? "비공개 샘플 만들기" : "Create a private sample",
    signInSample: ko ? "로그인하고 샘플 저장" : "Sign in to save the sample",
    sampleProjectName: ko ? "내 샘플 프로젝트" : "My sample project",
    stale: ko ? "검토 버전이나 요청 상태가 바뀌었습니다. 새로고침하고 다시 확인하세요." : "The reviewed version or request changed. Refresh and review again.",
    tooLarge: ko ? "입력 길이를 확인해 주세요. 본문은 최대 8,000자이고 UTF-8 기준 32 KiB까지 저장할 수 있습니다." : "Check the input length. The text limit is 8,000 characters and 32 KiB of UTF-8.",
    rate: ko ? "요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요." : "The request limit was reached. Try again shortly.",
    forbidden: ko ? "이 작업을 수행할 권한이 없습니다." : "This action requires permission.",
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
    if (["versions", "credentials", "preview", "publications", "checkpoint"].includes(page)) content.replaceChildren();
    for (const id of ["artifact-items", "artifact-detail", "artifact-graph", "discussions", "checkpoint-links", "sample-copy"]) $(id)?.replaceChildren();
    visible(content, false);
    visible($("sample-copy"), false);
    for (const id of ["project-nav", "sign-out", "continue", "versions-link", "publications-link", "credentials-link", "provenance-link", "preview-link"]) visible($(id), false);
  }

  function failure(result) {
    const message = result.status === 401 ? words.signIn : result.status === 404 ? words.gone
      : result.status === 403 ? words.forbidden : result.status === 409 ? words.stale : result.status === 429 ? words.rate
      : result.status === 413 ? words.tooLarge : ["authentication_unavailable", "upstream_timeout"].includes(result.value?.code) ? words.unavailable : words.failed;
    const hint = result.value?.traceId ? ` (${result.value.code} · ${result.value.traceId})` : "";
    const delay = result.status === 429 && Number(result.retryAfter) > 0 ? ` (${Number(result.retryAfter)}${ko ? "초" : "s"})` : "";
    statusMessage(message + delay + hint, true);
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
      return { ok: response.ok, status: response.status, retryAfter: response.headers.get("Retry-After"), value };
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
        label("span", item.verification_state === "ready" ? words.confirmed : item.verification_state === "not_connected" ? words.notConnected : words.waiting, "badge"));
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
    const [, , project, rawPart, rawStage, , rawItem] = location.pathname.split("/");
    let part, stage, item;
    try { part = decodeURIComponent(rawPart); stage = decodeURIComponent(rawStage); item = rawItem ? decodeURIComponent(rawItem) : null; }
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
    publishLinks(project);
    const picker = $("part-picker");
    const parts = [...new Set(rows.map(({ part }) => part))];
    picker.replaceChildren(...parts.map((name) => {
      const option = label("option", name);
      option.value = name;
      return option;
    }));
    picker.value = part;
    visible(picker, parts.length > 1);
    picker.onchange = () => location.assign(route(project, picker.value, stage));
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
    await workspaceArtifact(project, part, stage, item, read);
  }

  function sourceLink(source, id = "provenance-link") {
    const anchor = $(id);
    if (!anchor) return;
    visible(anchor, false);
    if (!source || source.line === null) return;
    try {
      const repository = new URL(source.repository_url);
      if (repository.origin !== "https://github.com" || !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.pathname) ||
          !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(source.commit) ||
          source.path.split("/").some((part) => !part || part === "." || part === "..")) return;
      anchor.href = `${repository.origin}${repository.pathname}/blob/${source.commit}/${source.path.split("/").map(encodeURIComponent).join("/")}#L${source.line}`;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = `${source.path} · ${source.commit.slice(0, 8)}`;
      visible(anchor, true);
    } catch { /* A source with unavailable provenance remains local. */ }
  }

  function buildDiagram(graph) {
    const panel = $("artifact-graph");
    const nodes = graph.nodes.slice(0, 300);
    panel.replaceChildren();
    if (!nodes.length) { visible(panel, false); return; }
    const point = (name, attributes = {}, note) => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", name);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
      if (note) node.textContent = note;
      return node;
    };
    const columns = Math.min(4, nodes.length);
    const positions = new Map(nodes.map((node, i) => [node.id, [18 + (i % columns) * 208, 20 + Math.floor(i / columns) * 112]]));
    const svg = point("svg", { viewBox: `0 0 ${columns * 208 + 18} ${Math.ceil(nodes.length / columns) * 112}`,
      role: "img", "aria-label": ko ? "원본에서 생성한 단계 다이어그램" : "Stage diagram from the published source" });
    const defs = point("defs");
    const marker = point("marker", { id: "stage-arrow", markerWidth: 10, markerHeight: 8, refX: 8, refY: 4,
      orient: "auto", markerUnits: "userSpaceOnUse" });
    marker.append(point("path", { d: "M0 1 L9 4 L0 7 Z" }));
    defs.append(marker);
    svg.append(defs);
    for (const edge of graph.edges) {
      const from = positions.get(edge.from), to = positions.get(edge.to);
      if (!from || !to) continue;
      const forward = from[1] === to[1] && to[0] > from[0];
      const began = forward ? [from[0] + 180, from[1] + 31] : [from[0] + 90, from[1] + 62];
      const ends = forward ? [to[0], to[1] + 31] : [to[0] + 90, to[1]];
      const elbow = (began[1] + ends[1]) / 2;
      const shape = point("path", { d: `M${began.join(" ")} V${elbow} H${ends[0]} V${ends[1]}`, class: "edge-line", "marker-end": "url(#stage-arrow)" });
      if (edge.label) shape.append(point("title", {}, edge.label));
      svg.append(shape);
    }
    for (const node of nodes) {
      const [x, y] = positions.get(node.id);
      const box = point("g");
      box.append(point("title", {}, node.label), point("rect", { x, y, width: 180, height: 62, rx: 9, class: "stage-node" }));
      const words = Array.from(node.label);
      box.append(point("text", { x: x + 9, y: y + 26, "font-size": 12, class: "node-text" }, words.slice(0, 20).join("")));
      if (words.length > 20) box.append(point("text", { x: x + 9, y: y + 45, "font-size": 12, class: "node-text" },
        words.slice(20, 37).join("") + (words.length > 37 ? "…" : "")));
      svg.append(box);
    }
    panel.append(svg);
    if (graph.nodes.length > nodes.length) panel.append(label("p", ko ? "전체 항목은 아래 목록에서 확인하세요." : "The item list covers the full publication.", "muted"));
    visible(panel, true);
  }

  function itemCard(item, project, part, stage, exact) {
    const row = label("li", "");
    const link = label("a", "");
    link.href = `${route(project, part, stage)}/items/${encodeURIComponent(item.id)}${exact}`;
    link.append(label("span", item.id, "mono"), label("strong", item.title));
    if (item.removed) {
      row.classList.add("removed");
      link.append(label("span", words.removed, "badge"));
      link.href = link.pathname + "?" + new URLSearchParams({ publication_id: item.source.publication_id });
    }
    row.append(link);
    return row;
  }

  function publishLinks(project) {
    for (const [id, path] of [["versions-link", "versions"], ["publications-link", "publications"], ["credentials-link", "settings/credentials"]]) {
      const node = $(id);
      node.href = `/p/${project}/${path}`;
      visible(node, true);
    }
  }

  async function workspaceArtifact(project, part, stage, itemId, read, cursor = null) {
    const parameters = new URLSearchParams();
    for (const key of ["version", "publication_id"]) {
      const param = new URL(location.href).searchParams.get(key);
      if (param !== null) parameters.set(key, param);
    }
    const exact = parameters.size ? `?${parameters}` : "";
    const requestPath = `/api/v2/projects/${project}/stages/${encodeURIComponent(part)}/${stage}`;
    if (cursor) parameters.set("cursor", cursor);
    const query = parameters.size ? `?${parameters}` : "";
    const [artifact, item] = await Promise.all([api(requestPath + query),
      itemId && !cursor ? api(`${requestPath}/items/${encodeURIComponent(itemId)}${exact}`) : null]);
    if (read !== generation) return;
    if (!artifact.ok) { failure(artifact); return; }
    const data = artifact.value;
    const missing = data.representation === "missing", unsupported = data.representation === "unsupported";
    $("stage-state").textContent = missing ? words.noSource : unsupported ? words.unsupported : words.present;
    sourceLink(data.source);
    if (data.diagnostics.length && !cursor) {
      $("stage-blockers").append(...data.diagnostics.map((diagnostic) => label("li", diagnostic)));
    }
    if (!cursor) {
      buildDiagram(data.graph);
      renderCheckpointLinks(project, part, stage, data, exact);
      $("artifact-items").replaceChildren();
      const preview = $("preview-link");
      visible(preview, Boolean(data.artifact_id && data.representation === "html"));
      const active = data.source?.content_version;
      if (data.representation === "html" && active) preview.href = `/p/${project}/preview/${data.artifact_id}?version=${active}`;
    }
    const rows = data.items.map((entry) => itemCard(entry, project, part, stage, exact));
    $("artifact-items").append(...rows);
    const more = $("more-items");
    visible(more, Boolean(data.next_cursor));
    more.onclick = data.next_cursor ? async () => {
      more.disabled = true;
      try { await workspaceArtifact(project, part, stage, itemId, read, data.next_cursor); }
      finally { more.disabled = false; }
    } : null;
    if (item) {
      if (!item.ok) { failure(item); return; }
      const detail = $("artifact-detail");
      const selected = item.value;
      const list = label("dl", "", "review-fields");
      for (const [name, value] of Object.entries(selected.fields)) list.append(label("dt", name), label("dd", value));
      detail.replaceChildren(label("h3", `${selected.id} · ${selected.title}`),
        label("p", selected.removed ? words.removed : words.version + " " + selected.source.publication_revision, "muted"), list);
      sourceLink(selected.source);
      visible(detail, true);
    }
    statusMessage();
    if (!cursor && (itemId === null || item?.ok) && data.source) await discussionPanel(project, part, stage, item?.value ?? null, data, read);
  }

  async function reviewProjectPage() {
    const project = location.pathname.split("/")[2];
    const read = generation;
    const root = $("private-content");
    const result = await api(`/api/v2/projects/${project}`);
    if (read !== generation) return;
    if (!result.ok) { failure(result); return; }
    const { project: data, stages, held_commit } = result.value;
    const entry = stages.find((stage) => stage.work_state === "in_progress") || stages[0];
    $("back-project").href = entry ? route(project, entry.part, entry.stage) : "/projects";
    visible(root, true);
    if (page === "versions") await renderVersions(project, root, read);
    if (page === "publications") renderPublications(project, root, data, held_commit);
    if (page === "credentials") await renderCredentials(project, root, read);
    if (page === "preview") await renderPreview(project, root, read);
    if (page === "checkpoint") await renderCheckpoint(project, root, read);
    if (page === "publications") statusMessage();
  }

  async function renderVersions(project, root, read, cursor) {
    const response = await api(`/api/v2/projects/${project}/versions${cursor ? "?" + new URLSearchParams({ cursor }) : ""}`);
    if (read !== generation) return;
    if (!response.ok) { failure(response); return; }
    const list = root.querySelector("ul") || label("ul", "", "review-items");
    if (!cursor) root.replaceChildren(list);
    root.querySelector("button")?.remove();
    for (const version of response.value.versions) {
      const row = label("li", "");
      const link = label("a", `${words.version} ${version.publication_revision} · ${stageTitle(version.stage)} · ${version.commit.slice(0, 8)}`);
      link.href = route(project, version.part, version.stage) + "?" + new URLSearchParams({ publication_id: version.publication_id });
      row.append(link);
      list.append(row);
    }
    if (!list.childElementCount) root.append(label("p", words.waiting, "muted"));
    if (response.value.next_cursor) {
      const more = label("button", words.more);
      more.type = "button";
      more.addEventListener("click", async () => {
        more.disabled = true;
        try { await renderVersions(project, root, read, response.value.next_cursor); }
        finally { more.disabled = false; }
      });
      root.append(more);
    }
    statusMessage();
  }

  function actionForm(fields, caption, submitBody, root) {
    const form = label("form", "", "stack");
    const submit = label("button", caption, "primary");
    submit.type = "submit";
    form.append(...fields, submit);
    let held = null;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = JSON.stringify(Object.fromEntries(new FormData(form)));
      if (held?.payload !== payload) held = { payload, key: crypto.randomUUID() };
      submit.disabled = true;
      try { if (await submitBody(held)) { held = null; form.reset(); } }
      finally { submit.disabled = false; }
    });
    root.append(form);
    return form;
  }

  function field(name, caption, options = {}) {
    const wrapper = label("label", caption);
    const node = document.createElement("input");
    node.name = name;
    node.required = true;
    Object.assign(node, options);
    wrapper.append(node);
    return wrapper;
  }

  function mutation(target, payload, key) {
    return api(target, { method: "POST", headers: { "Content-Type": "application/json",
      "X-CSRF-Token": currentSession.csrf_token, "Idempotency-Key": key }, body: payload });
  }

  function renderPublications(project, root, data, commit) {
    root.replaceChildren(label("h2", data.title), label("p", commit ? `${words.version} ${data.revision} · ${commit}` : words.waiting));
    if (data.repository_url) root.append(label("p", `${data.repository_url} · ${data.default_branch}`, "muted"));
    if (!commit && data.repository_url && !data.synthetic) {
      root.append(label("p", words.reviewConsent));
      actionForm([field("preview_digest", words.digest, { minLength: 64, maxLength: 64, pattern: "[0-9a-f]{64}", autocomplete: "off" })],
        words.consent, async ({ payload, key }) => {
          const result = await mutation(`/api/v2/projects/${project}/publication-consents`, JSON.stringify({ ...JSON.parse(payload), consent: true }), key);
          if (!result.ok) { failure(result); return false; }
          statusMessage(`${words.consentRecorded} ${result.value.id}`);
          return true;
        }, root);
    }
  }

  async function renderCredentials(project, root, read) {
    const path = `/api/v2/projects/${project}/credentials`;
    const response = await api(path);
    if (read !== generation) return;
    if (!response.ok) { failure(response); return; }
    root.replaceChildren();
    const list = label("ul", "", "review-items");
    for (const credential of response.value.credentials) {
      const row = label("li", "");
      const details = label("p", `${credential.label} · ${credential.role === "publisher" ? words.publisher : words.agent}`);
      row.append(details);
      if (credential.revoked) row.append(label("span", words.revoked, "muted"));
      else {
        const revoke = label("button", words.revoke);
        revoke.type = "button";
        const key = crypto.randomUUID();
        revoke.addEventListener("click", async () => {
          revoke.disabled = true;
          const result = await mutation(`${path}/${credential.id}/revoke`, JSON.stringify({ credential_id: credential.id }), key);
          if (result.ok) await renderCredentials(project, root, generation);
          else { failure(result); revoke.disabled = false; }
        });
        row.append(revoke);
      }
      list.append(row);
    }
    root.append(list);
    const roleWrapper = label("label", words.role);
    const role = document.createElement("select");
    role.name = "role";
    for (const [value, caption] of [["publisher", words.publisher], ["agent", words.agent]]) {
      const option = label("option", caption);
      option.value = value;
      role.append(option);
    }
    roleWrapper.append(role);
    actionForm([field("label", words.label, { maxLength: 80 }), roleWrapper], words.issue, async ({ payload, key }) => {
      const result = await mutation(path, payload, key);
      if (!result.ok) { failure(result); return false; }
      if (read !== generation) return false;
      await renderCredentials(project, root, read);
      if (read !== generation) return false;
      if (result.value.secret) {
        const wrapper = field("", words.singleSecret, { value: result.value.secret, readOnly: true, autocomplete: "off" });
        root.prepend(wrapper);
        wrapper.querySelector("input").focus();
      } else statusMessage(words.issued);
      return true;
    }, root);
    statusMessage();
  }

  async function renderPreview(project, root, read) {
    const id = location.pathname.split("/").at(-1);
    const version = new URL(location.href).searchParams.get("version");
    const response = await api(`/api/v2/projects/${project}/previews/${id}${version ? "?" + new URLSearchParams({ version }) : ""}`);
    if (read !== generation) return;
    if (!response.ok) { failure(response); return; }
    const frame = document.createElement("iframe");
    frame.className = "preview-frame";
    frame.title = words.preview;
    frame.setAttribute("sandbox", "allow-scripts");
    frame.referrerPolicy = "no-referrer";
    const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
    frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}">` + response.value.html.replace(/^\s*<!doctype html>/i, "");
    root.replaceChildren(frame);
    statusMessage();
  }

  function submissionField(name, text, required = true) {
    const wrapper = label("label", text);
    const input = document.createElement("textarea");
    input.name = name;
    input.required = required;
    input.maxLength = 8000;
    wrapper.append(input);
    return wrapper;
  }

  function decisionURL(project, part, stage, checkpoint) {
    return `${route(project, part, stage)}/checkpoints/${encodeURIComponent(checkpoint)}`;
  }

  function renderCheckpointLinks(project, part, stage, artifact, exact) {
    const parent = $("checkpoint-links");
    parent.replaceChildren();
    for (const id of artifact.checkpoint_ids.slice(0, 10)) {
      const link = label("a", words.checkpoint, "button");
      link.href = decisionURL(project, part, stage, id);
      parent.append(link);
    }
    if (!exact && artifact.artifact_id && !["missing", "unsupported"].includes(artifact.representation) &&
        ["none", "historical"].includes(artifact.stage.checkpoint_state)) {
      const button = label("button", words.requestCheckpoint);
      button.type = "button";
      const key = crypto.randomUUID();
      button.addEventListener("click", async () => {
        button.disabled = true;
        const { content_version, publication_id } = artifact.source;
        const result = await mutation(`/api/v2/projects/${project}/checkpoints`, JSON.stringify({ part, stage, content_version, publication_id }), key);
        if (result.ok) location.assign(decisionURL(project, part, stage, result.value.id));
        else { button.disabled = false; failure(result); }
      });
      parent.append(button);
    }
  }

  async function renderCheckpoint(project, root, read, retainDraft = false) {
    const draft = retainDraft ? root.querySelector("textarea[name=reason]")?.value || "" : "";
    const [, , , part, stage, , id] = location.pathname.split("/");
    const endpoint = `/api/v2/projects/${project}/checkpoints/${id}`;
    const response = await api(endpoint);
    if (read !== generation) return;
    if (!response.ok) { failure(response); return; }
    const checkpoint = response.value;
    if (checkpoint.part !== decodeURIComponent(part) || checkpoint.stage !== stage) {
      location.replace(decisionURL(project, checkpoint.part, checkpoint.stage, checkpoint.id));
      return;
    }
    const versionURL = route(project, checkpoint.part, checkpoint.stage) + "?" + new URLSearchParams({
      publication_id: checkpoint.publication_id, version: checkpoint.content_version,
    });
    const source = label("a", words.openReviewedVersion, "button");
    source.href = versionURL;
    $("back-project").href = route(project, checkpoint.part, checkpoint.stage);
    const status = label("p", checkpointLabel(checkpoint.state), "badge");
    const heading = label("h2", `${checkpoint.stage.slice(0, 2)} ${stageTitle(checkpoint.stage)}`);
    root.replaceChildren(heading, status, source, label("p", checkpoint.content_version, "mono muted"));
    if (checkpoint.blockers.length) {
      const errors = label("ul", "");
      errors.append(...checkpoint.blockers.map((detail) => label("li", detail)));
      root.append(errors);
    }
    const history = label("ul", "", "checkpoint-history");
    for (const entry of checkpoint.history) {
      const row = label("li", "");
      row.append(label("strong", checkpointLabel(entry.decision)),
        label("p", `${entry.decided_by} · ${new Date(entry.decided_at).toLocaleString(rootLanguage())}`, "muted"));
      if (entry.reason) row.append(label("p", entry.reason, "thread-text"));
      history.append(row);
    }
    if (history.children.length) root.append(history);
    const canDecide = checkpoint.state === "pending" && !checkpoint.blockers.length;
    const previous = checkpoint.history.at(-1);
    const canWithdraw = previous && ["passed", "changes_requested"].includes(checkpoint.state);
    if (canDecide || canWithdraw) {
      const decisionField = label("label", words.decision);
      const choices = document.createElement("select");
      choices.required = true;
      choices.name = "decision";
      const blank = label("option", words.chooseDecision);
      blank.value = "";
      choices.append(blank);
      for (const value of canDecide ? ["pass", "changes_requested"] : ["withdraw"]) {
        const option = label("option", checkpointLabel(value));
        option.value = value;
        choices.append(option);
      }
      decisionField.append(choices);
      const reasonField = submissionField("reason", words.reason, false);
      reasonField.querySelector("textarea").value = draft;
      actionForm([decisionField, reasonField], words.recordDecision, async ({ payload, key }) => {
        const { decision, reason } = JSON.parse(payload);
        const exact = { content_version: checkpoint.content_version, expected_revision: checkpoint.revision, reason };
        const body = canWithdraw ? { ...exact, prior_decision_id: previous.id } : { ...exact, decision };
        const result = await mutation(endpoint + (canWithdraw ? "/withdrawals" : "/decisions"), JSON.stringify(body), key);
        if (!result.ok) { failure(result); return false; }
        await renderCheckpoint(project, root, read);
        return true;
      }, root);
    }
    const refresh = label("button", words.refresh);
    refresh.type = "button";
    refresh.addEventListener("click", () => renderCheckpoint(project, root, read, true));
    root.append(refresh);
    statusMessage();
  }

  const rootLanguage = () => ko ? "ko-KR" : "en";
  const checkpointLabel = (value) => ({
    pending: words.pending, pass: words.pass, passed: words.passed, changes_requested: words.changesRequested,
    withdraw: words.withdraw, withdrawn: words.withdrawn, superseded: words.superseded,
  })[value] || value;

  function makeThread(note, project, source, refresh, read) {
    const card = label("article", "", "thread stack");
    const heading = label("h4", note.removed_item ? words.removed : note.state === "resolved" ? words.resolved : words.openDiscussion);
    const origin = label("a", `${words.version} · ${note.content_version.slice(0, 8)}`);
    origin.href = route(project, note.part, note.stage) + "?" + new URLSearchParams({ publication_id: note.publication_id });
    card.append(heading, origin);
    const messages = label("div", "", "stack");
    for (const message of note.messages) {
      const body = label("article", "");
      const author = message.author === "owner" ? words.owner : message.author === "agent" ? words.agent : words.earlier;
      body.append(label("strong", author), label("p", message.body, "thread-text"));
      messages.append(body);
    }
    card.append(messages);
    for (const work of note.agent_work) {
      const text = work.state === "queued" ? words.queued : work.state === "claimed" ? `${words.claimed} · ${work.session_label || ""}` :
        work.state === "answered" ? words.answered : words.cancelled;
      card.append(label("p", text, "badge"));
    }
    for (const proposal of note.proposals) {
      const row = label("article", "");
      row.append(label("strong", words.proposal), label("p", proposal.body, "thread-text"),
        label("p", proposalState(proposal.state), "muted"));
      if (proposal.reflection) {
        const reflected = label("a", `${words.openReviewedVersion} · ${proposal.reflection.source_commit.slice(0, 8)}`);
        reflected.href = route(project, note.part, note.stage) + "?" + new URLSearchParams({ publication_id: proposal.reflection.publication_id });
        row.append(reflected);
      }
      if (proposal.state === "proposed") {
        const actions = label("div", "", "row");
        for (const [decision, title] of [["accept", words.accept], ["reject", words.reject]]) {
          const button = label("button", title);
          button.type = "button";
          const key = crypto.randomUUID();
          button.addEventListener("click", async () => {
            button.disabled = true;
            const response = await mutation(`/api/v2/projects/${project}/proposals/${proposal.id}/decision`,
              JSON.stringify({ decision, expected_revision: proposal.revision }), key);
            if (response.ok) await refresh();
            else { button.disabled = false; failure(response); }
          });
          actions.append(button);
        }
        row.append(actions);
      }
      card.append(row);
    }
    for (const decision of note.decisions) {
      const row = label("article", "");
      row.append(label("strong", words.recorded), label("p", decision.body, "thread-text"),
        label("p", decision.source_commit || words.unverified, "muted mono"));
      card.append(row);
    }
    if (source) {
      const detail = label("details", "");
      detail.append(label("summary", words.recordDecision));
      actionForm([submissionField("body", words.decision), label("p", `${words.version} ${source.publication_revision} · ${source.commit}`, "muted mono")],
        words.recordDecision, async ({ payload, key }) => {
          const content = { ...JSON.parse(payload), expected_revision: note.revision, publication_id: source.publication_id, source_commit: source.commit };
          const response = await mutation(`/api/v2/projects/${project}/discussions/${note.id}/decisions`, JSON.stringify(content), key);
          if (read !== generation) return false;
          if (!response.ok) { failure(response); return false; }
          await refresh();
          return true;
        }, detail);
      card.append(detail);
    }
    if (note.next_cursor || note.next_proposal_cursor || note.next_decision_cursor) {
      const more = label("button", words.more);
      more.type = "button";
      more.addEventListener("click", async () => {
        const page = new URLSearchParams({ limit: "50" });
        const groups = [["messages", "cursor", "next_cursor"], ["proposals", "proposal_cursor", "next_proposal_cursor"],
          ["decisions", "decision_cursor", "next_decision_cursor"]];
        for (const [, param, next] of groups) if (note[next]) page.set(param, note[next]);
        const response = await api(`/api/v2/projects/${project}/discussions/${note.id}?${page}`);
        if (!response.ok) { failure(response); return; }
        const loaded = response.value;
        for (const [key, param, next] of groups) {
          loaded[key] = page.has(param) ? [...note[key], ...loaded[key]] : note[key];
          if (!page.has(param)) loaded[next] = null;
        }
        if (read === generation) card.replaceWith(makeThread(loaded, project, source, refresh, read));
      });
      card.append(more);
    }
    return card;
  }

  const proposalState = (value) => ({
    proposed: words.proposal, accepted: words.accepted, rejected: words.rejected, in_review: words.inReview, reflected: words.reflected,
  })[value] || value;

  async function discussionPanel(project, part, stage, item, artifact, read) {
    const root = $("discussions");
    const endpoint = `/api/v2/projects/${project}/stages/${encodeURIComponent(part)}/${stage}/discussions`;
    root.replaceChildren(label("h3", words.discussions));
    const refreshRow = label("div", "", "row");
    const refreshButton = label("button", words.refresh);
    refreshButton.type = "button";
    refreshRow.append(refreshButton);
    const history = label("div", "", "stack");
    root.append(refreshRow, history);
    const load = async (cursor) => {
      const response = await api(endpoint + "?" + new URLSearchParams({ limit: "50", ...(cursor ? { cursor } : {}) }));
      if (read !== generation) return;
      if (!response.ok) { failure(response); return; }
      if (!cursor) history.replaceChildren();
      const notes = response.value.discussions.filter((note) => item ? note.item_id === item.id : note.item_id === null);
      history.append(...notes.map((note) => makeThread(note, project, artifact.source, () => load(null), read)));
      if (!history.children.length) history.append(label("p", words.noDiscussions, "muted"));
      refreshRow.querySelector(".more-threads")?.remove();
      if (response.value.next_cursor) {
        const more = label("button", words.more, "more-threads");
        more.type = "button";
        more.onclick = () => load(response.value.next_cursor);
        refreshRow.append(more);
      }
    };
    if (!item?.removed && artifact.source && !["missing", "unsupported"].includes(artifact.representation)) {
      const ask = label("label", "");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.name = "ask_ai";
      check.checked = true;
      ask.append(check, document.createTextNode(words.askAI));
      actionForm([submissionField("body", words.question), ask], words.sendQuestion, async ({ payload, key }) => {
        const { body, ask_ai } = JSON.parse(payload);
        const { content_version, publication_id } = artifact.source;
        const response = await mutation(endpoint, JSON.stringify({ item_id: item?.id ?? null, body, ask_ai: Boolean(ask_ai),
          content_version, publication_id }), key);
        if (read !== generation) return false;
        if (!response.ok) { failure(response); return false; }
        await load(null);
        statusMessage(words.recorded);
        return true;
      }, root);
    }
    refreshButton.addEventListener("click", () => load(null));
    visible(root, true);
    await load(null);
  }

  function sampleActions() {
    const section = $("sample-copy");
    if (!section) return;
    section.replaceChildren(label("h2", words.saveSample));
    if (!currentSession) {
      const signIn = label("a", words.signInSample, "button");
      signIn.href = "/?" + new URLSearchParams({ next: "/learn/sample" });
      section.append(signIn);
    } else {
      actionForm([field("title", words.sampleProjectName, { value: words.sampleProjectName, maxLength: 120 })],
        words.saveSample, async ({ payload, key }) => {
          const response = await mutation("/api/v2/sample-projects", payload, key);
          if (!response.ok) { failure(response); return false; }
          location.assign(route(response.value.id, "main", "02-prd"));
          return true;
        }, section);
    }
    visible(section, true);
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
      if (page === "sample") sampleActions();
      return;
    }
    currentSession = result.value;
    if (page === "sample") sampleActions();
    visible($("project-nav"), true);
    visible($("sign-out"), true);
    visible($("continue"), true);
    if (page === "projects") { visible($("private-content"), true); await listProjects(null); }
    else if (page === "connect") { statusMessage(); visible($("private-content"), true); }
    else if (page === "workspace") await loadWorkspace();
    else if (["versions", "publications", "credentials", "preview", "checkpoint"].includes(page)) await reviewProjectPage();
  }
  addEventListener("pageshow", (event) => { if (event.persisted) { clearPrivate(); location.reload(); } });
  start();
})();
