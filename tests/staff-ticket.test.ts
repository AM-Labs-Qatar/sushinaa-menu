import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ticketModel } from '../src/ordering/ticket';
import type { DbRow } from '../src/cms/sql';

function staffRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    id: 'SU-staff-1',
    snapshot: JSON.stringify({
      version: 2,
      branchName: 'West Bay',
      lines: [{ name: 'Shrimp kunafa', nameAr: 'روبيان كنافة', quantity: 1, totalMinor: 3500, categoryName: 'Mains', categoryOrder: 1 }],
      totalMinor: 3500,
      customer: { brand: '' },
    }),
    order_number: 1,
    created_at: '2026-11-26T12:00:00.000Z',
    total_minor: 3500,
    payment_method: 'counter',
    paid_at: null,
    print_count: 0,
    printed_at: null,
    customer_name: '',
    customer_phone: '',
    car_plate: '12345',
    car_colour: '',
    car_model: '',
    instructions: '',
    order_surface: 'staff',
    amended_at: null,
    ...overrides,
  } as DbRow;
}

test('staff ticket omits removed guest and website channel', () => {
  const model = ticketModel(staffRow());
  assert.equal(model.customer, '');
  assert.equal(model.phone, '');
  assert.equal(model.channel, '');
  assert.equal(model.fulfilment, 'STAFF POS');
  assert.equal(model.car, '12345');
  assert.equal(model.brand, '');
});

test('purged pickup ticket still prints removed', () => {
  const model = ticketModel(staffRow({
    order_surface: 'pickup',
    customer_name: null,
    customer_phone: null,
    car_plate: 'Q1',
  }));
  assert.equal(model.customer, 'removed');
  assert.equal(model.channel, 'Website order');
  assert.equal(model.fulfilment, 'CAR PICKUP');
});
