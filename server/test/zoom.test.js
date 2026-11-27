import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampZoom, fitZoom, zoomScroll, zoomStep } from '../web/zoom.js';

test('zoom stays within its approved range and fit handles a picture larger than the viewport', () => {
  assert.equal(clampZoom(0.001), 0.01);
  assert.equal(clampZoom(3), 2);
  assert.equal(fitZoom(1000, 800, 500, 500), 0.5);
  assert.equal(fitZoom(3000, 4000, 1000, 600), 0.15);
  assert.equal(fitZoom(1000000, 1000000, 100, 100), 0.01);
  assert.equal(fitZoom(0, 0, 500, 500), 1);
});

test('buttons allow useful adjustments below ten percent in both directions', () => {
  assert.deepEqual([0.1, 0.05, 0.025].map((value) => zoomStep(value, -1)), [0.05, 0.025, 0.01]);
  assert.deepEqual([0.01, 0.025, 0.05].map((value) => zoomStep(value, 1)), [0.025, 0.05, 0.1]);
  assert.equal(zoomStep(0.15, -1), 0.1);
  assert.equal(zoomStep(0.1004, -1), 0.05);
  assert.equal(zoomStep(0.1006, -1), 0.1);
  assert.equal(zoomStep(0.1, 1), 0.2);
  assert.equal(zoomStep(0.09995, 1), 0.2);
  assert.equal(zoomStep(0.09, 1), 0.18);
});

test('zoom keeps a focal point steady in the scrolled picture', () => {
  assert.equal(zoomScroll(100, 50, 1, 2), 250);
  assert.equal(zoomScroll(250, 50, 2, 1), 100);
  assert.equal(zoomScroll(0, 100, 1, 0.25), 0);
});

test('small trackpad wheel changes accumulate at low magnification', () => {
  let scale = 0.1;
  for (let count = 0; count < 10; count += 1) scale = clampZoom(scale * Math.exp(0.002));
  assert.ok(scale > 0.101);
});
