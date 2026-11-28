import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sameDecisionAnswer } from '../web/decision-match.js';

test('answer comparison preserves punctuation and spaces that change meaning', () => {
  for (const [a, b] of [['1.5', '15'], ['-1', '1'], ['A/B', 'AB'], ['no thing', 'nothing']]) {
    assert.equal(sameDecisionAnswer(a, b), false);
  }
  assert.equal(sameDecisionAnswer('Use it!\n', 'Use it.'), true);
});
