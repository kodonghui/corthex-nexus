// SCR-142, the owner's to-do (SPEC-042, TASK-455): what waits on the owner across every project, from API-263, with
// the projects' titles from API-262. screens.js runs it in the shell; the shell draws the title, the loading, error,
// permission and stale states, and the header.
//
// - The morning report shows the separately selected cards and their direct actions. The full inbox keeps the API's
//   oldest-first order and warns when its 5000-entry limit may have truncated the list.
// - A failed daily backup stays above the list; unavailable and stale data are labelled and can be retried.
// - Questions and proposal decisions use the shell's ten-second undo; confirmation is previewed and asked again.

import { PROJECTS_HREF, TODO_HREF, diagramApi, projectApi, projectHref, stageHref } from './address.js';
import { isRetryableOutcome, newRequestKey } from './api.js';
import { fill, h, icon } from './dom.js';
import { CLOCK_SKEW_MS, RETRY_LIMIT_MS } from './pending-actions.js';
import { STAGES, stageOf } from './stages.js';
import { dayOf, sentWords } from './states.js';

// The timeline uses the plain-language names in the selected timeline mockup.
const STAGE_LABELS = ['무엇을 만드는지 정리','꼭 필요한 기능','사용하는 순서','기능 자세히','저장할 자료','주고받는 약속','화면 목록','화면별 상태','화면 시안','할 일 나누기','만들기','검사','발표'];
const stageLabel = (id) => { const stage = stageOf(id); return stage ? STAGE_LABELS[Number(stage.number) - 1] : id; };

// Each kind's tag, as the mockup draws it.
const KINDS = Object.freeze({
  confirm: { class: 'tag gray', text: '확정' },
  proposal: { class: 'ai', text: 'AI 제안' },
  question: { class: 'tag cyan', text: '질문' },
});
// Why a diagram waits for its confirmation (OwnerTodoEntry.reason).
export const REASONS = Object.freeze({
  new: '아직 확정한 적이 없어요',
  invalidated: '지난 확정 뒤 확인할 내용이 생겼어요. 그림을 다시 확인해 주세요',
  cancelled: '확정을 취소했어요',
});

// The body of SCR-142 from data.todo (API-263) and data.projects (API-262).
export function todoBody({ address, data, shell }) {
  if (address.view !== 'todo') return projectHome(data, shell);
  const missed = shell.missed('todo');
  if (data.todo == null) return missed ? shell.errorNotice(missed, () => shell.reload())
    : [h('div', { class: 'nt warn', role: 'status' }, '할 일을 불러오지 못했어요.')];
  const stale = missed ? oldTodoNotice(shell, missed) : null;
  const entries = data.todo.entries ?? [];
  const projects = data.projects.projects ?? [];
  const warning = data.todo.backup ? backupWarning(data.todo.backup) : null;
  if (entries.length === 0) return [warning, stale, nothingToDo(projects, shell, Boolean(missed))];
  const titles = new Map(projects.map((project) => [project.name, project.title || project.name]));
  const capped = entries.length >= 5000 ? h('p', { class: 'nt warn', role: 'status' }, '할 일이 적어도 5,000개예요. 오래된 5,000개를 보여 드려요.') : null;
  const list = h('div', { class: 'morning-cards' });
  const more = h('button', { type: 'button', class: 'btn tertiary', on: { click: showMore } }, '다음 할 일 보기');
  let shown = Math.min(shell.inboxShown ?? 50, entries.length);
  for (const [index, entry] of entries.slice(0, shown).entries()) list.append(morningCard(entry, shell, titles, index + 1));
  more.hidden = shown >= entries.length;
  function showMore() {
    for (const [index, entry] of entries.slice(shown, shown + 50).entries()) list.append(morningCard(entry, shell, titles, shown + index + 1));
    shown = Math.min(shown + 50, entries.length);
    shell.inboxShown = Math.max(shell.inboxShown ?? 50, shown);
    more.hidden = shown >= entries.length;
  }
  return [warning, stale, capped, list, more];
}

