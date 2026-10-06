import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db/client';
import { claimEvidence, claims, projects, publications, sourceSnapshots } from '$lib/server/db/schema';
import { publishClaim } from '$lib/server/operations/publish-claim';

const requireSteward = (role: string | undefined) => { if (role !== 'steward') error(403, 'Nur für die technische Verwaltung.'); };
const field = (data: FormData, key: string) => String(data.get(key) ?? '').trim();

export const load = async ({ locals, params, url }) => {
	requireSteward(locals.user?.role);
	const database = getDatabase();
	const [record] = await database.select({ claim: claims, project: projects }).from(claims).innerJoin(projects, eq(claims.projectId, projects.id)).where(eq(claims.id, params.id)).limit(1);
	if (!record) error(404, 'Faktenentwurf nicht gefunden.');
	const [evidence, publication] = await Promise.all([
		database.select().from(claimEvidence).where(eq(claimEvidence.claimId, record.claim.id)),
		database.select({ currentRevisionId: publications.currentRevisionId }).from(publications).where(eq(publications.route, `/projekte/${record.project.slug}`)).limit(1)
	]);
	const snapshotIds = evidence.map((item) => item.sourceSnapshotId).filter((id): id is string => id !== null);
	const snapshots = snapshotIds.length ? await database.select({ id: sourceSnapshots.id, bodySha256: sourceSnapshots.bodySha256 }).from(sourceSnapshots).where(inArray(sourceSnapshots.id, snapshotIds)) : [];
	return { claim: record.claim, project: record.project, evidence, snapshots, expectedPublicationRevisionId: publication[0]?.currentRevisionId ?? null, publishKey: randomUUID(), published: url.searchParams.get('published') === '1' };
};

export const actions = {
	publish: async ({ request, locals, params }) => {
		requireSteward(locals.user?.role);
		const data = await request.formData();
		try {
			await publishClaim({ claimId: params.id, expectedClaimRevision: field(data, 'expectedClaimRevision'), expectedPublicationRevisionId: field(data, 'expectedPublicationRevisionId') || null, initiatingUserId: locals.user!.id, idempotencyKey: field(data, 'idempotencyKey') });
		} catch (cause) { return fail(400, { error: cause instanceof Error ? cause.message : 'Veröffentlichung fehlgeschlagen.' }); }
		redirect(303, `/admin/inhalte/${params.id}?published=1`);
	}
};
