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
  invalidated: '새 문서로 확정이 풀렸어요',
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
  for (const entry of entries.slice(0, shown)) list.append(morningCard(entry, shell, titles));
  more.hidden = shown >= entries.length;
  function showMore() {
    for (const entry of entries.slice(shown, shown + 50)) list.append(morningCard(entry, shell, titles));
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

// Project-first home: only known counts are shown, and a capped to-do is labelled as a minimum.
function projectHome(data, shell) {
  const todo = data.todo;
  const failure = shell.missed('todo');
  if (todo === null || todo === undefined) return [h('p', {}, '할 일 수를 읽지 못했어요.'),
    ...(failure ? shell.errorNotice(failure, () => shell.reload()) : [])];
  const entries = todo.morning ?? [];
  const warning = todo.backup ? backupWarning(todo.backup) : null;
  const stale = failure ? oldTodoNotice(shell, failure) : null;
  const titles = new Map((data.projects?.projects ?? []).map((project) => [project.name, project.title || project.name]));
  return [warning, stale, timeline(data, shell), h('h2', {}, `오늘 할 일은 ${todo.entries.length >= 5000 ? '적어도 ' : ''}${todo.entries.length}가지예요`),
    entries.length ? h('div', { class: 'morning-cards' }, entries.map((entry) => morningCard(entry, shell, titles)))
      : h('div', { class: 'empty' }, h('p', {}, todo.morning === undefined && todo.entries.length ? '아침 보고를 읽지 못했어요. 모든 할 일에서 확인해 주세요.' : '기다리는 일이 없어요.'), titles.size === 0 ? h('p', {}, '에이전트가 처음 보내면 여기에 나와요.') : null),
    h('a', { class: 'btn tertiary', href: TODO_HREF }, '모든 할 일 보기'),
    h('a', { class: 'btn tertiary', href: PROJECTS_HREF }, '모든 프로젝트 보기')];
}

function timeline(data, shell) {
  const first = data.todo?.morning?.[0] ?? (data.projects?.projects?.[0] ? { project: data.projects.projects[0].name, part: null } : null);
  if (!first) return null;
  if (!data.progress) return h('p', { class: 'sec' }, '진행 상황을 불러오지 못했어요.');
  const project = data.progress;
  const words = { passed: '통과', changed_since_pass: '통과 뒤 바뀜', open: '진행 중', not_sent: '시작 전' };
  const part = first.part ?? project.stages?.[0]?.part ?? '';
  return h('section', { 'aria-label': '프로젝트 진행 상황' },
    h('h2', {}, `${project.title || project.name} 진행 상황`),
    h('nav', { class: 'tabs timeline', 'aria-label': '13단계 진행 상황' }, STAGES.map((stage) => {
      const row = (project.stages ?? []).find((each) => each.stage === stage.id && each.part === part);
      const state = words[row?.state] ?? '시작 전';
      return h('a', { class: 'tab', href: stageHref(first.project, part, stage.id), 'aria-label': `${stage.number} ${stageLabel(stage.id)}: ${state}` },
        h('span', { class: 'n' }, stage.number), h('span', { class: 'timeline-label' }, stageLabel(stage.id)), h('span', { class: 'timeline-state' }, state));
    })));
}

function morningCard(entry, shell, titles = new Map()) {
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
  const queue = (url, body, submittedDraft = null) => {
    try {
      if (!shell.pending) throw new Error('storage unavailable');
      shell.pending.enqueue(url, body, {
        done: () => { if (submittedDraft !== null && shell.draftOf(draftKey) === submittedDraft) shell.keepDraft(draftKey, ''); shell.reload(); },
        undone: () => { notice.textContent = '되돌렸어요. 아직 보내지 않았어요.'; },
        failed: (outcome) => { notice.textContent = isRetryableOutcome(outcome)
          ? '전송 결과를 확인하지 못했어요. 위의 안내를 확인해 주세요.' : '보내지 못했어요. 위의 안내를 확인해 주세요.'; },
      });
      notice.textContent = '10초 뒤 보내요. 위에서 되돌릴 수 있어요.';
    } catch (error) { notice.textContent = error.message === 'already pending' ? '이 항목은 처리 중이에요. 위 안내를 확인해 주세요.' : '보내기를 준비하지 못했어요. 다시 시도해 주세요.'; }
  };
  const field = entry.kind === 'question' ? h('textarea', { 'aria-label': '답변', rows: '3', on: { input: () => shell.keepDraft(draftKey, field.value) } }) : null;
  if (field) field.value = shell.draftOf(draftKey);
  const choices = entry.kind === 'question' && path ? (entry.question_choices ?? []).map((choice) =>
    h('button', { type: 'button', class: 'btn tertiary', on: { click: () => queue(path, { text: choice }) } }, choice)) : [];
  const actions = entry.kind === 'question' && path && entry.question_text ? h('div', {}, h('div', { class: 'btns' }, choices), h('form', { on: { submit: (event) => {
    event.preventDefault();
    const text = field.value.trim();
    if (!text) { notice.textContent = '답변을 적어 주세요.'; return; }
    if ([...text].length > 4000) { notice.textContent = '답변은 4,000자까지 쓸 수 있어요.'; return; }
    queue(path, { text }, field.value);
  } } }, field, h('button', { type: 'submit', class: 'btn primary' }, '답변 보내기')))
    : entry.kind === 'proposal' && path && entry.proposal_summary ? h('div', { class: 'btns' },
      entry.removed ? null : h('button', { type: 'button', class: 'btn primary', on: { click: () => queue(`${path}/accept`, {}) } }, '제안 넣기'),
      h('button', { type: 'button', class: 'btn tertiary', on: { click: () => queue(`${path}/reject`, {}) } }, '제안 빼기'))
      : entry.kind === 'confirm' ? confirmationCard(entry, shell) : null;
  return h('section', { class: 'panel morning-card' },
    h('h3', {}, `${titles.get(entry.project) ?? entry.project} · ${entry.diagram_name}`),
    h('p', { class: 'small' }, `${KINDS[entry.kind]?.text ?? '할 일'} · ${stageLabel(entry.stage)}`, ' · ', shell.since(entry.since)),
    h('p', { class: 'question-copy' }, question || entry.proposal_summary || (entry.kind === 'confirm' ? REASONS[entry.reason] ?? '확인할 그림이 있어요.' : '그림에서 내용을 확인해 주세요.')),
    actions, notice, h('a', { href: target, class: 'btn tertiary' }, entry.kind === 'confirm' ? '이 그림 확인하기' : '그림에서 보기'));
}

function confirmationCard(entry, shell) {
  const area = h('div');
  const path = diagramApi(entry.project, entry.diagram);
  let busy = false;
  const open = async () => {
    if (busy) return;
    busy = true;
    fill(area, h('p', { role: 'status' }, '그림을 불러오고 있어요.'));
    const result = await shell.readFresh(path);
    busy = false;
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
    const preview = h('div', { class: 'nt' }, h('b', {}, '확정할 내용 미리보기'),
      names.length ? h('ul', {}, names.slice(0, 6).map((name) => h('li', {}, name))) : h('p', {}, '그림에서 내용을 확인해 주세요.'),
      names.length > 6 ? h('p', {}, `이 밖에 ${names.length - 6}개가 더 있어요.`) : null,
      h('a', { href: stageHref(entry.project, entry.part, entry.stage, { diagram: entry.diagram }), class: 'btn tertiary' }, '전체 그림 보기'));
    const yes = h('button', { type: 'button', class: 'btn primary', on: { click: async () => {
      if (busy) return;
      busy = true; yes.setAttribute('disabled', '');
      const outcome = await shell.write('POST', `${path}/confirmation`, { drawing: diagram.drawing.id }, newRequestKey());
      busy = false;
      if (outcome.status === 200 || outcome.status === 201) { shell.announce('이 그림을 확정했어요. 함께 일하는 AI가 기록할 차례예요.'); shell.reload(); return; }
      fill(area, h('p', { role: 'alert' }, '확정하지 못했어요. 그림의 현재 상태를 다시 확인해 주세요.'), h('button', { type: 'button', class: 'btn tertiary', on: { click: open } }, '다시 확인'), h('button', { type: 'button', class: 'btn tertiary', on: { click: reset } }, '취소'));
    } } }, '네, 확정할게요');
    fill(area, preview, h('p', {}, summary), h('p', {}, '확정하면 함께 일하는 AI가 기록해요. 모든 그림과 표의 기록이 끝나면 단계가 통과돼요.'),
      yes, h('button', { type: 'button', class: 'btn tertiary', on: { click: reset } }, '취소'));
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
