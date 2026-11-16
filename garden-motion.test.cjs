const { test } = require('node:test');
const assert = require('node:assert/strict');
const { edgePoint, walkPoint, facingLeft } = require('./garden-motion.js');

const viewport = { width: 1280, height: 800, size: 54 };
const card = { left: 220, right: 1020, top: 180, bottom: 500, width: 800, height: 320 };

test('a koala stays at the same document point when the page scrolls', () => {
  const before = edgePoint(card, 54, viewport, { x: 0, y: 0 }, 'top', () => .4);
  const after = edgePoint({ ...card, top: 80, bottom: 400 }, 54, viewport, { x: 0, y: 100 }, 'top', () => .4);
  assert.deepEqual(after, before);
  assert(Math.abs(before.y + 54 * .90 - card.top) <= 1);
});

test('an input koala grips the upper right corner away from typed text', () => {
  const input = { left: 220, right: 620, top: 300, bottom: 348, width: 400, height: 48 };
  const pet = edgePoint(input, 54, viewport, { x: 0, y: 0 }, 'top', () => 0, true);
  assert(pet.x > input.right - 100);
  assert(Math.abs(pet.y + 54 * .50 - input.top) <= 1);
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

test('a koala runs along the container floor at the bottom edge', () => {
  const current = edgePoint(card, 54, viewport, { x: 0, y: 0 }, 'bottom', () => .5);
  const next = walkPoint(card, 54, viewport, { x: 0, y: 0 }, current, 'bottom', () => .75);
  assert.equal(next.y, current.y);
  assert(next.x !== current.x);
  assert(Math.abs(current.y + 54 * .90 - card.bottom) <= 1);
});

test('climbing koalas face into the container on both side edges', () => {
  assert.equal(facingLeft('right', 0), true);
  assert.equal(facingLeft('left', 0), false);
  assert.equal(facingLeft('top', -30), true);
  assert.equal(facingLeft('bottom', 30), false);
});