// A failed refresh keeps the last answer visible but never presents it as current.
function oldTodoNotice(shell, failure) {
  return [h('div', { class: 'nt warn', role: 'status' }, '이전 정보예요. 최신 할 일을 다시 확인해 주세요.'),
    ...shell.errorNotice(failure, () => shell.reload())];
}

// Morning report: only known counts and delivery times are shown.
function projectHome(data, shell) {
  const todo = data.todo;
  const failure = shell.missed('todo');
  if (todo === null || todo === undefined) return [h('p', {}, '할 일 수를 읽지 못했어요.'),
    ...(failure ? shell.errorNotice(failure, () => shell.reload()) : [])];
  const entries = todo.morning ?? [];
  const warning = todo.backup ? backupWarning(todo.backup) : null;
  const stale = failure ? oldTodoNotice(shell, failure) : null;
  const titles = new Map((data.projects?.projects ?? []).map((project) => [project.name, project.title || project.name]));
  const hasDecisions = entries.some((entry) => entry.kind === 'question' || entry.kind === 'proposal');
  const guidance = entries.length === 0 ? (todo.entries.length ? '모든 할 일에서 확인해 주세요.' : '새 질문이나 제안이 오면 여기에 알려 드려요.')
    : !hasDecisions ? '그림 내용을 살펴본 뒤 확정을 한 번 더 확인해 주세요.'
      : shell.pending ? '버튼 하나씩 누르면 끝나요. 답변과 제안은 10초 안에 되돌릴 수 있어요.'
        : '답변과 제안을 보내려면 브라우저 저장 공간을 확인해 주세요.';
  const intro = h('div', { class: 'morning-intro' }, h('p', { class: 'sec' }, '좋은 아침이에요'),
    h('h2', {}, `오늘 할 일은 ${todo.entries.length >= 5000 ? '적어도 ' : ''}${todo.entries.length}가지예요`),
    h('p', { class: 'sec' }, guidance));
  const cards = entries.length ? h('div', { class: 'morning-cards' }, entries.map((entry, index) => morningCard(entry, shell, titles, index + 1)))
    : h('div', { class: 'empty' }, h('p', {}, todo.morning === undefined && todo.entries.length ? '아침 보고를 읽지 못했어요. 모든 할 일에서 확인해 주세요.' : '기다리는 일이 없어요.'), titles.size === 0 ? h('p', {}, '에이전트가 처음 보내면 여기에 나와요.') : null);
  return [warning, stale, timeline(data, shell), h('div', { class: 'digest-grid' },
    h('div', { class: 'digest-main' }, intro, cards, h('a', { class: 'digest-more', href: TODO_HREF }, '모든 할 일 보기')),
    digestAside(data.projects?.projects ?? [], shell))];
}

// API-262 exposes the latest delivery per project, not a complete activity history.
function digestAside(projects, shell) {
  const today = new Date(Date.now());
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() - 1);
  const now = Date.now();
  const recent = projects.filter((project) => {
    const at = Date.parse(project.pushed_at);
    return Number.isFinite(at) && at >= today.getTime() && at <= now + CLOCK_SKEW_MS;
  }).sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at)).slice(0, 5);
  const overview = projects.slice(0, 5).map((project) => {
    const count = project.stages_passed;
    const known = Number.isInteger(count) && count >= 0 && count <= STAGES.length;
    return h('li', {}, h('div', { class: 'overview-title' }, h('a', { href: projectHref(project.name) }, project.title || project.name),
      h('span', { class: 'small' }, known ? `${count}/${STAGES.length}` : '진행 정보 없음')),
    known ? h('progress', { max: STAGES.length, value: count, 'aria-label': `${project.title || project.name}: ${STAGES.length}단계 중 ${count}단계 통과` }) : null);
  });
  return h('aside', { class: 'digest-side', 'aria-label': '프로젝트 요약' },
    h('section', {}, h('h2', {}, '어제부터 AI가 한 일'),
      h('p', { class: 'small' }, 'AI 작업의 전체 기록은 아직 볼 수 없어요. 조회할 때 어제부터 도착한 프로젝트 자료를 보여요.'),
      recent.length ? h('ul', { class: 'digest-activity' }, recent.map((project) => h('li', {},
        h('a', { href: projectHref(project.name) }, project.title || project.name), ': 자료가 도착했어요 · ', shell.since(project.pushed_at))))
        : h('p', { class: 'sec' }, '최근 도착한 자료가 없어요.')),
    h('section', {}, h('h2', {}, '프로젝트 한눈에'),
      overview.length ? h('ul', { class: 'project-overview' }, overview) : h('p', { class: 'sec' }, '아직 프로젝트가 없어요.'),
      h('a', { href: PROJECTS_HREF }, '모든 프로젝트 보기')));
}

