import { index, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

const id = (name = 'id') => uuid(name).primaryKey();
const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const visibility = pgEnum('visibility', ['private', 'team', 'scheduled_public', 'public', 'archived']);
export const editorialStatus = pgEnum('editorial_status', ['draft', 'ready', 'published', 'rejected', 'archived']);
export const operationStatus = pgEnum('operation_status', ['proposed', 'applied', 'failed', 'reverted']);

export const users = pgTable('users', {
	id: id(), email: varchar('email', { length: 320 }).notNull(), displayName: text('display_name').notNull(), role: varchar('role', { length: 32 }).notNull(), passwordHash: text('password_hash').notNull(), totpSecret: text('totp_secret'), createdAt, updatedAt
}, (table) => [uniqueIndex('users_email_unique').on(table.email)]);

export const sessions = pgTable('sessions', {
	id: id(), userId: uuid('user_id').notNull().references(() => users.id), tokenHash: varchar('token_hash', { length: 64 }).notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), createdAt
}, (table) => [uniqueIndex('sessions_token_hash_unique').on(table.tokenHash), index('sessions_user_expiry_index').on(table.userId, table.expiresAt)]);

export const projects = pgTable('projects', {
	id: id(), slug: varchar('slug', { length: 120 }).notNull(), name: text('name').notNull(), summary: text('summary').notNull(), status: varchar('status', { length: 40 }).notNull(), visibility: visibility('visibility').notNull().default('private'), locale: varchar('locale', { length: 8 }).notNull().default('de'), currentNeed: text('current_need'), startedAt: timestamp('started_at', { withTimezone: true }), contentOwnerId: uuid('content_owner_id').references(() => users.id), lastEditorialReviewedAt: timestamp('last_editorial_reviewed_at', { withTimezone: true }), nextReviewDueAt: timestamp('next_review_due_at', { withTimezone: true }), freshnessClass: varchar('freshness_class', { length: 16 }).notNull().default('historic'), lifecycleState: varchar('lifecycle_state', { length: 32 }).notNull().default('active'), revision: varchar('revision', { length: 32 }).notNull().default('1'), createdAt, updatedAt
}, (table) => [uniqueIndex('projects_slug_unique').on(table.slug), index('projects_public_index').on(table.visibility, table.slug)]);

export const animals = pgTable('animals', {
	id: id(), slug: varchar('slug', { length: 120 }).notNull(), name: text('name').notNull(), story: text('story'), visibility: visibility('visibility').notNull().default('private'), mediaRestrictions: jsonb('media_restrictions').notNull().default({}), revision: varchar('revision', { length: 32 }).notNull().default('1'), createdAt, updatedAt
}, (table) => [uniqueIndex('animals_slug_unique').on(table.slug)]);

export const sources = pgTable('sources', {
	id: id(), canonicalUrl: text('canonical_url').notNull(), name: text('name').notNull(), owner: text('owner').notNull(), authority: varchar('authority', { length: 32 }).notNull(), adapterKey: varchar('adapter_key', { length: 100 }), adapterVersion: varchar('adapter_version', { length: 40 }), cadenceMinutes: varchar('cadence_minutes', { length: 20 }), publicationPolicy: varchar('publication_policy', { length: 64 }).notNull(), health: varchar('health', { length: 32 }).notNull().default('unknown'), termsNotes: text('terms_notes'), lastSuccessfulAt: timestamp('last_successful_at', { withTimezone: true }), createdAt, updatedAt
}, (table) => [uniqueIndex('sources_canonical_url_unique').on(table.canonicalUrl)]);

export const sourceRuns = pgTable('source_runs', {
	id: id(), sourceId: uuid('source_id').notNull().references(() => sources.id), outcome: varchar('outcome', { length: 32 }).notNull(), statusCode: varchar('status_code', { length: 8 }), etag: text('etag'), lastModified: text('last_modified'), extractorVersion: varchar('extractor_version', { length: 40 }), errorCode: varchar('error_code', { length: 80 }), fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(), createdAt
}, (table) => [index('source_runs_source_fetched_index').on(table.sourceId, table.fetchedAt)]);

export const sourceSnapshots = pgTable('source_snapshots', {
	id: id(), sourceRunId: uuid('source_run_id').notNull().references(() => sourceRuns.id), objectKey: text('object_key').notNull(), bodySha256: varchar('body_sha256', { length: 64 }).notNull(), normalizedExtract: jsonb('normalized_extract').notNull(), normalizedSha256: varchar('normalized_sha256', { length: 64 }).notNull(), retentionClass: varchar('retention_class', { length: 32 }).notNull(), createdAt
}, (table) => [uniqueIndex('source_snapshots_object_key_unique').on(table.objectKey)]);

