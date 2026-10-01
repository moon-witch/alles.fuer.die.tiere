import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { validateAction, validPublicUrl } from '$lib/domain/action-policy';
import type { CurrentActionPublication, PublicAction } from '$lib/domain/current-action';
import { createId } from '$lib/domain/ids';
import { getDatabase } from '$lib/server/db/client';
import { actions, activityEvents, campaignPriorities, operations, publicationRevisions, publications } from '$lib/server/db/schema';

export const actionKinds = ['spende', 'petition', 'ticket', 'information', 'merchandise'] as const;
export type ActionKind = (typeof actionKinds)[number];

export type PublishCurrentActionInput = {
	kind: ActionKind;
	label: string;
	recipientName: string;
	destinationUrl: string;
	evidenceUrl: string;
	endsAt?: Date;
	fallbackActionId?: string;
	expectedRevisionId: string | null;
	initiatingUserId: string;
	idempotencyKey: string;
};

export const validateCurrentActionInput = (input: Omit<PublishCurrentActionInput, 'expectedRevisionId' | 'initiatingUserId' | 'idempotencyKey'>, now = new Date()): string[] => {
	const issues = validateAction(input);
	if (!actionKinds.includes(input.kind)) issues.push('Die Aktionsart ist nicht zulässig.');
	if (!input.label.trim() || input.label.length > 180) issues.push('Eine kurze Bezeichnung ist erforderlich.');
	if (!input.evidenceUrl.trim() || !validPublicUrl(input.evidenceUrl)) issues.push('Eine öffentliche HTTPS-Quelle ist erforderlich.');
	if (input.endsAt && (!Number.isFinite(input.endsAt.getTime()) || input.endsAt <= now)) issues.push('Das Ablaufdatum muss in der Zukunft liegen.');
	return issues;
};

export const publishCurrentAction = async (input: PublishCurrentActionInput): Promise<{ operationId: string; actionId: string; revisionId: string; reused: boolean }> => {
	const now = new Date();
	const issues = validateCurrentActionInput(input, now);
	if (issues.length) throw new Error(issues.join(' '));
	if (!input.idempotencyKey || input.idempotencyKey.length > 128) throw new Error('Ungültige Anfragekennung.');
	const destination = validPublicUrl(input.destinationUrl)!;
	const evidence = validPublicUrl(input.evidenceUrl)!;
	const normalized = { kind: input.kind, label: input.label.trim(), recipientName: input.recipientName.trim(), destinationUrl: destination.toString(), evidenceUrl: evidence.toString(), endsAt: input.endsAt?.toISOString() ?? null, fallbackActionId: input.fallbackActionId ?? null, expectedRevisionId: input.expectedRevisionId };
	const hash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
	const database = getDatabase();
	return database.transaction(async (tx) => {
		const operationId = createId();
		const correlationId = createId();
		const inserted = await tx.insert(operations).values({ id: operationId, status: 'proposed', type: 'action.set_primary', origin: 'admin', initiatingUserId: input.initiatingUserId, idempotencyKey: input.idempotencyKey, requestHash: hash, input: normalized, correlationId }).onConflictDoNothing().returning({ id: operations.id });
		if (!inserted.length) {
			const [existing] = await tx.select().from(operations).where(eq(operations.idempotencyKey, input.idempotencyKey)).limit(1);
			if (!existing || existing.requestHash !== hash || existing.status !== 'applied') throw new Error('Diese Anfragekennung wurde bereits anders verwendet.');
			const diff = existing.entityDiff as { actionId?: string; revisionId?: string } | null;
			if (!diff?.actionId || !diff.revisionId) throw new Error('Die vorhandene Aktion ist unvollständig.');
			return { operationId: existing.id, actionId: diff.actionId, revisionId: diff.revisionId, reused: true };
		}
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.proposed', origin: 'admin', severity: 'info', summary: 'Neue aktuelle Hilfe wurde zur Veröffentlichung vorbereitet.', correlationId, payload: { route: '/jetzt' } });
		let fallback: PublicAction | null = null;
		if (input.fallbackActionId) {
			const [existing] = await tx.select().from(actions).where(eq(actions.id, input.fallbackActionId)).limit(1);
			if (!existing || existing.visibility !== 'public' || existing.reviewStatus !== 'published' || existing.state !== 'active' || existing.endsAt !== null || !existing.evidenceUrl || !validPublicUrl(existing.destinationUrl) || !validPublicUrl(existing.evidenceUrl)) throw new Error('Der Fallback muss eine unbefristete, öffentliche Aktion sein.');
			fallback = { id: existing.id, kind: existing.kind, label: existing.label, recipientName: existing.recipientName, destinationUrl: existing.destinationUrl, destinationHost: existing.destinationHost, evidenceUrl: existing.evidenceUrl };
		}
		const [publication] = await tx.insert(publications).values({ id: createId(), route: '/jetzt', status: 'published' }).onConflictDoUpdate({ target: publications.route, set: { updatedAt: now } }).returning({ id: publications.id, currentRevisionId: publications.currentRevisionId });
		if (publication.currentRevisionId !== input.expectedRevisionId) throw new Error('Die aktuelle Hilfe hat sich seit der Vorschau geändert. Bitte erneut prüfen.');
		const actionId = createId();
		const primary: PublicAction = { id: actionId, kind: input.kind, label: normalized.label, recipientName: normalized.recipientName, destinationUrl: normalized.destinationUrl, destinationHost: destination.hostname, evidenceUrl: normalized.evidenceUrl };
		await tx.insert(actions).values({ id: actionId, kind: input.kind, label: primary.label, recipientName: primary.recipientName, destinationUrl: primary.destinationUrl, destinationHost: primary.destinationHost, evidenceUrl: primary.evidenceUrl, startsAt: now, endsAt: input.endsAt, state: 'active', visibility: 'public', reviewStatus: 'published' });
		await tx.insert(campaignPriorities).values({ id: createId(), actionId, rank: '1', startsAt: now, endsAt: input.endsAt, fallbackActionId: input.fallbackActionId, approvedRevision: '1' });
		const revisionId = createId();
		const payload: CurrentActionPublication = { type: 'current-action', version: 1, primary, fallback, startsAt: now.toISOString(), endsAt: normalized.endsAt, publishedAt: now.toISOString() };
		await tx.insert(publicationRevisions).values({ id: revisionId, publicationId: publication.id, operationId, payload, templateVersion: 'current-action-v1', publishedAt: now });
		await tx.update(publications).set({ currentRevisionId: revisionId, status: 'published', updatedAt: now }).where(eq(publications.id, publication.id));
		await tx.update(operations).set({ status: 'applied', entityDiff: { actionId, revisionId, fallbackActionId: input.fallbackActionId ?? null }, publicationDiff: { route: '/jetzt', before: publication.currentRevisionId, after: revisionId }, updatedAt: now }).where(eq(operations.id, operationId));
		await tx.insert(activityEvents).values({ id: createId(), operationId, eventType: 'operation.applied', origin: 'admin', severity: 'info', summary: 'Aktuelle Hilfe wurde als neue Revision gespeichert.', publicEffect: '/jetzt wurde aktualisiert.', correlationId, payload: { actionId, revisionId } });
		await tx.insert(activityEvents).values({ id: createId(), operationId, publicationRevisionId: revisionId, eventType: 'publication.published', origin: 'admin', severity: 'info', summary: 'Aktuelle Hilfe wurde veröffentlicht.', publicEffect: '/jetzt zeigt eine neue Aktion.', correlationId, payload: { actionId, route: '/jetzt', revisionId } });
		return { operationId, actionId, revisionId, reused: false };
	});
};
