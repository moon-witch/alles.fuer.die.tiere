import { desc, eq, inArray } from 'drizzle-orm';
import { getDatabase } from '$lib/server/db/client';
import { claimEvidence, claims, projects, sourceRuns, sourceSnapshots, sources } from '$lib/server/db/schema';

export const listSourceRegistry = () => getDatabase().select({
	id: sources.id,
	name: sources.name,
	owner: sources.owner,
	health: sources.health,
	lastSuccessfulAt: sources.lastSuccessfulAt,
	canonicalUrl: sources.canonicalUrl
}).from(sources).orderBy(sources.name).limit(100);

export const getSourceReview = async (sourceId: string) => {
	const database = getDatabase();
	const [source] = await database.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
	if (!source) return null;
	const [runs, evidence] = await Promise.all([
		database.select().from(sourceRuns).where(eq(sourceRuns.sourceId, sourceId)).orderBy(desc(sourceRuns.fetchedAt)).limit(30),
		database.select({
			claimId: claims.id,
			statement: claims.statement,
			visibility: claims.visibility,
			editorialStatus: claims.editorialStatus,
			projectName: projects.name,
			passage: claimEvidence.passage,
			observedAt: claimEvidence.observedAt,
			snapshotId: sourceSnapshots.id
		}).from(claimEvidence)
			.innerJoin(sourceSnapshots, eq(claimEvidence.sourceSnapshotId, sourceSnapshots.id))
			.innerJoin(sourceRuns, eq(sourceSnapshots.sourceRunId, sourceRuns.id))
			.innerJoin(claims, eq(claimEvidence.claimId, claims.id))
			.innerJoin(projects, eq(claims.projectId, projects.id))
			.where(eq(sourceRuns.sourceId, sourceId))
			.orderBy(desc(claimEvidence.observedAt)).limit(50)
	]);
	const runIds = runs.map((run) => run.id);
	const snapshots = runIds.length
		? await database.select({ id: sourceSnapshots.id, sourceRunId: sourceSnapshots.sourceRunId, bodySha256: sourceSnapshots.bodySha256, normalizedExtract: sourceSnapshots.normalizedExtract, normalizedSha256: sourceSnapshots.normalizedSha256, objectKey: sourceSnapshots.objectKey, retentionClass: sourceSnapshots.retentionClass }).from(sourceSnapshots).where(inArray(sourceSnapshots.sourceRunId, runIds))
		: [];
	return { source, runs, snapshots, evidence };
};
