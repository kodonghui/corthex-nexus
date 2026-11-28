// Compare literally, allowing whitespace runs and final sentence punctuation to differ.
export function sameDecisionAnswer(answer, decision) {
  if (typeof answer !== 'string' || typeof decision !== 'string') return false;
  const key = (text) => text.normalize('NFC').trim().replace(/\s+/gu, ' ').replace(/[.!。！]+$/u, '').trim();
  const a = key(answer);
  return a !== '' && a === key(decision);
}

export function exactExternalAnswer(answer, decision) {
  return typeof answer === 'string' && !/[?？]/u.test(answer) && sameDecisionAnswer(answer, decision);
}
