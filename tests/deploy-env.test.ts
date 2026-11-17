import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_DATABASE_HOST,
  databaseHost,
  showAmLabsCredit,
  touchesLiveDatabaseHost,
} from '../src/lib/deploy-env';

test('databaseHost strips trailing dots and ignores file urls', () => {
  assert.equal(databaseHost(`libsql://${LIVE_DATABASE_HOST}.`), LIVE_DATABASE_HOST);
  assert.equal(databaseHost(`libsql://${LIVE_DATABASE_HOST}%2e`), LIVE_DATABASE_HOST);
  assert.equal(databaseHost('file:./data/menu.db'), null);
});

test('touchesLiveDatabaseHost catches host aliases libsql still dials', () => {
  const withUserinfo = ['libsql://', 'evil.test', String.fromCharCode(64), LIVE_DATABASE_HOST].join('');
  const withBackslashUserinfo = ['libsql://', 'evil.test', '\\', String.fromCharCode(64), LIVE_DATABASE_HOST].join('');
  assert.equal(touchesLiveDatabaseHost(`libsql://${LIVE_DATABASE_HOST}`), true);
  assert.equal(touchesLiveDatabaseHost(`libsql://${LIVE_DATABASE_HOST}.`), true);
  assert.equal(touchesLiveDatabaseHost(withBackslashUserinfo), true);
  assert.equal(touchesLiveDatabaseHost(withUserinfo), true);
  assert.equal(touchesLiveDatabaseHost('libsql://sushinaa-cms-dev-example.turso.io'), false);
  assert.equal(touchesLiveDatabaseHost('file:./data/menu.db'), false);
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
