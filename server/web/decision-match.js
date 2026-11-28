// Compare an outside answer literally, ignoring only whitespace and punctuation.
export function sameDecisionAnswer(answer, decision) {
  if (typeof answer !== 'string' || typeof decision !== 'string') return false;
  const key = (text) => text.normalize('NFC').replace(/[\s\p{P}]/gu, '');
  const a = key(answer);
  return a !== '' && a === key(decision);
}
