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
    signInRetry: ko ? "로그인을 완료하지 못했습니다. 다시 시도해 주세요." : "Sign-in did not complete. Try again.",
    unavailable: ko ? "로그인 제공자에 연결할 수 없습니다. 다시 시도해 주세요." : "The sign-in provider is unavailable. Try again.",
    gone: ko ? "프로젝트를 열 수 없습니다. 프로젝트 목록을 확인하세요." : "This project is unavailable. Check your projects.",
    failed: ko ? "요청을 완료하지 못했습니다. 다시 시도해 주세요." : "The request could not be completed. Try again.",
    empty: ko ? "프로젝트가 없습니다. 저장소를 연결하거나 비공개 샘플을 만들어 보세요." : "You have no projects yet. Connect a repository or create a private sample.",
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
    previewUnavailable: ko ? "이 버전의 목업을 열 수 없습니다. 원본에서 다른 버전을 선택하세요." : "This mockup version is unavailable. Open the source and choose another version.",
    reviewConsent: ko ? "전송할 원본과 커밋을 검토한 뒤 게시 도구에 표시된 다이제스트로 동의하세요." : "Review the source and commit in your publication preview, then confirm its digest.",
    digest: ko ? "게시 미리 보기 다이제스트" : "Publication preview digest",
    consent: ko ? "첫 게시 동의" : "Consent to first publication",
    consentRecorded: ko ? "첫 게시 동의 ID" : "First-publication consent ID",
    receipt: ko ? "서버 수신 기록" : "Server receipt",
    receiptId: ko ? "수신 ID" : "Receipt ID",
    receivedAt: ko ? "수신 시각" : "Received at",
    receiptEvent: ko ? "수신 이벤트" : "Receipt event",
    receiptPending: ko ? "서버 수신 기록 확인 대기" : "Waiting for confirmation of the server receipt",
    verifyCommit: ko ? "게시를 시도한 커밋" : "Attempted commit",
    compareCommit: ko ? "수신 커밋 비교" : "Compare with the received commit",
    commitReceived: ko ? "입력한 커밋의 수신을 확인했습니다." : "The server received this commit.",
    commitPending: ko ? "입력한 커밋은 수신 확인 대기 중입니다. 기본 브랜치를 가져온 뒤 게시 명령 결과를 확인하세요." : "Receipt for this commit is pending confirmation. Fetch the default branch and check the publication command result.",
    publicationHelp: ko ? "게시 설정과 재시도" : "Publication setup and retry",
    publicationDiagnostics: ko ? "이 화면은 서버가 기록한 수신을 표시합니다. 대기, 건너뜀, 오류 사유는 게시 명령이나 CI 실행 결과에서 확인하세요." : "This screen shows recorded server receipts. Check the publication command or CI run for queued, skipped or failed attempts.",
    publicationPrepare: ko ? "기본 브랜치를 가져온 뒤 게시 미리 보기에서 원본과 커밋을 확인하세요." : "Fetch the default branch, then review the source and commit in the publication preview.",
    publicationCredential: ko ? "게시 자격 증명을 발급받아 승인된 실행 환경에서 CORTHEX_NEXUS_PUBLISHER_TOKEN으로 설정하세요." : "Issue a publisher credential and set CORTHEX_NEXUS_PUBLISHER_TOKEN in the authorized publishing environment.",
    sampleGuideLink: ko ? "공개 샘플 안내" : "Public sample guide",
    label: ko ? "자격 증명 이름" : "Credential label",
    role: ko ? "역할" : "Role",
    publisher: ko ? "게시" : "Publisher",
    agent: ko ? "에이전트" : "Agent",
    credentialScope: ko ? "자격 증명 범위" : "Credential scope",
    credentialRoles: ko ? "게시 역할은 이 프로젝트에 검증된 원본을 게시합니다. 에이전트 역할은 이 프로젝트에 할당된 질문을 확인하고 응답합니다." : "Publishers submit verified source for this project. Agents read and answer assigned questions for this project.",
    credentialEmpty: ko ? "등록된 자격 증명이 없습니다." : "No credentials have been issued.",
    credentialLastUse: ko ? "최근 사용 시각 · 확인 불가" : "Last used · unavailable",
    credentialCreated: ko ? "발급 시각" : "Issued at",
    revoke: ko ? "폐기" : "Revoke",
    confirmRevoke: ko ? "이 자격 증명 폐기" : "Revoke this credential",
    revokeScope: ko ? "폐기하면 선택한 자격 증명의 접근이 즉시 중단됩니다." : "Revocation immediately ends access for the selected credential.",
    revoked: ko ? "폐기됨" : "Revoked",
    cancel: ko ? "취소" : "Cancel",
    close: ko ? "닫기" : "Close",
    issue: ko ? "자격 증명 발급" : "Issue credential",
    singleSecret: ko ? "한 번 표시되는 비밀값" : "One-time secret",
    copyThenClose: ko ? "사용할 환경에 비밀값을 직접 복사한 뒤 닫으세요." : "Copy the secret to its intended environment, then close it.",
    issued: ko ? "같은 요청에서 이미 발급했습니다. 비밀값을 잃었다면 해당 자격 증명을 폐기하고 다시 발급하세요." : "This request already issued a credential. If you lost the secret, revoke the credential and issue a replacement.",
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
    sourceCommit: ko ? "원본 커밋" : "Source commit",
    contentVersion: ko ? "내용 버전" : "Content version",
    currentVersion: ko ? "최신 버전" : "Latest version",
    earlierVersion: ko ? "이전 버전" : "Earlier version",
    latestSource: ko ? "최신 원본 열기" : "Open latest source",
    historicalReview: ko ? "이 버전의 체크포인트는 이력으로 표시됩니다." : "This version’s checkpoint is available as history.",
    originalDecision: ko ? "철회한 결정 보기" : "View the withdrawn decision",
    savedDraft: ko ? "저장되지 않은 사유" : "Unsaved reason",
    withdrawalEffect: ko ? "이 결정은 이력에 남습니다. 이 체크포인트에 의존하는 후속 단계는 선행 조건을 다시 확인합니다." : "This decision stays in history. Dependent stages check their prerequisite again.",
    confirmWithdrawal: ko ? "철회를 확인합니다" : "Confirm withdrawal",
    noCheckpoint: ko ? "체크포인트 없음" : "No checkpoint",
    historicalCheckpoint: ko ? "이전 내용의 체크포인트" : "Checkpoint on earlier content",
    historyReview: ko ? "체크포인트 이력" : "Checkpoint history",
    compareVersions: ko ? "버전 비교" : "Compare versions",
    baseVersion: ko ? "기준 버전" : "Base version",
    targetVersion: ko ? "비교 버전" : "Comparison version",
    sameContent: ko ? "내용 버전이 같습니다." : "The content versions match.",
    differentContent: ko ? "내용 버전이 다릅니다." : "The content versions differ.",
    compareLimited: ko ? "항목 목록 일부만 제공되는 버전입니다. 두 원본을 열어 전체를 확인하세요." : "One version has more items than this comparison can load. Open both artifacts to review their full contents.",
    compareUnavailable: ko ? "이 형식의 항목 비교를 제공할 수 없습니다. 두 원본을 열어 확인하세요." : "Item comparison is unavailable for this format. Open both artifacts to review them.",
    itemChanges: ko ? "검토 항목 변경" : "Review item changes",
    addedItem: ko ? "추가" : "Added",
    changedItem: ko ? "수정" : "Changed",
    removedItem: ko ? "제거" : "Removed",
    discussions: ko ? "대화" : "Discussions",
    openDiscussion: ko ? "검토 중인 대화" : "Open discussion",
    resolved: ko ? "결정된 대화" : "Resolved discussion",
    owner: ko ? "소유자" : "Owner",
    earlier: ko ? "이전 기록" : "Earlier record",
    queued: ko ? "에이전트 응답 대기" : "Waiting for an agent reply",
    claimed: ko ? "에이전트 처리 중" : "Agent is working",
    leaseExpires: ko ? "작업 만료" : "Claim expires",
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
    sampleDownload: ko ? "샘플 원본 다운로드" : "Download sample source",
    sampleGuide: ko ? ["공개 샘플에서 원본과 검토 항목을 확인하세요.", "로그인한 뒤 비공개 샘플을 만들어 질문과 체크포인트를 검토하세요.", "원본을 다운로드해 내 저장소에 넣고 프로젝트를 연결한 뒤 첫 게시를 준비하세요."]
      : ["Read the source and review items in the public sample.", "Sign in and create a private sample to review questions and checkpoints.", "Download the source, add it to your repository and connect the project to prepare its first publication."],
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
      if (url.origin === location.origin && !url.pathname.startsWith("/api/") && url.pathname !== "/") return url.pathname + url.search + url.hash;
    } catch { /* Return to the project list. */ }
    return "/projects";
  };
  const route = (project, part = "main", stage = "01-domain") => `/p/${[project, part, stage].map(encodeURIComponent).join("/")}`;
  const stageTitle = (stage) => stages[Number(stage.slice(0, 2)) - 1] || stage;
  const stageStates = {
    not_started: ko ? "시작 전" : "Not started", in_progress: ko ? "진행 중" : "In progress",
    blocked: ko ? "차단됨" : "Blocked", done: ko ? "완료" : "Done",
    present: ko ? "산출물 있음" : "Artifact available", missing: ko ? "산출물 없음" : "No artifact",
    unsupported: ko ? "지원하지 않는 형식" : "Unsupported format", none: ko ? "체크포인트 없음" : "No checkpoint",
    pending: words.pending, passed: words.passed, changes_requested: words.changesRequested,
    withdrawn: words.withdrawn, historical: ko ? "이전 체크포인트" : "Historical checkpoint",
  };
  function blockerText(message) {
    const stage = /^([0-9]{2}-[a-z-]+) checkpoint is required$/.exec(message)?.[1];
    return ko && stage ? `${stage.slice(0, 2)} ${stageTitle(stage)} 체크포인트가 필요합니다.` : message;
  }

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
    $("preview-frame")?.contentWindow?.postMessage({ nexusPreviewTheme: value }, "*");
    try { localStorage.setItem("nexus.rebuild.theme", value); } catch { /* Use the current document preference. */ }
  });

  let currentSession = null;
  let currentProjects = [];
  const projectReviews = new Map();
  let reviewedPaths = {};
  let nextPage = null;
  let pending = null;
  let generation = 0;
  const reviewedPathKey = "nexus.rebuild.reviewed-paths";
  const signInPathKey = "nexus.rebuild.sign-in-path";
  const authSearch = new URLSearchParams(location.search);
  const callbackCode = page === "welcome" ? authSearch.get("sign_in_error") : null;
  const callbackMessages = { invalid_input: words.signInRetry, sign_in_required: words.signInRetry,
    rate_limited: words.rate, authentication_unavailable: words.unavailable, upstream_timeout: words.unavailable,
    internal_error: words.signInRetry };
  const recoveringSignIn = Object.hasOwn(callbackMessages, callbackCode);

  function projectHref(project, fallback = route(project)) {
    const stored = Object.hasOwn(reviewedPaths, project) && reviewedPaths[project];
    const path = safePath(typeof stored === "string" ? stored : null);
    return path.startsWith(`/p/${encodeURIComponent(project)}/`) ? path : fallback;
  }

  function rememberReview(project) {
    if (!currentSession) return;
    reviewedPaths[project] = safePath(location.href);
    try { sessionStorage.setItem(reviewedPathKey, JSON.stringify({ owner: currentSession.owner_id, paths: reviewedPaths })); }
    catch { /* Keep the current document usable without storage. */ }
  }

  function clearPrivate() {
    generation += 1;
    currentSession = null;
    currentProjects = [];
    projectReviews.clear();
    reviewedPaths = {};
    nextPage = null;
    pending = null;
    $("project-list")?.replaceChildren();
    $("stage-list")?.replaceChildren();
    $("stage-blockers")?.replaceChildren();
    for (const id of ["workspace-title", "stage-title", "stage-state"]) if ($(id)) $(id).textContent = "";
    const content = $("private-content");
    if (content instanceof HTMLFormElement) content.reset();
    if (["versions", "credentials", "preview", "publications", "checkpoint"].includes(page)) content.replaceChildren();
    for (const id of ["artifact-items", "artifact-detail", "artifact-graph", "artifact-provenance", "discussions", "checkpoint-links", "sample-copy"]) $(id)?.replaceChildren();
    visible(content, false);
    visible($("sample-copy"), false);
    for (const id of ["project-nav", "sign-out", "continue", "versions-link", "publications-link", "credentials-link", "provenance-link", "preview-link"]) visible($(id), false);
  }

  function failure(result, recoveryMessage) {
    const message = recoveryMessage ?? (result.status === 401 ? words.signIn : result.status === 404 ? words.gone
      : result.status === 403 ? words.forbidden : result.status === 409 ? words.stale : result.status === 429 ? words.rate
      : result.status === 413 ? words.tooLarge : ["authentication_unavailable", "upstream_timeout"].includes(result.value?.code) ? words.unavailable : words.failed);
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
      link.href = projectHref(item.id);
      link.append(label("p", item.synthetic ? (ko ? "비공개 · 샘플" : "Private · Sample") : (ko ? "비공개" : "Private"), "eyebrow"),
        label("h2", item.title), label("p", `${words.version} ${item.revision}`, "muted"),
        label("span", item.verification_state === "ready" ? words.confirmed : item.verification_state === "not_connected" ? words.notConnected : words.waiting, "badge"));
      const review = projectReviews.get(item.id);
      if (review) {
        if (review.current_stage) link.append(label("p", `${ko ? "현재 단계" : "Current stage"} · ${stageTitle(review.current_stage)}`));
        const checkpoint = review.checkpoint_state === "none" ? stageStates.none : `${words.checkpoint} · ${stageStates[review.checkpoint_state]}`;
        const discussions = ko ? `열린 대화 ${review.waiting_discussions}건` : `Open discussions ${review.waiting_discussions}`;
        link.append(label("p", `${discussions} · ${checkpoint}`, "small muted"));
        if (review.published_at) {
          const published = new Date(review.published_at).toLocaleString(ko ? "ko-KR" : "en", { dateStyle: "medium", timeStyle: "short" });
          link.append(label("p", `${ko ? "최근 게시" : "Latest publication"} · ${published}`, "small muted"));
        }
      }
      return link;
    });
    $("project-list").replaceChildren(...cards);
    $("project-empty-message").textContent = text ? words.filtered : words.empty;
    visible($("project-empty"), cards.length === 0);
    visible($("project-copy-sample"), !text && currentProjects.length === 0);
    visible($("project-clear-search"), Boolean(text));
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
    if (!cursor) projectReviews.clear();
    for (const summary of result.value.review_summaries ?? []) projectReviews.set(summary.project_id, summary);
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
    const selection = new URL(location.href).searchParams;
    const history = selection.has("version") || selection.has("publication_id");
    if (!selected && !history) {
      if (rows.length) location.replace(route(project, rows[0].part, rows[0].stage));
      else statusMessage(words.gone, true);
      return;
    }
    $("workspace-title").textContent = result.value.project.title;
    publishLinks(project);
    const picker = $("part-picker");
    const parts = [...new Set([...rows.map((row) => row.part), part])];
    picker.replaceChildren(...parts.map((name) => {
      const option = label("option", name);
      option.value = name;
      return option;
    }));
    picker.value = part;
    visible(picker, parts.length > 1);
    picker.onchange = () => location.assign(route(project, picker.value, stage));
    $("stage-title").textContent = `${stage.slice(0, 2)} ${stageTitle(stage)}`;
    $("stage-state").textContent = words.loading;
    const latest = $("latest-workspace");
    latest.href = route(project, part, stage);
    visible(latest, history);
    const navigation = selected ? rows.filter((item) => item.part === part) : [{ stage }];
    $("stage-list").replaceChildren(...navigation.map((item) => {
      const entry = label("li", "");
      const link = label("a", "");
      const summary = label("span", `${item.stage.slice(0, 2)} ${stageTitle(item.stage)}`);
      if (item.work_state) {
        entry.dataset.state = item.work_state;
        summary.append(label("span", [item.work_state, item.artifact_state, item.checkpoint_state]
          .map((key) => stageStates[key]).filter(Boolean).join(" · "), "stage-summary small muted"));
      }
      link.append(summary);
      link.href = route(project, part, item.stage);
      if (item.stage === stage) link.setAttribute("aria-current", "page");
      entry.append(link);
      return entry;
    }));
    statusMessage();
    visible($("private-content"), true);
    await workspaceArtifact(project, part, stage, item, read);
  }

  function sourceMetadata(source) {
    const list = label("dl", "", "review-fields");
    for (const [name, value] of [[ko ? "원본 저장소" : "Source repository", source.repository_url],
      [ko ? "원본 경로" : "Source path", source.path], [ko ? "원본 커밋" : "Source commit", source.commit],
      [ko ? "콘텐츠 버전" : "Content version", source.content_version]]) {
      list.append(label("dt", name), label("dd", value, "mono"));
    }
    return list;
  }

  function sourceLink(source, id = "provenance-link") {
    const metadata = $("artifact-provenance");
    if (metadata) {
      metadata.replaceChildren(...(source ? [sourceMetadata(source)] : []));
      visible(metadata, Boolean(source));
    }
    const anchor = $(id);
    if (!anchor) return;
    const href = githubSourceURL(source);
    visible(anchor, Boolean(href));
    if (!href) return;
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = `${source.path} · ${source.commit.slice(0, 8)}`;
  }

  function githubSourceURL(source) {
    if (!source) return null;
    try {
      const repository = new URL(source.repository_url);
      if (repository.origin !== "https://github.com" || !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.pathname) ||
          !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(source.commit) ||
          source.path.split("/").some((part) => !part || part === "." || part === "..")) return null;
      const line = Number.isSafeInteger(source.line) && source.line > 0 ? `#L${source.line}` : "";
      return `${repository.origin}${repository.pathname}/blob/${source.commit}/${source.path.split("/").map(encodeURIComponent).join("/")}${line}`;
    } catch { return null; }
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
    let exact = parameters.size ? `?${parameters}` : "";
    const requestPath = `/api/v2/projects/${project}/stages/${encodeURIComponent(part)}/${stage}`;
    if (cursor) parameters.set("cursor", cursor);
    const query = parameters.size ? `?${parameters}` : "";
    const retry = $("artifact-retry");
    visible(retry, false);
    const itemPath = `${requestPath}/items/${encodeURIComponent(itemId)}`;
    let [artifact, item] = await Promise.all([api(requestPath + query),
      itemId && !cursor ? api(itemPath + exact) : null]);
    if (read !== generation) return;
    if (!artifact.ok) {
      $("stage-state").textContent = "";
      failure(artifact);
      if (artifact.status === 0 || artifact.status >= 500) {
        visible(retry, true);
        retry.onclick = () => workspaceArtifact(project, part, stage, itemId, read, cursor);
      }
      return;
    }
    const data = artifact.value;
    if (item?.status === 404 && !exact && data.source) {
      const pinned = `?${new URLSearchParams({ version: data.source.content_version, publication_id: data.source.publication_id })}`;
      const removed = await api(itemPath + pinned);
      if (read !== generation) return;
      if (removed.ok && removed.value.removed) {
        exact = pinned;
        item = removed;
        window.history.replaceState(null, "", location.pathname + pinned + location.hash);
        const latest = $("latest-workspace");
        latest.href = route(project, part, stage);
        visible(latest, true);
      }
    }
    const missing = data.representation === "missing", unsupported = data.representation === "unsupported";
    $("stage-state").textContent = missing ? words.noSource : unsupported ? words.unsupported : words.present;
    sourceLink(data.source);
    if (!cursor) {
      $("stage-blockers").replaceChildren(...[...data.stage.blockers.map(blockerText), ...data.diagnostics].map((message) => label("li", message)));
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
    if (!cursor && (itemId === null || item?.ok)) {
      rememberReview(project);
      if (data.source) await discussionPanel(project, part, stage, item?.value ?? null, data, read);
    }
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
    $("back-project").href = projectHref(project, entry ? route(project, entry.part, entry.stage) : "/projects");
    visible(root, true);
    if (page === "versions") await renderVersions(project, root, read);
    if (page === "publications") await renderPublications(project, root, data, held_commit, read);
    if (page === "credentials") await renderCredentials(project, root, read, data.title);
    if (page === "preview") await renderPreview(project, root, read);
    if (page === "checkpoint") await renderCheckpoint(project, root, read);
  }

  const versionSlot = ({ part, stage }) => `${part}\0${stage}`;
  const versionTitle = (version) => `${words.version} ${version.publication_revision} · ${version.part} · ${stageTitle(version.stage)} · ${version.commit.slice(0, 8)}`;
  const versionAddress = (project, { part, stage, publication_id }) =>
    route(project, part, stage) + "?" + new URLSearchParams({ publication_id });

  function versionLink(project, version, caption = versionTitle(version)) {
    const link = label("a", caption);
    link.href = versionAddress(project, version);
    return link;
  }

  function versionEntry(project, version, latest) {
    const row = label("li", "", "version-entry stack");
    const state = label("div", "", "row");
    state.append(label("span", version.held ? words.currentVersion : words.earlierVersion, "badge"),
      label("span", checkpointLabel(version.checkpoint_state), "badge"));
    const actions = label("div", "", "row");
    if (!version.held && latest) actions.append(versionLink(project, latest, words.latestSource));
    for (const [index, id] of (version.matching_checkpoint_ids ?? []).entries()) {
      const caption = index === 0 ? words.historyReview : `${words.historyReview} · ${index + 1}`;
      const link = label("a", caption);
      link.href = decisionURL(project, version.part, version.stage, id);
      actions.append(link);
    }
    row.append(versionLink(project, version), state, label("p", `${words.sourceCommit} ${version.commit}`, "mono muted"),
      label("p", `${words.contentVersion} ${version.content_version}`, "mono muted"));
    if (actions.childElementCount) row.append(actions);
    return row;
  }

  function versionItemChanges(before, after) {
    const indexed = (data) => new Map(data.items.filter((item) => !item.removed).map((item) => [item.id, item]));
    const content = ({ title, kind, fields }) => JSON.stringify([title, kind, Object.entries(fields).sort()]);
    const previous = indexed(before), next = indexed(after);
    const keys = new Set([...previous.keys(), ...next.keys()]);
    const changes = [];
    for (const id of [...keys].sort()) {
      const old = previous.get(id), item = next.get(id);
      if (!old) changes.push([words.addedItem, item]);
      else if (!item) changes.push([words.removedItem, old]);
      else if (content(old) !== content(item)) changes.push([words.changedItem, item]);
    }
    return changes;
  }

  function versionComparison(project, entries, read) {
    const section = label("section", "", "stack");
    const result = label("div", "", "stack");
    result.setAttribute("aria-live", "polite");
    const form = label("form", "", "stack");
    const baseLabel = label("label", words.baseVersion), targetLabel = label("label", words.targetVersion);
    const base = document.createElement("select"), target = document.createElement("select");
    baseLabel.append(base);
    targetLabel.append(target);
    const show = label("button", words.compareVersions, "button");
    show.type = "submit";
    form.append(baseLabel, targetLabel, show);
    section.append(label("h2", words.compareVersions), form, result);

    function fill(select, versions) {
      const selected = select.value;
      select.replaceChildren(...versions.map((version) => {
        const option = label("option", versionTitle(version));
        option.value = version.artifact_id;
        return option;
      }));
      if (versions.some(({ artifact_id }) => artifact_id === selected)) select.value = selected;
    }
    function targets() {
      const version = entries.get(base.value);
      fill(target, version ? [...entries.values()].filter((entry) =>
        entry.artifact_id !== version.artifact_id && versionSlot(entry) === versionSlot(version)) : []);
    }
    base.addEventListener("change", () => { targets(); result.replaceChildren(); });
    target.addEventListener("change", () => result.replaceChildren());
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const left = entries.get(base.value), right = entries.get(target.value);
      if (show.disabled || !left || !right || versionSlot(left) !== versionSlot(right)) return;
      const links = label("div", "", "row");
      links.append(versionLink(project, left), versionLink(project, right));
      result.replaceChildren(links);
      statusMessage();
      if (left.content_version === right.content_version) { result.append(label("p", words.sameContent)); return; }
      show.disabled = true;
      result.setAttribute("aria-busy", "true");
      try {
        const responses = await Promise.all([left, right].map((version) => api(`/api/v2/projects/${project}/stages/` +
          `${encodeURIComponent(version.part)}/${version.stage}?` + new URLSearchParams({
            publication_id: version.publication_id, version: version.content_version, limit: "100",
          }))));
        if (read !== generation || base.value !== left.artifact_id || target.value !== right.artifact_id) return;
        const failed = responses.find((response) => !response.ok);
        if (failed) { failure(failed); return; }
        result.append(label("p", words.differentContent));
        const artifacts = responses.map(({ value }) => value);
        if (artifacts.some(({ representation, source }) => !source || ["missing", "unsupported", "html"].includes(representation))) {
          result.append(label("p", words.compareUnavailable, "muted"));
        } else if (artifacts.some(({ next_cursor }) => next_cursor)) {
          result.append(label("p", words.compareLimited, "muted"));
        } else {
          const changes = versionItemChanges(...artifacts);
          const list = label("ul", "");
          for (const [change, item] of changes) list.append(label("li", `${change} · ${item.id} · ${item.title}`));
          result.append(label("p", `${words.itemChanges} (${changes.length})`));
          if (changes.length) result.append(list);
        }
      } finally {
        show.disabled = false;
        result.removeAttribute("aria-busy");
      }
    });
    return { section, update() {
      const slots = new Map();
      for (const entry of entries.values()) slots.set(versionSlot(entry), (slots.get(versionSlot(entry)) || 0) + 1);
      const comparable = [...entries.values()].filter((entry) => slots.get(versionSlot(entry)) > 1);
      fill(base, comparable);
      targets();
      visible(section, Boolean(comparable.length));
    } };
  }

  async function renderVersions(project, root, read) {
    const entries = new Map(), latest = new Map();
    const comparison = versionComparison(project, entries, read);
    const list = label("ul", "", "review-items");
    const empty = label("div", "", "stack");
    const publish = label("a", ko ? "게시 상태 열기" : "Open publications", "button");
    publish.href = `/p/${project}/publications`;
    empty.append(label("p", words.waiting, "muted"), publish);
    const more = label("button", words.more);
    more.type = "button";
    let cursor = null;
    let loading = false;
    async function load() {
      if (loading) return;
      loading = true;
      more.disabled = true;
      try {
        const response = await api(`/api/v2/projects/${project}/versions${cursor ? "?" + new URLSearchParams({ cursor }) : ""}`);
        if (read !== generation) return;
        if (!response.ok) {
          failure(response);
          more.textContent = words.refresh;
          visible(more, response.status !== 401);
          return;
        }
        for (const version of response.value.versions) {
          entries.set(version.artifact_id, version);
          if (version.held) latest.set(versionSlot(version), version);
        }
        for (const version of response.value.versions) list.append(versionEntry(project, version, latest.get(versionSlot(version))));
        comparison.update();
        cursor = response.value.next_cursor;
        more.textContent = words.more;
        visible(more, Boolean(cursor));
        visible(empty, !entries.size);
        statusMessage();
      } finally {
        loading = false;
        more.disabled = false;
      }
    }
    for (const node of [comparison.section, empty, more]) visible(node, false);
    more.addEventListener("click", load);
    root.replaceChildren(comparison.section, list, empty, more);
    await load();
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

  async function renderPublications(project, root, data, commit, read) {
    const endpoint = `/api/v2/projects/${project}`;
    const title = label("h2", "");
    const repository = label("p", "", "muted");
    const received = label("section", "", "stack");
    received.setAttribute("aria-label", words.receipt);
    const refresh = label("button", words.refresh);
    refresh.type = "button";
    const consent = label("section", "", "stack");
    consent.append(label("p", words.reviewConsent));
    actionForm([field("preview_digest", words.digest, { minLength: 64, maxLength: 64, pattern: "[0-9a-f]{64}", autocomplete: "off" })],
      words.consent, async ({ payload, key }) => {
        const result = await mutation(`${endpoint}/publication-consents`, JSON.stringify({ ...JSON.parse(payload), consent: true }), key);
        if (read !== generation) return false;
        if (!result.ok) { failure(result); return false; }
        statusMessage(`${words.consentRecorded} ${result.value.id}`);
        return true;
      }, consent);

    const compare = label("form", "", "stack");
    const expected = field("expected_commit", words.verifyCommit, { maxLength: 64, pattern: "(?:[0-9a-f]{40}|[0-9a-f]{64})", autocomplete: "off", spellcheck: false });
    const compareAction = label("button", words.compareCommit);
    compareAction.type = "submit";
    const comparison = label("p", "");
    comparison.setAttribute("role", "status");
    compare.append(expected, compareAction, comparison);
    let confirmed = null, compared = null;
    const showComparison = () => {
      visible(comparison, compared !== null);
      comparison.textContent = compared === confirmed ? words.commitReceived : words.commitPending;
    };
    compare.addEventListener("input", () => { compared = null; showComparison(); });
    compare.addEventListener("submit", (event) => {
      event.preventDefault();
      compared = new FormData(compare).get("expected_commit");
      showComparison();
    });
    showComparison();

    const help = label("details", "");
    const samples = label("a", words.sampleGuideLink, "button");
    samples.href = "/learn/sample";
    const credentials = label("a", words.issue, "button");
    credentials.href = `/p/${project}/settings/credentials`;
    const command = label("p", "", "mono");
    help.append(label("summary", words.publicationHelp), label("p", words.publicationPrepare),
      label("p", `hub.py preview-v2 PROJECT --project-id ${project}`, "mono"), label("p", words.publicationCredential),
      command, label("p", words.publicationDiagnostics));
    const related = label("div", "", "row");
    related.append(credentials, samples);
    help.append(related);
    root.replaceChildren(title, repository, received, refresh, consent, compare, help);

    function showProject(projectData, held) {
      title.textContent = projectData.title;
      repository.textContent = `${projectData.repository_url} · ${projectData.default_branch}`;
      visible(repository, Boolean(projectData.repository_url));
      const canPublish = Boolean(projectData.repository_url && !projectData.synthetic);
      visible(consent, canPublish && !held);
      visible(compare, canPublish);
      visible(help, canPublish);
      const argument = held ? `--base-commit ${held}` : "--consent CONSENT_ID";
      command.textContent = `hub.py publish-v2 PROJECT --project-id ${project} ${argument}`;
      if (!confirmed) received.replaceChildren(label("p", held ? words.receiptPending : words.waiting));
    }

    async function verifyReceipt(held) {
      if (!held) { statusMessage(); return; }
      const [versions, events] = await Promise.all([api(`${endpoint}/versions?limit=1`), api(`${endpoint}/events?limit=100`)]);
      if (read !== generation) return;
      if (!versions.ok) { failure(versions); return; }
      if (events.status === 401) { failure(events); return; }
      const version = versions.value.versions[0];
      if (version?.commit !== held) { statusMessage(words.receiptPending); return; }
      const response = await api(`${endpoint}/publications/${encodeURIComponent(version.publication_id)}`);
      if (read !== generation) return;
      if (!response.ok) { failure(response); return; }
      const receipt = response.value;
      if (!receipt.sent || receipt.id !== version.publication_id || receipt.held_commit !== held || receipt.revision !== version.publication_revision) {
        statusMessage(words.receiptPending);
        return;
      }
      const source = label("a", words.openReviewedVersion, "button");
      source.href = route(project, version.part, version.stage) + "?" + new URLSearchParams({ publication_id: receipt.id });
      received.replaceChildren(label("h3", words.receipt), label("p", `${words.version} ${receipt.revision} · ${receipt.held_commit}`, "mono"),
        label("p", `${words.receiptId} · ${receipt.id}`, "mono"),
        label("p", `${words.receivedAt} · ${new Date(version.published_at).toLocaleString(rootLanguage())}`), source);
      const event = events.value?.events?.find((entry) => entry.kind === "publication" && entry.target_id === receipt.id && entry.content_version === receipt.snapshot_digest);
      if (event) received.append(label("p", `${words.receiptEvent} · ${event.sequence}`, "muted"));
      confirmed = receipt.held_commit;
      showComparison();
      if (events.ok) statusMessage(); else failure(events);
    }

    async function load(initial) {
      refresh.disabled = true;
      received.setAttribute("aria-busy", "true");
      try {
        if (!initial) {
          const result = await api(endpoint);
          if (read !== generation) return;
          if (!result.ok) {
            if ([403, 404].includes(result.status)) clearPrivate();
            failure(result);
            return;
          }
          data = result.value.project;
          commit = result.value.held_commit;
        }
        showProject(data, commit);
        await verifyReceipt(commit);
      } finally {
        received.setAttribute("aria-busy", "false");
        refresh.disabled = false;
      }
    }
    refresh.addEventListener("click", () => load(false));
    await load(true);
  }

  function showCredentialSecret(root, secret) {
    const section = label("section", "", "panel stack");
    section.setAttribute("aria-label", words.singleSecret);
    const wrapper = field("", words.singleSecret, { value: secret, readOnly: true, autocomplete: "off", spellcheck: false });
    const input = wrapper.querySelector("input");
    const close = label("button", words.close);
    close.type = "button";
    function clearSecret() {
      input.value = "";
      section.remove();
      removeEventListener("pagehide", clearSecret);
    }
    close.addEventListener("click", () => {
      clearSecret();
      root.querySelector('input[name="label"]')?.focus();
    });
    addEventListener("pagehide", clearSecret, { once: true });
    section.append(label("p", words.copyThenClose), wrapper, close);
    root.prepend(section);
    input.focus();
  }

  function confirmCredentialRevocation(project, root, read, title, credential, trigger, key) {
    const dialog = label("dialog", "", "panel confirmation-dialog");
    const heading = label("h2", words.confirmRevoke);
    heading.id = "credential-revoke-heading";
    dialog.setAttribute("aria-labelledby", heading.id);
    const error = label("p", "", "error");
    error.setAttribute("role", "alert");
    const cancel = label("button", words.cancel);
    const submit = label("button", words.confirmRevoke, "primary");
    cancel.type = submit.type = "button";
    cancel.addEventListener("click", () => dialog.close());
    const actions = label("div", "", "row");
    actions.append(cancel, submit);
    const name = credential.role === "publisher" ? words.publisher : words.agent;
    dialog.append(heading, label("p", `${title} · ${credential.label} · ${name}`), label("p", words.revokeScope), error, actions);
    dialog.addEventListener("close", () => { dialog.remove(); if (trigger.isConnected) trigger.focus(); });
    dialog.addEventListener("cancel", (event) => { if (submit.disabled) event.preventDefault(); });
    submit.addEventListener("click", async () => {
      submit.disabled = cancel.disabled = true;
      const result = await mutation(`/api/v2/projects/${project}/credentials/${encodeURIComponent(credential.id)}/revoke`, JSON.stringify({ credential_id: credential.id }), key);
      if (read !== generation) return;
      if (!result.ok) {
        failure(result);
        error.textContent = status.textContent;
        submit.disabled = cancel.disabled = false;
        return;
      }
      dialog.close();
      trigger.replaceWith(label("span", words.revoked, "muted"));
      await renderCredentials(project, root, read, title);
      root.querySelector("h2")?.focus();
    });
    root.append(dialog);
    dialog.showModal();
    cancel.focus();
  }

  async function renderCredentials(project, root, read, title) {
    const path = `/api/v2/projects/${project}/credentials`;
    const response = await api(path);
    if (read !== generation) return;
    if (!response.ok) { failure(response); return; }
    const heading = label("h2", `${words.credentialScope} · ${title}`);
    heading.tabIndex = -1;
    root.replaceChildren(heading, label("p", words.credentialRoles));
    const list = label("ul", "", "review-items");
    for (const credential of response.value.credentials) {
      const row = label("li", "");
      const name = credential.role === "publisher" ? words.publisher : words.agent;
      row.append(label("p", `${credential.label} · ${name}`),
        label("p", `${words.credentialCreated} · ${new Date(credential.created_at).toLocaleString(rootLanguage())}`, "muted"));
      if (credential.revoked) row.append(label("span", words.revoked, "muted"));
      else {
        const revoke = label("button", words.revoke);
        revoke.type = "button";
        const key = crypto.randomUUID();
        revoke.addEventListener("click", () => confirmCredentialRevocation(project, root, read, title, credential, revoke, key));
        row.append(revoke);
      }
      list.append(row);
    }
    if (list.childElementCount) root.append(label("p", words.credentialLastUse, "muted"), list);
    else root.append(label("p", words.credentialEmpty, "muted"));
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
      if (read !== generation) return false;
      if (!result.ok) { failure(result); return false; }
      await renderCredentials(project, root, read, title);
      if (read !== generation) return false;
      if (result.value.secret) showCredentialSecret(root, result.value.secret);
      else statusMessage(words.issued);
      return true;
    }, root);
    statusMessage();
  }

  async function renderPreview(project, root, read) {
    const id = location.pathname.split("/").at(-1);
    const version = new URL(location.href).searchParams.get("version");
    const response = await api(`/api/v2/projects/${project}/previews/${id}${version ? "?" + new URLSearchParams({ version }) : ""}`);
    if (read !== generation) return;
    if (!response.ok) {
      failure(response, response.status === 404 ? words.previewUnavailable : undefined);
      if (response.status === 0 || response.status >= 500) {
        const retry = label("button", ko ? "다시 시도" : "Try again");
        retry.type = "button";
        retry.onclick = () => { retry.disabled = true; renderPreview(project, root, read); };
        root.replaceChildren(retry);
      }
      return;
    }
    const { source, part, content_version, html } = response.value;
    $("back-project").href = route(project, part, "09-mockup") + "?" + new URLSearchParams({ version: content_version, publication_id: source.publication_id });
    const frame = document.createElement("iframe");
    frame.id = "preview-frame";
    frame.className = "preview-frame";
    frame.title = words.preview;
    frame.setAttribute("sandbox", "allow-scripts");
    frame.referrerPolicy = "no-referrer";
    const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
    // Messages cross into the opaque preview with a theme value only.
    const themeInput = `<script>addEventListener("message", (event) => {
      const value = event.data?.nexusPreviewTheme;
      if (event.source !== parent || event.origin !== ${JSON.stringify(location.origin)} || !["light", "dark"].includes(value)) return;
      const button = document.querySelector("button#theme");
      const action = value === "dark" ? "다크 모드로 전환" : "라이트 모드로 전환";
      if (button?.getAttribute("aria-label") === action) button.click();
      document.documentElement.dataset.theme = value;
      document.documentElement.style.colorScheme = value;
    });</script>`;
    frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}">${themeInput}` + html.replace(/^\s*<!doctype html>/i, "");
    const tools = label("div", "", "row preview-tools");
    tools.setAttribute("role", "group");
    tools.setAttribute("aria-label", ko ? "미리 보기 화면 폭" : "Preview width");
    for (const width of [0, 320, 390, 768, 1440]) {
      const control = label("button", width ? `${width} px` : ko ? "자동" : "Auto");
      control.type = "button";
      control.setAttribute("aria-pressed", String(width === 0));
      control.onclick = () => {
        for (const button of tools.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button === control));
        frame.dataset.width = String(width);
      };
      tools.append(control);
    }
    const viewport = label("div", "", "preview-viewport");
    viewport.append(frame);
    const guidance = label("p", ko ? "격리된 미리 보기에서는 외부 리소스가 표시되지 않을 수 있습니다." : "Some external resources may be unavailable in the isolated preview.", "small muted");
    const href = githubSourceURL(source);
    if (href) {
      const openSource = label("a", ko ? "원본 HTML 열기" : "Open source HTML", "button");
      openSource.href = href;
      openSource.target = "_blank";
      openSource.rel = "noopener noreferrer";
      tools.append(openSource);
    }
    root.replaceChildren(sourceMetadata(source), tools, guidance, viewport);
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
    for (const [index, id] of artifact.checkpoint_ids.slice(0, 10).entries()) {
      const text = index === 0 ? words.checkpoint : `${words.checkpoint} · ${id.slice(-6)}`;
      const link = label("a", text, "button");
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
    const draft = retainDraft ? root.querySelector("textarea[name=reason]")?.value ??
      root.querySelector("[data-checkpoint-draft]")?.textContent ?? "" : "";
    const focus = root.contains(document.activeElement) ? document.activeElement.dataset.checkpointFocus : null;
    const current = checkpoint.current_source;
    const historical = current?.content_version !== checkpoint.content_version;
    const versionURL = route(project, checkpoint.part, checkpoint.stage) + "?" + new URLSearchParams({
      publication_id: checkpoint.publication_id, version: checkpoint.content_version,
    });
    const source = label("a", words.openReviewedVersion, "button");
    source.href = versionURL;
    source.dataset.checkpointFocus = "source";
    $("back-project").href = route(project, checkpoint.part, checkpoint.stage);
    const status = label("p", checkpointLabel(checkpoint.state), "badge");
    const heading = label("h2", `${checkpoint.stage.slice(0, 2)} ${stageTitle(checkpoint.stage)}`);
    const sources = label("div", "", "row");
    sources.append(source);
    if (current && current.publication_id !== checkpoint.publication_id) {
      const latest = versionLink(project, { part: checkpoint.part, stage: checkpoint.stage, ...current }, words.latestSource);
      latest.className = "button";
      latest.dataset.checkpointFocus = "latest";
      sources.append(latest);
    }
    root.replaceChildren(heading, status, sources,
      label("p", `${words.sourceCommit} ${checkpoint.source_commit || words.unverified}`, "mono muted"),
      label("p", `${words.contentVersion} ${checkpoint.content_version}`, "mono muted"));
    if (historical) root.append(label("p", words.historicalReview, "muted"));
    if (checkpoint.blockers.length) {
      const errors = label("ul", "");
      errors.append(...checkpoint.blockers.map((detail) => label("li", blockerText(detail))));
      root.append(errors);
    }
    const history = label("ul", "", "checkpoint-history");
    const decisionIds = new Set(checkpoint.history.map(({ id }) => id));
    for (const entry of checkpoint.history) {
      const row = label("li", "");
      row.id = `checkpoint-decision-${entry.id}`;
      const actor = entry.decided_by === currentSession?.owner_id ? words.owner : entry.decided_by;
      row.append(label("strong", checkpointLabel(entry.decision)),
        label("p", `${actor} · ${new Date(entry.decided_at).toLocaleString(rootLanguage())}`, "muted"));
      if (entry.reason) row.append(label("p", entry.reason, "thread-text"));
      if (decisionIds.has(entry.prior_decision_id)) {
        const prior = label("a", words.originalDecision);
        prior.href = `#checkpoint-decision-${entry.prior_decision_id}`;
        prior.dataset.checkpointFocus = `history-${entry.id}`;
        row.append(prior);
      }
      history.append(row);
    }
    if (history.children.length) root.append(history);
    const canDecide = !historical && ["pending", "withdrawn"].includes(checkpoint.state) && !checkpoint.blockers.length;
    const previous = checkpoint.history.at(-1);
    const canWithdraw = !historical && previous && ["passed", "changes_requested"].includes(checkpoint.state);
    if (canDecide || canWithdraw) {
      const decisionField = label("label", words.decision);
      const choices = document.createElement("select");
      choices.required = true;
      choices.name = "decision";
      choices.dataset.checkpointFocus = "choice";
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
      const reasonInput = reasonField.querySelector("textarea");
      reasonInput.value = draft;
      reasonInput.dataset.checkpointFocus = "reason";
      const fields = [decisionField, reasonField];
      if (canWithdraw) {
        const effect = label("p", words.withdrawalEffect, "muted");
        effect.id = "checkpoint-withdrawal-effect";
        const confirmation = label("label", "", "checkpoint-confirm");
        const checkbox = document.createElement("input");
        checkbox.name = "confirm_withdrawal";
        checkbox.type = "checkbox";
        checkbox.required = true;
        checkbox.setAttribute("aria-describedby", effect.id);
        checkbox.dataset.checkpointFocus = "confirm";
        confirmation.append(checkbox, document.createTextNode(words.confirmWithdrawal));
        fields.push(effect, confirmation);
      }
      const form = actionForm(fields, words.recordDecision, async ({ payload, key }) => {
        const { decision, reason } = JSON.parse(payload);
        const exact = { content_version: checkpoint.content_version, expected_revision: checkpoint.revision, reason };
        const body = canWithdraw ? { ...exact, prior_decision_id: previous.id } : { ...exact, decision };
        const result = await mutation(endpoint + (canWithdraw ? "/withdrawals" : "/decisions"), JSON.stringify(body), key);
        if (!result.ok) { failure(result); return false; }
        await renderCheckpoint(project, root, read);
        return true;
      }, root);
      form.querySelector("button[type=submit]").dataset.checkpointFocus = "submit";
    } else if (draft) {
      const note = label("div", "", "stack");
      const text = label("p", draft, "thread-text");
      text.dataset.checkpointDraft = "";
      note.append(label("h3", words.savedDraft), text);
      root.append(note);
    }
    const refresh = label("button", words.refresh);
    refresh.type = "button";
    refresh.dataset.checkpointFocus = "refresh";
    refresh.addEventListener("click", async () => {
      if (root.hasAttribute("aria-busy")) return;
      root.setAttribute("aria-busy", "true");
      try { await renderCheckpoint(project, root, read, true); }
      finally { root.removeAttribute("aria-busy"); }
    });
    root.append(refresh);
    if (focus) {
      const target = [...root.querySelectorAll("[data-checkpoint-focus]")].find((node) => node.dataset.checkpointFocus === focus);
      (target || refresh).focus({ preventScroll: true });
    }
    statusMessage();
  }

  const rootLanguage = () => ko ? "ko-KR" : "en";
  const checkpointLabel = (value) => ({
    pending: words.pending, pass: words.pass, passed: words.passed, changes_requested: words.changesRequested,
    withdraw: words.withdraw, withdrawn: words.withdrawn, superseded: words.superseded,
    none: words.noCheckpoint, historical: words.historicalCheckpoint,
  })[value] || value;

  function discussionForm(root, { fieldLabel, caption, extras, read, submit, saved }) {
    const field = submissionField("body", fieldLabel);
    const input = field.querySelector("textarea");
    input.removeAttribute("maxlength");
    const error = label("p", "", "notice error");
    error.id = `discussion-error-${crypto.randomUUID()}`;
    error.setAttribute("role", "alert");
    error.hidden = true;
    input.setAttribute("aria-describedby", error.id);
    const required = ko ? `${fieldLabel} 내용을 입력해 주세요.` : `Enter text in the ${fieldLabel.toLowerCase()} field.`;
    const invalid = ko ? `${fieldLabel} 내용을 확인해 주세요.` : `Check the ${fieldLabel.toLowerCase()} text.`;
    function report(message) {
      error.textContent = message;
      visible(error, Boolean(message));
      if (message) {
        input.setAttribute("aria-invalid", "true");
        input.focus();
      } else input.removeAttribute("aria-invalid");
    }
    input.addEventListener("input", () => report(""));
    const form = actionForm([field, error, ...extras], caption, async ({ payload, key }) => {
      const content = JSON.parse(payload);
      const body = content.body;
      const issue = !body.trim() ? required : !body.isWellFormed() ? invalid
        : Array.from(body).length > 8000 || new TextEncoder().encode(body).length > 32768 ? words.tooLarge : "";
      if (issue) { report(issue); return false; }
      report("");
      const result = await submit(content, key);
      if (read !== generation) return false;
      if (!result.ok) {
        const problem = result.value;
        if (result.status === 413 || problem?.code === "invalid_input") {
          const hint = problem?.traceId ? ` (${problem.code} · ${problem.traceId})` : "";
          report((result.status === 413 ? words.tooLarge : invalid) + hint);
        } else failure(result);
        return false;
      }
      await saved();
      return true;
    }, root);
    form.noValidate = true;
    return input;
  }

  function discussionVersionLink(project, note, source, caption) {
    const itemPath = note.item_id ? `/items/${encodeURIComponent(note.item_id)}` : "";
    const query = new URLSearchParams({ publication_id: source.publication_id, version: source.content_version });
    const link = label("a", caption);
    link.href = `${route(project, note.part, note.stage)}${itemPath}?${query}#discussion-${encodeURIComponent(note.id)}`;
    return link;
  }

  function makeThread(note, project, source, refresh, read) {
    const card = label("article", "", "thread stack");
    card.id = `discussion-${note.id}`;
    card.tabIndex = -1;
    const heading = label("h4", note.removed_item ? words.removed : note.state === "resolved" ? words.resolved : words.openDiscussion);
    const origin = discussionVersionLink(project, note, note, `${words.version} · ${note.content_version.slice(0, 8)}`);
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
      const activity = label("div", "");
      activity.append(label("p", text, "badge"));
      if (work.state === "claimed" && work.lease_expires_at) {
        const expiry = new Date(work.lease_expires_at);
        const time = label("time", expiry.toLocaleString(rootLanguage(), { dateStyle: "medium", timeStyle: "long" }));
        time.dateTime = work.lease_expires_at;
        const lease = label("p", `${words.leaseExpires} `, "muted small");
        lease.append(time);
        activity.append(lease);
      }
      card.append(activity);
    }
    for (const proposal of note.proposals) {
      const row = label("article", "");
      row.append(label("strong", words.proposal), label("p", proposal.body, "thread-text"),
        label("p", proposalState(proposal.state), "muted"));
      if (proposal.reflection) {
        row.append(discussionVersionLink(project, note, proposal.reflection,
          `${words.openReviewedVersion} · ${proposal.reflection.source_commit.slice(0, 8)}`));
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
      discussionForm(detail, { fieldLabel: words.decision, caption: words.recordDecision, read,
        extras: [label("p", `${words.version} ${source.publication_revision} · ${source.commit}`, "muted mono")],
        submit: ({ body }, key) => mutation(`/api/v2/projects/${project}/discussions/${note.id}/decisions`,
          JSON.stringify({ body, expected_revision: note.revision, publication_id: source.publication_id, source_commit: source.commit }), key),
        saved: refresh,
      });
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
    let question;
    const load = async (cursor, openingFocus) => {
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
      if (openingFocus && !openingFocus.aborted && document.activeElement === document.body) {
        const thread = document.getElementById(location.hash.slice(1));
        if (thread?.parentElement === history) thread.focus();
        else if (!location.hash && item && !notes.length && !response.value.next_cursor) question?.focus({ preventScroll: true });
      }
    };
    if (!item?.removed && artifact.source && !["missing", "unsupported"].includes(artifact.representation)) {
      const ask = label("label", "");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.name = "ask_ai";
      check.checked = true;
      ask.append(check, document.createTextNode(words.askAI));
      const { content_version, publication_id } = artifact.source;
      question = discussionForm(root, { fieldLabel: words.question, caption: words.sendQuestion, extras: [ask], read,
        submit: ({ body, ask_ai }, key) => mutation(endpoint, JSON.stringify({
          item_id: item?.id ?? null, body, ask_ai: Boolean(ask_ai), content_version, publication_id,
        }), key),
        saved: async () => {
          await load(null);
          statusMessage(words.recorded);
        },
      });
    }
    refreshButton.addEventListener("click", () => load(null));
    visible(root, true);
    const openingFocus = new AbortController();
    const cancelFocus = () => openingFocus.abort();
    for (const type of ["pointerdown", "keydown"]) {
      document.addEventListener(type, cancelFocus, { capture: true, signal: openingFocus.signal });
    }
    try { await load(null, openingFocus.signal); }
    finally { openingFocus.abort(); }
  }

  async function savePrivateSample({ payload, key }) {
    const response = await mutation("/api/v2/sample-projects", payload, key);
    if (!response.ok) { failure(response); return false; }
    location.assign(route(response.value.id, "main", "02-prd"));
    return true;
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
        words.saveSample, savePrivateSample, section);
    }
    visible(section, true);
  }

  async function renderPublicSample() {
    const content = $("sample-content");
    const guide = label("ol", "");
    guide.append(...words.sampleGuide.map((step) => label("li", step)));
    content.replaceChildren(guide);
    const result = await api("/api/v2/sample");
    content.setAttribute("aria-busy", "false");
    if (!result.ok) {
      failure(result);
      const refresh = label("button", words.refresh);
      refresh.type = "button";
      refresh.addEventListener("click", () => location.reload());
      content.append(refresh);
      return;
    }
    for (const source of result.value.source_files) {
      const download = label("a", words.sampleDownload, "button");
      const name = source.path.split("/").at(-1);
      download.download = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.md$/.test(name) ? name : "sample.txt";
      download.href = URL.createObjectURL(new Blob([source.content_utf8], { type: "text/plain; charset=utf-8" }));
      const url = download.href;
      addEventListener("pagehide", (event) => { if (!event.persisted) URL.revokeObjectURL(url); });
      content.append(label("h2", source.path), download, label("pre", source.content_utf8));
    }
  }

  $("sign-in")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    statusMessage(words.signingIn);
    let next = authSearch.get("next");
    if (recoveringSignIn) {
      try { next = sessionStorage.getItem(signInPathKey); } catch { /* Use the project list. */ }
    }
    const return_path = safePath(next);
    const result = await api("/api/v2/auth/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ return_path }) });
    if (result.ok) {
      const target = new URL(result.value.authorize_url);
      if (target.protocol === "https:") {
        try { sessionStorage.setItem(signInPathKey, return_path); } catch { /* Use the project list on callback recovery. */ }
        location.assign(target.href);
        return;
      }
    }
    failure(result);
    $("sign-in").disabled = false;
  });

  $("sign-out").addEventListener("click", async () => {
    if (!currentSession) return;
    $("sign-out").disabled = true;
    const result = await api("/api/v2/session/logout", { method: "POST", headers: { "X-CSRF-Token": currentSession.csrf_token } });
    if (result.ok || result.status === 401) {
      try { sessionStorage.removeItem(reviewedPathKey); sessionStorage.removeItem(signInPathKey); } catch { /* Storage is optional. */ }
      clearPrivate();
      location.replace("/");
      return;
    }
    $("sign-out").disabled = false;
    failure(result);
  });

  $("project-search")?.addEventListener("input", renderProjects);
  $("more-projects")?.addEventListener("click", () => { if (nextPage) listProjects(nextPage); });
  $("project-clear-search")?.addEventListener("click", () => {
    $("project-search").value = "";
    renderProjects();
    $("project-search").focus();
  });
  let sampleKey = null;
  $("project-copy-sample")?.addEventListener("click", async (event) => {
    const control = event.currentTarget;
    control.disabled = true;
    sampleKey ??= crypto.randomUUID();
    if (!await savePrivateSample({ payload: JSON.stringify({ title: words.sampleProjectName }), key: sampleKey })) control.disabled = false;
  });
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
    if (recoveringSignIn) {
      const trace = authSearch.get("trace") || "";
      const metadata = /^[0-9a-f-]{36}$/.test(trace) ? ` (${callbackCode} · ${trace})` : "";
      const wait = authSearch.get("retry_after") || "";
      const delay = /^\d{1,5}$/.test(wait) ? ` (${wait}${ko ? "초" : "s"})` : "";
      statusMessage(callbackMessages[callbackCode] + delay + metadata, true);
    }
    if (page === "sample") await renderPublicSample();
    if (page !== "welcome" && page !== "sample") statusMessage(words.loading);
    const result = await api("/api/v2/session");
    if (!result.ok) {
      if (!["welcome", "sample"].includes(page) || result.status !== 401) failure(result);
      if (page === "sample") sampleActions();
      return;
    }
    currentSession = result.value;
    try {
      const saved = JSON.parse(sessionStorage.getItem(reviewedPathKey));
      if (saved?.owner === currentSession.owner_id && saved.paths && typeof saved.paths === "object") reviewedPaths = saved.paths;
      else sessionStorage.removeItem(reviewedPathKey);
      if (!recoveringSignIn) sessionStorage.removeItem(signInPathKey);
    } catch { /* The default project address stays available. */ }
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