function timeline(data, shell) {
  const first = data.todo?.morning?.[0] ?? (data.projects?.projects?.[0] ? { project: data.projects.projects[0].name, part: null } : null);
  if (!first) return null;
  if (!data.progress || data.progress.name !== first.project) return h('div', { class: 'nt warn', role: 'status' },
    h('span', {}, '진행 상황을 불러오지 못했어요.'), h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => shell.reload() } }, '다시 확인'));
  const project = data.progress;
  const words = { passed: '통과', changed_since_pass: '통과 뒤 바뀜', open: '진행 중', not_sent: '시작 전' };
  const part = first.part ?? project.stages?.[0]?.part ?? '';
  const rows = (project.stages ?? []).filter((stage) => stage.part === part);
  if (rows.length === 0) return h('div', { class: 'nt warn', role: 'status' },
    h('span', {}, '이 프로젝트의 진행 상황을 확인할 수 없어요.'), h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => shell.reload() } }, '다시 확인'));
  const firstRow = rows.find((stage) => stage.stage === first.stage);
  const current = firstRow && ['open', 'changed_since_pass'].includes(firstRow.state) ? firstRow.stage
    : rows.find((stage) => stage.state === 'open')?.stage ?? rows.find((stage) => stage.state === 'changed_since_pass')?.stage ?? null;
  const next = current === null ? rows.find((stage) => stage.state === 'not_sent')?.stage ?? null : null;
  const positionKey = `${project.name}:${part}:${current ?? next ?? 'none'}`;
  const positions = shell.timelinePositions ??= new Map();
  let interacted = false;
  let active = null;
  const nav = h('nav', { class: 'tabs timeline', 'aria-label': '13단계 진행 상황', on: {
    pointerdown: () => { interacted = true; }, wheel: () => { interacted = true; }, keydown: () => { interacted = true; },
    scroll: () => { if (interacted) { if (!positions.has(positionKey) && positions.size >= 100) positions.delete(positions.keys().next().value); positions.set(positionKey, nav.scrollLeft); } },
  } }, STAGES.map((stage) => {
      const row = (project.stages ?? []).find((each) => each.stage === stage.id && each.part === part);
      const state = words[row?.state] ?? '시작 전';
      const isCurrent = stage.id === current;
      const isNext = stage.id === next;
      const marker = isCurrent ? (row?.state === 'changed_since_pass' ? '현재 · 바뀜' : '현재') : isNext ? '다음'
        : row?.state === 'passed' ? '✓' : row?.state === 'changed_since_pass' ? '바뀜' : row?.state === 'open' ? '진행 중' : '';
      const link = h('a', { class: `tab timeline-${row?.state ?? 'not_sent'}${isCurrent || isNext ? ' current' : ''}`,
        href: stageHref(first.project, part, stage.id), 'aria-current': isCurrent ? 'step' : null,
        'aria-label': `${stage.number} ${stageLabel(stage.id)}: ${state}${isCurrent ? ', 현재 단계' : isNext ? ', 다음 단계' : ''}` },
      h('span', { class: 'n' }, stage.number), h('span', { class: 'timeline-label' }, stageLabel(stage.id)),
      marker ? h('span', { class: 'timeline-marker', 'aria-hidden': 'true' }, marker) : null);
      if (isCurrent || isNext) active = link;
      return link;
    }));
  globalThis.requestAnimationFrame?.(() => {
    if (positions.has(positionKey)) nav.scrollLeft = positions.get(positionKey);
    else if (active?.isConnected && nav.clientWidth < nav.scrollWidth) {
      const left = active.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
      nav.scrollLeft = Math.max(0, left - (nav.clientWidth - active.clientWidth) / 2);
    }
  });
  return h('section', { class: 'timeline-section', 'aria-label': '프로젝트 진행 상황' },
    h('div', { class: 'timeline-heading' }, h('h2', {}, `${project.title || project.name} 진행 상황`),
      h('p', { class: 'small' }, '파랑: 현재 또는 다음 단계 · ✓: 통과 · 바뀜: 다시 확인')),
    shell.missed('progress') ? h('div', { class: 'nt warn', role: 'status' }, h('span', {}, '진행 상황은 이전 정보예요.'),
      h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => shell.reload() } }, '다시 확인')) : null, nav);
}

