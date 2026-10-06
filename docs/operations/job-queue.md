# PostgreSQL job queue

Migration `0004` adds job status and per-attempt records. Apply it with `npm run db:migrate` from the private operations resource before deploying code that calls the queue. The migration does not alter public content.

`enqueueJob` accepts a stable dedupe key for one logical occurrence; an existing key returns the original job. `claimNextJob` leases one due job using `FOR UPDATE SKIP LOCKED`. A worker must finish within its lease, extend it before expiry, or let another worker reclaim it. A stale worker cannot mark a reclaimed job complete. Failures use exponential backoff with jitter; the last attempt becomes `failed`. `failExhaustedLeases` closes jobs whose final lease expired. Each attempt records its worker, times, outcome, and short error code.

The private worker image (`Dockerfile.worker`) now processes `publication.verify` jobs only. `PUBLICATION_VERIFY_JOBS_ENABLED=true` on the web resource opts new publications into the queue after migration `0004` and worker deployment. The verification is read-only: it checks the immutable payload and, if the revision is still current, the public data reader. It does not issue an HTTP request or render HTML. A superseded revision is a successful check, not a new publication. Exhausted jobs create a steward attention item. The worker does not yet process source capture or polling; the source form continues synchronously. Keep worker concurrency at one on the launch server.

To check queue behavior against an isolated database, run `npm run test:jobs-db` after migrations. Do not run this integration script against production: it intentionally creates and changes test jobs.
