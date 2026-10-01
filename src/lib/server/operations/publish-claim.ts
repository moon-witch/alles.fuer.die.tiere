import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { validPublicUrl } from '$lib/domain/action-policy';
import type { ProjectPublication, PublishedClaim } from '$lib/domain/project-publication';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';
import { activityEvents, claimEvidence, claims, operations, projects, publicationRevisions, publications } from '$lib/server/db/schema';

export const publishClaim = async (input: { claimId: string; expectedClaimRevision: string; expectedPublicationRevisionId: string | null; initiatingUserId: string; idempotencyKey: string }) => {
	if (!input.idempotencyKey || input.idempotencyKey.length > 128) throw new Error('Ungültige Anfragekennung.');
	const hash = createHash('sha256').update(JSON.stringify({ claimId: input.claimId, expectedClaimRevision: input.expectedClaimRevision, expectedPublicationRevisionId: input.expectedPublicationRevisionId })).digest('hex');
	return getDatabase().transaction(async (tx) => {
		const operationId = createId();
		const correlationId = createId();
		const inserted = await tx.insert(operations).values({ id: operationId, status: 'proposed', type: 'claim.publish', origin: 'admin', initiatingUserId: input.initiatingUserId, idempotencyKey: input.idempotencyKey, requestHash: hash, input: { claimId: input.claimId }, correlationId }).onConflictDoNothing().returning({ id: operations.id });
		if (!inserted.length) {
			const [existing] = await tx.select().from(operations).where(eq(operations.idempotencyKey, input.idempotencyKey)).limit(1);
			const diff = existing?.publicationDiff as { revisionId?: string; route?: string } | null;
			if (!existing || existing.requestHash !== hash || existing.status !== 'applied' || !diff?.revisionId || !diff.route) throw new Error('Diese Anfragekennung wurde bereits anders verwendet.');
			return { operationId: existing.id, revisionId: diff.revisionId, route: diff.route, reused: true };
		}
		const [claim] = await tx.select().from(claims).where(eq(claims.id, input.claimId)).limit(1);
		if (!claim || claim.editorialStatus !== 'draft' || claim.visibility !== 'private' || claim.revision !== input.expectedClaimRevision) throw new Error('Der Faktenentwurf hat sich geändert oder ist bereits veröffentlicht.');
		const [project] = await tx.select().from(projects).where(eq(projects.id, claim.projectId)).limit(1);
		if (!project || project.lifecycleState !== 'active') throw new Error('Das Projekt ist nicht verfügbar.');
		const evidence = await tx.select().from(claimEvidence).where(eq(claimEvidence.claimId, claim.id));
		if (!evidence.length || evidence.some((item) => !item.passage.trim() || !validPublicUrl(item.sourceUrl))) throw new Error('Für die Veröffentlichung ist ein genauer, öffentlicher HTTPS-Beleg erforderlich.');
		const route = `/projekte/${project.slug}`;
		const [publication] = await tx.insert(publications).values({ id: createId(), route, status: 'published' }).onConflictDoUpdate({ target: publications.route, set: { updatedAt: new Date() } }).returning({ id: publications.id, currentRevisionId: publications.currentRevisionId });
		if (publication.currentRevisionId !== input.expectedPublicationRevisionId) throw new Error('Die Projektseite hat sich seit der Vorschau geändert. Bitte erneut prüfen.');
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.proposed', origin: 'admin', severity: 'info', summary: 'Quellenbasierter Fakt wurde zur Veröffentlichung vorbereitet.', correlationId, payload: { claimId: claim.id, route } });
		const now = new Date();
		await tx.update(claims).set({ visibility: 'public', editorialStatus: 'published', revision: String(Number(claim.revision) + 1), updatedAt: now }).where(eq(claims.id, claim.id));
		await tx.update(projects).set({ visibility: 'public', lastEditorialReviewedAt: now, updatedAt: now }).where(eq(projects.id, project.id));
		const rows = await tx.select({ claimId: claims.id, kind: claims.kind, statement: claims.statement, occurredAt: claims.occurredAt, sourceUrl: claimEvidence.sourceUrl, observedAt: claimEvidence.observedAt })
			.from(claims).innerJoin(claimEvidence, eq(claimEvidence.claimId, claims.id))
			.where(and(eq(claims.projectId, project.id), eq(claims.visibility, 'public'), eq(claims.editorialStatus, 'published')));
		const byClaim = new Map<string, PublishedClaim>();
		for (const row of rows) {
			if (!validPublicUrl(row.sourceUrl)) throw new Error('Eine veröffentlichte Quelle ist nicht mehr zulässig.');
			let entry = byClaim.get(row.claimId);
			if (!entry) { entry = { id: row.claimId, kind: row.kind, statement: row.statement, occurredAt: row.occurredAt?.toISOString() ?? null, evidence: [] }; byClaim.set(row.claimId, entry); }
			entry.evidence.push({ url: row.sourceUrl, publisher: new URL(row.sourceUrl).hostname, observedAt: row.observedAt.toISOString() });
		}
		const entries = [...byClaim.values()].sort((a, b) => (a.occurredAt ?? a.evidence[0].observedAt).localeCompare(b.occurredAt ?? b.evidence[0].observedAt));
		const payload: ProjectPublication = { type: 'project', version: 1, slug: project.slug, name: project.name, claims: entries, publishedAt: now.toISOString() };
		const revisionId = createId();
		await tx.insert(publicationRevisions).values({ id: revisionId, publicationId: publication.id, operationId, payload, templateVersion: 'project-v1', renderedDiff: { addedClaimId: claim.id, beforeCount: entries.length - 1, afterCount: entries.length }, publishedAt: now });
		await tx.update(publications).set({ currentRevisionId: revisionId, status: 'published', updatedAt: now }).where(eq(publications.id, publication.id));
		await tx.update(operations).set({ status: 'applied', entityDiff: { claimId: claim.id, before: 'private/draft', after: 'public/published' }, publicationDiff: { route, before: publication.currentRevisionId, revisionId }, updatedAt: now }).where(eq(operations.id, operationId));
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.applied', origin: 'admin', severity: 'info', summary: 'Fakt und Projektseite wurden veröffentlicht.', publicEffect: route, correlationId, payload: { claimId: claim.id, revisionId } });
		await tx.insert(activityEvents).values({ id: createId(), operationId, publicationRevisionId: revisionId, eventType: 'publication.published', origin: 'admin', severity: 'info', summary: 'Projektseite erhielt eine neue Revision.', publicEffect: route, correlationId, payload: { claimId: claim.id, revisionId, route } });
		return { operationId, revisionId, route, reused: false };
	});
};