function morningCard(entry, shell, titles = new Map(), number = 1) {
  const target = stageHref(entry.project, entry.part, entry.stage, { diagram: entry.diagram, thread: entry.thread });
  const path = entry.kind === 'question' && entry.thread
    ? `${projectApi(entry.project)}/threads/${encodeURIComponent(entry.thread)}/comments`
    : entry.kind === 'proposal' && entry.change_set
      ? `${projectApi(entry.project)}/change-sets/${encodeURIComponent(entry.change_set)}` : null;
  const notice = h('p', { class: 'sec', role: 'status' });
  const question = entry.question_choices?.length && entry.question_text
    ? entry.question_text.split(/\r?\n/).filter((line) => !/^\s*[-*]\s+\[ \]/.test(line)).join('\n').trim()
    : entry.question_text;
  const draftKey = `todo:${entry.project}:${entry.thread}:${entry.since}`;
  const openAnswers = shell.openAnswers ??= new Map();
  // Keep the current tab's text across redraws even if browser storage is unavailable.
  const drafts = shell.morningDrafts ??= new Map();
  const getDraft = () => drafts.has(draftKey) ? drafts.get(draftKey) : shell.draftOf(draftKey);
  const keepDraft = (text) => {
    if (!drafts.has(draftKey) && drafts.size >= 5000) drafts.delete(drafts.keys().next().value);
    drafts.set(draftKey, text);
    shell.keepDraft(draftKey, text);
  };
  const queue = (url, body, submittedDraft = null) => {
    try {
      if (!shell.pending) throw new Error('storage unavailable');
      shell.pending.enqueue(url, body, {
        draft: submittedDraft === null ? null : draftKey,
        draftText: submittedDraft,
        done: () => { openAnswers.delete(draftKey); if (submittedDraft !== null && getDraft() === submittedDraft) { drafts.delete(draftKey); shell.keepDraft(draftKey, ''); } shell.reload(); },
        undone: (reason) => { notice.textContent = reason === 'elsewhere' ? '다른 화면에서 상태가 바뀌었어요. 현재 내용을 확인해 주세요.' : '되돌렸어요. 아직 보내지 않았어요.'; },
        failed: (outcome) => { notice.textContent = outcome.failure === 'expired' ? '오래된 답변이나 결정은 현재 내용을 확인해 주세요.' : isRetryableOutcome(outcome)
          ? '전송 결과를 확인하지 못했어요. 위의 안내를 확인해 주세요.' : '보내지 못했어요. 위의 안내를 확인해 주세요.'; },
      });
      notice.textContent = '10초 뒤 보내요. 위에서 되돌릴 수 있어요.';
    } catch (error) { notice.textContent = error.message === 'already pending' ? '이 항목은 처리 중이에요. 위 안내를 확인해 주세요.' : error.message === 'storage unavailable' ? '브라우저 저장 공간을 사용할 수 없어 보내지 못했어요. 저장 공간을 확인해 주세요.' : '보내기를 준비하지 못했어요. 다시 시도해 주세요.'; }
  };
  const identity = [entry.project, entry.thread, entry.since].map((part) => encodeURIComponent(String(part)));
  const formId = `answer-${identity.map((part) => `${part.length}_${part}`).join('-')}`;
  const field = entry.kind === 'question' ? h('textarea', { id: `${formId}-input`, 'data-preserve-focus': 'true', 'aria-label': '답변', rows: '3', on: {
    input: () => keepDraft(field.value),
    compositionstart: () => field.setAttribute('data-composing', 'true'),
    compositionend: () => { field.removeAttribute('data-composing'); shell.finishComposition(); },
    blur: () => { if (field.getAttribute('data-composing') === 'true') { field.removeAttribute('data-composing'); shell.finishComposition(); } },
  } }) : null;
  if (field) field.value = getDraft();
  const choices = entry.kind === 'question' && path ? (entry.question_choices ?? []).map((choice, index) =>
    h('button', { id: `${formId}-choice-${index}-${encodeURIComponent(choice.toWellFormed())}`, 'data-preserve-focus': 'true', type: 'button', class: 'btn tertiary', on: { click: () => queue(path, { text: choice }) } }, choice)) : [];
  const expanded = openAnswers.has(draftKey) ? openAnswers.get(draftKey) : Boolean(field?.value);
  if (expanded && !openAnswers.has(draftKey)) {
    if (openAnswers.size >= 5000) openAnswers.delete(openAnswers.keys().next().value);
    openAnswers.set(draftKey, true);
  }
  const form = field ? h('form', { id: formId, hidden: !expanded, on: { submit: (event) => {
    event.preventDefault();
    const text = field.value.trim();
    if (!text) { notice.textContent = '답변을 적어 주세요.'; return; }
    if ([...text].length > 4000) { notice.textContent = '답변은 4,000자까지 쓸 수 있어요.'; return; }
    queue(path, { text }, field.value);
  } } }, field, h('button', { type: 'submit', class: 'btn primary' }, '답변 보내기')) : null;
  const writeOwn = form ? h('button', { id: `${formId}-toggle`, 'data-preserve-focus': 'true', type: 'button', class: 'btn tertiary', 'aria-expanded': expanded ? 'true' : 'false', 'aria-controls': formId, on: { click: () => {
    form.hidden = !form.hidden;
    if (!openAnswers.has(draftKey) && openAnswers.size >= 5000) openAnswers.delete(openAnswers.keys().next().value);
    openAnswers.set(draftKey, !form.hidden);
    writeOwn.setAttribute('aria-expanded', form.hidden ? 'false' : 'true');
    if (!form.hidden) field.focus();
  } } }, '직접 쓰기') : null;
  const actions = entry.kind === 'question' && path && entry.question_text ? h('div', { class: 'answer-actions' }, h('div', { class: 'btns choice-row' }, choices, writeOwn), form)
    : entry.kind === 'proposal' && path && entry.proposal_summary ? h('div', { class: 'btns' },
      entry.removed ? null : h('button', { type: 'button', class: 'btn primary', on: { click: () => queue(`${path}/accept`, {}) } }, '제안 넣기'),
      h('button', { type: 'button', class: 'btn tertiary', on: { click: () => queue(`${path}/reject`, {}) } }, '제안 빼기'))
      : entry.kind === 'confirm' ? confirmationCard(entry, shell) : null;
  const stage = stageOf(entry.stage);
  const technical = stage && stage.name !== stageLabel(entry.stage) ? stage.name : null;
  const pictureName = entry.diagram_name && entry.diagram_name !== stage?.name && entry.diagram_name !== stageLabel(entry.stage) ? entry.diagram_name : null;
  return h('section', { class: 'panel morning-card' },
    h('div', { class: 'morning-card-head' }, h('span', { class: 'card-number', 'aria-hidden': 'true' }, String(number)),
      h('h3', { 'aria-label': `${titles.get(entry.project) ?? entry.project} · ${stageLabel(entry.stage)}${pictureName ? ` · 그림: ${pictureName}` : ''}` }, `${titles.get(entry.project) ?? entry.project} · ${stageLabel(entry.stage)}`), technical ? h('span', { class: 'small technical-name' }, technical) : null),
    h('p', { class: 'small' }, `${KINDS[entry.kind]?.text ?? '할 일'}`, pictureName ? ` · 그림: ${pictureName}` : null, ' · ', shell.since(entry.since)),
    h('p', { class: 'question-copy' }, question || entry.proposal_summary || (entry.kind === 'confirm' ? REASONS[entry.reason] ?? '확인할 그림이 있어요.' : '그림에서 내용을 확인해 주세요.')),
    actions, notice, h('a', { href: target, class: 'picture-link' }, entry.kind === 'confirm' ? '이 그림 확인하기' : '그림에서 보기'));
}

