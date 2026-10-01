CREATE TYPE "public"."editorial_status" AS ENUM('draft', 'ready', 'published', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."operation_status" AS ENUM('proposed', 'applied', 'failed', 'reverted');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'team', 'scheduled_public', 'public', 'archived');--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"kind" varchar(32) NOT NULL,
	"label" text NOT NULL,
	"recipient_name" text NOT NULL,
	"destination_url" text NOT NULL,
	"destination_host" varchar(255) NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"state" varchar(32) DEFAULT 'draft' NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"evidence_url" text,
	"review_status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"revision" varchar(32) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"operation_id" uuid,
	"source_run_id" uuid,
	"publication_revision_id" uuid,
	"event_type" varchar(80) NOT NULL,
	"origin" varchar(32) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"summary" text NOT NULL,
	"public_effect" text,
	"correlation_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" text NOT NULL,
	"story" text,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"media_restrictions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" varchar(32) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_priorities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action_id" uuid NOT NULL,
	"rank" varchar(8) DEFAULT '1' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"fallback_action_id" uuid,
	"approved_revision" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"claim_id" uuid NOT NULL,
	"source_snapshot_id" uuid,
	"source_url" text NOT NULL,
	"passage" text NOT NULL,
	"source_published_at" timestamp with time zone,
	"observed_at" timestamp with time zone NOT NULL,
	"confidence_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"animal_id" uuid,
	"kind" varchar(32) NOT NULL,
	"statement" text NOT NULL,
	"occurred_at" timestamp with time zone,
	"occurred_until" timestamp with time zone,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"editorial_status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"revision" varchar(32) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" varchar(80) NOT NULL,
	"dedupe_key" varchar(160) NOT NULL,
	"payload" jsonb NOT NULL,
	"run_at" timestamp with time zone NOT NULL,
	"lease_owner" varchar(120),
	"lease_until" timestamp with time zone,
	"attempts" varchar(8) DEFAULT '0' NOT NULL,
	"max_attempts" varchar(8) DEFAULT '5' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" "operation_status" NOT NULL,
	"type" varchar(80) NOT NULL,
	"origin" varchar(32) NOT NULL,
	"initiating_user_id" uuid,
	"instruction" text,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"input" jsonb NOT NULL,
	"entity_diff" jsonb,
	"publication_diff" jsonb,
	"inverse_operation_id" uuid,
	"correlation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_animals" (
	"project_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_animals_project_id_animal_id_pk" PRIMARY KEY("project_id","animal_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"status" varchar(40) NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"locale" varchar(8) DEFAULT 'de' NOT NULL,
	"current_need" text,
	"started_at" timestamp with time zone,
	"content_owner_id" uuid,
	"last_editorial_reviewed_at" timestamp with time zone,
	"next_review_due_at" timestamp with time zone,
	"freshness_class" varchar(16) DEFAULT 'historic' NOT NULL,
	"lifecycle_state" varchar(32) DEFAULT 'active' NOT NULL,
	"revision" varchar(32) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"publication_id" uuid NOT NULL,
	"operation_id" uuid,
	"payload" jsonb NOT NULL,
	"template_version" varchar(40) NOT NULL,
	"rendered_diff" jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route" text NOT NULL,
	"status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"current_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"outcome" varchar(32) NOT NULL,
	"status_code" varchar(8),
	"etag" text,
	"last_modified" text,
	"extractor_version" varchar(40),
	"error_code" varchar(80),
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_run_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"body_sha256" varchar(64) NOT NULL,
	"normalized_extract" jsonb NOT NULL,
	"normalized_sha256" varchar(64) NOT NULL,
	"retention_class" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"canonical_url" text NOT NULL,
	"name" text NOT NULL,
	"owner" text NOT NULL,
	"authority" varchar(32) NOT NULL,
	"adapter_key" varchar(100),
	"adapter_version" varchar(40),
	"cadence_minutes" varchar(20),
	"publication_policy" varchar(64) NOT NULL,
	"health" varchar(32) DEFAULT 'unknown' NOT NULL,
	"terms_notes" text,
	"last_successful_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" text NOT NULL,
	"role" varchar(32) NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_source_run_id_source_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."source_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_publication_revision_id_publication_revisions_id_fk" FOREIGN KEY ("publication_revision_id") REFERENCES "public"."publication_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_priorities" ADD CONSTRAINT "campaign_priorities_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_priorities" ADD CONSTRAINT "campaign_priorities_fallback_action_id_actions_id_fk" FOREIGN KEY ("fallback_action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_initiating_user_id_users_id_fk" FOREIGN KEY ("initiating_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_animals" ADD CONSTRAINT "project_animals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_animals" ADD CONSTRAINT "project_animals_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_content_owner_id_users_id_fk" FOREIGN KEY ("content_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_revisions" ADD CONSTRAINT "publication_revisions_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_source_run_id_source_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."source_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "animals_slug_unique" ON "animals" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "campaign_priorities_active_index" ON "campaign_priorities" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "claims_project_public_date_index" ON "claims" USING btree ("project_id","visibility","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_dedupe_key_unique" ON "jobs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "jobs_ready_index" ON "jobs" USING btree ("run_at","lease_until");--> statement-breakpoint
CREATE UNIQUE INDEX "operations_idempotency_key_unique" ON "operations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "operations_correlation_index" ON "operations" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_unique" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_public_index" ON "projects" USING btree ("visibility","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "publications_route_unique" ON "publications" USING btree ("route");--> statement-breakpoint
CREATE INDEX "source_runs_source_fetched_index" ON "source_runs" USING btree ("source_id","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_snapshots_object_key_unique" ON "source_snapshots" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_canonical_url_unique" ON "sources" USING btree ("canonical_url");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");