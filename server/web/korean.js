// Korean words the pages build. objectParticle is the object particle after a project's name, 을 or 를, as the stage-09
// mockup writes "book-club을 적으세요" and SCR-143 "demo를 지웠어요" (the coordinator's rule for TASK-456 and TASK-457,
// waiting for the maintainer's delegate). A name is the contract's ProjectName, lowercase letters, digits and hyphens,
// so the particle follows how its end is read aloud:
// - a final digit as Korean reads it: 0 (영), 1 (일), 3 (삼), 6 (육), 7 (칠) and 8 (팔) take 을; 2, 4, 5 and 9 take 를;
// - a final ng, l, m or n takes 을, and so does an e after m, n or l, which is silent: home, time, phone, table;
// - a final b, k, p or t after a vowel takes 을, a doubled letter or a final ck read once: club, book, app, chat, stack;
// - anything else takes 를: demo, nexus, desk, test, note.
// English spelling does not always say how a word ends aloud, so the rule can miss on other words; a missed particle
// shows the name with the other particle and nothing else.

const DIGIT_EUL = new Set(['0', '1', '3', '6', '7', '8']);
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const NASAL_OR_L = new Set(['l', 'm', 'n']);
const STOPS = new Set(['b', 'k', 'p', 't']);

export function objectParticle(name) {
  const last = name.at(-1) ?? '';
  if (/[0-9]/.test(last)) return DIGIT_EUL.has(last) ? '을' : '를';
  // The letters the name ends with, a doubled last letter or a final ck read once.
  let word = /[a-z]+$/.exec(name)?.[0] ?? '';
  if (word.endsWith('ng')) return '을';
  if (word.length >= 2 && word.endsWith('e') && NASAL_OR_L.has(word.at(-2))) return '을';
  if (word.length >= 2 && word.at(-1) === word.at(-2)) word = word.slice(0, -1);
  word = word.replace(/ck$/, 'k');
  const end = word.at(-1);
  if (NASAL_OR_L.has(end)) return '을';
  if (STOPS.has(end) && word.length >= 2 && VOWELS.has(word.at(-2))) return '을';
  return '를';
}
