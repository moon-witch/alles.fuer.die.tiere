import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { parseProjectPublication, type ProjectPublication } from '$lib/domain/project-publication';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, attentionItems, claims, jobs, operations, projects, publicationRevisions, publications } from '$lib/server/db/schema';

type ClaimDiff = { route?: string; before?: string | null; revisionId?: string };
const readDiff = (value: unknown): { route: string; before: string | null; revisionId: string } | null => {
	if (!value || typeof value !== 'object') return null;
	const diff = value as ClaimDiff;
	return typeof diff.route === 'string' && /^\/projekte\/[a-z0-9-]+$/.test(diff.route) && (diff.before === null || typeof diff.before === 'string') && typeof diff.revisionId === 'string'
		? { route: diff.route, before: diff.before, revisionId: diff.revisionId }
		: null;
};
const readClaimId = (value: unknown): string | null => value && typeof value === 'object' && typeof (value as { claimId?: unknown }).claimId === 'string' ? (value as { claimId: string }).claimId : null;

export const getClaimRevertPreview = async (targetOperationId: string) => {
	const database = getDatabase();
	const [target] = await database.select().from(operations).where(eq(operations.id, targetOperationId)).limit(1);
	if (!target || target.type !== 'claim.publish') return null;
	const diff = readDiff(target.publicationDiff);
	const claimId = readClaimId(target.entityDiff);
	if (!diff || !claimId) return null;
	const [[claim], [publication], [prior]] = await Promise.all([
		database.select().from(claims).where(eq(claims.id, claimId)).limit(1),
		database.select().from(publications).where(eq(publications.route, diff.route)).limit(1),
		diff.before ? database.select().from(publicationRevisions).where(eq(publicationRevisions.id, diff.before)).limit(1) : Promise.resolve([])
	]);
	const priorPayload = diff.before ? parseProjectPublication(prior?.payload) : null;
	let reason: string | null = null;
	if (target.status !== 'applied') reason = 'Diese Veröffentlichung wurde bereits rückgängig gemacht oder ist nicht mehr aktiv.';
	else if (publication?.currentRevisionId !== diff.revisionId) reason = 'Es gibt eine neuere Projektveröffentlichung. Prüfe sie und erstelle eine gezielte Korrektur.';
	else if (!claim || claim.visibility !== 'public' || claim.editorialStatus !== 'published' || claim.revision !== '2') reason = 'Der veröffentlichte Fakt wurde inzwischen geändert.';
	else if (diff.before && (!prior || prior.publicationId !== publication.id || !priorPayload || diff.route !== `/projekte/${priorPayload.slug}` || priorPayload.claims.some((item) => item.id === claimId))) reason = 'Die vorherige Projektseite kann nicht sicher wiederhergestellt werden.';
	return { targetOperationId, route: diff.route, claimStatement: claim?.statement ?? '', expectedRevisionId: diff.revisionId, beforeRevisionId: diff.before, remainingClaims: priorPayload?.claims.length ?? 0, reason };
};