function confirmationCard(entry, shell) {
  const area = h('div', { class: 'confirmation-area' });
  const path = diagramApi(entry.project, entry.diagram);
  let busy = false;
  const open = async () => {
    if (busy) return;
    busy = true;
    fill(area, h('p', { role: 'status' }, '그림을 불러오고 있어요.'));
    const result = await shell.readFresh(path);
    busy = false;
    if (result.status === 401 || result.status === 403 || result.failure === 'gate') return;
    const diagram = result.body;
    if (result.status !== 200 || !diagram) {
      fill(area, h('p', { role: 'alert' }, '그림을 불러오지 못했어요.'), h('button', { type: 'button', class: 'btn tertiary', on: { click: open } }, '다시 시도'), h('button', { type: 'button', class: 'btn tertiary', on: { click: reset } }, '취소'));
      return;
    }
    if (diagram.removed || diagram.drawing?.status !== 'drawn' || diagram.confirmation?.state === 'confirmed'
        || (diagram.overlays ?? []).some((set) => set.state === 'accepted')) {
      fill(area, h('p', { role: 'alert' }, '지금은 이 그림을 확정할 수 없어요. 그림에서 상태를 확인해 주세요.'), h('button', { type: 'button', class: 'btn tertiary', on: { click: open } }, '다시 확인'), h('button', { type: 'button', class: 'btn tertiary', on: { click: reset } }, '취소'));
      return;
    }
    const changed = diagram.since_confirmation;
    const count = changed ? (changed.added?.length ?? 0) + (changed.changed?.length ?? 0) + (changed.removed?.length ?? 0) : 0;
    const summary = changed == null ? '처음 확정하는 그림이에요.' : `지난 확정 뒤 바뀐 곳이 ${count}개예요.`;
    const names = (diagram.elements ?? []).map((element) => element.name?.trim()).filter(Boolean);
    const preview = h('div', { class: 'nt confirmation-preview' }, h('b', {}, '확정할 내용 미리보기'),
      names.length ? h('ul', {}, names.slice(0, 6).map((name) => h('li', {}, name))) : h('p', {}, '그림에서 내용을 확인해 주세요.'),
      names.length > 6 ? h('p', {}, `이 밖에 ${names.length - 6}개가 더 있어요.`) : null,
      h('a', { href: stageHref(entry.project, entry.part, entry.stage, { diagram: entry.diagram }), class: 'btn tertiary' }, '전체 그림 보기'));
    const requestKey = newRequestKey();
    const createdAt = Date.now();
    const confirm = async () => {
      if (busy) return;
      if (Date.now() + CLOCK_SKEW_MS < createdAt || Date.now() - createdAt >= RETRY_LIMIT_MS) {
        fill(area, h('p', { role: 'alert' }, '오래된 확정 요청이에요. 그림의 현재 상태를 확인해 주세요.'), h('button', { type: 'button', class: 'btn tertiary', on: { click: open } }, '그림 다시 확인'), h('button', { type: 'button', class: 'btn tertiary', on: { click: reset } }, '취소'));
        return;
      }
      busy = true; fill(area, h('p', { role: 'status' }, '확정 결과를 확인하고 있어요.'));
      const outcome = await shell.write('POST', `${path}/confirmation`, { drawing: diagram.drawing.id }, requestKey);
      busy = false;
      if (outcome.status === 200 || outcome.status === 201) { shell.announce('이 그림을 확정했어요. 함께 일하는 AI가 기록할 차례예요.'); shell.reload(); return; }
      if (outcome.status === 401 || outcome.status === 403 || outcome.failure === 'gate') return;
      if (isRetryableOutcome(outcome)) {
        fill(area, h('p', { role: 'alert' }, '확정 결과를 확인하지 못했어요. 다시 확인해 주세요.'), h('button', { type: 'button', class: 'btn tertiary', on: { click: confirm } }, '결과 다시 확인'), h('button', { type: 'button', class: 'btn tertiary', on: { click: reset } }, '취소'));
        return;
      }
      fill(area, h('p', { role: 'alert' }, '확정하지 못했어요. 그림의 현재 상태를 다시 확인해 주세요.'), h('button', { type: 'button', class: 'btn tertiary', on: { click: open } }, '다시 확인'), h('button', { type: 'button', class: 'btn tertiary', on: { click: reset } }, '취소'));
    };
    const yes = h('button', { type: 'button', class: 'btn primary', on: { click: confirm } }, '네, 확정할게요');
    const stage = stageOf(entry.stage);
    const lastStep = stage ? `모든 그림과 표가 기록되면 ${Number(stage.number)}단계가 끝나요.` : '모든 그림과 표가 기록되면 이 단계가 끝나요.';
    fill(area, preview, h('p', {}, summary), h('div', { class: 'confirmation-steps' }, h('b', {}, '확정하면'), h('ol', {},
      h('li', {}, '지금 그림을 맞다고 표시해요.'), h('li', {}, 'AI가 내용을 기록해요.'), h('li', {}, lastStep))),
      h('div', { class: 'btns' }, yes, h('button', { type: 'button', class: 'btn tertiary', on: { click: reset } }, '취소')));
  };
  const reset = () => fill(area, h('button', { type: 'button', class: 'btn primary', on: { click: open } }, '이 그림 확정하기'));
  reset();
  return area;
}

