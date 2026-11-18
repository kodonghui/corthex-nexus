import { Problem } from "./problem.js";
import { planPush, checkCommit } from "./push-plan.js";
import * as E from "./entries.js";
import { checkWriteBody, planEntryWrite, entryDisposition, lookedUp, requestOpen } from "./entry-plan.js";
import { stageData, heldItem, partsOf } from "./stage-items.js";
import { talkData, CLOSED } from "./stage-talk.js";
import { itemData } from "./item-data.js";
import { searchData } from "./search.js";
import { homeData, currentPlace, TURN } from "./home-data.js";
import { projectData, projectExport, removal } from "./project-data.js";
import { STAGES, defaultQuery } from "./preflight.js";
// Everything that touches the database is in this file. The SQL is the part
// SQLite (D1) and Postgres share, apart from the `?` placeholders, so moving
// to another database changes this file only.

// All SQL, including released migrations, stays in this module (REQ-123).
// SQLite reads row lists with json_each; Postgres uses json_array_elements.
// Postgres also needs BIGINT for generated_ms, since its INTEGER is 32-bit.
// Changed-row comparisons use IS NOT, SQLite's null-safe equivalent of
// IS DISTINCT FROM, so that two NULL values compare equal on older SQLite.
// Never edit a released migration: add a new version instead.
export const MIGRATIONS = [
  {
    "version": 1,
    "statements": [
      "CREATE TABLE IF NOT EXISTS snapshots (\n  name TEXT PRIMARY KEY,\n  revision INTEGER NOT NULL,\n  generated_ms INTEGER NOT NULL,\n  generated_at TEXT NOT NULL,\n  received_at TEXT NOT NULL,\n  bytes INTEGER NOT NULL,\n  body TEXT NOT NULL\n)"
    ]
  },
  {
    "version": 2,
    "statements": [
      "ALTER TABLE snapshots ADD COLUMN default_commit TEXT",
      "ALTER TABLE snapshots ADD COLUMN push_id TEXT",
      "CREATE TABLE project_spaces (\n  project     TEXT    PRIMARY KEY REFERENCES snapshots (name) ON DELETE CASCADE,\n  repo_url    TEXT,\n  created_at  TEXT    NOT NULL,\n  text_bytes  INTEGER NOT NULL DEFAULT 0 CHECK (text_bytes >= 0),\n  unopened    TEXT    NOT NULL DEFAULT '{}'\n)",
      "CREATE TABLE pictures (\n  project      TEXT NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,\n  part         TEXT NOT NULL,\n  stage        TEXT NOT NULL CHECK (stage IN ('01-domain', '05-erd', '07-sitemap')),\n  commit_id    TEXT NOT NULL,\n  committed_at TEXT NOT NULL,\n  source       TEXT NOT NULL,\n  digest       TEXT NOT NULL,\n  drawn_at     TEXT NOT NULL,\n  not_current  TEXT CHECK (not_current IN ('size', 'source-gone', 'other-repository')),\n  PRIMARY KEY (project, part, stage)\n)",
      "CREATE TABLE discrepancies (\n  id              TEXT    PRIMARY KEY,\n  project         TEXT    NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,\n  part            TEXT    NOT NULL,\n  compares        TEXT    NOT NULL CHECK (compares IN ('aggregate-table', 'read-model-screen')),\n  term            TEXT    NOT NULL,\n  item            TEXT    NOT NULL,\n  reasons         TEXT    NOT NULL,\n  level           TEXT    NOT NULL CHECK (level IN ('warn', 'info')),\n  state           TEXT    NOT NULL CHECK (state IN ('open', 'resolved')),\n  waiting         INTEGER NOT NULL DEFAULT 0 CHECK (waiting IN (0, 1)),\n  opened_commit   TEXT    NOT NULL,\n  opened_at       TEXT    NOT NULL,\n  resolved_commit TEXT,\n  resolved_at     TEXT,\n  earlier         TEXT    REFERENCES discrepancies (id) ON DELETE SET NULL,\n  CHECK ((state = 'open' AND resolved_commit IS NULL AND resolved_at IS NULL)\n      OR (state = 'resolved' AND resolved_commit IS NOT NULL AND resolved_at IS NOT NULL)),\n  CHECK (waiting = 0 OR state = 'open')\n)",
      "CREATE UNIQUE INDEX discrepancies_pair ON discrepancies (project, part, compares, term, item) WHERE state = 'open'",
      "CREATE INDEX discrepancies_state ON discrepancies (project, state, level)",
      "CREATE TABLE comments (\n  id           TEXT    PRIMARY KEY,\n  project      TEXT    NOT NULL,\n  part         TEXT    NOT NULL,\n  stage        TEXT    NOT NULL,\n  item         TEXT    NOT NULL,\n  quote        TEXT,\n  discrepancy  TEXT    REFERENCES discrepancies (id) ON DELETE SET NULL,\n  commit_id    TEXT    NOT NULL,\n  author       TEXT    NOT NULL CHECK (author IN ('user', 'agent')),\n  text         TEXT    NOT NULL,\n  state        TEXT    NOT NULL CHECK (state IN ('open', 'closed')),\n  closed_as    TEXT    CHECK (closed_as IN ('answered', 'decided')),\n  waits        TEXT    CHECK (waits IN ('user', 'agent')),\n  settled      INTEGER NOT NULL DEFAULT 0 CHECK (settled IN (0, 1)),\n  dismissed    INTEGER NOT NULL DEFAULT 0 CHECK (dismissed IN (0, 1)),\n  made_at      TEXT    NOT NULL,\n  last_at      TEXT    NOT NULL,\n  FOREIGN KEY (project, part, stage) REFERENCES pictures (project, part, stage) ON DELETE CASCADE,\n  CHECK ((state = 'open' AND closed_as IS NULL AND waits IS NOT NULL)\n      OR (state = 'closed' AND closed_as IS NOT NULL AND waits IS NULL)),\n  CHECK ((settled = 0 AND dismissed = 0) OR state = 'open')\n)",
      "CREATE INDEX comments_waiting ON comments (project, state, waits, last_at)",
      "CREATE INDEX comments_picture ON comments (project, part, stage, state)",
      "CREATE TABLE replies (\n  comment  TEXT    NOT NULL REFERENCES comments (id) ON DELETE CASCADE,\n  seq      INTEGER NOT NULL CHECK (seq > 0),\n  author   TEXT    NOT NULL CHECK (author IN ('user', 'agent')),\n  text     TEXT    NOT NULL,\n  settles  INTEGER NOT NULL DEFAULT 0 CHECK (settles IN (0, 1)),\n  made_at  TEXT    NOT NULL,\n  PRIMARY KEY (comment, seq),\n  CHECK (settles = 0 OR author = 'user')\n)",
      "CREATE TABLE decisions (\n  comment  TEXT    NOT NULL REFERENCES comments (id) ON DELETE CASCADE,\n  seq      INTEGER NOT NULL CHECK (seq > 0),\n  link     TEXT    NOT NULL,\n  text     TEXT,\n  made_at  TEXT    NOT NULL,\n  PRIMARY KEY (comment, seq)\n)",
      "CREATE TABLE proposals (\n  id           TEXT PRIMARY KEY,\n  project      TEXT NOT NULL,\n  part         TEXT NOT NULL,\n  stage        TEXT NOT NULL,\n  commit_id    TEXT NOT NULL,\n  items        TEXT NOT NULL,\n  reason       TEXT NOT NULL,\n  change       TEXT NOT NULL,\n  source_text  TEXT,\n  comment      TEXT REFERENCES comments (id) ON DELETE SET NULL,\n  discrepancy  TEXT REFERENCES discrepancies (id) ON DELETE SET NULL,\n  state        TEXT NOT NULL CHECK (state IN ('open', 'accepted', 'dismissed', 'withdrawn')),\n  made_at      TEXT NOT NULL,\n  closed_at    TEXT,\n  FOREIGN KEY (project, part, stage) REFERENCES pictures (project, part, stage) ON DELETE CASCADE,\n  CHECK ((state = 'open') = (closed_at IS NULL))\n)",
      "CREATE INDEX proposals_state ON proposals (project, state)",
      "CREATE INDEX proposals_comment ON proposals (comment)",
      "CREATE TABLE edits (\n  id            TEXT PRIMARY KEY,\n  project       TEXT NOT NULL,\n  part          TEXT NOT NULL,\n  stage         TEXT NOT NULL,\n  commit_id     TEXT NOT NULL,\n  proposal      TEXT UNIQUE REFERENCES proposals (id) ON DELETE CASCADE,\n  content       TEXT,\n  state         TEXT NOT NULL CHECK (state IN ('pending', 'in-review', 'needs-user', 'closed', 'dismissed')),\n  pull_request  TEXT,\n  closed_commit TEXT,\n  made_at       TEXT NOT NULL,\n  changed_at    TEXT NOT NULL,\n  FOREIGN KEY (project, part, stage) REFERENCES pictures (project, part, stage) ON DELETE CASCADE,\n  CHECK (proposal IS NOT NULL OR content IS NOT NULL),\n  CHECK (state <> 'in-review' OR pull_request IS NOT NULL)\n)",
      "CREATE INDEX edits_state ON edits (project, state, made_at)",
      "CREATE TABLE checkpoints (\n  id              TEXT PRIMARY KEY,\n  project         TEXT NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,\n  part            TEXT NOT NULL,\n  stage           TEXT NOT NULL,\n  commit_id       TEXT,\n  words           TEXT,\n  state           TEXT NOT NULL CHECK (state IN ('passed', 'withdrawn')),\n  passed_at       TEXT NOT NULL,\n  withdrawn_at    TEXT,\n  pull_request    TEXT,\n  pr_state        TEXT CHECK (pr_state IN ('open', 'merged', 'closed')),\n  recorded_commit TEXT,\n  CHECK ((state = 'withdrawn') = (withdrawn_at IS NOT NULL)),\n  CHECK ((pull_request IS NULL) = (pr_state IS NULL))\n)",
      "CREATE INDEX checkpoints_state ON checkpoints (project, state)",
      "CREATE TABLE claims (\n  entry      TEXT PRIMARY KEY,\n  project    TEXT NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,\n  session    TEXT NOT NULL,\n  claimed_at TEXT NOT NULL,\n  ends_at    TEXT NOT NULL\n)",
      "CREATE INDEX claims_ends ON claims (project, ends_at)",
      "CREATE TABLE writes (\n  project     TEXT NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,\n  id          TEXT NOT NULL,\n  request     TEXT NOT NULL,\n  result      TEXT NOT NULL,\n  received_at TEXT NOT NULL,\n  PRIMARY KEY (project, id)\n)",
      "CREATE INDEX writes_received ON writes (received_at)"
    ]
  }
];

// Schema 2 has no way to distinguish a repeated closed report after its PR
// field was cleared. Preserve the last event internally without changing APIs.
MIGRATIONS.push({ version: 3, statements: ["ALTER TABLE edits ADD COLUMN last_report TEXT"] });

// The redesign (stage 05, TBL-105 and TBL-110): a comment is on any of the 13
// stages of a part, bound to the project space instead of a picture, and keeps
// what the agent's last entry asks of the user. SQLite changes a foreign key
// only by making the table again. Dropping the old table deletes the replies
// and decisions with their comment and empties a proposal's comment even while
// foreign keys are deferred (D1 runs with them on), so the batch copies those
// rows aside first and puts them back after the rename, in one transaction.
MIGRATIONS.push({ version: 4, statements: [
  "CREATE TABLE comments_new (\n  id           TEXT    PRIMARY KEY,\n  project      TEXT    NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,\n  part         TEXT    NOT NULL,\n  stage        TEXT    NOT NULL CHECK (stage IN ('01-domain', '02-prd', '03-user-flow', '04-functional-spec', '05-erd', '06-api', '07-sitemap', '08-screen-states', '09-mockup', '10-wbs', '11-development', '12-qa', '13-presentation')),\n  item         TEXT    NOT NULL,\n  quote        TEXT,\n  discrepancy  TEXT    REFERENCES discrepancies (id) ON DELETE SET NULL,\n  commit_id    TEXT    NOT NULL,\n  author       TEXT    NOT NULL CHECK (author IN ('user', 'agent')),\n  text         TEXT    NOT NULL,\n  state        TEXT    NOT NULL CHECK (state IN ('open', 'closed')),\n  closed_as    TEXT    CHECK (closed_as IN ('answered', 'decided')),\n  waits        TEXT    CHECK (waits IN ('user', 'agent')),\n  asks         TEXT    CHECK (asks IN ('answer', 'recommended', 'checkpoint')),\n  settled      INTEGER NOT NULL DEFAULT 0 CHECK (settled IN (0, 1)),\n  dismissed    INTEGER NOT NULL DEFAULT 0 CHECK (dismissed IN (0, 1)),\n  made_at      TEXT    NOT NULL,\n  last_at      TEXT    NOT NULL,\n  CHECK ((state = 'open' AND closed_as IS NULL AND waits IS NOT NULL)\n      OR (state = 'closed' AND closed_as IS NOT NULL AND waits IS NULL)),\n  CHECK ((settled = 0 AND dismissed = 0) OR state = 'open'),\n  CHECK (asks IS NULL OR (state = 'open' AND waits = 'user'))\n)",
  "CREATE TABLE replies_keep AS SELECT comment, seq, author, text, settles, made_at FROM replies",
  "CREATE TABLE decisions_keep AS SELECT comment, seq, link, text, made_at FROM decisions",
  "CREATE TABLE proposals_keep AS SELECT id, comment FROM proposals WHERE comment IS NOT NULL",
  "INSERT INTO comments_new (id, project, part, stage, item, quote, discrepancy, commit_id, author, text, state, closed_as, waits, asks, settled, dismissed, made_at, last_at)\n  SELECT id, project, part, stage, item, quote, discrepancy, commit_id, author, text, state, closed_as, waits, NULL, settled, dismissed, made_at, last_at FROM comments",
  "DROP TABLE comments",
  "ALTER TABLE comments_new RENAME TO comments",
  "INSERT INTO replies (comment, seq, author, text, settles, made_at)\n  SELECT comment, seq, author, text, settles, made_at FROM replies_keep",
  "INSERT INTO decisions (comment, seq, link, text, made_at)\n  SELECT comment, seq, link, text, made_at FROM decisions_keep",
  "UPDATE proposals SET comment = (SELECT k.comment FROM proposals_keep AS k WHERE k.id = proposals.id)\n  WHERE id IN (SELECT id FROM proposals_keep)",
  "DROP TABLE replies_keep",
  "DROP TABLE decisions_keep",
  "DROP TABLE proposals_keep",
  "CREATE INDEX comments_waiting ON comments (project, state, waits, last_at)",
  "CREATE INDEX comments_stage ON comments (project, part, stage, state)",
  "ALTER TABLE checkpoints ADD COLUMN comment TEXT REFERENCES comments (id) ON DELETE SET NULL"
] });

// The design revision of 2026-11-11 (stage 05, "The revision's migrations"; TASK-295): the agent's last read on the
// space (SPEC-187), the thing to look at first of a checkpoint request (SPEC-197), what a pass names and the browser
// and device that sent it (SPEC-194, SPEC-195), and one open request for each part's stage. Every new column may be
// empty, so no table is made again. A database of before may hold several open requests on a stage, since nothing
// refused them: the statement before the index keeps the newest of each stage as its request and turns the older
// ones into entries that ask for an answer, still open and waiting for the user. The statements are the guide's,
// word for word, and nexus/test/migrations.test.js holds them to it.
MIGRATIONS.push({ version: 5, statements: [
  "ALTER TABLE project_spaces ADD COLUMN read_at TEXT",
  "ALTER TABLE project_spaces ADD COLUMN read_session TEXT",
  "ALTER TABLE checkpoints ADD COLUMN browser TEXT CHECK (browser IN ('chrome', 'safari', 'firefox', 'edge', 'other', 'unknown'))",
  "ALTER TABLE checkpoints ADD COLUMN device TEXT CHECK (device IN ('phone', 'tablet', 'desktop', 'unknown'))",
  "ALTER TABLE checkpoints ADD COLUMN driven INTEGER CHECK (driven IN (0, 1))",
  "ALTER TABLE checkpoints ADD COLUMN snapshot_revision INTEGER",
  "ALTER TABLE checkpoints ADD COLUMN entry INTEGER CHECK (entry >= 0)",
  "ALTER TABLE comments ADD COLUMN look_first TEXT",
  "ALTER TABLE replies ADD COLUMN look_first TEXT",
  "UPDATE comments SET asks = 'answer'\n WHERE state = 'open' AND asks = 'checkpoint'\n   AND EXISTS (SELECT 1 FROM comments AS newer\n                WHERE newer.project = comments.project AND newer.part = comments.part AND newer.stage = comments.stage\n                  AND newer.state = 'open' AND newer.asks = 'checkpoint'\n                  AND (newer.last_at > comments.last_at OR (newer.last_at = comments.last_at AND newer.id > comments.id)))",
  "CREATE UNIQUE INDEX comments_request ON comments (project, part, stage) WHERE state = 'open' AND asks = 'checkpoint'"
] });

const MIGRATION_TABLE = "CREATE TABLE IF NOT EXISTS migrations (\n  version    INTEGER PRIMARY KEY,\n  applied_at TEXT    NOT NULL\n)";

