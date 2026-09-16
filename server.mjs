import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';
const origins = new Set([`http://${host}:${port}`, `http://localhost:${port}`]);
const hosts = new Set([`${host}:${port}`, `localhost:${port}`]);
let active = 0;
const dev = process.argv.includes('--dev');
const vite = dev ? await (await import('vite')).createServer({ root, server: { middlewareMode: true }, appType: 'spa' }) : null;
const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};

export function runOptimization(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./src/optimizer-worker.mjs', import.meta.url), { workerData: data });
    const timer = setTimeout(() => finish(new Error('Optimization took too long. Try a smaller file.')), 15000);
    let done = false;
    function finish(error, value) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error); else resolve(value);
    }
    worker.once('message', msg => finish(msg.error ? new Error(msg.error) : null, msg.result));
    worker.once('error', err => finish(err));
    worker.once('exit', () => { if (!done) finish(new Error('The optimizer stopped. Try a smaller file.')); });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!hosts.has(req.headers.host)) return json(res, 403, { error: 'Local access only.' });
  if (req.headers.origin && !origins.has(req.headers.origin)) return json(res, 403, { error: 'Local access only.' });
  if (req.url === '/api/optimize') {
    if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Expected JSON.' });
    if (active >= 2) return json(res, 429, { error: 'The optimizer is busy. Try again shortly.' });
    active++;
    try {
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 7 * 1024 * 1024) { json(res, 413, { error: 'File is too large.' }); return; }
        chunks.push(chunk);
      }
      let data;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return json(res, 400, { error: 'Invalid JSON.' }); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return json(res, 400, { error: 'Invalid request.' });
      json(res, 200, await runOptimization(data));
    } catch (error) { if (!res.writableEnded) json(res, 400, { error: error.message }); }
    finally { active--; }
    return;
  }
  if (vite) return vite.middlewares(req, res);
  if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (pathname !== '/' && !/^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname)) return json(res, 404, { error: 'Not found.' });
    const file = path.join(root, 'dist', pathname === '/' ? 'index.html' : pathname.slice(1));
    const body = await readFile(file);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    res.writeHead(200);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { json(res, 404, { error: 'App not built. Run the build command first.' }); }
});
server.requestTimeout = 30000;
server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  console.log(`Source Code Optimizer is ready at ${url}`);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' }).on('error', () => console.log(`Open ${url} in your browser.`));
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
