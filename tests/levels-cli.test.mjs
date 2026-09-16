import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { optimize } from '../src/optimizer.mjs';

test('conservative keeps local names; stronger levels preserve fixture behavior', async () => {
  const source = 'function total(price) { const longLocalVariable = price * 2; if (false) { console.log("dead"); } return longLocalVariable; }';
  const conservative = await optimize({ source, language: 'js', level: 'conservative' });
  assert.match(conservative.code, /longLocalVariable/);
  for (const level of ['conservative', 'balanced', 'aggressive']) {
    const result = await optimize({ source, language: 'js', level });
    assert.equal(vm.runInNewContext(result.code + '; total(21)', {}, { timeout: 1000 }), 42);
    assert.equal(result.level, level);
  }
});
test('levels reject unsupported values and HTML aggressive keeps whitespace opt-in', async () => {
  await assert.rejects(optimize({ source: 'let x = 1;', language: 'js', level: 'turbo' }), /level/i);
  const r = await optimize({ source: '<!-- ordinary --><div class="sample">a   b</div>', language: 'html', level: 'aggressive' });
  assert.match(r.code, /a   b/);
  assert.match(r.code, /class=sample/);
});
test('CSS conservative keeps long color while aggressive merges duplicate rules', async () => {
  const source = '.a { color: #ffffff; } .a { color: #ffffff; }';
  const conservative = await optimize({ source, language: 'css', level: 'conservative' });
  const aggressive = await optimize({ source, language: 'css', level: 'aggressive' });
  assert.match(conservative.code, /#ffffff/);
  assert.ok(aggressive.outputBytes < conservative.outputBytes);
});
test('CLI writes optimized copy, protects original/existing outputs, and reports errors', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'source-code-optimizer-test-'));
  const input = path.join(dir, 'test.js');
  const original = 'function double(value) { return value * 2; }';
  await writeFile(input, original);
  const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
  const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 20000 });
  const first = run([input, '--level', 'aggressive']);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /saved/i);
  const output = path.join(dir, 'test.min.js');
  assert.equal(vm.runInNewContext((await readFile(output, 'utf8')) + '; double(21)'), 42);
  assert.equal(await readFile(input, 'utf8'), original);
  assert.notEqual(run([input]).status, 0);
  assert.notEqual(run([input, '--output', input, '--force']).status, 0);
  assert.notEqual(run([input, '--level', 'turbo']).status, 0);
  assert.notEqual(run([input, '--unknown']).status, 0);
  assert.equal(run(['--help']).status, 0);
  const broken = path.join(dir, 'bad.js');
  await writeFile(broken, 'function {');
  assert.notEqual(run([broken]).status, 0);
});