export const claims = pgTable('claims', {
	id: id(), projectId: uuid('project_id').notNull().references(() => projects.id), animalId: uuid('animal_id').references(() => animals.id), kind: varchar('kind', { length: 32 }).notNull(), statement: text('statement').notNull(), occurredAt: timestamp('occurred_at', { withTimezone: true }), occurredUntil: timestamp('occurred_until', { withTimezone: true }), visibility: visibility('visibility').notNull().default('private'), editorialStatus: editorialStatus('editorial_status').notNull().default('draft'), revision: varchar('revision', { length: 32 }).notNull().default('1'), createdAt, updatedAt
}, (table) => [index('claims_project_public_date_index').on(table.projectId, table.visibility, table.occurredAt)]);

export const claimEvidence = pgTable('claim_evidence', {
	id: id(), claimId: uuid('claim_id').notNull().references(() => claims.id), sourceSnapshotId: uuid('source_snapshot_id').references(() => sourceSnapshots.id), sourceUrl: text('source_url').notNull(), passage: text('passage').notNull(), sourcePublishedAt: timestamp('source_published_at', { withTimezone: true }), observedAt: timestamp('observed_at', { withTimezone: true }).notNull(), confidenceNote: text('confidence_note'), createdAt
});

export const actions = pgTable('actions', {
	id: id(), projectId: uuid('project_id').references(() => projects.id), kind: varchar('kind', { length: 32 }).notNull(), label: text('label').notNull(), recipientName: text('recipient_name').notNull(), destinationUrl: text('destination_url').notNull(), destinationHost: varchar('destination_host', { length: 255 }).notNull(), startsAt: timestamp('starts_at', { withTimezone: true }), endsAt: timestamp('ends_at', { withTimezone: true }), state: varchar('state', { length: 32 }).notNull().default('draft'), visibility: visibility('visibility').notNull().default('private'), evidenceUrl: text('evidence_url'), reviewStatus: editorialStatus('review_status').notNull().default('draft'), revision: varchar('revision', { length: 32 }).notNull().default('1'), createdAt, updatedAt
});

export const media = pgTable('media', {
	id: id(), projectId: uuid('project_id').references(() => projects.id), animalId: uuid('animal_id').references(() => animals.id), originalUrl: text('original_url').notNull(), credit: text('credit').notNull(), caption: text('caption'), delivery: varchar('delivery', { length: 24 }).notNull(), sensitivity: varchar('sensitivity', { length: 24 }).notNull().default('none'), revealRequired: varchar('reveal_required', { length: 8 }).notNull().default('false'), visibility: visibility('visibility').notNull().default('private'), width: varchar('width', { length: 8 }), height: varchar('height', { length: 8 }), createdAt, updatedAt
});

export const events = pgTable('events', {
	id: id(), projectId: uuid('project_id').references(() => projects.id), title: text('title').notNull(), startsAt: timestamp('starts_at', { withTimezone: true }).notNull(), endsAt: timestamp('ends_at', { withTimezone: true }), timezone: varchar('timezone', { length: 64 }).notNull(), venue: text('venue'), venueGranularity: varchar('venue_granularity', { length: 24 }).notNull(), organizer: text('organizer'), officialUrl: text('official_url'), status: varchar('status', { length: 24 }).notNull().default('planned'), visibility: visibility('visibility').notNull().default('private'), sourceId: uuid('source_id').references(() => sources.id), revision: varchar('revision', { length: 32 }).notNull().default('1'), createdAt, updatedAt
}, (table) => [index('events_public_start_index').on(table.visibility, table.startsAt)]);

export const metrics = pgTable('metrics', {
	id: id(), projectId: uuid('project_id').references(() => projects.id), key: varchar('key', { length: 100 }).notNull(), value: varchar('value', { length: 64 }).notNull(), unit: varchar('unit', { length: 32 }).notNull(), evidenceUrl: text('evidence_url').notNull(), verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(), staleAfter: timestamp('stale_after', { withTimezone: true }).notNull(), allowedRange: jsonb('allowed_range').notNull(), anomalyPolicy: varchar('anomaly_policy', { length: 64 }).notNull(), visibility: visibility('visibility').notNull().default('private'), createdAt, updatedAt
}, (table) => [index('metrics_project_key_index').on(table.projectId, table.key)]);

export const projectUpdates = pgTable('project_updates', {
	id: id(), projectId: uuid('project_id').notNull().references(() => projects.id), headline: text('headline').notNull(), body: text('body').notNull(), visibility: visibility('visibility').notNull().default('private'), editorialStatus: editorialStatus('editorial_status').notNull().default('draft'), revision: varchar('revision', { length: 32 }).notNull().default('1'), createdAt, updatedAt
});

