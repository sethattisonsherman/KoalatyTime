const { test } = require('node:test');
const assert = require('node:assert/strict');
const { edgePoint, walkPoint, chooseButtonMode } = require('./garden-motion.js');

const viewport = { width: 1280, height: 800, size: 54 };
const card = { left: 220, right: 1020, top: 180, bottom: 500, width: 800, height: 320 };

test('a koala stays at the same document point when the page scrolls', () => {
  const before = edgePoint(card, 54, viewport, { x: 0, y: 0 }, 'top', () => .4);
  const after = edgePoint({ ...card, top: 80, bottom: 400 }, 54, viewport, { x: 0, y: 100 }, 'top', () => .4);
  assert.deepEqual(after, before);
  assert(before.y < card.top);
});

test('koalas can perch and climb on a container side', () => {
  const left = edgePoint(card, 54, viewport, { x: 0, y: 0 }, 'left', () => .2);
  const right = edgePoint(card, 54, viewport, { x: 0, y: 0 }, 'right', () => .8);
  assert(left.x < card.left);
  assert(right.x < card.right && right.x + 54 > card.right);
  const climb = walkPoint(card, 54, viewport, { x: 0, y: 0 }, left, 'left', () => .75);
  assert.equal(climb.x, left.x);
  assert(climb.y > left.y);
});

test('koalas can walk in either direction along a panel rim', () => {
  const current = { x: 500, y: 144 };
  const leftRandom = [0.5, 0.1];
  const rightRandom = [0.5, 0.9];
  const left = walkPoint(card, 54, viewport, { x: 0, y: 0 }, current, 'top', () => leftRandom.shift() ?? .5);
  const right = walkPoint(card, 54, viewport, { x: 0, y: 0 }, current, 'top', () => rightRandom.shift() ?? .5);
  assert(left.x < current.x);
  assert(right.x > current.x);
  assert.equal(left.y, right.y);
});

test('each button visit can select a different koala pose', () => {
  const first = chooseButtonMode(null, () => 0);
  const next = chooseButtonMode(first, () => 0);
  assert.notEqual(first, next);
  assert(new Set(['walk', 'jump', 'dangle', 'breathe', 'wave', 'peek']).has(next));
});
