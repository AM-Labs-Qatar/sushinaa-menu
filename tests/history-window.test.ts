import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORY_DISPLAY_DAYS,
  clampHistoryFrom,
  historyEarliestDate,
  historyLatestDate,
  historyRangeAllowed,
} from '../src/ordering/history-window';

test('history window is 31 inclusive days ending today', () => {
  const now = new Date('2026-11-26T12:00:00+03:00');
  assert.equal(HISTORY_DISPLAY_DAYS, 31);
  assert.equal(historyLatestDate(now), '2026-11-26');
  assert.equal(historyEarliestDate(now), '2026-10-27');
});

test('clampHistoryFrom never opens before the window', () => {
  const now = new Date('2026-11-26T12:00:00+03:00');
  assert.equal(clampHistoryFrom(undefined, now), '2026-10-27');
  assert.equal(clampHistoryFrom('2026-01-01', now), '2026-10-27');
  assert.equal(clampHistoryFrom('2026-11-01', now), '2026-11-01');
});

test('historyRangeAllowed rejects ranges outside the window', () => {
  const now = new Date('2026-11-26T12:00:00+03:00');
  assert.equal(historyRangeAllowed('2026-10-27', '2026-11-26', now), true);
  assert.equal(historyRangeAllowed('2026-10-26', '2026-11-26', now), false);
  assert.equal(historyRangeAllowed('2026-11-20', '2026-11-10', now), false);
});