export const revertClaimPublication = async (input: { targetOperationId: string; expectedRevisionId: string; initiatingUserId: string; idempotencyKey: string }) => {
	if (!input.idempotencyKey || input.idempotencyKey.length > 128) throw new Error('Ungültige Anfragekennung.');
	const requestHash = createHash('sha256').update(JSON.stringify({ targetOperationId: input.targetOperationId, expectedRevisionId: input.expectedRevisionId })).digest('hex');
	return getDatabase().transaction(async (tx) => {
		const operationId = createId();
		const correlationId = createId();
		const inserted = await tx.insert(operations).values({ id: operationId, type: 'claim.revert', status: 'proposed', origin: 'admin', initiatingUserId: input.initiatingUserId, idempotencyKey: input.idempotencyKey, requestHash, input: { targetOperationId: input.targetOperationId, expectedRevisionId: input.expectedRevisionId }, correlationId }).onConflictDoNothing().returning({ id: operations.id });
		if (!inserted.length) {
			const [existing] = await tx.select().from(operations).where(eq(operations.idempotencyKey, input.idempotencyKey)).limit(1);
			if (!existing || existing.requestHash !== requestHash || !['applied', 'failed'].includes(existing.status)) throw new Error('Diese Anfragekennung wurde bereits anders verwendet.');
			return { operationId: existing.id, status: existing.status, reused: true };
		}
		const [target] = await tx.select().from(operations).where(eq(operations.id, input.targetOperationId)).limit(1);
		const diff = target?.type === 'claim.publish' ? readDiff(target.publicationDiff) : null;
		const claimId = readClaimId(target?.entityDiff);
		if (!target || !diff || !claimId) throw new Error('Diese Veröffentlichung kann nicht automatisch rückgängig gemacht werden.');
		const now = new Date();
		const [publication] = await tx.update(publications).set({ updatedAt: now }).where(eq(publications.route, diff.route)).returning();
		if (!publication) throw new Error('Die Projektveröffentlichung wurde nicht gefunden.');
		const [[claim], [prior]] = await Promise.all([
			tx.select().from(claims).where(eq(claims.id, claimId)).limit(1),
			diff.before ? tx.select().from(publicationRevisions).where(eq(publicationRevisions.id, diff.before)).limit(1) : Promise.resolve([])
		]);
		const priorPayload = diff.before ? parseProjectPublication(prior?.payload) : null;
		if (!claim || (diff.before && (!prior || prior.publicationId !== publication.id || !priorPayload || diff.route !== `/projekte/${priorPayload.slug}` || priorPayload.claims.some((item) => item.id === claimId)))) throw new Error('Die vorherige Projektseite kann nicht sicher wiederhergestellt werden.');
		const [project] = await tx.select().from(projects).where(eq(projects.id, claim.projectId)).limit(1);
		if (!project || diff.route !== `/projekte/${project.slug}`) throw new Error('Das Projekt passt nicht zur Veröffentlichung.');
		const isConflict = target.status !== 'applied' || publication.currentRevisionId !== diff.revisionId || input.expectedRevisionId !== diff.revisionId || claim.visibility !== 'public' || claim.editorialStatus !== 'published' || claim.revision !== '2';
		if (isConflict) {
			const reason = 'Eine neuere Änderung verhindert das automatische Rückgängigmachen des Fakts.';
			await tx.insert(attentionItems).values({ id: createId(), kind: 'revert_conflict', severity: 'warning', summary: reason, entityType: 'claim', entityId: claim.id, operationId });
			await tx.update(operations).set({ status: 'failed', entityDiff: { reason, claimId, currentRevisionId: publication.currentRevisionId }, updatedAt: now }).where(eq(operations.id, operationId));
			await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.failed', origin: 'admin', severity: 'warning', summary: reason, correlationId, payload: { targetOperationId: target.id, claimId, currentRevisionId: publication.currentRevisionId } });
			return { operationId, status: 'failed' as const, reused: false };
		}
		const visibleClaims = await tx.select({ id: claims.id }).from(claims).where(and(eq(claims.projectId, project.id), eq(claims.visibility, 'public'), eq(claims.editorialStatus, 'published')));
		const expectedIds = new Set([claim.id, ...(priorPayload?.claims.map((item) => item.id) ?? [])]);
		if (visibleClaims.length !== expectedIds.size || visibleClaims.some((item) => !expectedIds.has(item.id))) throw new Error('Die veröffentlichten Fakten weichen von der letzten Projektseite ab. Bitte manuell prüfen.');
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.proposed', origin: 'admin', severity: 'info', summary: 'Rückgängigmachen des veröffentlichten Fakts wurde bestätigt.', correlationId, payload: { targetOperationId: target.id, claimId, route: diff.route } });
		await tx.update(claims).set({ visibility: 'private', editorialStatus: 'draft', revision: '3', updatedAt: now }).where(eq(claims.id, claim.id));
		await tx.update(projects).set({ visibility: priorPayload ? 'public' : 'private', lastEditorialReviewedAt: now, updatedAt: now }).where(eq(projects.id, project.id));
		let revisionId: string | null = null;
		if (priorPayload) {
			revisionId = createId();
			const payload: ProjectPublication = { ...priorPayload, publishedAt: now.toISOString() };
			await tx.insert(publicationRevisions).values({ id: revisionId, publicationId: publication.id, operationId, payload, templateVersion: 'project-v1', renderedDiff: { removedClaimId: claim.id, restoredFromRevisionId: diff.before }, publishedAt: now });
		}
		await tx.update(publications).set({ currentRevisionId: revisionId, status: revisionId ? 'published' : 'archived', updatedAt: now }).where(eq(publications.id, publication.id));
		await tx.update(operations).set({ status: 'applied', entityDiff: { claimId: claim.id, before: 'public/published', after: 'private/draft' }, publicationDiff: { route: diff.route, before: diff.revisionId, after: revisionId }, updatedAt: now }).where(eq(operations.id, operationId));
		await tx.update(operations).set({ status: 'reverted', inverseOperationId: operationId, updatedAt: now }).where(eq(operations.id, target.id));
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.applied', origin: 'admin', severity: 'info', summary: 'Der veröffentlichte Fakt wurde rückgängig gemacht.', publicEffect: diff.route, correlationId, payload: { targetOperationId: target.id, claimId, revisionId } });
		await tx.insert(activityEvents).values({ id: createId(), operationId, publicationRevisionId: revisionId, eventType: revisionId ? 'publication.published' : 'publication.unpublished', origin: 'admin', severity: 'info', summary: revisionId ? 'Vorherige Projektseite wurde erneut veröffentlicht.' : 'Projektseite wurde entfernt.', publicEffect: diff.route, correlationId, payload: { targetOperationId: target.id, claimId, revisionId, route: diff.route } });
		if (revisionId && process.env.PUBLICATION_VERIFY_JOBS_ENABLED === 'true') await tx.insert(jobs).values({ id: createId(), kind: 'publication.verify', dedupeKey: `publication.verify:${revisionId}`, payload: { revisionId, route: diff.route, correlationId }, runAt: now, maxAttempts: '3' });
		return { operationId, status: 'applied' as const, reused: false };
	});
};
