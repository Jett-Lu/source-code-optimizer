import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('local HTTP API optimizes code, rejects bad inputs, and does not expose source files', async t => {
  const port = 4287;
  const process = spawn(globalThis.process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...globalThis.process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => process.kill());
  await Promise.race([
    once(process.stdout, 'data'),
    once(process, 'exit').then(([code]) => { throw new Error(`Server exited: ${code}`); }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Server startup timeout')), 5000); timer.unref(); }),
  ]);
  const url = `http://127.0.0.1:${port}`;
  const post = (body, headers = {}) => fetch(url + '/api/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const response = await post({ source: 'function sum(a, b) { return a + b; }', language: 'js' });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).savedBytes > 0);
  assert.equal((await post({ source: 'function {', language: 'js' })).status, 400);
  assert.equal((await post(null)).status, 400);
  assert.equal((await post({ source: 'x', language: 'js' }, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await fetch(url + '/server.mjs')).status, 404);
  assert.equal((await fetch(url + '/api/optimize')).status, 405);
});