// The warning of a failed daily backup (BackupWarning): the local date it failed on, as the mockup says it. It stays
// while backups keep failing and is drawn again with each changed answer, so it is a status, not an alert that would
// break in on a screen reader each time.
export function backupWarning(backup) {
  return h('div', { class: 'nt warn', role: 'status' }, h('div', { class: 'b' },
    h('b', {}, `${dayOf(backup.failed_at)} 백업이 실패했어요.`),
    h('span', {}, '서버 기록을 확인하세요. 다음 백업이 성공하면 이 알림은 사라져요.')));
}

// SCR-142#empty: nothing waits, with the projects, each to SCR-144; or, with no project yet, the agent credentials.
function nothingToDo(projects, shell, stale = false) {
  if (projects.length === 0) {
    return h('div', { class: 'empty' },
      h('h2', {}, stale ? '이전 확인에서는 기다리는 일이 없었어요' : '기다리는 일이 없어요'),
      h('p', { class: 'sec' }, '에이전트가 처음 보내면 여기에 나와요.'),
      h('a', { class: 'btn tertiary', href: PROJECTS_HREF }, '에이전트 자격'));
  }
  return [
    h('div', { class: 'empty' },
      h('h2', {}, stale ? '이전 확인에서는 기다리는 일이 없었어요' : '기다리는 일이 없어요'),
      h('p', { class: 'sec' }, '에이전트가 확정할 그림이나 질문을 보내면 여기에 나와요.')),
    h('section', { class: 'group' },
      h('div', { class: 'gh' }, h('h2', {}, '프로젝트')),
      h('div', { class: 'list' }, projects.map((project) => h('a', { class: 'li', href: projectHref(project.name) },
        h('span', { class: 'grow' },
          h('b', {}, project.title || project.name),
          h('span', { class: 'sec' }, `${STAGES.length}단계 중 ${project.stages_passed} 통과`,
            project.pushed_at ? [' · ', shell.since(project.pushed_at, sentWords)] : null)),
        icon('next', 'ic chev'))))),
  ];
}
