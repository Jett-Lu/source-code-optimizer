import { parentPort, workerData } from 'node:worker_threads';
import { optimize } from './optimizer.mjs';
try { parentPort.postMessage({ result: await optimize(workerData) }); }
catch (error) { parentPort.postMessage({ error: error.message }); }