// The newer of two snapshots of a project wins: the update runs only when
// the incoming snapshot was generated at the same time or later. A new name
// is added only while the hub holds fewer projects than the limit. SQLite,
// which D1 runs, makes the statement one serializable transaction, so two
// uploads cannot both take the last place; Postgres would need a lock for that.
const PUT = `INSERT INTO snapshots (name, revision, generated_ms, generated_at, received_at, bytes, body)
SELECT ?, 1, ?, ?, ?, ?, ?
WHERE EXISTS (SELECT 1 FROM snapshots WHERE name = ?) OR (SELECT COUNT(*) FROM snapshots) < ?
ON CONFLICT (name) DO UPDATE SET
  revision = snapshots.revision + 1,
  generated_ms = excluded.generated_ms,
  generated_at = excluded.generated_at,
  received_at = excluded.received_at,
  bytes = excluded.bytes,
  body = excluded.body
WHERE excluded.generated_ms >= snapshots.generated_ms
RETURNING revision`;

const ready = new WeakMap();
const CHECKPOINT_BASIS = `SELECT json_group_array(json_object('id',id,'state',state,'recorded_commit',recorded_commit))
  FROM (SELECT id,state,recorded_commit FROM checkpoints WHERE project=? ORDER BY id)`;

// Identifiers below are fixed by the schema, never taken from a request.
const ENTRY_COLUMNS = Object.freeze({
  comments: "id project part stage item quote discrepancy commit_id author text state closed_as waits asks settled dismissed made_at last_at look_first".split(" "),
  replies: "comment seq author text settles made_at look_first".split(" "),
  decisions: "comment seq link text made_at".split(" "),
  proposals: "id project part stage commit_id items reason change source_text comment discrepancy state made_at closed_at".split(" "),
  edits: "id project part stage commit_id proposal content state pull_request closed_commit made_at changed_at last_report".split(" "),
  checkpoints: "id project part stage commit_id words state passed_at withdrawn_at pull_request pr_state recorded_commit comment snapshot_revision entry browser device driven".split(" "),
  discrepancies: "id project part compares term item reasons level state waiting opened_commit opened_at resolved_commit resolved_at earlier".split(" "),
  claims: "entry project session claimed_at ends_at".split(" "),
});
const rowJSON = (table, where) => `(SELECT json_object(${ENTRY_COLUMNS[table].map((name) => `'${name}',${name}`).join(",")}) FROM ${table} WHERE ${where})`;
const activeEntry = `EXISTS(SELECT 1 FROM comments WHERE id=entry AND project=claims.project AND state='open')
 OR EXISTS(SELECT 1 FROM discrepancies WHERE id=entry AND project=claims.project AND state='open')
 OR EXISTS(SELECT 1 FROM edits WHERE id=entry AND project=claims.project AND state IN ('pending','needs-user'))
 OR EXISTS(SELECT 1 FROM checkpoints WHERE id=entry AND project=claims.project AND pr_state IS NOT 'open' AND
   ((state='passed' AND recorded_commit IS NULL) OR (state='withdrawn' AND recorded_commit IS NOT NULL)))`;
// The agent to-do's checkpoints (API-113): passed and in no stage record yet,
// or withdrawn while a record or an open pull request still names them.
// x names the table where another statement joins it.
const todoCheckpoint = (x = "") => `((${x}state='passed' AND ${x}recorded_commit IS NULL) OR (${x}state='withdrawn' AND (${x}recorded_commit IS NOT NULL OR ${x}pr_state='open')))`;
const TODO_CHECKPOINT = todoCheckpoint();
// A claim that the to-do counts as taken: on a comment that waits for the
// agent or on another entry that the agent still has to finish.
const TAKEN = `(${activeEntry}) AND (EXISTS(SELECT 1 FROM comments WHERE id=entry AND waits='agent') OR substr(entry,1,3)<>'nc_')`;
// SPEC-189: an entry that waits for the agent is not yet read while no claim
// that lasts holds it, its one `?` binding the time of the read, and it waits
// since its space's last read, ps.read_at, or later, or the space was never
// read. alias is the entry's table, since the time since which it waits.
const notRead = (alias, since) => `NOT EXISTS(SELECT 1 FROM claims AS k WHERE k.entry=${alias}.id AND k.ends_at>?)
  AND (ps.read_at IS NULL OR ${since}>=ps.read_at)`;
// The entries of the agent to-do's four lists that wait for the agent, each
// with the time since which it waits (SPEC-189): a comment since its last
// entry, a discrepancy since it opened, a reflection while it is pending since
// the acceptance that made it, and a checkpoint since its pass or, withdrawn,
// its withdrawal. A reflection in review waits for its pull request and one
// that needs the user for the user, so neither is ever unread.
const WAITING = [
  ["comments", "x.state='open' AND x.waits='agent'", "x.last_at"],
  ["discrepancies", "x.state='open'", "x.opened_at"],
  ["edits", "x.state='pending'", "x.made_at"],
  ["checkpoints", todoCheckpoint("x."), "CASE WHEN x.state='withdrawn' THEN x.withdrawn_at ELSE x.passed_at END"],
];
// A space's entries that the agent has not read, in counts, with the oldest
// time since which one waits (SPEC-188), for ps, its project space: four `?`,
// each the time of the read.
const UNREAD = `(SELECT json_object('unread',COUNT(*),'since',MIN(since)) FROM (${WAITING.map(([table, where, since]) =>
  `SELECT ${since} AS since FROM ${table} AS x WHERE x.project=ps.project AND ${where} AND ${notRead("x", since)}`).join("\n    UNION ALL ")}))`;
// One space's last read, with its session label, and what the agent has not
// read (API-158's project, API-177).
const SPACE_READ = `SELECT ps.read_at,ps.read_session,${UNREAD} AS unread_json FROM project_spaces AS ps WHERE ps.project=?`;
const STAGE_LIST = STAGES.map((stage) => `'${stage}'`).join(",");
// The first page (API-151). My turn across the spaces in SPEC-143's order: the
// comments that ask for a checkpoint, the open proposals, then the other
// comments that wait for the user, each oldest first by the time that it began
// to wait, as API-152 orders a stage's talk; 50 with their total. Only those 50
// read a comment's last entry, the agent's: the change of an open proposal
// that answers it after its last reply, else that reply, else the comment; and
// look their item up in the stored snapshot, the first with the ID on one of
// the 13 stages, as API-157 finds it. A comment's entries take strictly later
// times, so the proposal and the reply never tie.
// A checkpoint request among them shows whole (SPEC-196, TASK-302): the place
// of its last entry, the agent's last reply, else 0 for the comment's own, as a
// pass names it (API-128); that entry's text and thing to look at first, an
// item looked up as above, with its stage, or an address; and what is left in
// its part's stage as the stage's record counts it (API-158): the open
// discrepancies that the stage compares, the other open comments and the
// pending reflections. A request stored without the thing to look at first
// shows its first 300 characters only.
const MY_TURN = `WITH mine AS (
    SELECT CASE WHEN asks='checkpoint' THEN 0 ELSE 2 END AS rank,'comment' AS kind,id,project,part,stage,item,quote,text AS own,last_at AS at,asks,look_first AS look
      FROM comments WHERE state='open' AND waits='user'
    UNION ALL SELECT 1,'proposal',id,project,part,stage,COALESCE(json_extract(items,'$[0]'),''),NULL,change,made_at,NULL,NULL
      FROM proposals WHERE state='open'),
  top AS MATERIALIZED (SELECT *,COUNT(*) OVER() AS _total FROM mine ORDER BY rank,at,id LIMIT ${TURN}),
  asked AS MATERIALIZED (SELECT id,project,part,stage,own,look,(SELECT json_object('seq',r.seq,'text',r.text,'look',r.look_first)
      FROM replies AS r WHERE r.comment=top.id ORDER BY r.seq DESC LIMIT 1) AS last
    FROM top WHERE kind='comment' AND asks='checkpoint'),
  req AS MATERIALIZED (SELECT id,project,part,stage,CASE WHEN last IS NULL THEN 0 ELSE json_extract(last,'$.seq') END AS entry,
      CASE WHEN last IS NULL THEN own ELSE json_extract(last,'$.text') END AS text,CASE WHEN last IS NULL THEN look ELSE json_extract(last,'$.look') END AS look
    FROM asked),
  sought AS MATERIALIZED (SELECT project,item FROM top WHERE item<>'' UNION SELECT project,look FROM req WHERE look IS NOT NULL AND substr(look,1,8)<>'https://'),
  titles AS MATERIALIZED (SELECT s.name AS project,json_extract(j.value,'$.id') AS item,json_extract(j.value,'$.title') AS title,
      json_extract(j.value,'$.stage') AS stage,j.key AS place
    FROM snapshots AS s JOIN json_each(s.body,'$.items') AS j
    WHERE s.name IN (SELECT project FROM sought) AND json_extract(j.value,'$.stage') IN (${STAGE_LIST})
      AND json_extract(j.value,'$.id') IN (SELECT item FROM sought WHERE sought.project=s.name))
  SELECT top.*,CASE WHEN kind='comment' THEN COALESCE((SELECT p.change FROM proposals AS p WHERE p.comment=top.id AND p.state='open'
      AND p.made_at>COALESCE((SELECT r.made_at FROM replies AS r WHERE r.comment=top.id ORDER BY r.seq DESC LIMIT 1),'') ORDER BY p.made_at DESC,p.id DESC LIMIT 1),
    (SELECT r.text FROM replies AS r WHERE r.comment=top.id ORDER BY r.seq DESC LIMIT 1),own) ELSE own END AS last_text,
    (SELECT title FROM titles AS t WHERE t.project=top.project AND t.item=top.item ORDER BY t.place LIMIT 1) AS title,
    (SELECT json_object('entry',q.entry,'text',q.text,'look',q.look,
        'look_stage',(SELECT t.stage FROM titles AS t WHERE t.project=q.project AND t.item=q.look ORDER BY t.place LIMIT 1),
        'look_title',(SELECT t.title FROM titles AS t WHERE t.project=q.project AND t.item=q.look ORDER BY t.place LIMIT 1),
        'discrepancies',(SELECT COUNT(*) FROM discrepancies AS d WHERE d.project=q.project AND d.part=q.part AND d.state='open'
          AND CASE q.stage WHEN '01-domain' THEN 1 WHEN '05-erd' THEN d.compares='aggregate-table' WHEN '07-sitemap' THEN d.compares='read-model-screen' ELSE 0 END),
        'comments',(SELECT COUNT(*) FROM comments AS c WHERE c.project=q.project AND c.part=q.part AND c.stage=q.stage AND c.state='open' AND c.id<>q.id),
        'reflections',(SELECT COUNT(*) FROM edits AS e WHERE e.project=q.project AND e.part=q.part AND e.stage=q.stage AND e.state NOT IN ('closed','dismissed')))
      FROM req AS q WHERE q.id=top.id AND q.look IS NOT NULL) AS request_json
  FROM top ORDER BY rank,at,id`;
// Each space's agent to-do in counts, by the lists of API-113 read without a
// session, with the place of each list's oldest entry: a discrepancy opens at
// its table's or screen's stage.
const TODO_LISTS = [
  ["comments", "comments", "state='open' AND waits='agent'", "stage", "last_at"],
  ["discrepancies", "discrepancies", "state='open'", "CASE compares WHEN 'aggregate-table' THEN '05-erd' ELSE '07-sitemap' END", "opened_at"],
  ["reflections", "edits", "state NOT IN ('closed','dismissed')", "stage", "made_at"],
  ["checkpoints", "checkpoints", TODO_CHECKPOINT, "stage", "passed_at"],
];
// With them, the space's last read and what the agent has not read (SPEC-188,
// SPEC-189): five `?`, each the time of the read.
const AGENT_COUNTS = `SELECT ps.project,${TODO_LISTS.map(([list, table, where, stage, time]) =>
  `(SELECT COUNT(*) FROM ${table} WHERE project=ps.project AND ${where}) AS ${list},
  (SELECT json_object('part',part,'stage',${stage},'entry',id) FROM ${table} WHERE project=ps.project AND ${where} ORDER BY ${time},id LIMIT 1) AS ${list}_oldest`).join(",\n  ")},
  ps.read_at,${UNREAD} AS unread_json,
  (SELECT COUNT(*) FROM claims WHERE project=ps.project AND ends_at>? AND ${TAKEN}) AS taken
  FROM project_spaces AS ps ORDER BY ps.project`;
// A card for each stored snapshot, by name: SQLite takes the settings, the
// stage records, each stage's count of items and the count of warnings out of
// the stored body, so the server never parses the items or the checks. The
// snapshot's revision is what a pass from the first page names where the
// snapshot names no commit (SPEC-194, SPEC-196).
const SNAPSHOT_HEAD = `name,default_commit,revision,generated_at,received_at,json_extract(body,'$.project') AS project,
  json_extract(body,'$.repos."."') AS repo`;
const CARDS = `SELECT ${SNAPSHOT_HEAD},json_extract(body,'$.stages') AS stages,
  (SELECT json_group_object(stage,n) FROM (SELECT json_extract(value,'$.stage') AS stage,COUNT(*) AS n
    FROM json_each(snapshots.body,'$.items') WHERE json_extract(value,'$.stage') IN (${STAGE_LIST}) GROUP BY 1)) AS counts,
  (SELECT COUNT(*) FROM json_each(snapshots.body,'$.checks') WHERE json_extract(value,'$.level')='warn') AS warnings
  FROM snapshots ORDER BY name`;
const CARD_PICTURES = `SELECT p.project,p.part,p.stage,p.commit_id,p.committed_at,p.not_current,p.source,
  (SELECT COUNT(*) FROM comments AS c WHERE c.project=p.project AND c.part=p.part AND c.stage=p.stage AND c.state='open') AS comments
  FROM pictures AS p ORDER BY p.project,p.part,p.stage`;
// A comment as a list holds it: its count of replies, its last reply and its
// proposals' IDs, newest first.
const COMMENT_EXTRAS = `(SELECT COUNT(*) FROM replies AS r WHERE r.comment=c.id) AS reply_count,
      (SELECT json_object('seq',r.seq,'author',r.author,'text',r.text,'settles',r.settles,'made_at',r.made_at,'look_first',r.look_first)
       FROM replies AS r WHERE r.comment=c.id ORDER BY r.seq DESC LIMIT 1) AS last_reply_json,
      (SELECT json_group_array(id) FROM (SELECT id FROM proposals WHERE comment=c.id ORDER BY made_at DESC,id LIMIT 500)) AS proposal_ids_json`;
// A stage's closed talk (API-152): its closed comments, by their last entry,
// and its proposals no longer open, by when they closed; an item narrows both.
const CLOSED_TALK = `talk AS (SELECT 'comment' AS kind,id,last_at AS at FROM comments
      WHERE project=? AND part=? AND stage=? AND state='closed' AND (? IS NULL OR item=?)
    UNION ALL SELECT 'proposal',id,COALESCE(closed_at,made_at) FROM proposals
      WHERE project=? AND part=? AND stage=? AND state<>'open' AND (? IS NULL OR EXISTS(SELECT 1 FROM json_each(items) WHERE value=?)))`;

// What a removal deletes with the snapshot (API-110, SPEC-115): the count of
// each kind of the space's rows and, by ID, the open entries that the user may
// finish first, up to 20 of each with their totals, in the order of
// project-data.js's removal(). A project's data (API-177) and the export's head
// (API-178) count the same rows in the same way, so the three cannot differ.
const REMOVAL = [
  ...["pictures", "discrepancies", "comments", "proposals", "edits", "checkpoints"].map((table) => `SELECT COUNT(*) AS n FROM ${table} WHERE project=?`),
  "SELECT COUNT(*) AS n FROM replies AS r JOIN comments AS c ON c.id=r.comment WHERE c.project=?",
  "SELECT COUNT(*) AS n FROM decisions AS d JOIN comments AS c ON c.id=d.comment WHERE c.project=?",
  ...[["comments", "state='open'"], ["proposals", "state='open'"], ["edits", "state NOT IN ('closed','dismissed')"], ["checkpoints", "state='passed' AND recorded_commit IS NULL"]]
    .map(([table, where]) => `SELECT id,COUNT(*) OVER() AS _total FROM ${table} WHERE project=? AND ${where} ORDER BY id LIMIT 20`),
];
// The export's lists (API-178, SPEC-201), each in the file's order: every
// comment, its replies and its decisions, every proposal with its stage source
// text and its edit, every edit and every checkpoint of the space. An edit's
// content and report stay out, as no answer gives them.
const EXPORT = [
  "SELECT * FROM comments WHERE project=? ORDER BY made_at,id",
  "SELECT r.* FROM replies AS r JOIN comments AS c ON c.id=r.comment WHERE c.project=? ORDER BY r.comment,r.seq",
  "SELECT d.* FROM decisions AS d JOIN comments AS c ON c.id=d.comment WHERE c.project=? ORDER BY d.comment,d.seq",
  "SELECT p.*,e.id AS edit FROM proposals AS p LEFT JOIN edits AS e ON e.proposal=p.id WHERE p.project=? ORDER BY p.made_at,p.id",
  "SELECT id,part,stage,commit_id,proposal,state,pull_request,closed_commit,made_at,changed_at FROM edits WHERE project=? ORDER BY made_at,id",
  "SELECT * FROM checkpoints WHERE project=? ORDER BY passed_at,id",
];

