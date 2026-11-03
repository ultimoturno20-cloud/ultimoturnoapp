import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { recoverLock, allowedNavigation } from './lifecycle.mjs';

test('recover a dead process lock without modifying drafts; keep live/invalid locks', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ut-desktop-lock-'));
  try {
    const lock = path.join(dir, 'running.lock'), state = path.join(dir, 'sessions.json');
    await writeFile(state, '{"sessions":[{"id":"synthetic"}]}');
    await recoverLock(dir);
    await writeFile(lock, '123');
    await assert.rejects(recoverLock(dir, () => true), /ya está abierto/);
    assert.equal(await readFile(lock, 'utf8'), '123');
    await recoverLock(dir, () => false);
    await assert.rejects(readFile(lock), { code: 'ENOENT' });
    assert.equal(await readFile(state, 'utf8'), '{"sessions":[{"id":"synthetic"}]}');
    await writeFile(lock, '-1');
    await assert.rejects(recoverLock(dir, () => false), /proceso válido/);
    assert.equal(await readFile(lock, 'utf8'), '-1');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('only local companion documents can navigate in the desktop window', () => {
  const origin = 'http://127.0.0.1:12345';
  assert.ok(allowedNavigation(origin + '/batches', origin));
  assert.ok(allowedNavigation(origin + '/', origin));
  for (const target of ['https://example.com/', 'file:///C:/test', 'javascript:alert(1)', origin + '/send', 'http://127.0.0.1:9999/']) assert.equal(allowedNavigation(target, origin), false);
});
