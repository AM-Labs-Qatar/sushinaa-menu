import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ordersExportPaymentLabel,
  parseSplitCashMajor,
  paymentMethodFromTenders,
  sanitizeCashMajorInput,
  singleTender,
  tendersRequiredForCollect,
  validateTenders,
} from '../src/ordering/counter-tender';
import { OrderError } from '../src/ordering/errors';

test('tenders required only for unsettled counter orders', () => {
  assert.equal(tendersRequiredForCollect('counter', null), true);
  assert.equal(tendersRequiredForCollect('counter', '2026-01-01T00:00:00Z'), false);
  assert.equal(tendersRequiredForCollect('pay_at_pickup', null), false);
  assert.equal(tendersRequiredForCollect('cash', '2026-01-01T00:00:00Z'), false);
});

test('single cash or card equals total', () => {
  assert.deepEqual(singleTender('cash', 1500), [{ kind: 'cash', amountMinor: 1500 }]);
  assert.equal(paymentMethodFromTenders(singleTender('card', 1500)), 'card');
});

test('split cash+card must sum to total', () => {
  const lines = validateTenders([
    { kind: 'cash', amountMinor: 500 },
    { kind: 'card', amountMinor: 1000 },
  ], 1500);
  assert.equal(paymentMethodFromTenders(lines), 'split');
});

test('rejects bad tender shapes', () => {
  assert.throws(() => validateTenders([{ kind: 'cash', amountMinor: 100 }], 200), (e: unknown) => e instanceof OrderError && e.code === 'INVALID_TENDER');
  assert.throws(() => validateTenders([
    { kind: 'cash', amountMinor: 100 },
    { kind: 'cash', amountMinor: 100 },
  ], 200), (e: unknown) => e instanceof OrderError && e.code === 'INVALID_TENDER');
  assert.throws(() => validateTenders([], 100), (e: unknown) => e instanceof OrderError && e.code === 'INVALID_TENDER');
});

test('zero-due accepts empty tenders only', () => {
  assert.deepEqual(validateTenders([], 0), []);
  assert.equal(paymentMethodFromTenders([]), 'cash');
  assert.deepEqual(singleTender('card', 0), []);
  assert.throws(() => validateTenders([{ kind: 'cash', amountMinor: 1 }], 0), (e: unknown) => e instanceof OrderError && e.code === 'INVALID_TENDER');
});

test('export payment labels separate staff counter from pickup', () => {
  assert.equal(ordersExportPaymentLabel({ paidAt: null, paymentMethod: 'counter' }), 'Pay at counter');
  assert.equal(ordersExportPaymentLabel({ paidAt: null, paymentMethod: 'pay_at_pickup' }), 'Pay at pickup');
  assert.equal(ordersExportPaymentLabel({ paidAt: '2026-01-01T00:00:00Z', paymentMethod: 'split' }), 'Split');
  assert.equal(ordersExportPaymentLabel({ paidAt: '2026-01-01T00:00:00Z', paymentMethod: 'card' }), 'Card');
});

test('parseSplitCashMajor accepts a cash portion under the total', () => {
  assert.deepEqual(parseSplitCashMajor('50.00', 12600), { ok: true, cashMinor: 5000, cardMinor: 7600 });
  assert.deepEqual(parseSplitCashMajor('0.01', 12600), { ok: true, cashMinor: 1, cardMinor: 12599 });
});

test('parseSplitCashMajor rejects empty, junk, zero, and full total', () => {
  assert.deepEqual(parseSplitCashMajor('', 12600), { ok: false, reason: 'empty' });
  assert.deepEqual(parseSplitCashMajor('12.345', 12600), { ok: false, reason: 'invalid' });
  assert.deepEqual(parseSplitCashMajor('abc', 12600), { ok: false, reason: 'invalid' });
  assert.deepEqual(parseSplitCashMajor('0', 12600), { ok: false, reason: 'too_small' });
  assert.deepEqual(parseSplitCashMajor('126', 12600), { ok: false, reason: 'too_large' });
  assert.deepEqual(parseSplitCashMajor('200', 12600), { ok: false, reason: 'too_large' });
});

test('sanitizeCashMajorInput keeps digits and two decimals', () => {
  assert.equal(sanitizeCashMajorInput('12.345a'), '12.34');
  assert.equal(sanitizeCashMajorInput('1.2.3'), '1.23');
  assert.equal(sanitizeCashMajorInput('-50'), '50');
});
