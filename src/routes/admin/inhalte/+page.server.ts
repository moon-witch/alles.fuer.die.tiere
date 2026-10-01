import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import { validPublicUrl } from '$lib/domain/action-policy';
import { getDatabase } from '$lib/server/db/client';
import { claims, projects } from '$lib/server/db/schema';
import { createClaimDraft } from '$lib/server/operations/create-claim-draft';
import { createProjectDraft } from '$lib/server/operations/create-project-draft';

const requireSteward = (role: string | undefined) => { if (role !== 'steward') error(403, 'Nur für die technische Verwaltung.'); };
const field = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const kinds = ['milestone', 'status', 'outcome', 'context'] as const;

export const load = async ({ locals, url }) => {
	requireSteward(locals.user?.role);
	const database = getDatabase();
	const [projectRows, draftRows] = await Promise.all([
		database.select({ id: projects.id, name: projects.name, slug: projects.slug, visibility: projects.visibility }).from(projects).orderBy(projects.name),
		database.select({ id: claims.id, statement: claims.statement, projectName: projects.name, createdAt: claims.createdAt }).from(claims).innerJoin(projects, eq(claims.projectId, projects.id)).where(eq(claims.editorialStatus, 'draft')).orderBy(desc(claims.createdAt)).limit(30)
	]);
	return { projects: projectRows, drafts: draftRows, kinds, projectKey: randomUUID(), claimKey: randomUUID(), created: url.searchParams.get('created') === '1' };
};

export const actions = {
	createProject: async ({ request, locals }) => {
		requireSteward(locals.user?.role);
		const data = await request.formData();
		try {
			await createProjectDraft({ name: field(data, 'name'), slug: field(data, 'slug'), initiatingUserId: locals.user!.id, idempotencyKey: field(data, 'idempotencyKey') });
		} catch (cause) { return fail(400, { error: cause instanceof Error ? cause.message : 'Projekt konnte nicht angelegt werden.' }); }
		redirect(303, '/admin/inhalte?created=1');
	},
	createClaim: async ({ request, locals }) => {
		requireSteward(locals.user?.role);
		const data = await request.formData();
		const kind = field(data, 'kind');
		const sourceUrl = field(data, 'sourceUrl');
		const date = field(data, 'occurredAt');
		if (!kinds.includes(kind as (typeof kinds)[number]) || !validPublicUrl(sourceUrl) || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return fail(400, { error: 'Art, Datum oder HTTPS-Quelle ist ungültig.' });
		let claimId: string;
		try {
			const result = await createClaimDraft({ projectId: field(data, 'projectId'), kind: kind as (typeof kinds)[number], statement: field(data, 'statement'), sourceUrl, passage: field(data, 'passage'), occursAt: date ? new Date(`${date}T12:00:00Z`) : undefined, observedAt: new Date(), initiatingUserId: locals.user!.id, idempotencyKey: field(data, 'idempotencyKey') });
			claimId = result.claimId;
		} catch (cause) {
			return fail(400, { error: cause instanceof Error ? cause.message : 'Faktenentwurf konnte nicht angelegt werden.' });
		}
		redirect(303, `/admin/inhalte/${claimId}`);
	}
};
