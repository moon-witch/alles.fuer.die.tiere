CREATE TABLE "job_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"worker_id" varchar(120) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"outcome" varchar(16),
	"error_code" varchar(80)
);
--> statement-breakpoint
DROP INDEX "jobs_ready_index";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "status" varchar(16) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_attempts" ADD CONSTRAINT "job_attempts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_attempts_job_attempt_unique" ON "job_attempts" USING btree ("job_id","attempt");--> statement-breakpoint
CREATE INDEX "jobs_ready_index" ON "jobs" USING btree ("status","run_at","lease_until");