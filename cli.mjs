#!/usr/bin/env node
import { readFile, writeFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { Worker } from 'node:worker_threads';

const help = `Source Code Optimizer — local JavaScript, HTML and CSS minifier

Usage: node cli.mjs <file> [options]
       source-code-optimizer <file> [options]  (after npm link)

  --level <name>          conservative | balanced | aggressive (default: balanced)
  --output <path>, -o     Output path (default: file.min.ext)
  --force                Replace an existing output; never the input file
  --remove-license-comments
  --collapse-whitespace  Opt in to HTML text whitespace collapse
  --help, -h             Show this help

One UTF-8 file up to 1 MiB. 15-second processing limit. No source code is executed.
Aggressive may change internal function names or CSS rule structure. Test your output.
`;

function run(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./src/optimizer-worker.mjs', import.meta.url), { workerData: data });
    let done = false;
    const timer = setTimeout(() => finish(new Error('Optimization exceeded 15 seconds.')), 15000);
    function finish(error, result) {
      if (done) return;
      done = true; clearTimeout(timer); void worker.terminate();
      if (error) reject(error); else resolve(result);
    }
    worker.once('message', msg => finish(msg.error ? new Error(msg.error) : null, msg.result));
    worker.once('error', finish);
    worker.once('exit', () => { if (!done) finish(new Error('Optimizer stopped unexpectedly.')); });
  });
}

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    level: { type: 'string', default: 'balanced' }, output: { type: 'string', short: 'o' },
    force: { type: 'boolean' }, 'remove-license-comments': { type: 'boolean' },
    'collapse-whitespace': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) { console.log(help); }
  else {
    if (positionals.length !== 1) throw new Error('Provide exactly one input file. Use --help for usage.');
    const input = path.resolve(positionals[0]);
    const ext = path.extname(input).toLowerCase();
    const language = ({ '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.html': 'html', '.htm': 'html', '.css': 'css' })[ext];
    if (!language) throw new Error('Unsupported extension. Use JavaScript, HTML, or CSS.');
    const info = await stat(input);
    if (!info.isFile() || info.size > 1048576) throw new Error('Choose a file up to 1 MiB.');
    const output = path.resolve(values.output || input.slice(0, -ext.length) + '.min' + ext);
    if (input.toLowerCase() === output.toLowerCase()) throw new Error('Output must be different from the input file.');
    try {
      const existing = await stat(output);
      if ((existing.ino === info.ino && existing.dev === info.dev) || await realpath(output) === await realpath(input)) throw new Error('Output points to the input file.');
      if (!values.force) throw new Error('Output already exists. Choose another path or use --force.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const source = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(input));
    const result = await run({ source, language, level: values.level,
      preserveLicense: !values['remove-license-comments'], collapseWhitespace: Boolean(values['collapse-whitespace']) });
    await writeFile(output, result.code, { encoding: 'utf8', flag: values.force ? 'w' : 'wx' });
    console.log(`${output}\n${result.inputBytes} B -> ${result.outputBytes} B | ${result.savedPercent.toFixed(1)}% saved | ${result.level}`);
  }
} catch (error) { console.error(`Source Code Optimizer: ${error.message}`); process.exitCode = 1; }
