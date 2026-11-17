import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_DATABASE_HOST,
  databaseHost,
  showAmLabsCredit,
  touchesLiveDatabaseHost,
} from '../src/lib/deploy-env';
import { orderDatabaseAllowed } from '../src/ordering/guard';

test('databaseHost strips trailing dots and ignores file urls', () => {
  assert.equal(databaseHost(`libsql://${LIVE_DATABASE_HOST}.`), LIVE_DATABASE_HOST);
  assert.equal(databaseHost(`libsql://${LIVE_DATABASE_HOST}%2e`), LIVE_DATABASE_HOST);
  assert.equal(databaseHost('file:./data/menu.db'), null);
});

test('orderDatabaseAllowed refuses live host aliases libsql still dials', () => {
  const previous = process.env.ORDERING_LIVE_ENABLED;
  delete process.env.ORDERING_LIVE_ENABLED;
  try {
    const withUserinfo = ['libsql://', 'evil.test', String.fromCharCode(64), LIVE_DATABASE_HOST].join('');
    const withBackslashUserinfo = ['libsql://', 'evil.test', '\\', String.fromCharCode(64), LIVE_DATABASE_HOST].join('');
    assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}`), false);
    assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}.`), false);
    assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}%2e`), false);
    assert.equal(orderDatabaseAllowed(withBackslashUserinfo), false);
    assert.equal(orderDatabaseAllowed(withUserinfo), false);
    assert.equal(orderDatabaseAllowed('libsql://sushinaa-cms-dev-example.turso.io'), true);
    assert.equal(orderDatabaseAllowed('file:./data/menu.db'), true);
    assert.equal(touchesLiveDatabaseHost(withBackslashUserinfo), true);
    assert.equal(touchesLiveDatabaseHost('libsql://sushinaa-cms-dev-example.turso.io'), false);
  } finally {
    if (previous === undefined) delete process.env.ORDERING_LIVE_ENABLED;
    else process.env.ORDERING_LIVE_ENABLED = previous;
  }
});

test('showAmLabsCredit is always on', () => {
  const previousCms = process.env.CMS_DATABASE_URL;
  const previousTurso = process.env.TURSO_DATABASE_URL;
  try {
    delete process.env.CMS_DATABASE_URL;
    delete process.env.TURSO_DATABASE_URL;
    assert.equal(showAmLabsCredit(), true);

    process.env.CMS_DATABASE_URL = `libsql://${LIVE_DATABASE_HOST}`;
    assert.equal(showAmLabsCredit(), true);
  } finally {
    if (previousCms === undefined) delete process.env.CMS_DATABASE_URL;
    else process.env.CMS_DATABASE_URL = previousCms;
    if (previousTurso === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previousTurso;
  }
});

test('orderDatabaseAllowed allows live only when ORDERING_LIVE_ENABLED=1', () => {
  const previous = process.env.ORDERING_LIVE_ENABLED;
  try {
    process.env.ORDERING_LIVE_ENABLED = '1';
    assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}`), true);
    process.env.ORDERING_LIVE_ENABLED = 'true';
    assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}`), false);
    delete process.env.ORDERING_LIVE_ENABLED;
    assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}`), false);
  } finally {
    if (previous === undefined) delete process.env.ORDERING_LIVE_ENABLED;
    else process.env.ORDERING_LIVE_ENABLED = previous;
  }
});
