import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildCookingPath,
  getResumableSessionId,
  shouldResumeCookingSession,
} from './useCookingSessionPersistence';

test('buildCookingPath stores session id in the cooking route query string', () => {
  assert.equal(buildCookingPath('cook_123'), '/cooking?sessionId=cook_123');
});

test('getResumableSessionId prefers the route query over stored session state', () => {
  assert.equal(getResumableSessionId('?sessionId=cook_from_url', 'cook_from_storage'), 'cook_from_url');
});

test('getResumableSessionId falls back to stored session state when query is empty', () => {
  assert.equal(getResumableSessionId('', 'cook_from_storage'), 'cook_from_storage');
});

test('shouldResumeCookingSession only resumes when a session id exists without route state', () => {
  assert.equal(shouldResumeCookingSession('cook_123', false), true);
  assert.equal(shouldResumeCookingSession('cook_123', true), false);
  assert.equal(shouldResumeCookingSession('', false), false);
});

test('vercel frontend config rewrites deep routes to the SPA entrypoint', async () => {
  const vercelConfigPath = path.resolve(process.cwd(), 'client/vercel.json');
  const rawConfig = await readFile(vercelConfigPath, 'utf8');
  const config = JSON.parse(rawConfig) as {
    rewrites?: Array<{ source: string; destination: string }>;
  };

  assert.deepEqual(config.rewrites, [
    {
      source: '/(.*)',
      destination: '/index.html',
    },
  ]);
});
