import { and, desc, eq } from 'drizzle-orm';
import { getDatabase } from '$lib/server/db/client';
import { sourceRuns, sources } from '$lib/server/db/schema';
import { MA_FOREST_ADAPTER_VERSION, MA_FOREST_PAGE_URL } from '$lib/server/ingestion/ma-forest';
import { enqueueJob } from './queue';

const sixHoursMs = 6 * 60 * 60 * 1000;
const retryMs = 15 * 60 * 1000;

/** The worker checks once per minute, but only enqueues one due poll per source run. */
export const scheduleMaForestPoll = async (now = new Date()): Promise<string | null> => {
	if (process.env.MA_FOREST_POLL_ENABLED !== 'true') return null;
	const database = getDatabase();
	const [source] = await database.select({ id: sources.id, health: sources.health, adapterKey: sources.adapterKey }).from(sources).where(eq(sources.canonicalUrl, MA_FOREST_PAGE_URL)).limit(1);
	if (source && (source.health === 'paused' || (source.adapterKey && source.adapterKey !== 'wilderness-ma-counter'))) return null;
	const runs = source ? await database.select({ id: sourceRuns.id, outcome: sourceRuns.outcome, fetchedAt: sourceRuns.fetchedAt }).from(sourceRuns).where(and(eq(sourceRuns.sourceId, source.id), eq(sourceRuns.extractorVersion, MA_FOREST_ADAPTER_VERSION))).orderBy(desc(sourceRuns.fetchedAt)).limit(2) : [];
	const last = runs[0];
	const retryAfter = last?.outcome === 'failed' && runs[1]?.outcome !== 'failed' ? retryMs : sixHoursMs;
	if (last && now.getTime() - last.fetchedAt.getTime() < retryAfter) return null;
	const occurrence = last?.id ?? `initial-${Math.floor(now.getTime() / sixHoursMs)}`;
	const job = await enqueueJob({ kind: 'source.poll.ma_forest', dedupeKey: `source.poll.ma_forest:${occurrence}`, payload: { sourceId: source?.id ?? null }, maxAttempts: 1 });
	return job.created ? job.id : null;
};
