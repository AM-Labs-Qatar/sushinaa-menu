import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ORDERING_MODES,
  enabledOrderingModes,
  hasOrderingMode,
  normalizeOrderingModes,
  withOrderingMode,
} from '../src/branches/ordering-modes';
import { branchSettingsSchema, defaultBranchSettings } from '../src/branches/schema';

test('defaults to pickup only', () => {
  assert.deepEqual(normalizeOrderingModes(undefined), [...DEFAULT_ORDERING_MODES]);
  assert.deepEqual(enabledOrderingModes({}), [...DEFAULT_ORDERING_MODES]);
  assert.equal(hasOrderingMode({ orderingModes: ['pickup'] }, 'pickup'), true);
  assert.equal(hasOrderingMode({ orderingModes: ['pickup'] }, 'staff'), false);
});

test('withOrderingMode adds and removes without duplicates', () => {
  assert.deepEqual(withOrderingMode(['pickup'], 'staff', true), ['pickup', 'staff']);
  assert.deepEqual(withOrderingMode(['pickup', 'staff'], 'pickup', false), ['staff']);
  assert.deepEqual(withOrderingMode(['pickup', 'staff'], 'staff', true), ['pickup', 'staff']);
});

test('branch schema defaults orderingModes and rejects duplicates', () => {
  const sample = defaultBranchSettings()[0]!;
  const parsed = branchSettingsSchema.parse({
    slug: sample.slug,
    name: sample.name,
    nameAr: sample.nameAr,
    phone: sample.phone,
    hours: sample.hours,
  });
  assert.deepEqual(parsed.orderingModes, ['pickup']);
  assert.equal(branchSettingsSchema.safeParse({
    ...parsed,
    orderingModes: ['pickup', 'pickup'],
  }).success, false);
});
