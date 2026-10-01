CREATE TABLE "attention_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" varchar(64) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"status" varchar(24) DEFAULT 'open' NOT NULL,
	"summary" text NOT NULL,
	"entity_type" varchar(64),
	"entity_id" uuid,
	"operation_id" uuid,
	"assigned_user_id" uuid,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"timezone" varchar(64) NOT NULL,
	"venue" text,
	"venue_granularity" varchar(24) NOT NULL,
	"organizer" text,
	"official_url" text,
	"status" varchar(24) DEFAULT 'planned' NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"source_id" uuid,
	"revision" varchar(32) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"animal_id" uuid,
	"original_url" text NOT NULL,
	"credit" text NOT NULL,
	"caption" text,
	"delivery" varchar(24) NOT NULL,
	"sensitivity" varchar(24) DEFAULT 'none' NOT NULL,
	"reveal_required" varchar(8) DEFAULT 'false' NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"width" varchar(8),
	"height" varchar(8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"key" varchar(100) NOT NULL,
	"value" varchar(64) NOT NULL,
	"unit" varchar(32) NOT NULL,
	"evidence_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"stale_after" timestamp with time zone NOT NULL,
	"allowed_range" jsonb NOT NULL,
	"anomaly_policy" varchar(64) NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_updates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"headline" text NOT NULL,
	"body" text NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"editorial_status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"revision" varchar(32) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attention_items" ADD CONSTRAINT "attention_items_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attention_items" ADD CONSTRAINT "attention_items_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attention_items_open_index" ON "attention_items" USING btree ("status","severity","due_at");--> statement-breakpoint
CREATE INDEX "events_public_start_index" ON "events" USING btree ("visibility","starts_at");--> statement-breakpoint
CREATE INDEX "metrics_project_key_index" ON "metrics" USING btree ("project_id","key");