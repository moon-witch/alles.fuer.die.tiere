import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, operations, projects } from '$lib/server/db/schema';

export const createProjectDraft = async (input: { name: string; slug: string; initiatingUserId: string; idempotencyKey: string }) => {
	const name = input.name.trim();
	const slug = input.slug.trim().toLowerCase();
	if (!name || name.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) throw new Error('Projektname oder Slug ist ungültig.');
	if (!input.idempotencyKey || input.idempotencyKey.length > 128) throw new Error('Ungültige Anfragekennung.');
	const hash = createHash('sha256').update(JSON.stringify({ name, slug })).digest('hex');
	return getDatabase().transaction(async (tx) => {
		const operationId = createId();
		const correlationId = createId();
		const inserted = await tx.insert(operations).values({ id: operationId, status: 'proposed', type: 'project.draft', origin: 'admin', initiatingUserId: input.initiatingUserId, idempotencyKey: input.idempotencyKey, requestHash: hash, input: { name, slug }, correlationId }).onConflictDoNothing().returning({ id: operations.id });
		if (!inserted.length) {
			const [existing] = await tx.select().from(operations).where(eq(operations.idempotencyKey, input.idempotencyKey)).limit(1);
			const projectId = (existing?.entityDiff as { projectId?: string } | null)?.projectId;
			if (!existing || existing.requestHash !== hash || existing.status !== 'applied' || !projectId) throw new Error('Diese Anfragekennung wurde bereits anders verwendet.');
			return { projectId, reused: true };
		}
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.proposed', origin: 'admin', severity: 'info', summary: 'Projektentwurf wurde vorbereitet.', correlationId, payload: { slug } });
		const projectId = createId();
		await tx.insert(projects).values({ id: projectId, slug, name, summary: 'Diese Projektseite sammelt belegte Informationen.', status: 'active', visibility: 'private', contentOwnerId: input.initiatingUserId });
		await tx.update(operations).set({ status: 'applied', entityDiff: { projectId, visibility: 'private' }, updatedAt: new Date() }).where(eq(operations.id, operationId));
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.applied', origin: 'admin', severity: 'info', summary: 'Privater Projektentwurf wurde gespeichert.', correlationId, payload: { projectId, publicEffect: 'none' } });
		return { projectId, reused: false };
	});
};