export const campaignPriorities = pgTable('campaign_priorities', {
	id: id(), actionId: uuid('action_id').notNull().references(() => actions.id), rank: varchar('rank', { length: 8 }).notNull().default('1'), startsAt: timestamp('starts_at', { withTimezone: true }).notNull(), endsAt: timestamp('ends_at', { withTimezone: true }), fallbackActionId: uuid('fallback_action_id').references(() => actions.id), approvedRevision: varchar('approved_revision', { length: 32 }), createdAt, updatedAt
}, (table) => [index('campaign_priorities_active_index').on(table.startsAt, table.endsAt)]);

export const publications = pgTable('publications', { id: id(), route: text('route').notNull(), status: editorialStatus('status').notNull().default('draft'), currentRevisionId: uuid('current_revision_id'), createdAt, updatedAt }, (table) => [uniqueIndex('publications_route_unique').on(table.route)]);
export const publicationRevisions = pgTable('publication_revisions', { id: id(), publicationId: uuid('publication_id').notNull().references(() => publications.id), operationId: uuid('operation_id'), payload: jsonb('payload').notNull(), templateVersion: varchar('template_version', { length: 40 }).notNull(), renderedDiff: jsonb('rendered_diff'), publishedAt: timestamp('published_at', { withTimezone: true }), createdAt });

export const operations = pgTable('operations', { id: id(), status: operationStatus('status').notNull(), type: varchar('type', { length: 80 }).notNull(), origin: varchar('origin', { length: 32 }).notNull(), initiatingUserId: uuid('initiating_user_id').references(() => users.id), instruction: text('instruction'), idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(), requestHash: varchar('request_hash', { length: 64 }).notNull(), input: jsonb('input').notNull(), entityDiff: jsonb('entity_diff'), publicationDiff: jsonb('publication_diff'), inverseOperationId: uuid('inverse_operation_id'), correlationId: uuid('correlation_id').notNull(), createdAt, updatedAt }, (table) => [uniqueIndex('operations_idempotency_key_unique').on(table.idempotencyKey), index('operations_correlation_index').on(table.correlationId)]);
export const activityEvents = pgTable('activity_events', { id: id(), operationId: uuid('operation_id').references(() => operations.id), sourceRunId: uuid('source_run_id').references(() => sourceRuns.id), publicationRevisionId: uuid('publication_revision_id').references(() => publicationRevisions.id), eventType: varchar('event_type', { length: 80 }).notNull(), origin: varchar('origin', { length: 32 }).notNull(), severity: varchar('severity', { length: 16 }).notNull(), summary: text('summary').notNull(), publicEffect: text('public_effect'), correlationId: uuid('correlation_id').notNull(), payload: jsonb('payload').notNull(), createdAt });

export const attentionItems = pgTable('attention_items', { id: id(), kind: varchar('kind', { length: 64 }).notNull(), severity: varchar('severity', { length: 16 }).notNull(), status: varchar('status', { length: 24 }).notNull().default('open'), summary: text('summary').notNull(), entityType: varchar('entity_type', { length: 64 }), entityId: uuid('entity_id'), operationId: uuid('operation_id').references(() => operations.id), assignedUserId: uuid('assigned_user_id').references(() => users.id), dueAt: timestamp('due_at', { withTimezone: true }), createdAt, updatedAt }, (table) => [index('attention_items_open_index').on(table.status, table.severity, table.dueAt)]);

export const jobs = pgTable('jobs', { id: id(), kind: varchar('kind', { length: 80 }).notNull(), dedupeKey: varchar('dedupe_key', { length: 160 }).notNull(), payload: jsonb('payload').notNull(), runAt: timestamp('run_at', { withTimezone: true }).notNull(), leaseOwner: varchar('lease_owner', { length: 120 }), leaseUntil: timestamp('lease_until', { withTimezone: true }), attempts: varchar('attempts', { length: 8 }).notNull().default('0'), maxAttempts: varchar('max_attempts', { length: 8 }).notNull().default('5'), lastError: text('last_error'), createdAt, updatedAt }, (table) => [uniqueIndex('jobs_dedupe_key_unique').on(table.dedupeKey), index('jobs_ready_index').on(table.runAt, table.leaseUntil)]);

export const conversationStates = pgTable('conversation_states', { id: id(), userId: uuid('user_id').notNull().references(() => users.id), activeProjectId: uuid('active_project_id').references(() => projects.id), lastOperationId: uuid('last_operation_id').references(() => operations.id), state: jsonb('state').notNull().default({}), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), createdAt, updatedAt }, (table) => [uniqueIndex('conversation_states_user_unique').on(table.userId)]);

export const projectAnimals = pgTable('project_animals', { projectId: uuid('project_id').notNull().references(() => projects.id), animalId: uuid('animal_id').notNull().references(() => animals.id), createdAt }, (table) => [primaryKey({ columns: [table.projectId, table.animalId] })]);
