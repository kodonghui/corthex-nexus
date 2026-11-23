// Text that looks like a secret or an email address (REQ-077): a snapshot's source that holds such text is left out of
// what NEXUS keeps and named in the push answer's refused (API-242, see snapshots.js).
//
// The patterns are the pinned hub's own, SECRET_TEXT of its hub.py, which the hub uses to redact every text of a
// snapshot before it sends it: OpenAI-style, GitHub, Slack and AWS keys, a private key's first line, and an email
// address. So a snapshot the pinned hub made never holds one, and NEXUS refuses no more than the hub itself redacts.
// A key starts a word, so "Task-board" in a title is not one.
//
// Nothing here returns or logs the text it found: a caller learns only which kind it was (rule 5).

const SECRET = new RegExp([
  '(?<![A-Za-z0-9])(?:sk-[A-Za-z0-9_-]{20,}',
  '|(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}',
  '|github_pat_[A-Za-z0-9_]{20,}',
  '|xox[abprs]-[A-Za-z0-9-]{10,}',
  '|AKIA[0-9A-Z]{16})',
  '|-----BEGIN [A-Z ]*PRIVATE KEY-----',
].join(''));

// The hub's email pattern, [A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}, found from each @ rather
// than by one search: one search tries every start in a long run of letters, which takes time that grows with the
// square of the run, and a source may be 1 MiB of text. From each @, one character of the local part before it and the
// domain after it are what the pattern needs, so the two find the same texts.
const LOCAL = /[A-Za-z0-9._%+-]/;
const DOMAIN = /[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/y;

function holdsEmail(text) {
  for (let at = text.indexOf('@'); at !== -1; at = text.indexOf('@', at + 1)) {
    if (at === 0 || !LOCAL.test(text[at - 1])) continue;
    DOMAIN.lastIndex = at + 1;
    if (DOMAIN.test(text)) return true;
  }
  return false;
}

// 'secret' when the text looks like it holds a secret, otherwise 'email' when it looks like it holds an email address,
// otherwise null.
export function sensitiveText(text) {
  if (SECRET.test(text)) return 'secret';
  if (holdsEmail(text)) return 'email';
  return null;
}

// The same for a JSON value: each text in it, the names of its members included. A secret anywhere wins over an email.
export function sensitiveValue(value) {
  let found = null;
  const waiting = [value];
  while (waiting.length > 0) {
    const next = waiting.pop();
    if (typeof next === 'string') {
      const kind = sensitiveText(next);
      if (kind === 'secret') return kind;
      found ??= kind;
    } else if (Array.isArray(next)) {
      for (const item of next) waiting.push(item);
    } else if (next !== null && typeof next === 'object') {
      for (const [name, item] of Object.entries(next)) waiting.push(name, item);
    }
  }
  return found;
}
