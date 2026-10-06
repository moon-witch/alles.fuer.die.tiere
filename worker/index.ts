import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { processNextJob } from '../src/lib/server/jobs/process';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the worker.');
const workerId = `${hostname().slice(0, 60)}-${randomUUID()}`;
const shutdown = new AbortController();
process.once('SIGTERM', () => shutdown.abort());
process.once('SIGINT', () => shutdown.abort());
console.log(JSON.stringify({ event: 'worker.started', workerId }));

const wait = (ms: number) => new Promise<void>((resolve) => {
	if (shutdown.signal.aborted) return resolve();
	const done = () => { clearTimeout(timer); shutdown.signal.removeEventListener('abort', done); resolve(); };
	const timer = setTimeout(done, ms);
	shutdown.signal.addEventListener('abort', done, { once: true });
});

while (!shutdown.signal.aborted) {
	const started = Date.now();
	try {
		const result = await processNextJob(workerId);
		if (result) {
			console.log(JSON.stringify({ event: 'job.finished', workerId, ...result, durationMs: Date.now() - started }));
			continue;
		}
	} catch {
		console.error(JSON.stringify({ event: 'worker.error', workerId, errorCode: 'worker_tick_failed' }));
	}
	await wait(60_000);
}
