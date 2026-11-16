const { test } = require('node:test');
const assert = require('node:assert/strict');
const { perchPoint, walkPoint, chooseButtonMode } = require('./garden-motion.js');

test('koala perches stay on visible card and input edges', () => {
  const viewport = { width: 1280, height: 800, size: 54 };
  const card = { left: 220, right: 1020, top: 180 };
  const left = perchPoint(card, 54, viewport, () => 0);
  const right = perchPoint(card, 54, viewport, () => 1);
  assert.equal(left.x, 228);
  assert.equal(right.x, 958);
  assert(left.y < card.top);
  const input = perchPoint(card, 54, viewport, () => .5, true);
  assert(input.y > left.y);
});

test('koalas can walk in either direction along a panel edge', () => {
  const viewport = { width: 1280, height: 800, size: 54 };
  const card = { left: 220, right: 1020, top: 180 };
  const current = { x: 500, y: 144 };
  const leftRandom = [0.5, 0.1];
  const rightRandom = [0.5, 0.9];
  const left = walkPoint(card, 54, viewport, current, () => leftRandom.shift() ?? .5);
  const right = walkPoint(card, 54, viewport, current, () => rightRandom.shift() ?? .5);
  assert(left.x < current.x);
  assert(right.x > current.x);
  assert(left.x >= card.left && right.x < card.right);
});

test('each button visit can select a different koala pose', () => {
  const first = chooseButtonMode(null, () => 0);
  const next = chooseButtonMode(first, () => 0);
  assert.notEqual(first, next);
  assert(new Set(['walk', 'jump', 'dangle', 'breathe']).has(next));
});
