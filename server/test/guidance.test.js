import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyStageGuidance } from '../web/guidance.js';
import { STAGES } from '../web/stages.js';

test('each stage explains what to ask an agent to prepare and send', () => {
  const messages = STAGES.map(({ id }) => emptyStageGuidance(id));
  assert.equal(new Set(messages).size, STAGES.length);
  assert.ok(messages.every((message) => message.includes('AI 대화창') && message.includes('NEXUS에 보내줘')));
  assert.match(emptyStageGuidance('07-sitemap'), /화면 목록과 연결/);
});