// Engine operations also stay here. The standalone adapter never owns product
// SQL, and uses these fixed statements only for connection/transaction upkeep.
export const SQLITE = Object.freeze({
  setup: "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;",
  begin: "BEGIN IMMEDIATE", commit: "COMMIT", rollback: "ROLLBACK",
  changes: "SELECT total_changes() AS n", integrity: "PRAGMA integrity_check",
  foreignKeys: "PRAGMA foreign_key_check", archive: "PRAGMA journal_mode=DELETE",
  // A database's tables and their row counts, which compare a restored copy with the server's (TASK-313).
  tables: "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name",
  rows: (table) => `SELECT COUNT(*) AS n FROM "${table.replaceAll('"', '""')}"`,
  columns: (table) => `SELECT name FROM pragma_table_info('${table.replaceAll("'", "''")}')`,
  projectRows: (table) => `SELECT project, COUNT(*) AS n FROM "${table.replaceAll('"', '""')}" GROUP BY project ORDER BY project`,
});


// API-237. The manifest records closed, ordered rows from a consistent
// SQLite backup. Unknown tables are kept in that backup and block automatic
// native import until the operator has accounted for their contents.
const LEGACY_KEYS = Object.freeze({
  snapshots: ["name"], project_spaces: ["project"], pictures: ["project", "part", "stage"], discrepancies: ["id"],
  comments: ["id"], replies: ["comment", "seq"], decisions: ["comment", "seq"], proposals: ["id"], edits: ["id"],
  checkpoints: ["id"], claims: ["entry"], writes: ["project", "id"], migrations: ["version"],
});

export function readLegacyCollections(connection) {
  const metadata = connection.prepare(`SELECT name,sql FROM sqlite_schema
    WHERE type='table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name`).all();
  const names = new Set(metadata.map(({ name }) => name));
  if (!["snapshots", "project_spaces", "comments", "checkpoints", "writes", "migrations"].every((name) => names.has(name))) {
    throw new Error("Expected a legacy NEXUS database");
  }
  if (connection.prepare(SQLITE.integrity).get()?.integrity_check !== "ok" || connection.prepare(SQLITE.foreignKeys).get()) {
    throw new Error("Legacy database integrity failed");
  }
  const records = {};
  const unknown = [];
  for (const { name } of metadata) {
    if (!Object.hasOwn(LEGACY_KEYS, name)) { unknown.push(name); continue; }
    const order = LEGACY_KEYS[name].map((key) => `"${key}"`).join(",");
    records[name] = connection.prepare(`SELECT * FROM "${name}" ORDER BY ${order}`).all().map((row) => ({ ...row }));
  }
  const boundary = connection.prepare("SELECT coalesce(max(rowid),0) AS boundary FROM writes").get().boundary;
  return { schema: metadata.map((item) => ({ ...item })), records, usedKeys: LEGACY_KEYS, unknown, boundary };
}


// TASK-322 (SPEC-341, SPEC-343): the rebuild owns a different database.
// Its application ID and schema version are committed with the first schema.
const REBUILD_APPLICATION_ID = 0x4e585332;
const REBUILD_SCHEMA_VERSION = 1;

export function applyRebuildSchema(connection, initialSchema) {
  connection.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  connection.exec(SQLITE.begin);
  try {
    const { application_id: application } = connection.prepare("PRAGMA application_id").get();
    const { user_version: version } = connection.prepare("PRAGMA user_version").get();
    if (application === 0 && version === 0) {
      const occupied = connection.prepare("SELECT 1 FROM sqlite_schema WHERE substr(name, 1, 7) <> 'sqlite_' LIMIT 1").get();
      if (occupied) throw new Error("The rebuild schema requires an empty database");
      connection.exec(initialSchema);
      connection.exec(`PRAGMA application_id=${REBUILD_APPLICATION_ID}; PRAGMA user_version=${REBUILD_SCHEMA_VERSION};`);
    } else if (application !== REBUILD_APPLICATION_ID || version !== REBUILD_SCHEMA_VERSION) {
      throw new Error("Unsupported rebuild database version");
    }
    const integrity = connection.prepare(SQLITE.integrity).all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok" || connection.prepare(SQLITE.foreignKeys).get()) {
      throw new Error("Rebuild database integrity check failed");
    }
    connection.exec(SQLITE.commit);
  } catch (error) {
    connection.exec(SQLITE.rollback);
    throw error;
  }
}

const REBUILD_PROJECT_COLUMNS = "id,slug,title,repository_url,default_branch,synthetic,row_revision,held_publication_id";

function rebuildProject(row) {
  if (!row) return null;
  return { id: row.id, slug: row.slug, title: row.title, synthetic: Boolean(row.synthetic), revision: row.row_revision,
    repository_url: row.repository_url, default_branch: row.default_branch,
    verification_state: row.repository_url === null ? "not_connected" : row.held_publication_id ? "ready" : "authorization_required" };
}

function rebuildCredential(row) {
  return { id: row.id, role: row.role, label: row.label, created_at: row.created_at, revoked: row.revoked_at !== null };
}

function rebuildPublication(row) {
  return { id: row.id, sent: true, held_commit: row.commit_sha, revision: row.revision, snapshot_digest: row.snapshot_digest };
}

const DISCUSSION_COLUMNS = `d.id,a.content_version,d.item_trace_id AS item_id,d.state,d.row_revision AS revision,a.part,a.stage,a.publication_id,
  CASE WHEN d.item_trace_id IS NULL THEN 0 ELSE NOT EXISTS(
    SELECT 1 FROM stage_artifacts newest JOIN artifact_items t ON t.project_id=newest.project_id AND t.artifact_id=newest.id
    WHERE newest.project_id=d.project_id AND newest.publication_id=p.held_publication_id AND newest.part=a.part AND newest.stage=a.stage
      AND t.trace_id=d.item_trace_id AND t.removed=0) END AS removed_item`;
const WORK_COLUMNS = `w.*,m.id AS question_id,m.discussion_id,m.sequence,m.author_kind AS author,m.author_ref,m.body,m.created_at AS question_date,
  d.item_trace_id,a.content_version,a.part,a.stage,a.publication_id`;
const WORK_JOINS = `FROM agent_work w JOIN messages m ON m.project_id=w.project_id AND m.id=w.question_message_id
  JOIN discussions d ON d.project_id=m.project_id AND d.id=m.discussion_id JOIN stage_artifacts a ON a.project_id=d.project_id AND a.id=d.origin_artifact_id`;
const PROPOSAL_COLUMNS = `p.id,p.state,p.row_revision,p.discussion_id,p.work_id,p.body,p.reflected_publication_id,p.source_commit,
  a.content_version,r.content_version AS reflected_version`;

function claimant(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return { credential: value, label: value.slice(0, 80) }; }
}

function rebuildVisibleWork(row, now, credential) {
  return row.state === "queued" || (row.state === "claimed" && row.lease_expires_at <= now) || claimant(row.claimed_by)?.credential === credential;
}

function rebuildWork(row, now) {
  const expired = row.state === "claimed" && row.lease_expires_at <= now;
  return { id: row.id, question_id: row.question_id, content_version: row.content_version, state: expired ? "queued" : row.state,
    session_label: expired ? null : claimant(row.claimed_by)?.label ?? null, lease_expires_at: expired ? null : row.lease_expires_at,
    revision: row.row_revision, discussion_id: row.discussion_id, part: row.part, stage: row.stage, item_id: row.item_trace_id,
    question: { id: row.question_id, discussion_id: row.discussion_id, sequence: row.sequence, author: row.author,
      author_ref: row.author_ref, body: row.body, created_at: row.question_date }, publication_id: row.publication_id };
}

function checkRebuildLease(row, actor, hash, now) {
  if (!row) return "not_found";
  if (row.state !== "claimed" || row.lease_expires_at <= now) return "lease_expired";
  if (claimant(row.claimed_by)?.credential !== actor || row.lease_token_hash !== hash) return "state_conflict";
  return null;
}

function rebuildProposal(row) {
  return { id: row.id, state: row.state, revision: row.row_revision, discussion_id: row.discussion_id, work_id: row.work_id,
    body: row.body, content_version: row.content_version, reflection: row.state === "reflected" ? {
      publication_id: row.reflected_publication_id, source_commit: row.source_commit, content_version: row.reflected_version || row.content_version,
    } : null };
}

// The rebuild uses native SQLite. Each write callback is synchronous so a
// transaction cannot be kept open during a provider request.
export class RebuildStore {
  constructor(connection) {
    this.connection = connection;
  }

  transaction(write) {
    this.connection.exec(SQLITE.begin);
    try {
      const result = write();
      this.connection.exec(SQLITE.commit);
      return result;
    } catch (error) {
      this.connection.exec(SQLITE.rollback);
      throw error;
    }
  }

  saveAuthAttempt(attempt) {
    this.connection.prepare(`INSERT INTO auth_attempts(state_hash,nonce_hash,protected_pkce_verifier,safe_return_path,created_at,expires_at)
      VALUES (?,?,?,?,?,?)`).run(attempt.stateHash, attempt.nonceHash, attempt.verifier, attempt.returnPath, attempt.now, attempt.expires);
  }

  consumeAuthAttempt(stateHash, now) {
    return this.connection.prepare(`UPDATE auth_attempts SET used_at=?
      WHERE state_hash=? AND used_at IS NULL AND expires_at>?
      RETURNING state_hash,nonce_hash,protected_pkce_verifier,safe_return_path`).get(now, stateHash, now) ?? null;
  }

  issueSession({ issuer, subject, ownerId, idHash, csrfHash, now, idleExpires, absoluteExpires, previousHash }) {
    return this.transaction(() => {
      this.connection.prepare("INSERT INTO owners(id,issuer,subject,created_at) VALUES(?,?,?,?) ON CONFLICT(issuer,subject) DO NOTHING")
        .run(ownerId, issuer, subject, now);
      const { id } = this.connection.prepare("SELECT id FROM owners WHERE issuer=? AND subject=?").get(issuer, subject);
      if (previousHash) this.revokeSession(previousHash, now);
      this.connection.prepare(`INSERT INTO owner_sessions(id_hash,owner_id,csrf_hash,created_at,last_seen_at,idle_expires_at,absolute_expires_at)
        VALUES (?,?,?,?,?,?,?)`).run(idHash, id, csrfHash, now, now, idleExpires, absoluteExpires);
      return id;
    });
  }

  session(idHash, time) {
    return this.connection.prepare(`SELECT owner_id,csrf_hash,idle_expires_at,absolute_expires_at FROM owner_sessions
      WHERE id_hash=? AND revoked_at IS NULL AND idle_expires_at>? AND absolute_expires_at>?`).get(idHash, time, time) ?? null;
  }

  touchSession(idHash, now, idleExpires) {
    return this.connection.prepare(`UPDATE owner_sessions SET last_seen_at=?,idle_expires_at=min(?,absolute_expires_at)
      WHERE id_hash=? AND revoked_at IS NULL AND idle_expires_at>? AND absolute_expires_at>?
      RETURNING owner_id,csrf_hash,idle_expires_at,absolute_expires_at`).get(now, idleExpires, idHash, now, now) ?? null;
  }

  revokeSession(idHash, now) {
    return this.connection.prepare(`UPDATE owner_sessions SET revoked_at=? WHERE id_hash=? AND revoked_at IS NULL
      AND idle_expires_at>? AND absolute_expires_at>?`).run(now, idHash, now, now).changes === 1;
  }

  credential(secretHash, now) {
    return this.connection.prepare(`SELECT c.id,c.owner_id,c.project_id,c.role FROM project_credentials c
      JOIN projects p ON p.id=c.project_id AND p.owner_id=c.owner_id
      WHERE c.secret_hash=? AND c.revoked_at IS NULL AND (c.expires_at IS NULL OR c.expires_at>?) AND p.archived_at IS NULL`)
      .get(secretHash, now) ?? null;
  }

  listProjects(owner, after, limit) {
    return this.connection.prepare(`SELECT ${REBUILD_PROJECT_COLUMNS} FROM projects
      WHERE owner_id=? AND archived_at IS NULL AND id>? ORDER BY id LIMIT ?`).all(owner, after, limit).map(rebuildProject);
  }

  project(owner, id) {
    return rebuildProject(this.connection.prepare(`SELECT ${REBUILD_PROJECT_COLUMNS} FROM projects
      WHERE owner_id=? AND id=? AND archived_at IS NULL`).get(owner, id));
  }

  overview(owner, id) {
    const row = this.connection.prepare(`SELECT p.*,v.commit_sha FROM projects p
      LEFT JOIN publications v ON v.project_id=p.id AND v.id=p.held_publication_id
      WHERE p.owner_id=? AND p.id=? AND p.archived_at IS NULL`).get(owner, id);
    if (!row) return null;
    const artifacts = this.connection.prepare(`SELECT a.id,a.part,a.stage,a.content_version,a.representation FROM stage_artifacts a
      JOIN projects p ON p.id=a.project_id AND p.held_publication_id=a.publication_id WHERE p.owner_id=? AND p.id=?
      ORDER BY a.part,a.stage`).all(owner, id);
    const checkpoints = this.connection.prepare(`SELECT c.id,c.content_version,c.state,a.part,a.stage FROM checkpoint_requests c
      JOIN stage_artifacts a ON a.project_id=c.project_id AND a.id=c.artifact_id
      JOIN publications v ON v.project_id=a.project_id AND v.id=a.publication_id
      JOIN projects p ON p.id=c.project_id WHERE p.owner_id=? AND p.id=?
      ORDER BY v.revision DESC,c.requested_at DESC,c.id`).all(owner, id);
    return { project: rebuildProject(row), heldCommit: row.commit_sha, artifacts, checkpoints };
  }

  readReceipt({ owner, scope, operation, keyHash, bodyDigest, now }) {
    const row = this.connection.prepare(`SELECT body_digest,http_status,safe_result_json FROM idempotency_receipts
      WHERE owner_id=? AND scope_key=? AND operation=? AND key_hash=? AND expires_at>?`).get(owner, scope, operation, keyHash, now);
    if (!row) return null;
    return row.body_digest === bodyDigest ? { body: JSON.parse(row.safe_result_json), status: row.http_status, replay: true }
      : { conflict: "idempotency_conflict" };
  }

