import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { processNextJob, WorkerTickFailure } from '../src/lib/server/jobs/process';

const diagnosticCode = (cause: unknown): string => {
	let current = cause;
	for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
		const code = 'code' in current ? current.code : undefined;
		if (typeof code === 'string' && /^[A-Z0-9_]{2,30}$/.test(code)) return code;
		current = 'cause' in current ? current.cause : undefined;
	}
	return 'unclassified';
};

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
	} catch (cause) {
		console.error(JSON.stringify({ event: 'worker.error', workerId, errorCode: 'worker_tick_failed', stage: cause instanceof WorkerTickFailure ? cause.stage : 'process_job', diagnosticCode: diagnosticCode(cause) }));
	}
	await wait(60_000);
}
