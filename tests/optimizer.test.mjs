import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { optimize } from '../src/optimizer.mjs';

test('JavaScript keeps public names and observable results while shrinking', async () => {
  const source = '// ordinary comment\nfunction calculateTotal(price, count) { const total = price * count; return total; }\nglobalThis.answer = calculateTotal(7, 6);';
  const r = await optimize({ source, language: 'js' });
  const context = {};
  vm.runInNewContext(r.code, context, { timeout: 1000 });
  assert.equal(context.answer, 42);
  assert.equal(context.calculateTotal.name, 'calculateTotal');
  assert.ok(r.outputBytes < r.inputBytes);
  assert.equal(r.savedBytes, r.inputBytes - r.outputBytes);
});
test('JavaScript preserves strings, regexes, templates and function arity', async () => {
  const source = 'function read(value, unused) { return /a b/.test(value) ? `two  spaces` : "x // y"; } globalThis.answer = [read("a b"), read("c"), read.length];';
  const r = await optimize({ source, language: 'js' });
  const context = {};
  vm.runInNewContext(r.code, context, { timeout: 1000 });
  assert.equal(JSON.stringify(context.answer), '["two  spaces","x // y",2]');
});
test('module exports stay valid', async () => {
  const r = await optimize({ source: 'export const answer = 42;\nexport default function greet(name) { return "Hello " + name; }', language: 'js' });
  assert.match(r.code, /export/);
  assert.match(r.checks.join(' '), /syntax/i);
});
test('CSS preserves content and custom properties and never fetches imports', async () => {
  const source = '@import url("https://example.invalid/do-not-fetch.css");\n/* comment */\n.x { --gap: 10px; margin: 0px; content: "two  spaces"; width: calc(100% - var(--gap)); }';
  const r = await optimize({ source, language: 'css' });
  assert.match(r.code, /two  spaces/);
  assert.match(r.code, /example.invalid/);
  assert.match(r.code, /--gap/);
  assert.ok(r.outputBytes < r.inputBytes);
});
test('HTML preserves significant text whitespace and preformatted content by default', async () => {
  const source = '<!-- remove me -->\n<div style="white-space: pre-wrap">a   b\n c</div><p>Hello <span>world</span> !</p><pre> x  y\n z</pre><script>const message = "a  b";</script>';
  const r = await optimize({ source, language: 'html' });
  assert.match(r.code, /a   b\n c/);
  assert.match(r.code, /Hello <span>world<\/span> !/);
  assert.match(r.code, /<pre> x  y\n z<\/pre>/);
  assert.match(r.code, /const message = "a  b";/);
  assert.doesNotMatch(r.code, /remove me/);
});
test('explicit HTML whitespace collapse keeps separation between inline words', async () => {
  const r = await optimize({ source: '<p>Hello    <span>world</span>   !</p>', language: 'html', collapseWhitespace: true });
  assert.match(r.code, /Hello <span>world<\/span> !/);
});
for (const [language, source] of [['js', '/*! License MIT */\nconst answer = 42;'], ['css', '/*! License MIT */\n.x { color: red; }'], ['html', '<!--! License MIT -->\n<p>Hi</p>']]) {
  test(`${language} keeps license comments by default and supports removal`, async () => {
    assert.match((await optimize({ source, language })).code, /License MIT/);
    assert.doesNotMatch((await optimize({ source, language, preserveLicense: false })).code, /License MIT/);
  });
}
test('rejects invalid JavaScript and CSS, empty and unsupported input', async () => {
  await assert.rejects(optimize({ source: 'function {', language: 'js' }));
  await assert.rejects(optimize({ source: '.x { color: red;', language: 'css' }));
  await assert.rejects(optimize({ source: '   ', language: 'js' }));
  await assert.rejects(optimize({ source: 'hello', language: 'python' }));
  await assert.rejects(optimize({ source: 'x'.repeat(1048577), language: 'js' }));
});
test('reports UTF-8 byte sizes and never exports a larger candidate', async () => {
  const source = 'globalThis.text="😀";';
  const r = await optimize({ source, language: 'js' });
  assert.equal(r.inputBytes, Buffer.byteLength(source));
  assert.equal(r.outputBytes, Buffer.byteLength(r.code));
  assert.ok(r.outputBytes <= r.inputBytes);
});
