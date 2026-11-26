import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staffOrderingOpen, type QatarClock } from '../src/branches/hours';
import type { WeekHours } from '../src/branches/branches';

const week = (open: number, close: number): WeekHours =>
  Array.from({ length: 7 }, () => ({ open, close }));

test('staff ordering open inside published hours', () => {
  const hours = week(14 * 60, 23 * 60);
  const clock: QatarClock = { day: 1, minute: 15 * 60 };
  assert.equal(staffOrderingOpen(hours, clock, 60), true);
});

test('staff ordering open within one hour before open', () => {
  const hours = week(14 * 60, 23 * 60);
  const clock: QatarClock = { day: 1, minute: 13 * 60 + 15 };
  assert.equal(staffOrderingOpen(hours, clock, 60), true);
  assert.equal(staffOrderingOpen(hours, { day: 1, minute: 12 * 60 + 50 }, 60), false);
});

test('staff ordering open within one hour after close', () => {
  const hours = week(14 * 60, 23 * 60);
  assert.equal(staffOrderingOpen(hours, { day: 1, minute: 23 * 60 + 30 }, 60), true);
  assert.equal(staffOrderingOpen(hours, { day: 1, minute: 24 * 60 + 5 }, 60), false);
});

test('staff grace after a 23:30 close spills past midnight', () => {
  const hours = week(14 * 60, 23 * 60 + 30);
  assert.equal(staffOrderingOpen(hours, { day: 1, minute: 23 * 60 + 50 }, 60), true);
  assert.equal(staffOrderingOpen(hours, { day: 2, minute: 20 }, 60), true);
  assert.equal(staffOrderingOpen(hours, { day: 2, minute: 40 }, 60), false);
});

test('staff grace after a midnight close covers 00:30', () => {
  const hours = week(14 * 60, 24 * 60);
  assert.equal(staffOrderingOpen(hours, { day: 2, minute: 30 }, 60), true);
  assert.equal(staffOrderingOpen(hours, { day: 2, minute: 60 }, 60), false);
});