  writeWithReceipt({ owner, scope, operation, keyHash, bodyDigest, receipt, now, expires, digest }, input, write) {
    return this.transaction(() => {
      const before = this.connection.prepare(`SELECT id,body_digest,http_status,safe_result_json,expires_at FROM idempotency_receipts
        WHERE owner_id=? AND scope_key=? AND operation=? AND key_hash=?`).get(owner, scope, operation, keyHash);
      if (before?.expires_at > now) return before.body_digest === bodyDigest
        ? { body: JSON.parse(before.safe_result_json), status: before.http_status, replay: true } : { conflict: "idempotency_conflict" };
      const capture = this.connection.createSession();
      try {
        const result = write();
        if (result.conflict) return result;
        // Preserve the original receipt and journal link after its key expires.
        if (before) this.connection.prepare("UPDATE idempotency_receipts SET scope_key=? WHERE id=?").run(`expired:${before.id}`, before.id);
        const response = JSON.stringify(result.safeBody ?? result.body);
        this.connection.prepare(`INSERT INTO idempotency_receipts(id,owner_id,project_id,scope_key,operation,key_hash,body_digest,
          http_status,safe_result_json,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
          .run(receipt, owner, result.projectId, scope, operation, keyHash, bodyDigest, result.status, response, now, expires);
        const identity = this.connection.prepare("SELECT id,issuer,subject,created_at FROM owners WHERE id=?").get(owner);
        const changes = Buffer.from(capture.changeset());
        this.connection.prepare(`INSERT INTO write_journal(project_id,operation,receipt_id,protected_payload_json,result_digest,acknowledged_at)
          VALUES(?,?,?,?,?,?)`).run(result.projectId, operation, receipt,
            JSON.stringify({ owner, scope, keyHash, bodyDigest, input, result: JSON.parse(response), ...result.journal,
              identity, changeset: changes.toString("base64"), changeset_sha256: digest(changes) }), digest(response), now);
        return result;
      } finally { capture.close(); }
    });
  }

  projectState(owner, id) {
    return this.connection.prepare(`SELECT p.*,v.commit_sha,v.revision as publication_revision,v.snapshot_digest
      FROM projects p LEFT JOIN publications v ON v.project_id=p.id AND v.id=p.held_publication_id
      WHERE p.owner_id=? AND p.id=? AND p.archived_at IS NULL`).get(owner, id) ?? null;
  }

  listCredentials(project) {
    return this.connection.prepare(`SELECT id,role,label,created_at,revoked_at FROM project_credentials
      WHERE project_id=? ORDER BY revoked_at IS NOT NULL,created_at DESC,id LIMIT 100`).all(project).map(rebuildCredential);
  }

  issueCredential(write, project, input, id, secret, secretHash) {
    return this.writeWithReceipt(write, input, () => {
      const count = this.connection.prepare("SELECT count(*) AS n FROM project_credentials WHERE project_id=? AND revoked_at IS NULL").get(project).n;
      if (count >= 100) return { conflict: "state_conflict" };
      const credential = rebuildCredential(this.connection.prepare(`INSERT INTO project_credentials(id,owner_id,project_id,role,label,secret_hash,created_at)
        VALUES(?,?,?,?,?,?,?) RETURNING id,role,label,created_at,revoked_at`).get(id, write.owner, project, input.role, input.label, secretHash, write.now));
      return { projectId: project, status: 201, body: { credential, secret, one_time: true },
        safeBody: { credential, secret_not_replayed: true }, journal: { credential_hash: secretHash } };
    });
  }

  revokeCredential(write, project, id, input) {
    return this.writeWithReceipt(write, input, () => {
      const row = this.connection.prepare(`UPDATE project_credentials SET revoked_at=coalesce(revoked_at,?)
        WHERE owner_id=? AND project_id=? AND id=? RETURNING id,role,label,created_at,revoked_at`).get(write.now, write.owner, project, id);
      return row ? { projectId: project, status: 200, body: rebuildCredential(row) } : { conflict: "not_found" };
    });
  }

  liveConsent(owner, project, id, digest) {
    return Boolean(this.connection.prepare(`SELECT id FROM publication_consents WHERE id=? AND owner_id=? AND project_id=?
      AND preview_digest=? AND withdrawn_at IS NULL`).get(id, owner, project, digest));
  }

  firstConsent(write, project, input, id) {
    return this.writeWithReceipt(write, input, () => {
      const row = this.projectState(write.owner, project);
      if (!row || row.held_publication_id || !row.repository_url || row.synthetic) return { conflict: "state_conflict" };
      // Only the latest consent remains active before the first publication.
      this.connection.prepare(`UPDATE publication_consents SET withdrawn_at=?
        WHERE project_id=? AND withdrawn_at IS NULL`).run(write.now, project);
      this.connection.prepare("INSERT INTO publication_consents(id,project_id,owner_id,preview_digest,consented_at) VALUES(?,?,?,?,?)")
        .run(id, project, write.owner, input.preview_digest, write.now);
      return { projectId: project, status: 201, body: { id, preview_digest: input.preview_digest, consented_at: write.now } };
    });
  }

  publication(project, id) {
    const row = this.connection.prepare(`SELECT id,commit_sha,revision,snapshot_digest FROM publications
      WHERE project_id=? AND id=?`).get(project, id);
    return row ? rebuildPublication(row) : null;
  }

  publish(write, project, credential, verified, input) {
    return this.writeWithReceipt(write, input, () => {
      if (this.credential(credential, write.now)?.project_id !== project) return { conflict: "sign_in_required" };
      const current = this.projectState(write.owner, project);
      if (!current) return { conflict: "not_found" };
      if (current.held_publication_id !== verified.priorId || current.commit_sha !== input.base_commit ||
          current.repository_url !== verified.repository || current.synthetic) return { conflict: "older_publication" };
      if (current.commit_sha === input.commit) {
        const body = this.publication(project, current.held_publication_id);
        return body.snapshot_digest === verified.digest ? { projectId: project, body, status: 201 } : { conflict: "older_publication" };
      }
      if (current.held_publication_id) {
        if (input.consent_id !== null) return { conflict: "consent_required" };
      } else {
        const consent = this.connection.prepare(`UPDATE publication_consents SET withdrawn_at=?
          WHERE id=? AND owner_id=? AND project_id=? AND preview_digest=? AND withdrawn_at IS NULL RETURNING id`)
          .get(write.now, input.consent_id, write.owner, project, verified.consentDigest);
        if (!consent) return { conflict: "consent_required" };
      }
      const body = this.insertPublication(current, verified, input, write.now);
      return { projectId: project, body, status: 201, journal: { parser_version: verified.parser } };
    });
  }

  insertPublication(current, verified, input, now) {
    const project = current.id;
    const revision = Number(current.publication_revision || 0) + 1;
    const publication = verified.id;
    this.connection.prepare(`INSERT INTO publications(id,project_id,revision,commit_sha,parent_publication_id,snapshot_digest,
      format_version,snapshot_json,received_at) VALUES(?,?,?,?,?,?,2,?,?)`)
      .run(publication, project, revision, input.commit, current.held_publication_id, verified.digest, verified.snapshotText, now);
    const history = this.connection.prepare(`SELECT id,part,stage,source_path FROM stage_artifacts WHERE project_id=? AND publication_id=?`)
      .all(project, current.held_publication_id);
    const previousBySlot = new Map(history.map((artifact) => [`${artifact.part}\0${artifact.stage}`, artifact]));
    const insert = this.connection.prepare(`INSERT INTO stage_artifacts(id,project_id,publication_id,part,stage,content_version,
      parser_version,representation,source_path,source_json,attachment_manifest_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
    const fetchItems = this.connection.prepare("SELECT trace_id,item_json FROM artifact_items WHERE project_id=? AND artifact_id=?");
    const insertItem = this.connection.prepare(`INSERT INTO artifact_items(project_id,artifact_id,trace_id,item_json,source_line,removed)
      VALUES(?,?,?,?,?,?)`);
    const versionBySlot = new Map();
    for (const artifact of verified.artifacts) {
      const { id, part, stage, sourcePath, contentVersion, representation, diagnostics, graph, files, manifest } = artifact;
      const slot = `${part}\0${stage}`;
      const previous = previousBySlot.get(slot);
      versionBySlot.set(slot, contentVersion);
      const path = sourcePath || previous?.source_path || stage;
      insert.run(id, project, publication, part, stage, contentVersion, verified.parser, representation, path,
        JSON.stringify({ graph, diagnostics, source_files: files }), JSON.stringify(manifest), now);
      const oldItems = previous ? fetchItems.all(project, previous.id) : [];
      const byId = new Map(artifact.items.map((item) => [item.id, item]));
      for (const old of oldItems) {
        if (byId.has(old.trace_id)) continue;
        const item = JSON.parse(old.item_json);
        byId.set(old.trace_id, { ...item, path: item.source.path, line: null, removed: true });
      }
      for (const value of byId.values()) {
        const item = { id: value.id, title: value.title, kind: value.kind, removed: value.removed, fields: value.fields,
          source: { repository_url: verified.repository, path: value.path, line: value.line, commit: input.commit,
            content_version: contentVersion, publication_id: publication, publication_revision: revision, published_at: now } };
        insertItem.run(project, id, item.id, JSON.stringify(item), value.line, Number(value.removed));
      }
    }
    const pending = this.connection.prepare(`SELECT c.id,c.content_version,a.part,a.stage FROM checkpoint_requests c
      JOIN stage_artifacts a ON a.project_id=c.project_id AND a.id=c.artifact_id WHERE c.project_id=? AND c.state='pending'`).all(project);
    const supersede = this.connection.prepare("UPDATE checkpoint_requests SET state='superseded',row_revision=row_revision+1 WHERE project_id=? AND id=?");
    for (const row of pending) {
      if (versionBySlot.get(`${row.part}\0${row.stage}`) !== row.content_version) supersede.run(project, row.id);
    }
    this.connection.prepare("UPDATE projects SET held_publication_id=?,row_revision=row_revision+1 WHERE id=? AND owner_id=?")
      .run(publication, project, current.owner_id);
    return rebuildPublication({ id: publication, commit_sha: input.commit, revision, snapshot_digest: verified.digest });
  }

  artifact(project, part, stage, selection) {
    const { version, publication } = selection;
    return this.connection.prepare(`SELECT a.*,p.repository_url,p.held_publication_id,p.synthetic,v.commit_sha,
        v.revision AS publication_revision,v.received_at AS published_at
      FROM stage_artifacts a JOIN projects p ON p.id=a.project_id
      JOIN publications v ON a.publication_id=v.id AND a.project_id=v.project_id
      WHERE p.id=? AND a.part=? AND a.stage=?
        AND (? IS NULL OR a.content_version=?) AND (? IS NULL OR a.publication_id=?)
        AND (? IS NOT NULL OR ? IS NOT NULL OR a.publication_id=p.held_publication_id)
      ORDER BY v.revision DESC LIMIT 1`).get(project, part, stage, version, version, publication, publication, version, publication) ?? null;
  }

  artifactById(project, id, version) {
    return this.connection.prepare(`SELECT id,content_version,representation,source_path,source_json FROM stage_artifacts
      WHERE project_id=? AND id=? AND (? IS NULL OR content_version=?)`).get(project, id, version, version) ?? null;
  }

  artifactItems(project, artifact, after, limit, only) {
    return this.connection.prepare(`SELECT item_json FROM artifact_items
      WHERE project_id=? AND artifact_id=? AND trace_id>? AND (? IS NULL OR trace_id=?) ORDER BY trace_id LIMIT ?`)
      .all(project, artifact, after, only, only, limit).map(({ item_json }) => JSON.parse(item_json));
  }

  citedWork(project, artifact, credential, at, { after = "", limit = 1, item = null } = {}) {
    return this.connection.prepare(`SELECT DISTINCT d.item_trace_id FROM agent_work w
      JOIN messages m ON m.project_id=w.project_id AND m.id=w.question_message_id
      JOIN discussions d ON d.project_id=w.project_id AND d.id=m.discussion_id
      WHERE w.project_id=? AND d.origin_artifact_id=?
        AND (w.state='queued' OR (w.state='claimed' AND w.lease_expires_at<=?) OR
          (CASE WHEN json_valid(w.claimed_by) THEN json_extract(w.claimed_by,'$.credential') ELSE w.claimed_by END=?))
        AND (d.item_trace_id IS NULL OR (d.item_trace_id>? AND (? IS NULL OR d.item_trace_id=?)))
      ORDER BY d.item_trace_id LIMIT ?`).all(project, artifact, at, credential, after, item, item, limit).map((row) => row.item_trace_id);
  }

  versionPosition(project, artifact) {
    return this.connection.prepare(`SELECT a.part,a.stage,a.id,v.revision FROM stage_artifacts a
      JOIN publications v ON v.project_id=a.project_id AND a.publication_id=v.id
      WHERE a.project_id=? AND a.id=?`).get(project, artifact);
  }

  versions(project, prior, limit) {
    return this.connection.prepare(`SELECT v.id AS publication_id,v.commit_sha AS "commit",v.revision AS publication_revision,
      v.received_at AS published_at,a.part,a.stage,a.id AS artifact_id,a.content_version
      FROM stage_artifacts a JOIN publications v ON v.project_id=a.project_id AND v.id=a.publication_id
      WHERE a.project_id=? AND (v.revision<? OR (v.revision=? AND (a.part,a.stage,a.id)>(?,?,?)))
      ORDER BY v.revision DESC,a.part,a.stage,a.id LIMIT ?`)
      .all(project, prior.revision, prior.revision, prior.part, prior.stage, prior.id, limit);
  }

  artifactCheckpoints(project, part, stage, version) {
    return this.connection.prepare(`SELECT c.id,c.state,c.content_version FROM checkpoint_requests c
      JOIN stage_artifacts a ON a.project_id=c.project_id AND a.id=c.artifact_id
      WHERE c.project_id=? AND a.part=? AND a.stage=?
      ORDER BY c.content_version=? DESC,c.requested_at DESC,c.id LIMIT 100`).all(project, part, stage, version);
  }

  discussionRecord(project, id) {
    return this.connection.prepare(`SELECT ${DISCUSSION_COLUMNS} FROM discussions d
      JOIN stage_artifacts a ON a.project_id=d.project_id AND a.id=d.origin_artifact_id
      JOIN projects p ON p.id=d.project_id WHERE d.project_id=? AND d.id=?`).get(project, id) ?? null;
  }

  stageDiscussions(project, part, stage, version, after, limit) {
    return this.connection.prepare(`SELECT ${DISCUSSION_COLUMNS} FROM discussions d
      JOIN stage_artifacts a ON a.project_id=d.project_id AND a.id=d.origin_artifact_id JOIN projects p ON p.id=d.project_id
      WHERE d.project_id=? AND a.part=? AND a.stage=? AND d.id>? AND (? IS NULL OR a.content_version=?)
      ORDER BY d.id LIMIT ?`).all(project, part, stage, after, version, version, limit);
  }

  discussionRows(project, id, { messages, proposals, decisions }, now, credentialId) {
    const bySequence = (value) => Number(value.after || 0);
    const notes = this.connection.prepare(`SELECT id,discussion_id,sequence,author_kind AS author,body,created_at,author_ref FROM messages
      WHERE project_id=? AND discussion_id=? AND sequence>? ORDER BY sequence LIMIT ?`)
      .all(project, id, bySequence(messages), messages.limit + 1);
    const resolution = this.connection.prepare(`SELECT id,discussion_id,sequence,body,content_version,source_publication_id AS publication_id,
      source_commit,pull_request_url,coalesce(json_extract(legacy_actor_json,'$.label'),actor_owner_id) AS decided_by,decided_at FROM discussion_decisions
      WHERE project_id=? AND discussion_id=? AND sequence>? ORDER BY sequence LIMIT ?`)
      .all(project, id, bySequence(decisions), decisions.limit + 1);
    const changes = this.connection.prepare(`SELECT ${PROPOSAL_COLUMNS} FROM proposals p
      JOIN discussions d ON d.project_id=p.project_id AND d.id=p.discussion_id
      JOIN stage_artifacts a ON a.project_id=d.project_id AND a.id=d.origin_artifact_id
      LEFT JOIN stage_artifacts r ON r.project_id=p.project_id AND r.publication_id=p.reflected_publication_id AND r.part=a.part AND r.stage=a.stage
      WHERE p.project_id=? AND p.discussion_id=? AND p.id>? ORDER BY p.id LIMIT ?`).all(project, id, proposals.after, proposals.limit + 1);
    const work = this.connection.prepare(`SELECT ${WORK_COLUMNS} ${WORK_JOINS}
      WHERE w.project_id=? AND d.id=? ORDER BY m.sequence LIMIT 100`).all(project, id);
    const visible = work.filter((row) => !credentialId || rebuildVisibleWork(row, now, credentialId));
    if (credentialId && !visible.length) return null;
    return { notes, changes: changes.map(rebuildProposal), resolution, work: visible.map((row) => rebuildWork(row, now)) };
  }

  askAboutArtifact(write, project, part, stage, input, ids) {
    return this.writeWithReceipt(write, input, () => {
      const artifact = this.artifact(project, part, stage, { version: null, publication: input.publication_id });
      if (!artifact || ["missing", "unsupported"].includes(artifact.representation)) return { conflict: "not_found" };
      if (artifact.content_version !== input.content_version) return { conflict: "stale_version" };
      if (input.item_id !== null) {
        const item = this.connection.prepare(`SELECT removed FROM artifact_items WHERE project_id=? AND artifact_id=? AND trace_id=?`)
          .get(project, artifact.id, input.item_id);
        if (!item || item.removed) return { conflict: "not_found" };
      }
      this.connection.prepare(`INSERT INTO discussions(id,project_id,origin_artifact_id,item_trace_id,state,created_at) VALUES(?,?,?,?,'open',?)`)
        .run(ids.discussion, project, artifact.id, input.item_id, write.now);
      const question = this.insertRebuildMessage(project, ids.discussion, ids.message, "owner", write.owner, input.body, write.now);
      let queue = [];
      if (input.ask_ai) {
        this.connection.prepare(`INSERT INTO agent_work(id,project_id,question_message_id,state,created_at) VALUES(?,?,?,'queued',?)`)
          .run(ids.work, project, ids.message, write.now);
        queue = [rebuildWork(this.workRecord(project, ids.work), write.now)];
      }
      return { projectId: project, status: 201, body: { ...this.discussionRecord(project, ids.discussion), removed_item: false,
        messages: [question], next_cursor: null, agent_work: queue, proposals: [], next_proposal_cursor: null, decisions: [], next_decision_cursor: null },
        journal: { event: { kind: "discussion", target_id: ids.discussion, content_version: input.content_version } } };
    });
  }

  insertRebuildMessage(project, discussion, message, kind, actor, input, now, parent = null) {
    return this.connection.prepare(`INSERT INTO messages(id,project_id,discussion_id,sequence,parent_message_id,author_kind,author_ref,body,created_at)
      VALUES(?,?,?,(SELECT coalesce(max(sequence),0)+1 FROM messages WHERE project_id=? AND discussion_id=?),?,?,?,?,?)
      RETURNING id,discussion_id,sequence,author_kind AS author,body,created_at,author_ref`)
      .get(message, project, discussion, project, discussion, parent, kind, actor, input, now);
  }

  recordDiscussionDecision(write, project, id, input, decision) {
    return this.writeWithReceipt(write, input, () => {
      const row = this.discussionRecord(project, id);
      const publication = this.publication(project, input.publication_id);
      if (!row || !publication) return { conflict: "not_found" };
      if (row.revision !== input.expected_revision || publication.held_commit !== input.source_commit) return { conflict: "stale_version" };
      this.connection.prepare(`INSERT INTO discussion_decisions(id,project_id,discussion_id,sequence,actor_owner_id,content_version,
        body,source_publication_id,source_commit,pull_request_url,decided_at)
        VALUES(?,?,?,(SELECT coalesce(max(sequence),0)+1 FROM discussion_decisions WHERE project_id=? AND discussion_id=?),?,?,?,?,?,?,?)`)
        .run(decision, project, id, project, id, write.owner, row.content_version, input.body, input.publication_id, input.source_commit,
          input.pull_request_url ?? null, write.now);
      this.connection.prepare("UPDATE discussions SET state='resolved',row_revision=row_revision+1 WHERE project_id=? AND id=?").run(project, id);
      return { projectId: project, status: 201, body: { id: decision, state: "recorded", content_version: row.content_version, revision: row.revision + 1 },
        journal: { event: { kind: "discussion", target_id: id, content_version: row.content_version } } };
    });
  }

  workRecord(project, id) {
    return this.connection.prepare(`SELECT ${WORK_COLUMNS} ${WORK_JOINS} WHERE w.project_id=? AND w.id=?`).get(project, id) ?? null;
  }

  agentQueue(project, credential, now, after, limit) {
    return this.connection.prepare(`SELECT ${WORK_COLUMNS} ${WORK_JOINS} WHERE w.project_id=? AND w.id>? AND
      (w.state='queued' OR (w.state='claimed' AND w.lease_expires_at<=?) OR
        (CASE WHEN json_valid(w.claimed_by) THEN json_extract(w.claimed_by,'$.credential') ELSE w.claimed_by END=?))
      ORDER BY w.id LIMIT ?`).all(project, after, now, credential, limit).map((row) => rebuildWork(row, now));
  }

  claim(work, project, id, input, actor, leaseHash, expires) {
    return this.writeWithReceipt(work, input, () => {
      const row = this.workRecord(project, id);
      if (!row) return { conflict: "not_found" };
      if (row.row_revision !== input.expected_revision ||
          !(row.state === "queued" || (row.state === "claimed" && row.lease_expires_at <= work.now))) return { conflict: "state_conflict" };
      const claimed = JSON.stringify({ credential: actor, label: input.session_label });
      this.connection.prepare(`UPDATE agent_work SET state='claimed',claimed_by=?,lease_token_hash=?,lease_expires_at=?,row_revision=row_revision+1
        WHERE project_id=? AND id=?`).run(claimed, leaseHash, expires, project, id);
      return { projectId: project, status: 200, body: rebuildWork(this.workRecord(project, id), work.now),
        journal: { event: { kind: "claim", target_id: id, content_version: row.content_version }, lease_hash: leaseHash } };
    });
  }

  changeLease(write, project, id, input, actor, expires, messageId = null) {
    return this.writeWithReceipt(write, input, () => {
      const row = this.workRecord(project, id);
      const failure = checkRebuildLease(row, actor, input.lease_hash, write.now);
      if (failure) return { conflict: failure };
      if (row.row_revision !== input.expected_revision || (input.content_version && input.content_version !== row.content_version)) {
        return { conflict: "stale_version" };
      }
      const event = { kind: "claim", target_id: id, content_version: row.content_version };
      if (messageId) {
        const message = this.insertRebuildMessage(project, row.discussion_id, messageId, "agent", actor, input.body, write.now, row.question_id);
        this.connection.prepare(`UPDATE agent_work SET state='answered',lease_token_hash=NULL,lease_expires_at=NULL,
          reply_message_id=?,row_revision=row_revision+1 WHERE project_id=? AND id=?`).run(messageId, project, id);
        this.connection.prepare("UPDATE discussions SET row_revision=row_revision+1 WHERE project_id=? AND id=?").run(project, row.discussion_id);
        return { projectId: project, status: 201, body: message,
          journal: { event: { ...event, kind: "discussion", target_id: row.discussion_id } } };
      }
      if (expires) this.connection.prepare("UPDATE agent_work SET lease_expires_at=?,row_revision=row_revision+1 WHERE project_id=? AND id=?")
        .run(expires, project, id);
      else this.connection.prepare(`UPDATE agent_work SET state='queued',claimed_by=NULL,lease_token_hash=NULL,lease_expires_at=NULL,
        row_revision=row_revision+1 WHERE project_id=? AND id=?`).run(project, id);
      return { projectId: project, status: 200, body: rebuildWork(this.workRecord(project, id), write.now), journal: { event } };
    });
  }

  proposalRecord(project, id) {
    return this.connection.prepare(`SELECT ${PROPOSAL_COLUMNS},a.part,a.stage,a.publication_id AS original_publication_id
      FROM proposals p JOIN discussions d ON d.project_id=p.project_id AND d.id=p.discussion_id
      JOIN stage_artifacts a ON a.project_id=d.project_id AND a.id=d.origin_artifact_id
      LEFT JOIN stage_artifacts r ON r.project_id=p.project_id AND r.publication_id=p.reflected_publication_id AND r.part=a.part AND r.stage=a.stage
      WHERE p.project_id=? AND p.id=?`).get(project, id) ?? null;
  }

  proposeChange(write, project, discussion, input, actor, proposal) {
    return this.writeWithReceipt(write, input, () => {
      const row = this.workRecord(project, input.work_id);
      if (!row || row.discussion_id !== discussion) return { conflict: "not_found" };
      const failure = checkRebuildLease(row, actor, input.lease_hash, write.now);
      if (failure) return { conflict: failure };
      if (row.content_version !== input.content_version) return { conflict: "stale_version" };
      this.connection.prepare(`INSERT INTO proposals(id,project_id,discussion_id,work_id,body,state,created_at) VALUES(?,?,?,?,?,'proposed',?)`)
        .run(proposal, project, discussion, input.work_id, input.body, write.now);
      this.connection.prepare("UPDATE discussions SET row_revision=row_revision+1 WHERE project_id=? AND id=?").run(project, discussion);
      return { projectId: project, status: 201, body: rebuildProposal(this.proposalRecord(project, proposal)),
        journal: { event: { kind: "discussion", target_id: discussion, content_version: row.content_version } } };
    });
  }

  decideProposal(write, project, proposal, input) {
    return this.writeWithReceipt(write, input, () => {
      const row = this.proposalRecord(project, proposal);
      if (!row) return { conflict: "not_found" };
      if (row.row_revision !== input.expected_revision) return { conflict: "stale_version" };
      if (row.state !== "proposed" || !row.work_id) return { conflict: "state_conflict" };
      this.connection.prepare("UPDATE proposals SET state=?,row_revision=row_revision+1 WHERE project_id=? AND id=?")
        .run(input.decision === "accept" ? "accepted" : "rejected", project, proposal);
      this.connection.prepare("UPDATE discussions SET row_revision=row_revision+1 WHERE project_id=? AND id=?").run(project, row.discussion_id);
      return { projectId: project, status: 200, body: rebuildProposal(this.proposalRecord(project, proposal)),
        journal: { event: { kind: "discussion", target_id: row.discussion_id, content_version: row.content_version } } };
    });
  }

  reflectProposal(write, project, proposal, input, actor) {
    return this.writeWithReceipt(write, input, () => {
      const row = this.proposalRecord(project, proposal);
      const work = row?.work_id && this.workRecord(project, row.work_id);
      if (!row || !work || claimant(work.claimed_by)?.credential !== actor) return { conflict: "not_found" };
      if (row.row_revision !== input.expected_revision) return { conflict: "stale_version" };
      if (!["accepted", "in_review"].includes(row.state)) return { conflict: "state_conflict" };
      const reflected = this.artifact(project, row.part, row.stage, { publication: input.publication_id, version: null });
      const origin = this.artifact(project, row.part, row.stage, { publication: row.original_publication_id, version: null });
      if (!reflected || !origin) return { conflict: "not_found" };
      if (reflected.commit_sha !== input.source_commit || reflected.publication_revision <= origin.publication_revision ||
          reflected.content_version === origin.content_version || ["missing", "unsupported"].includes(reflected.representation)) return { conflict: "stale_version" };
      this.connection.prepare(`UPDATE proposals SET state='reflected',source_commit=?,reflected_publication_id=?,row_revision=row_revision+1
        WHERE project_id=? AND id=?`).run(input.source_commit, input.publication_id, project, proposal);
      this.connection.prepare("UPDATE discussions SET row_revision=row_revision+1 WHERE project_id=? AND id=?").run(project, row.discussion_id);
      return { projectId: project, status: 200, body: rebuildProposal(this.proposalRecord(project, proposal)),
        journal: { event: { kind: "discussion", target_id: row.discussion_id, content_version: reflected.content_version } } };
    });
  }

  checkpointRecord(project, id) {
    return this.connection.prepare(`SELECT c.id,c.state,c.content_version,c.row_revision AS revision,a.part,a.stage,a.publication_id
      FROM checkpoint_requests c JOIN stage_artifacts a ON a.project_id=c.project_id AND a.id=c.artifact_id
      WHERE c.project_id=? AND c.id=?`).get(project, id) ?? null;
  }

  checkpointHistory(project, id) {
    return this.connection.prepare(`SELECT id,decision,content_version,decided_at,coalesce(json_extract(legacy_actor_json,'$.label'),actor_owner_id) AS decided_by,reason
      FROM checkpoint_decisions WHERE project_id=? AND request_id=? ORDER BY sequence DESC LIMIT 100`).all(project, id).reverse();
  }

  requestCheckpoint(write, project, input, id, blockers) {
    return this.writeWithReceipt(write, input, () => {
      const held = this.artifact(project, input.part, input.stage, { publication: null, version: null });
      if (!held || ["missing", "unsupported"].includes(held.representation)) return { conflict: "not_found" };
      if (input.publication_id !== held.publication_id || input.content_version !== held.content_version) return { conflict: "stale_version" };
      const existing = this.artifactCheckpoints(project, input.part, input.stage, held.content_version)
        .find((row) => row.content_version === held.content_version && row.state !== "superseded");
      if (existing) return { conflict: "state_conflict" };
      this.connection.prepare(`INSERT INTO checkpoint_requests(id,project_id,artifact_id,content_version,state,requested_at) VALUES(?,?,?,?,'pending',?)`)
        .run(id, project, held.id, held.content_version, write.now);
      return { projectId: project, status: 201, body: { ...this.checkpointRecord(project, id), blockers: blockers(input.part, input.stage), history: [] },
        journal: { event: { kind: "checkpoint", target_id: id, content_version: held.content_version } } };
    });
  }

  decideRebuildCheckpoint(write, project, checkpoint, input, decision, blockers, withdraw) {
    return this.writeWithReceipt(write, input, () => {
      const row = this.checkpointRecord(project, checkpoint);
      if (!row) return { conflict: "not_found" };
      if (row.revision !== input.expected_revision || row.content_version !== input.content_version) return { conflict: "stale_version" };
      const held = this.artifact(project, row.part, row.stage, { publication: null, version: null });
      if (row.content_version !== held?.content_version) return { conflict: "stale_version" };
      const prior = this.connection.prepare("SELECT id,decision FROM checkpoint_decisions WHERE project_id=? AND request_id=? ORDER BY sequence DESC LIMIT 1")
        .get(project, checkpoint);
      let action, state;
      if (withdraw) {
        if (!prior || prior.id !== input.prior_decision_id) return { conflict: "stale_version" };
        if (!["passed", "changes_requested"].includes(row.state)) return { conflict: "state_conflict" };
        action = "withdraw";
        state = "withdrawn";
      } else {
        if (!["pending", "withdrawn"].includes(row.state) || blockers(row.part, row.stage).length) return { conflict: "state_conflict" };
        action = input.decision;
        state = action === "pass" ? "passed" : "changes_requested";
      }
      this.connection.prepare(`INSERT INTO checkpoint_decisions(id,project_id,request_id,sequence,actor_owner_id,decision,prior_decision_id,
        content_version,reason,decided_at) VALUES(?,?,?,(SELECT coalesce(max(sequence),0)+1 FROM checkpoint_decisions
          WHERE project_id=? AND request_id=?),?,?,?,?,?,?)`).run(decision, project, checkpoint, project, checkpoint, write.owner,
        action, withdraw ? prior.id : null, row.content_version, input.reason || null, write.now);
      this.connection.prepare("UPDATE checkpoint_requests SET state=?,row_revision=row_revision+1 WHERE project_id=? AND id=?")
        .run(state, project, checkpoint);
      return { projectId: project, status: 201, body: { id: decision, state, content_version: row.content_version, revision: row.revision + 1 },
        journal: { event: { kind: "checkpoint", target_id: checkpoint, content_version: row.content_version } } };
    });
  }

  verifiedOwner(id) {
    return this.connection.prepare("SELECT id FROM owners WHERE id=?").get(id)?.id ?? null;
  }

  importLegacy(plan) {
    return this.transaction(() => {
      const { id, digest, archive, counts, boundary, at, rows, mappings, report } = plan;
      const prior = this.connection.prepare("SELECT state,baseline_digest,reconciliation_json FROM migration_runs WHERE id=?").get(id);
      if (prior) {
        if (prior.baseline_digest !== digest) throw new Error("The migration ID belongs to another baseline");
        return { replay: true, ...JSON.parse(prior.reconciliation_json) };
      }
      this.connection.prepare(`INSERT INTO migration_runs(id,state,protected_manifest_ref,baseline_digest,counts_json,accepted_write_boundary,
        reconciliation_json,created_at) VALUES(?,'restored',?,?,?,?,?,?)`).run(id, archive, digest, JSON.stringify(counts), boundary, JSON.stringify(report), at);
      const tables = ["projects", "publications", "stage_artifacts", "artifact_items", "discussions", "messages",
        "discussion_decisions", "checkpoint_requests", "checkpoint_decisions"];
      for (const name of tables) {
        // All fields are constructed by the legacy mapper. Validate columns
        // against the dedicated target schema before constructing a statement.
        const columns = new Set(this.connection.prepare(SQLITE.columns(name)).all().map((column) => column.name));
        for (const row of rows[name]) {
          const keys = Object.keys(row);
          if (keys.some((key) => !columns.has(key))) throw new Error("Unexpected migration column");
          this.connection.prepare(`INSERT INTO "${name}" (${keys.map((key) => `"${key}"`).join(",")})
            VALUES (${keys.map(() => "?").join(",")})`).run(...Object.values(row));
        }
      }
      const link = this.connection.prepare(`INSERT INTO legacy_mappings(migration_run_id,legacy_project,record_kind,legacy_id,target_project_id,target_id,original_digest)
        VALUES(?,?,?,?,?,?,?)`);
      for (const mapping of mappings) link.run(id, mapping.project, mapping.kind, mapping.legacy, mapping.targetProject, mapping.target, mapping.digest);
      if (this.connection.prepare(SQLITE.foreignKeys).get()) throw new Error("Legacy migration contains broken references");
      const mapped = this.connection.prepare("SELECT count(*) AS n FROM legacy_mappings WHERE migration_run_id=?").get(id).n;
      if (mapped !== mappings.length) throw new Error("Legacy migration count differs");
      return { replay: false, ...report };
    });
  }

  journalBoundary() {
    return this.connection.prepare("SELECT coalesce(max(sequence),0) AS boundary FROM write_journal").get().boundary;
  }

  recoveryRows(after) {
    return this.connection.prepare(`SELECT sequence,project_id,operation,receipt_id,protected_payload_json,result_digest,acknowledged_at
      FROM write_journal WHERE sequence>? ORDER BY sequence`).iterate(after);
  }

  restoreJournal(rows, after, through, digest, abortConflict) {
    return this.transaction(() => {
      if (this.journalBoundary() !== after) throw new Error("The target does not match the expected write boundary");
      this.connection.exec("PRAGMA defer_foreign_keys=ON");
      let boundary = after, applied = 0;
      const identities = this.connection.prepare("INSERT INTO owners(id,issuer,subject,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING");
      const findOwner = this.connection.prepare("SELECT id,issuer,subject,created_at FROM owners WHERE id=?");
      const insert = this.connection.prepare(`INSERT INTO write_journal(sequence,project_id,operation,receipt_id,protected_payload_json,
        result_digest,acknowledged_at) VALUES(?,?,?,?,?,?,?)`);
      const receipt = this.connection.prepare("SELECT project_id,operation,safe_result_json FROM idempotency_receipts WHERE id=?");
      for (const row of rows) {
        const box = JSON.parse(row.protected_payload_json);
        if (row.sequence !== boundary + 1 || row.sequence > through || !box.identity || !box.changeset) throw new Error("Journal continuity failure");
        const { id, issuer, subject, created_at: date } = box.identity;
        identities.run(id, issuer, subject, date);
        const found = findOwner.get(id);
        if (found.issuer !== issuer || found.subject !== subject || found.created_at !== date) throw new Error("Journal owner differs");
        const changes = Buffer.from(box.changeset, "base64");
        if (digest(changes) !== box.changeset_sha256 ||
            !this.connection.applyChangeset(changes, { onConflict: abortConflict })) throw new Error("Journal transaction could not be applied");
        const acknowledged = receipt.get(row.receipt_id);
        if (acknowledged?.project_id !== row.project_id || acknowledged.operation !== row.operation ||
            digest(acknowledged.safe_result_json) !== row.result_digest) throw new Error("Acknowledged write result differs");
        insert.run(row.sequence, row.project_id, row.operation, row.receipt_id, row.protected_payload_json, row.result_digest, row.acknowledged_at);
        boundary = row.sequence;
        applied += 1;
      }
      if (boundary !== through || this.connection.prepare(SQLITE.foreignKeys).get()) throw new Error("Journal replay is incomplete");
      return { after, through, applied };
    });
  }

  projectEvents(project, after, limit, publisher) {
    return this.connection.prepare(`SELECT sequence,
      CASE WHEN operation='publishSnapshot' THEN json_object('kind','publication','target_id',json_extract(protected_payload_json,'$.result.id'),
        'content_version',json_extract(protected_payload_json,'$.result.snapshot_digest'))
        ELSE json_extract(protected_payload_json,'$.event') END AS payload
      FROM write_journal WHERE project_id=? AND sequence>? AND (operation='publishSnapshot' OR (?=0 AND json_type(protected_payload_json,'$.event')='object'))
      ORDER BY sequence LIMIT ?`).all(project, after, Number(publisher), limit).map(({ sequence, payload }) => ({ sequence, ...JSON.parse(payload) }));
  }

  createSample(write, input, id, slug, verified, snapshot) {
    return this.writeWithReceipt(write, input, () => {
      this.connection.prepare("INSERT INTO projects(id,owner_id,slug,title,synthetic,created_at) VALUES(?,?,?,?,1,?)")
        .run(id, write.owner, slug, input.title, write.now);
      const row = this.projectState(write.owner, id);
      this.insertPublication(row, verified, snapshot, write.now);
      return { projectId: id, status: 201, body: this.project(write.owner, id),
        journal: { snapshot, parser_version: verified.parser } };
    });
  }

  connectProject({ id, input, ...write }) {
    const { owner, now } = write;
    return this.writeWithReceipt({ ...write, scope: "owner", operation: "connectProject" }, input, () => {
      if (this.connection.prepare("SELECT 1 FROM projects WHERE owner_id=? AND slug=?").get(owner, input.slug)) return { conflict: "state_conflict" };
      this.connection.prepare(`INSERT INTO projects(id,owner_id,slug,title,repository_url,default_branch,created_at) VALUES(?,?,?,?,?,?,?)`)
        .run(id, owner, input.slug, input.title, input.repository_url, input.default_branch, now);
      return { projectId: id, body: this.project(owner, id), status: 201 };
    });
  }
}

export class Store {
  constructor(db) {
    this.db = db;
  }

  // Each version is one D1 transaction with its version marker. Separate
  // Worker isolates may race: a loser rereads the committed versions rather
  // than attempting to continue after a partially applied migration.
  async migrate() {
    await this.db.prepare(MIGRATION_TABLE).run();
    const versions = async () => {
      const { results } = await this.db.prepare("SELECT version FROM migrations").all();
      return new Set((results || []).map((row) => row.version));
    };
    let applied = await versions();
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      const statements = migration.statements.map((sql) => this.db.prepare(sql));
      statements.push(this.db.prepare("INSERT INTO migrations (version, applied_at) VALUES (?, ?)")
        .bind(migration.version, new Date().toISOString()));
      try {
        await this.db.batch(statements);
      } catch (error) {
        // A failure is recoverable only if another isolate committed this
        // exact version. Other failures remain failures and are retryable.
        applied = await versions();
        if (!applied.has(migration.version)) throw error;
      }
    }
  }

  // Share startup work within an isolate, but never cache a rejected attempt.
  async ensure() {
    let pending = ready.get(this.db);
    if (!pending) {
      pending = this.migrate();
      ready.set(this.db, pending);
      pending.catch(() => ready.delete(this.db));
    }
    await pending;
  }

  async meta(name) {
    await this.ensure();
    return this.db
      .prepare("SELECT name, revision, generated_at, received_at, bytes FROM snapshots WHERE name = ?")
      .bind(name)
      .first();
  }

  async list() {
    await this.ensure();
    const { results } = await this.db
      .prepare("SELECT name, revision, generated_at, received_at, bytes FROM snapshots ORDER BY name")
      .all();
    return results || [];
  }

  async bodies() {
    await this.ensure();
    const { results } = await this.db.prepare("SELECT body FROM snapshots ORDER BY name").all();
    return (results || []).map((row) => row.body);
  }

  async body(name) {
    await this.ensure();
    return this.db.prepare("SELECT body FROM snapshots WHERE name = ?").bind(name).first("body");
  }

  // Returns the new revision, or null when nothing was stored: the stored
  // snapshot is newer, or the name is new and the hub holds `limit` projects.
  async put(name, generatedMs, generatedAt, receivedAt, body, bytes, limit) {
    await this.ensure();
    const row = await this.db
      .prepare(PUT)
      .bind(name, generatedMs, generatedAt, receivedAt, bytes, body, name, limit)
      .first();
    return row ? row.revision : null;
  }

  async remove(name) {
    await this.ensure();
    const result = await this.db.prepare("DELETE FROM snapshots WHERE name = ?").bind(name).run();
    return Boolean(result && result.meta && result.meta.changes);
  }
  async pushState(name) {
    await this.ensure();
    const read = (sql) => this.db.prepare(sql).bind(name);
    const rows = await this.db.batch([
      read("SELECT name, revision, generated_ms, generated_at, default_commit, push_id FROM snapshots WHERE name = ?"),
      read("SELECT * FROM project_spaces WHERE project = ?"),
      read("SELECT part, stage, commit_id, committed_at, digest, drawn_at, not_current FROM pictures WHERE project = ?"),
      read("SELECT * FROM discrepancies WHERE project = ? AND state = 'open'"),
      read("SELECT * FROM checkpoints WHERE project = ?"),
      this.db.prepare("SELECT COUNT(*) AS projects FROM snapshots"),
      read(CHECKPOINT_BASIS),
    ]);
    return {
      held: rows[0].results[0] || null, space: rows[1].results[0] || null,
      pictures: rows[2].results, discrepancies: rows[3].results, checkpoints: rows[4].results,
      projectCount: rows[5].results[0].projects,
      checkpointBasis: Object.values(rows[6].results[0])[0],
    };
  }

  async push(sent, given = undefined, retry = 0) {
    const state = await this.pushState(sent.name);
    checkCommit(sent, state.held);
    if (!state.held && state.projectCount >= 30) throw new Problem("too_many_projects", "remove a stored project before adding another", { limit: 30 });
    const phase2 = sent.data?.schema === "corthex-hub/0.2";
    const plan = phase2 ? await planPush(sent, state, given ?? new Date().toISOString()) : null;
    // The push's time is taken in its batch's turn, as a write's is (writeEntry),
    // so that a discrepancy that it opens after the agent's read counts as not
    // yet read; the pictures that it draws take the same time.
    const now = given ?? new Date().toISOString();
    const token = crypto.randomUUID();
    const held = state.held;
    const revision = (held?.revision || 0) + 1;
    const bytes = new TextEncoder().encode(sent.body).byteLength;
    const gate = "EXISTS (SELECT 1 FROM snapshots WHERE name = ? AND push_id = ?)";
    const gated = (sql, ...params) => this.db.prepare(sql).bind(...params, sent.name, token);
    const first = this.db.prepare(`INSERT INTO snapshots
      (name, revision, generated_ms, generated_at, received_at, bytes, body, default_commit, push_id)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE ((? IS NULL AND NOT EXISTS (SELECT 1 FROM snapshots WHERE name = ?) AND (SELECT COUNT(*) FROM snapshots) < 30)
         OR EXISTS (SELECT 1 FROM snapshots WHERE name = ? AND revision = ? AND default_commit IS NOT DISTINCT FROM ? AND push_id IS NOT DISTINCT FROM ?))
        AND (${CHECKPOINT_BASIS})=?
      ON CONFLICT (name) DO UPDATE SET
        revision = excluded.revision, generated_ms = excluded.generated_ms, generated_at = excluded.generated_at,
        received_at = excluded.received_at, bytes = excluded.bytes, body = excluded.body,
        default_commit = excluded.default_commit, push_id = excluded.push_id
      WHERE snapshots.revision = ? AND snapshots.default_commit IS NOT DISTINCT FROM ? AND snapshots.push_id IS NOT DISTINCT FROM ?
        AND (${CHECKPOINT_BASIS})=?
      RETURNING revision`).bind(sent.name, revision, sent.generatedMs, sent.generatedAt, now, bytes, sent.body,
        sent.defaultCommit || null, token, held?.revision || null, sent.name, sent.name, held?.revision || null,
        held?.default_commit || null, held?.push_id || null, sent.name, state.checkpointBasis,
        held?.revision || null, held?.default_commit || null, held?.push_id || null, sent.name, state.checkpointBasis);
    const statements = [first];
    if (plan) {
      statements.push(gated(`INSERT INTO project_spaces (project, repo_url, created_at)
        SELECT ?, ?, ? WHERE ${gate}
        ON CONFLICT (project) DO UPDATE SET repo_url = excluded.repo_url
        WHERE project_spaces.repo_url IS NULL AND excluded.repo_url IS NOT NULL`, sent.name, plan.repository, now));
      const drawn = plan.pictures.filter((row) => row.source !== undefined).map((row) => ({ ...row, commit_id: row.commit, committed_at: row.time, drawn_at: now }));
      const marks = plan.pictures.filter((row) => row.source === undefined);
      statements.push(gated(`INSERT INTO pictures (project, part, stage, commit_id, committed_at, source, digest, drawn_at, not_current)
        SELECT ?, json_extract(value,'$.part'), json_extract(value,'$.stage'), json_extract(value,'$.commit_id'),
          json_extract(value,'$.committed_at'), json_extract(value,'$.source'), json_extract(value,'$.digest'),
          json_extract(value,'$.drawn_at'), NULL FROM json_each(?) WHERE ${gate}
        ON CONFLICT (project, part, stage) DO UPDATE SET commit_id=excluded.commit_id, committed_at=excluded.committed_at,
          source=excluded.source, digest=excluded.digest, drawn_at=excluded.drawn_at, not_current=NULL`, sent.name, JSON.stringify(drawn)));
      statements.push(gated(`UPDATE pictures AS p SET not_current=json_extract(j.value,'$.not_current')
        FROM json_each(?) AS j WHERE p.project=? AND p.part=json_extract(j.value,'$.part') AND p.stage=json_extract(j.value,'$.stage')
        AND p.not_current IS DISTINCT FROM json_extract(j.value,'$.not_current') AND ${gate}`, JSON.stringify(marks), sent.name));
      statements.push(gated(`UPDATE discrepancies SET state='resolved', waiting=0, resolved_commit=?, resolved_at=?
        WHERE project=? AND id IN (SELECT value FROM json_each(?)) AND ${gate}`, sent.defaultCommit, now, sent.name, JSON.stringify(plan.discrepancies.resolve)));
      const updates = plan.discrepancies.updates.map((row) => ({ ...row, reasons: JSON.stringify(row.reasons) }));
      statements.push(gated(`UPDATE discrepancies AS d SET reasons=json_extract(j.value,'$.reasons'), level=json_extract(j.value,'$.level'), waiting=json_extract(j.value,'$.waiting')
        FROM json_each(?) AS j WHERE d.project=? AND d.id=json_extract(j.value,'$.id') AND ${gate}`, JSON.stringify(updates), sent.name));
      const opened = plan.discrepancies.open.map((row) => ({ ...row, reasons: JSON.stringify(row.reasons) }));
      statements.push(gated(`INSERT INTO discrepancies (id, project, part, compares, term, item, reasons, level, state, waiting, opened_commit, opened_at, earlier)
        SELECT json_extract(j.value,'$.id'), ?, json_extract(j.value,'$.part'), json_extract(j.value,'$.compares'),
          json_extract(j.value,'$.term'), json_extract(j.value,'$.item'), json_extract(j.value,'$.reasons'), json_extract(j.value,'$.level'), 'open', 0, ?, ?,
          (SELECT d.id FROM discrepancies AS d WHERE d.project=? AND d.part=json_extract(j.value,'$.part')
            AND d.compares=json_extract(j.value,'$.compares') AND d.term=json_extract(j.value,'$.term') AND d.item=json_extract(j.value,'$.item')
            AND d.state='resolved' ORDER BY d.resolved_at DESC, d.id LIMIT 1)
        FROM json_each(?) AS j WHERE ${gate}`, sent.name, sent.defaultCommit, now, sent.name, JSON.stringify(opened)));
      statements.push(gated(`UPDATE checkpoints AS c SET recorded_commit=json_extract(j.value,'$.recorded_commit')
        FROM json_each(?) AS j WHERE c.project=? AND c.id=json_extract(j.value,'$.id') AND c.recorded_commit IS DISTINCT FROM json_extract(j.value,'$.recorded_commit') AND ${gate}`,
        JSON.stringify(plan.checkpoints), sent.name));
      const ended = [...plan.discrepancies.resolve, ...plan.checkpoints.filter((row) => row.recorded_commit).map((row) => row.id)];
      statements.push(gated(`DELETE FROM claims WHERE project=? AND entry IN (SELECT value FROM json_each(?)) AND ${gate}`, sent.name, JSON.stringify(ended)));
      const unopened = JSON.stringify(plan.unopened);
      statements.push(gated(`UPDATE project_spaces SET unopened=? WHERE project=? AND unopened<>? AND ${gate}`, unopened, sent.name, unopened));
      statements.push(this.db.prepare(`SELECT
        (SELECT COUNT(*) FROM comments WHERE project=? AND state='open' AND waits='agent') AS comments,
        (SELECT COUNT(*) FROM discrepancies WHERE project=? AND state='open') AS discrepancies,
        (SELECT COUNT(*) FROM edits WHERE project=? AND state NOT IN ('closed','dismissed')) AS reflections,
        (SELECT COUNT(*) FROM checkpoints WHERE project=? AND
          ((state='passed' AND recorded_commit IS NULL) OR (state='withdrawn' AND (pr_state='open' OR recorded_commit IS NOT NULL)))) AS checkpoints`).bind(sent.name, sent.name, sent.name, sent.name));
    }
    const results = await this.db.batch(statements);
    if (!results[0].results.length) {
      const latest = await this.pushState(sent.name);
      // A checkpoint may be withdrawn after planning but before this batch.
      // Replan against it when no other snapshot overtook the push. Never
      // acknowledge the old checkpoint state or hide its withdrawal warning.
      if (retry < 1 && latest.held?.push_id === held?.push_id && latest.held?.revision === held?.revision && latest.checkpointBasis !== state.checkpointBasis) return this.push(sent,given,retry+1);
      if (!latest.held && latest.projectCount >= 30) throw new Problem("too_many_projects", "remove a stored project before adding another", { limit: 30 });
      if (latest.held?.default_commit) throw new Problem("commit_not_replaced", "another push stored first; fetch the held commit and push again", { held_commit: latest.held.default_commit });
      if (latest.held) throw new Problem("older_snapshot", "another push stored first; build a fresh snapshot and push again", { stored_at: latest.held.generated_at });
      throw new Problem("internal", "the project changed during this push; try again");
    }
    return plan ? { ...plan.answer, todo: results[results.length - 1].results[0] } : { name: sent.name, revision };
  }

  async readContext(project, needsSpace = false) {
    await this.ensure();
    const [snapshots, spaces] = await this.db.batch([
      this.db.prepare("SELECT * FROM snapshots WHERE name=?").bind(project),
      this.db.prepare("SELECT * FROM project_spaces WHERE project=?").bind(project),
    ]);
    const held = snapshots.results[0];
    if (!held) throw new Problem("project_not_found", "no such project");
    const space = spaces.results[0] || null;
    if (needsSpace && !space) throw new Problem("space_not_found", "this project has no space; push a 0.2 snapshot first");
    return { held, snapshot: JSON.parse(held.body), space };
  }

  validPart(snapshot, part) {
    if (part && (!Array.isArray(snapshot.project.parts) || !snapshot.project.parts.includes(part))) throw new Problem("part_not_found", "no such part");
  }

  // A list's comments, each with whether the agent has not read it (SPEC-189)
  // as of now, the time of the read.
  commentStatement(project, mode, part, stage, limit, item = null, now = new Date().toISOString()) {
    let where = "c.project=?";
    const params = [project];
    if (part !== undefined) { where += " AND c.part=?"; params.push(part); }
    if (stage !== undefined) { where += " AND c.stage=?"; params.push(stage); }
    if (item !== null) { where += " AND c.item=?"; params.push(item); }
    where += mode === "todo" ? " AND c.state='open' AND c.waits='agent'" : " AND c.state='open'";
    return this.db.prepare(`SELECT c.*, COUNT(*) OVER() AS _total, ${COMMENT_EXTRAS},
      (c.state='open' AND c.waits='agent' AND ${notRead("c", "c.last_at")}) AS unread
      FROM comments AS c LEFT JOIN project_spaces AS ps ON ps.project=c.project
      WHERE ${where} ORDER BY c.last_at ${mode === "todo" ? "ASC" : "DESC"}, c.id LIMIT ?`).bind(now, ...params, limit);
  }

  proposalStatement(project, part, stage) {
    let where = "p.project=? AND p.state='open'";
    const params = [project];
    if (part !== undefined) { where += " AND p.part=?"; params.push(part); }
    if (stage !== undefined) { where += " AND p.stage=?"; params.push(stage); }
    return this.db.prepare(`SELECT p.*,e.id AS edit FROM proposals AS p LEFT JOIN edits AS e ON e.proposal=p.id
      WHERE ${where} ORDER BY p.made_at,p.id LIMIT 500`).bind(...params);
  }

  // A list's reflections, each with whether the agent has not read it, which
  // only a pending one can be (SPEC-189), as of now.
  editStatement(project, mode, part, stage, limit, now = new Date().toISOString()) {
    let where = "e.project=? AND e.state NOT IN ('closed','dismissed')";
    const params = [project];
    if (part !== undefined) { where += " AND e.part=?"; params.push(part); }
    if (stage !== undefined) { where += " AND e.stage=?"; params.push(stage); }
    return this.db.prepare(`SELECT e.*,COUNT(*) OVER() AS _total,
      json_object('id',p.id,'part',p.part,'stage',p.stage,'commit_id',p.commit_id,'items',p.items,'reason',p.reason,
       'change',p.change,'source_text',p.source_text,'comment',p.comment,'discrepancy',p.discrepancy,'state',p.state,
       'made_at',p.made_at,'closed_at',p.closed_at,'edit',e.id) AS proposal_json,
      (e.state='pending' AND ${notRead("e", "e.made_at")}) AS unread
      FROM edits AS e LEFT JOIN proposals AS p ON e.proposal=p.id LEFT JOIN project_spaces AS ps ON ps.project=e.project WHERE ${where}
      ORDER BY ${mode === "todo" ? "CASE WHEN e.pull_request IS NULL THEN 0 ELSE 1 END," : ""} e.made_at,e.id LIMIT ?`).bind(now, ...params, limit);
  }

  discrepancyStatement(project, part, stage, limit) {
    let where = "project=? AND state='open'";
    const params = [project];
    if (part !== undefined) { where += " AND part=?"; params.push(part); }
    if (stage === "05-erd") where += " AND compares='aggregate-table'";
    else if (stage === "07-sitemap") where += " AND compares='read-model-screen'";
    else if (stage && stage !== "01-domain") where += " AND 0";
    return this.db.prepare(`SELECT *,COUNT(*) OVER() AS _total FROM discrepancies WHERE ${where}
      ORDER BY CASE WHEN level='warn' THEN 0 ELSE 1 END, opened_at,id LIMIT ?`).bind(...params, limit);
  }

  async heldCommit(project) {
    const { held } = await this.readContext(project);
    return { project, revision: held.revision, default_commit: held.default_commit,
      generated_at: held.generated_at, received_at: held.received_at };
  }

  async readPicture(project, part, stage, now = new Date().toISOString()) {
    const { snapshot } = await this.readContext(project, true);
    this.validPart(snapshot, part);
    return this.picture(snapshot, project, part, stage, now);
  }

  async picture(snapshot, project, part, stage, now = new Date().toISOString()) {
    const rows = await this.db.batch([
      this.db.prepare("SELECT * FROM pictures WHERE project=? AND part=? AND stage=?").bind(project, part, stage),
      this.commentStatement(project, "picture", part, stage, 500, null, now),
      this.db.prepare("SELECT id,item,closed_as,last_at,COUNT(*) OVER() AS _total FROM comments WHERE project=? AND part=? AND stage=? AND state='closed' ORDER BY last_at DESC,id LIMIT 500").bind(project, part, stage),
      this.proposalStatement(project, part, stage), this.editStatement(project, "picture", part, stage, 500, now),
      this.discrepancyStatement(project, part, stage, 1000),
    ]);
    const picture = rows[0].results[0];
    if (!picture) {
      const omitted=(snapshot.left_out||[]).find((row)=>row.part===part&&row.stage===stage);
      throw new Problem("picture_not_found", "this part and stage have no picture yet", {why:omitted?.why||"not-drawn"});
    }
    const comments = rows[1].results, closed = rows[2].results;
    return { project, part, stage,
      picture: { commit: picture.commit_id, committed_at: picture.committed_at, drawn_at: picture.drawn_at, not_current: picture.not_current, source: JSON.parse(picture.source) },
      comments: { total: comments[0]?._total || 0, entries: comments.map((row) => E.commentListRow(row)) },
      closed_comments: { total: closed[0]?._total || 0, entries: closed.map(({ id,item,closed_as,last_at }) => ({ id,item,closed_as,last_at })) },
      proposals: rows[3].results.map((row) => E.proposal(row)), reflections: rows[4].results.map((row) => E.editListEntry(row)),
      discrepancies: rows[5].results.map((row) => E.discrepancy(row)),
    };
  }

  async readOverview(project, part, stage, now = new Date().toISOString()) {
    const context = await this.readContext(project);
    this.validPart(context.snapshot, part);
    return this.overview(context, project, part, stage, await this.db.batch(this.overviewStatements(project, part, stage, now)));
  }

  overviewStatements(project, part, stage, now = new Date().toISOString()) {
    return [
      this.commentStatement(project,"overview",part,stage,50,null,now), this.editStatement(project,"overview",part,stage,50,now),
      this.discrepancyStatement(project,part,stage,50),
      // The checkpoints passed in NEXUS that wait for their records and the withdrawn ones that a
      // stored record names, oldest first; then, from TASK-299, those that a stored record names,
      // newest first, so that the record shows each one's kind of browser and device beside its
      // entry (SPEC-195). The 50 keep the first two kinds first.
      this.db.prepare(`SELECT * FROM checkpoints WHERE project=? AND part=? AND stage=?
        AND (state='passed' OR (state='withdrawn' AND recorded_commit IS NOT NULL))
        ORDER BY state='passed' AND recorded_commit IS NOT NULL,
          CASE WHEN state='passed' AND recorded_commit IS NOT NULL THEN passed_at END DESC, passed_at, id
        LIMIT 50`).bind(project,part,stage),
      this.db.prepare("SELECT stage,commit_id,not_current FROM pictures WHERE project=? AND part=? ORDER BY stage").bind(project,part),
    ];
  }

  overview({ snapshot, space }, project, part, stage, [comments, edits, discrepancies, checkpoints, pictures]) {
    const source = snapshot.stages?.[stage] || {};
    const notOpened = space ? JSON.parse(space.unopened) : {};
    const warnings = checkpoints.results.filter((row) => row.state==='withdrawn').map((row) => ({ rule:"checkpoint-withdrawn", checkpoint:row.id }));
    const checks = (snapshot.checks || []).filter((check) => check.stage===stage && (!check.part || check.part===part));
    for (const warning of warnings) checks.push({ rule:warning.rule,level:"warn",by:"server",stage,part,message:"A withdrawn checkpoint is named by the stored stage record",refs:[],args:{checkpoint:warning.checkpoint} });
    const envelope = (rows, mapper) => ({ total:rows[0]?._total || 0,entries:rows.map(mapper) });
    return { project,part,stage,record:E.stageRecord(snapshot,part,stage),
      source_state:["found","missing","none","no-checkout","skipped","invalid"].includes(source.source_state)?source.source_state:"none", read:Boolean(source.read),checks:checks.slice(0,2000),
      pictures:["01-domain","05-erd","07-sitemap"].includes(stage)?pictures.results.slice(0,3).map((row)=>({stage:row.stage,commit:row.commit_id,not_current:row.not_current})):[],
      comments:envelope(comments.results,(row)=>E.commentListRow(row)), reflections:envelope(edits.results,(row)=>E.editListEntry(row)),
      discrepancies:envelope(discrepancies.results,(row)=>E.discrepancy(row)), checkpoints:checkpoints.results.map((row)=>E.checkpoint(row)), warnings,
      not_opened:Object.hasOwn(notOpened,part)?notOpened[part]:0 };
  }

  // API-158: the overview's statements, then the part's marks: each stage's and
  // item's comments, the open proposals, the open discrepancies, the stage's
  // pending reflections and the part's pictures, with the DDD board's source
  // only on stage 01, whose head counts its open hotspots; and the space's last
  // read with the oldest time since which an entry that the agent has not read
  // waits, for the head (SPEC-188).
  async readStage(project, part, stage, query, now = new Date().toISOString()) {
    const context = await this.readContext(project);
    this.validPart(context.snapshot, part);
    return this.stage(context, project, part, stage, query, now);
  }

  async stage(context, project, part, stage, query, now = new Date().toISOString()) {
    const rows = await this.db.batch([
      ...this.overviewStatements(project, part, stage, now),
      this.db.prepare(`SELECT stage,item,COUNT(*) AS total,SUM(state='open') AS open,SUM(state='open' AND waits='user') AS mine
        FROM comments WHERE project=? AND part=? GROUP BY stage,item`).bind(project, part),
      this.db.prepare("SELECT stage,items FROM proposals WHERE project=? AND part=? AND state='open'").bind(project, part),
      this.db.prepare("SELECT term,item FROM discrepancies WHERE project=? AND part=? AND state='open'").bind(project, part),
      this.db.prepare(`SELECT p.items FROM edits AS e JOIN proposals AS p ON e.proposal=p.id
        WHERE e.project=? AND e.part=? AND e.stage=? AND e.state NOT IN ('closed','dismissed')`).bind(project, part, stage),
      this.db.prepare(`SELECT stage,commit_id,committed_at,not_current,CASE WHEN stage='01-domain' AND ?='01-domain' THEN source END AS source
        FROM pictures WHERE project=? AND part=?`).bind(stage, project, part),
      this.db.prepare(SPACE_READ).bind(now, now, now, now, project),
    ]);
    return stageData({ ...context, record: this.overview(context, project, part, stage, rows.slice(0, 5)), project, part, stage, query,
      comments: rows[5].results, proposals: rows[6].results, discrepancies: rows[7].results, reflections: rows[8].results, pictures: rows[9].results,
      read: rows[10].results[0] ? E.spaceRead(rows[10].results[0]) : null });
  }

  // API-154: what a stage's page holds (stage 06's Page data), from one read of
  // the stored snapshot: the stage as API-158 answers it in its default order,
  // the whole talk as API-152 answers it and, on a pictured stage, the picture
  // as API-111 answers it. A project without a space, pushed only by a hub of
  // 0.1, has neither talk nor picture, and a pictured stage whose picture the
  // space does not hold has no picture: the page holds why, as its problem.
  async readStagePage(project, part, stage, now = new Date().toISOString()) {
    const context = await this.readContext(project);
    this.validPart(context.snapshot, part);
    const data = await this.stage(context, project, part, stage, defaultQuery("getStage"), now);
    if (!context.space) return { data, talk: null, picture: null,
      problem: new Problem("space_not_found", "this project has no space; push a 0.2 snapshot first") };
    const talk = await this.talk(context, project, part, stage, defaultQuery("getStageTalk"), now);
    if (!["01-domain", "05-erd", "07-sitemap"].includes(stage)) return { data, talk, picture: null, problem: null };
    try {
      return { data, talk, picture: await this.picture(context.snapshot, project, part, stage, now), problem: null };
    } catch (error) {
      if (!(error instanceof Problem) || error.code !== "picture_not_found") throw error;
      return { data, talk, picture: null, problem: error };
    }
  }

  // API-153: where a project's address leads (SPEC-146), the current stage of
  // its first part as its card on the first page names it.
  async projectPlace(project) {
    return currentPlace((await this.readContext(project)).snapshot);
  }

  // API-152: the part's stage talk. One batch reads the stage's open comments,
  // which a project holds 2,000 of at most, its open proposals and pending
  // reflections, 500 of each at most, the claims that last, and the count of
  // its closed talk with, for closed=1, a page of it; stage-talk.js sorts them
  // into turns. An item narrows the comments here and the lists of items there.
  async readTalk(project, part, stage, query, now = new Date().toISOString()) {
    const context = await this.readContext(project, true);
    this.validPart(context.snapshot, part);
    return this.talk(context, project, part, stage, query, now);
  }

  async talk(context, project, part, stage, { item, closed, after }, now) {
    const keys = [project, part, stage, item, item, project, part, stage, item, item];
    const page = `WITH ${CLOSED_TALK}, page AS (SELECT kind,id,at FROM talk ORDER BY at DESC,id LIMIT ${CLOSED} OFFSET ?)`;
    const rows = await this.db.batch([
      this.commentStatement(project, "talk", part, stage, 2000, item, now),
      this.proposalStatement(project, part, stage), this.editStatement(project, "talk", part, stage, 500, now),
      this.db.prepare(`SELECT * FROM claims WHERE project=? AND ends_at>? AND (${activeEntry})`).bind(project, now),
      this.db.prepare(`WITH ${CLOSED_TALK} SELECT COUNT(*) AS total FROM talk`).bind(...keys),
      ...(closed ? [
        this.db.prepare(`${page} SELECT c.*,page.at AS _at,${COMMENT_EXTRAS} FROM page JOIN comments AS c ON c.id=page.id
          WHERE page.kind='comment'`).bind(...keys, after),
        this.db.prepare(`${page} SELECT p.*,e.id AS edit,page.at AS _at FROM page JOIN proposals AS p ON p.id=page.id
          LEFT JOIN edits AS e ON e.proposal=p.id WHERE page.kind='proposal'`).bind(...keys, after),
      ] : []),
    ]);
    return talkData({ snapshot: context.snapshot, project, part, stage, item, now,
      open: rows[0].results, proposals: rows[1].results, reflections: rows[2].results, claims: rows[3].results,
      closedTotal: rows[4].results[0].total, closedRows: closed ? [...rows[5].results, ...rows[6].results] : [] });
  }

  // API-157: an item that a stage of the stored snapshot holds, with its talk
  // in the part, the project's first part unless the request names one, as
  // API-152 gives it narrowed to the item, so a project without a space is
  // space_not_found as there.
  async readItem(project, id, part, now = new Date().toISOString()) {
    const context = await this.readContext(project, true);
    const chosen = part === null ? partsOf(context.snapshot)[0] : part;
    this.validPart(context.snapshot, chosen);
    const item = heldItem(context.snapshot, id);
    if (!item) throw new Problem("item_not_found", `no stage of the stored snapshot of ${project} holds ${id}`);
    const comments = await this.talk(context, project, chosen, item.stage, { item: id, closed: 0, after: 0 }, now);
    return itemData({ snapshot: context.snapshot, project, part: chosen, item, comments });
  }

  // API-156: each stored snapshot's first part and items, in the order of the
  // projects' names; SQLite takes them out of the stored body, so the server
  // parses only the items, never the checks or the stage sources.
  async searchItems(q) {
    await this.ensure();
    const { results } = await this.db.prepare(`SELECT name,json_extract(body,'$.project.parts[0]') AS part,
      json_extract(body,'$.items') AS items FROM snapshots ORDER BY name`).all();
    return searchData(q, results || []);
  }

  async readEntry(project, kind, id) {
    await this.readContext(project);
    if (kind === "comment") {
      const [comments,replies,decisions,proposals] = await this.db.batch([
        this.db.prepare("SELECT * FROM comments WHERE project=? AND id=?").bind(project,id),
        this.db.prepare("SELECT r.* FROM replies AS r JOIN comments AS c ON c.id=r.comment WHERE c.project=? AND c.id=? ORDER BY r.seq").bind(project,id),
        this.db.prepare("SELECT d.* FROM decisions AS d JOIN comments AS c ON c.id=d.comment WHERE c.project=? AND c.id=? ORDER BY d.seq").bind(project,id),
        this.db.prepare("SELECT p.*,e.id AS edit FROM proposals AS p LEFT JOIN edits AS e ON e.proposal=p.id WHERE p.project=? AND p.comment=? ORDER BY p.made_at DESC,p.id").bind(project,id),
      ]);
      const row=comments.results[0]; if(!row)throw new Problem("comment_not_found","no such comment");
      return {...E.comment(row),replies:replies.results.map(E.reply),decisions:decisions.results.map(E.decision),proposals:proposals.results.map((row)=>E.proposal(row))};
    }
    if (kind === "proposal") {
      const row=await this.db.prepare("SELECT p.*,e.id AS edit FROM proposals AS p LEFT JOIN edits AS e ON e.proposal=p.id WHERE p.project=? AND p.id=?").bind(project,id).first();
      if(!row)throw new Problem("proposal_not_found","no such proposal"); return E.proposal(row,true);
    }
    if (kind === "edit") {
      const row=await this.db.prepare(`SELECT e.*,json_object('id',p.id,'part',p.part,'stage',p.stage,'commit_id',p.commit_id,'items',p.items,'reason',p.reason,
        'change',p.change,'source_text',p.source_text,'comment',p.comment,'discrepancy',p.discrepancy,'state',p.state,'made_at',p.made_at,'closed_at',p.closed_at,'edit',e.id) AS proposal_json
        FROM edits AS e LEFT JOIN proposals AS p ON e.proposal=p.id WHERE e.project=? AND e.id=?`).bind(project,id).first();
      if(!row)throw new Problem("edit_not_found","no such reflection"); return E.editListRow(row,true);
    }
    if(kind === "checkpoint") {
      const row=await this.db.prepare("SELECT * FROM checkpoints WHERE project=? AND id=?").bind(project,id).first();
      if(!row)throw new Problem("checkpoint_not_found","no such checkpoint"); return E.checkpoint(row);
    }
    throw new Error("unimplemented entry kind");
  }

  // API-110: what a removal deletes, from one batch with the snapshot and the space.
  async removalDryRun(project) {
    await this.ensure();
    const rows = await this.db.batch([
      this.db.prepare("SELECT name FROM snapshots WHERE name=?").bind(project),
      this.db.prepare("SELECT project FROM project_spaces WHERE project=?").bind(project),
      ...REMOVAL.map((sql) => this.db.prepare(sql).bind(project)),
    ]);
    if (!rows[0].results[0]) throw new Problem("project_not_found", "no such project");
    return removal(project, Boolean(rows[1].results[0]), rows.slice(2));
  }

  // API-177: what the server holds of a project (SPEC-203), from one batch: the
  // stored snapshot as its card gives it, the space's last read with what the
  // agent has not read as of now, the time of the read, and the removal's dry
  // run at the same moment. The read records nothing.
  async projectData(project, now = new Date().toISOString()) {
    await this.ensure();
    const rows = await this.db.batch([
      this.db.prepare(`SELECT ${SNAPSHOT_HEAD} FROM snapshots WHERE name=?`).bind(project),
      this.db.prepare(SPACE_READ).bind(now, now, now, now, project),
      ...REMOVAL.map((sql) => this.db.prepare(sql).bind(project)),
    ]);
    const head = rows[0].results[0];
    if (!head) throw new Problem("project_not_found", "no such project");
    const read = rows[1].results[0] || null;
    return projectData(head, read, removal(project, Boolean(read), rows.slice(2)));
  }

  // API-178: the export (SPEC-201), built as the server answers from one batch
  // and kept nowhere: the commit that the project shows, the agent's last read
  // and every entry of the space that Git does not hold. now is exported_at.
  async exportProject(project, now = new Date().toISOString()) {
    await this.ensure();
    const rows = await this.db.batch([
      this.db.prepare("SELECT default_commit FROM snapshots WHERE name=?").bind(project),
      this.db.prepare("SELECT read_at FROM project_spaces WHERE project=?").bind(project),
      ...EXPORT.map((sql) => this.db.prepare(sql).bind(project)),
    ]);
    const head = rows[0].results[0];
    if (!head) throw new Problem("project_not_found", "no such project");
    return projectExport(project, now, head, rows[1].results[0] || null, rows.slice(2).map((row) => row.results));
  }

  // Read only the target rows and counters needed by this transition. The
  // exact same SQL is evaluated inside the receipt INSERT, so a concurrent
  // push, claim or write invalidates the plan before any business row changes.
  // A checkpoint request also reads its part's stage's open request, so that
  // the receipt records the write ID only while the stage has no other, and
  // whether a stage of the stored snapshot holds its trace ID (SPEC-197). So
  // does a pass, with the place of that request's last entry, so that the
  // receipt records it only while the request that the page showed is still
  // the stage's open one and has no newer entry (SPEC-194).
  entryBasis(project, id, body, write, cutoff, pass = false) {
    const sql = `WITH q AS (SELECT ? AS project,? AS target,? AS body_comment,? AS body_discrepancy,
      ? AS part,? AS stage,? AS write,? AS cutoff,? AS request,? AS look),
      p AS (SELECT q.*,COALESCE(body_comment,(SELECT comment FROM proposals WHERE id=q.target AND project=q.project),target) AS thread,
        COALESCE(body_discrepancy,(SELECT discrepancy FROM proposals WHERE id=q.target AND project=q.project),target) AS diff FROM q),
      t AS (SELECT p.*,CASE WHEN p.request=1 THEN (SELECT r.id FROM comments AS r WHERE r.project=p.project AND r.state='open' AND r.asks='checkpoint'
          AND r.part=COALESCE(p.part,(SELECT part FROM comments WHERE project=p.project AND id=p.thread))
          AND r.stage=COALESCE(p.stage,(SELECT stage FROM comments WHERE project=p.project AND id=p.thread)) ORDER BY r.id LIMIT 1) END AS open_request FROM p)
      SELECT json_object(
        'held',(SELECT json_object('revision',revision,'default_commit',default_commit) FROM snapshots WHERE name=t.project),
        'parts',json(COALESCE((SELECT json_extract(body,'$.project.parts') FROM snapshots WHERE name=t.project),'[]')),
        'leftOut',json(COALESCE((SELECT json_extract(body,'$.left_out') FROM snapshots WHERE name=t.project),'[]')),
        'space',(SELECT json_object('text_bytes',text_bytes,'repo_url',repo_url) FROM project_spaces WHERE project=t.project),
        'picture',(SELECT json_object('commit_id',commit_id,'source',source) FROM pictures WHERE project=t.project AND part=t.part AND stage=t.stage),
        'comment',${rowJSON("comments", "project=t.project AND id=t.thread")},
        'proposal',${rowJSON("proposals", "project=t.project AND id=t.target")},
        'edit',${rowJSON("edits", "project=t.project AND id=t.target")},
        'checkpoint',${rowJSON("checkpoints", "project=t.project AND id=t.target")},
        'discrepancy',${rowJSON("discrepancies", "project=t.project AND id=t.diff")},
        'counts',json_object('comments',(SELECT COUNT(*) FROM comments WHERE project=t.project),
          'proposals',(SELECT COUNT(*) FROM proposals WHERE project=t.project AND state='open'),
          'edits',(SELECT COUNT(*) FROM edits WHERE project=t.project AND state NOT IN ('closed','dismissed'))),
        'replyCount',(SELECT COUNT(*) FROM replies WHERE comment=t.thread),
        'decisionCount',(SELECT COUNT(*) FROM decisions WHERE comment=t.thread),
        'lastReply',json((SELECT json_object('seq',seq,'author',author,'text',text,'settles',settles,'made_at',made_at,'look_first',look_first) FROM replies WHERE comment=t.thread ORDER BY seq DESC LIMIT 1)),
        'request',t.open_request,
        'requestEntry',CASE WHEN t.open_request IS NULL THEN NULL ELSE (SELECT COALESCE(MAX(seq),0) FROM replies WHERE comment=t.open_request) END,
        'lookHeld',CASE WHEN t.look IS NULL THEN NULL ELSE EXISTS(SELECT 1 FROM snapshots AS s,json_each(s.body,'$.items') AS j
          WHERE s.name=t.project AND json_extract(j.value,'$.id')=t.look AND json_extract(j.value,'$.stage') IN (${STAGE_LIST})) END,
        'threadProposals',json((SELECT json_group_array(json_object('id',id,'state',state,'made_at',made_at,'closed_at',closed_at)) FROM proposals WHERE project=t.project AND comment=t.thread)),
        'claims',json((SELECT json_group_array(json_object('entry',entry,'session',session,'claimed_at',claimed_at,'ends_at',ends_at)) FROM claims WHERE project=t.project AND entry IN(t.target,t.thread,t.diff))),
        'prior',(SELECT json_object('request',request,'result',result) FROM writes WHERE project=t.project AND id=t.write AND received_at>t.cutoff)
      ) AS basis FROM t`;
    return { sql, params: [project,id || null,body.comment || null,body.discrepancy || null,body.part ?? null,body.stage || null,write || null,cutoff,
      pass || body.asks === "checkpoint" ? 1 : 0,lookedUp(body)] };
  }

  async writeEntry(name, project, id, body, { kind, session = null, write, now: given, language = "en", client }) {
    checkWriteBody(name, body, kind);
    await this.ensure();
    const cutoff = new Date(Date.parse(given ?? new Date().toISOString())-7*86400000).toISOString();
    const basisQuery = this.entryBasis(project,id,body,write,cutoff,name === "checkpoint");
    for (let attempt=0; attempt<8; attempt++) {
      const basis = await this.db.prepare(basisQuery.sql).bind(...basisQuery.params).first("basis");
      // The write's time is taken in its batch's turn, with nothing awaited in
      // between, so that on the standalone server the order of the times is
      // the order of the writes, as the agent's read needs (SPEC-187, SPEC-189).
      const now = given ?? new Date().toISOString();
      const state = JSON.parse(basis);
      if (state.prior) {
        if (state.prior.request!==name) throw new Problem("write_id_reused","this ID was used for another request");
        const { status,body: answer }=JSON.parse(state.prior.result);
        return { status,body:answer };
      }
      const plan=planEntryWrite(name,body,state,{project,kind,session,now,language,client});
      const nonce=crypto.randomUUID();
      const result=JSON.stringify({status:plan.status,body:plan.body,nonce});
      const gate="EXISTS(SELECT 1 FROM writes WHERE project=? AND id=? AND json_extract(result,'$.nonce')=?)";
      const guard=[project,write,nonce];
      const statements=[
        this.db.prepare("DELETE FROM writes WHERE project=? AND received_at<=?").bind(project,cutoff),
        this.db.prepare(`INSERT OR IGNORE INTO writes(project,id,request,result,received_at)
          SELECT ?,?,?,?,? WHERE (${basisQuery.sql})=?`).bind(project,write,name,result,now,...basisQuery.params,basis),
      ];
      for(const change of plan.changes) {
        const columns=ENTRY_COLUMNS[change.table];
        if(!columns)throw new Error("unknown transition table");
        const keys=change.table==="replies"||change.table==="decisions"?["comment","seq"]:["id","project"];
        const fields=columns.filter((column)=>Object.hasOwn(change.row,column));
        if(change.fresh)statements.push(this.db.prepare(`INSERT INTO ${change.table}(${fields.join(",")})
          SELECT ${fields.map(()=>"?").join(",")} WHERE ${gate}`).bind(...fields.map((key)=>change.row[key]),...guard));
        else statements.push(this.db.prepare(`UPDATE ${change.table} SET ${fields.filter((key)=>!keys.includes(key)).map((key)=>key+"=?").join(",")}
          WHERE ${keys.map((key)=>key+"=?").join(" AND ")} AND ${gate}`)
          .bind(...fields.filter((key)=>!keys.includes(key)).map((key)=>change.row[key]),...keys.map((key)=>change.row[key]),...guard));
      }
      if(plan.textBytes)statements.push(this.db.prepare(`UPDATE project_spaces SET text_bytes=text_bytes+? WHERE project=? AND ${gate}`).bind(plan.textBytes,project,...guard));
      if(plan.on && kind==="agent")statements.push(this.db.prepare(`UPDATE claims SET ends_at=? WHERE project=? AND entry=? AND session=? AND ${gate}`)
        .bind(new Date(Date.parse(now)+3600000).toISOString(),project,plan.on,session,...guard));
      statements.push(this.db.prepare(`DELETE FROM claims WHERE project=? AND (ends_at<=? OR NOT (${activeEntry})) AND ${gate}`).bind(project,now,...guard));
      statements.push(this.db.prepare("SELECT request,result FROM writes WHERE project=? AND id=?").bind(project,write));
      let results;
      try { results=await this.db.batch(statements); }
      catch(error) {
        // The index comments_request is the guard beneath the receipt's check: a
        // batch that would leave a part's stage two open checkpoint requests fails
        // whole, and the request is answered with the one that is open (SPEC-197).
        if(!/UNIQUE constraint failed: comments\.project, comments\.part, comments\.stage/.test(String(error?.message)))throw error;
        const [part,stage]=name==="comment"?[body.part,body.stage]:[state.comment?.part,state.comment?.stage];
        const open=await this.db.prepare("SELECT id FROM comments WHERE project=? AND part=? AND stage=? AND state='open' AND asks='checkpoint'").bind(project,part,stage).first("id");
        if(open)throw requestOpen(project,part,stage,open);
        continue;
      }
      const receipt=results[results.length-1].results[0];
      if(!receipt)continue; // another write changed the basis; plan afresh
      if(receipt.request!==name)throw new Problem("write_id_reused","this ID was used for another request");
      const {status,body:answer}=JSON.parse(receipt.result);
      return {status,body:answer};
    }
    throw new Error("the entry kept changing during this write");
  }

  async claimEntry(project,id,session,release=false,now=new Date().toISOString()) {
    await this.ensure();
    const query=this.entryBasis(project,id,{},null,now);
    for(let attempt=0;attempt<8;attempt++) {
      const basis=await this.db.prepare(query.sql).bind(...query.params).first("basis");
      const state=JSON.parse(basis);
      if(!state.held)throw new Problem("project_not_found","no such project");
      if(!state.space)throw new Problem("space_not_found","this project has no space");
      const type={nc_:"comment",nd_:"discrepancy",ne_:"edit",nk_:"checkpoint"}[id.slice(0,3)];
      const row=state[type];
      if(!row)throw new Problem("entry_not_found","no such entry");
      const held=state.claims.find((claim)=>claim.entry===id && claim.ends_at>now);
      if(held && held.session!==session)throw new Problem("claimed","another session holds this entry",{ends_at:held.ends_at});
      if(release) {
        const result=await this.db.prepare(`DELETE FROM claims WHERE project=? AND entry=? AND session=? AND ends_at>? AND (${query.sql})=? RETURNING entry`)
          .bind(project,id,session,now,...query.params,basis).all();
        if(result.results.length)return {entry:id,released:true};
        // A missing own claim is an idempotent release. If it changed under
        // us, reread before returning or refusing another session's claim.
        if(!held)return {entry:id,released:false};
      } else {
        const disposition=entryDisposition(row,type);
        if(disposition.held)throw new Problem("pull_request_reported","a pull request holds this entry",{pull_request:disposition.held});
        if(disposition.closed)throw new Problem("entry_closed","this entry is closed");
        const result=await this.db.prepare(`INSERT INTO claims(entry,project,session,claimed_at,ends_at)
          SELECT ?,?,?,?,? WHERE (${query.sql})=? ON CONFLICT(entry) DO UPDATE SET
          session=excluded.session,claimed_at=excluded.claimed_at,ends_at=excluded.ends_at RETURNING *`)
          .bind(id,project,session,held?.claimed_at||now,new Date(Date.parse(now)+3600000).toISOString(),...query.params,basis).all();
        if(result.results.length)return E.claim(result.results[0]);
      }
    }
    throw new Error("the claim kept changing");
  }

  // API-113. With record, for a read with the service token (SPEC-187), the
  // batch's first statement records the read's time and the session's label
  // for the space, before the lists are gathered, and the answer names that
  // time; a person's read and a HEAD record nothing and answer null. The time
  // is taken in the batch's turn, with nothing awaited in between, as each
  // write takes its own: on the standalone server an entry that the lists do
  // not hold then carries a time at or after the read's (SPEC-189).
  async readTodo(project,session=null,{record=false,now:given}={}) {
    const {held}=await this.readContext(project,true);
    const now=given??new Date().toISOString();
    const recorded=record?[this.db.prepare("UPDATE project_spaces SET read_at=?,read_session=? WHERE project=?").bind(now,session,project)]:[];
    const results=await this.db.batch([...recorded,
      this.commentStatement(project,"todo",undefined,undefined,50,null,now),this.discrepancyStatement(project,undefined,undefined,50),this.editStatement(project,"todo",undefined,undefined,50,now),
      this.db.prepare(`SELECT *,COUNT(*) OVER() AS _total FROM checkpoints WHERE project=? AND ${TODO_CHECKPOINT}
        ORDER BY CASE WHEN state='passed' THEN 0 ELSE 1 END,passed_at,id LIMIT 50`).bind(project),
      this.db.prepare(`SELECT * FROM claims WHERE project=? AND ends_at>? AND (${activeEntry})`).bind(project,now),
      this.db.prepare(`SELECT (SELECT COUNT(*) FROM comments WHERE project=? AND state='open' AND waits='user') AS waiting,
        (SELECT COUNT(*) FROM claims WHERE project=? AND ends_at>? AND session IS NOT ? AND ${TAKEN}) AS taken`).bind(project,project,now,session),
    ]);
    // A space removed after readContext leaves the record nothing to change:
    // that read is the 404 of a project without a space, and records nothing.
    if(record&&!results[0].meta.changes)throw new Problem("space_not_found","this project has no space; push a 0.2 snapshot first");
    const [comments,discrepancies,edits,checkpoints,claims,counts]=results.slice(recorded.length);
    const rows=claims.results;
    const wrap=(result,mapper)=>({total:result.results[0]?._total||0,entries:result.results.map(mapper)});
    return {project,default_commit:held.default_commit,session,read_at:record?now:null,
      comments:wrap(comments,(row)=>E.commentListRow(row,rows,session,now)),
      discrepancies:wrap(discrepancies,(row)=>E.withClaim(E.discrepancy(row),rows,session,now)),
      reflections:wrap(edits,(row)=>E.withClaim(E.editListEntry(row),rows,session,now)),
      checkpoints:wrap(checkpoints,(row)=>E.withClaim({...E.checkpoint(row),why:E.listedCheckpoint(row)},rows,session,now)),
      waiting_for_user:counts.results[0].waiting,taken:counts.results[0].taken};
  }

  async readSpaces() {
    await this.ensure();
    const [spaces,pictures,counts,checkpoints,warnings]=await this.db.batch([
      this.db.prepare("SELECT project,unopened FROM project_spaces ORDER BY project"),
      this.db.prepare("SELECT project,part,stage,commit_id,committed_at,not_current FROM pictures ORDER BY project,part,stage"),
      this.db.prepare(`SELECT project,'comments' AS kind,COUNT(*) AS n FROM comments WHERE state='open' GROUP BY project
        UNION ALL SELECT project,'proposals',COUNT(*) FROM proposals WHERE state='open' GROUP BY project
        UNION ALL SELECT project,'discrepancies',COUNT(*) FROM discrepancies WHERE state='open' GROUP BY project`),
      this.db.prepare(`SELECT project,id,part,stage,passed_at,COUNT(*) OVER(PARTITION BY project) AS _total,
        ROW_NUMBER() OVER(PARTITION BY project ORDER BY passed_at,id) AS place FROM checkpoints WHERE state='passed' AND recorded_commit IS NULL`),
      this.db.prepare("SELECT project,id,part,stage FROM checkpoints WHERE state='withdrawn' AND recorded_commit IS NOT NULL ORDER BY passed_at,id"),
    ]);
    const result=Object.fromEntries(spaces.results.map((row)=>[row.project,{pictures:[],open:{comments:0,proposals:0,discrepancies:0},checkpoints:{total:0,entries:[]},warnings:[],not_opened:JSON.parse(row.unopened)}]));
    for(const row of pictures.results)result[row.project].pictures.push({part:row.part,stage:row.stage,commit:row.commit_id,committed_at:row.committed_at,not_current:row.not_current});
    for(const row of counts.results)result[row.project].open[row.kind]=row.n;
    for(const row of checkpoints.results) {
      result[row.project].checkpoints.total=row._total;
      if(row.place<=100)result[row.project].checkpoints.entries.push({id:row.id,part:row.part,stage:row.stage,passed_at:row.passed_at});
    }
    for(const row of warnings.results)if(result[row.project].warnings.length<100)result[row.project].warnings.push({part:row.part,stage:row.stage,rule:"checkpoint-withdrawn",checkpoint:row.id});
    return result;
  }

  // API-151: the first page in one batch, every space's my turn and to-do and
  // every stored snapshot's card; home-data.js shapes them.
  async readHome(now = new Date().toISOString()) {
    await this.ensure();
    const [turn, agent, cards, pictures] = await this.db.batch([
      this.db.prepare(MY_TURN), this.db.prepare(AGENT_COUNTS).bind(now, now, now, now, now), this.db.prepare(CARDS), this.db.prepare(CARD_PICTURES),
    ]);
    return homeData({ now, turn: turn.results, agent: agent.results, cards: cards.results, pictures: pictures.results });
  }

}
