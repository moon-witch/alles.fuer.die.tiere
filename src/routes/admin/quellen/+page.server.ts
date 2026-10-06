import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db/client';
import { projects, sourceRuns, sources } from '$lib/server/db/schema';
import { rawSnapshotStorageConfigured } from '$lib/server/ingestion/raw-snapshots';
import { observeSource, type SourceObservationInput } from '$lib/server/operations/observe-source';

const field = (data: FormData, key: string) => String(data.get(key) ?? '').trim();

export const load = async ({ locals }) => {
	if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
	const database = getDatabase();
	const [projectRows, recent] = await Promise.all([
		database.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.lifecycleState, 'active')).orderBy(projects.name),
		database.select({ name: sources.name, url: sources.canonicalUrl, outcome: sourceRuns.outcome, statusCode: sourceRuns.statusCode, fetchedAt: sourceRuns.fetchedAt }).from(sourceRuns).innerJoin(sources, eq(sourceRuns.sourceId, sources.id)).orderBy(desc(sourceRuns.fetchedAt)).limit(20)
	]);
	return { projects: projectRows, recent, storageReady: rawSnapshotStorageConfigured(), observationKey: randomUUID() };
};

export const actions = {
	observe: async ({ request, locals }) => {
		if (locals.user?.role !== 'steward') error(403, 'Nur für die technische Verwaltung.');
		const data = await request.formData();
		const sourcePublishedDate = field(data, 'sourcePublishedAt');
		if (sourcePublishedDate && !/^\d{4}-\d{2}-\d{2}$/.test(sourcePublishedDate)) return fail(400, { error: 'Das Quelldatum ist ungültig.' });
		let claimId: string;
		try {
			const result = await observeSource({
				projectId: field(data, 'projectId'), name: field(data, 'name'), owner: field(data, 'owner'),
				sourceType: field(data, 'sourceType') as SourceObservationInput['sourceType'],
				authority: field(data, 'authority') as SourceObservationInput['authority'],
				url: field(data, 'url'), kind: field(data, 'kind') as SourceObservationInput['kind'],
				statement: field(data, 'statement'), passage: field(data, 'passage'),
				sourcePublishedAt: sourcePublishedDate ? new Date(`${sourcePublishedDate}T12:00:00Z`) : undefined,
				rightsNote: field(data, 'rightsNote'), sensitivity: field(data, 'sensitivity') as SourceObservationInput['sensitivity'],
				initiatingUserId: locals.user!.id, idempotencyKey: field(data, 'idempotencyKey')
			});
			claimId = result.claimId;
		} catch (cause) {
			return fail(400, { error: cause instanceof Error ? cause.message : 'Quelle konnte nicht erfasst werden.' });
		}
		redirect(303, `/admin/inhalte/${claimId}`);
	}
};
