# PostgreSQL job queue

Migration `0004` adds job status and per-attempt records. Apply it with `npm run db:migrate` from the private operations resource before deploying code that calls the queue. The migration does not alter public content.

`enqueueJob` accepts a stable dedupe key for one logical occurrence; an existing key returns the original job. `claimNextJob` leases one due job using `FOR UPDATE SKIP LOCKED`. A worker must finish within its lease, extend it before expiry, or let another worker reclaim it. A stale worker cannot mark a reclaimed job complete. Failures use exponential backoff with jitter; the last attempt becomes `failed`. `failExhaustedLeases` closes jobs whose final lease expired. Each attempt records its worker, times, outcome, and short error code.

This commit provides queue storage and tested claim/retry behavior, but it does not start a worker or enqueue production jobs. Add a bounded handler and a private Coolify worker resource before enabling automated ingestion. Keep worker concurrency at one on the launch server.

To check queue behavior against an isolated database, run `npm run test:jobs-db` after migrations. Do not run this integration script against production: it intentionally creates and changes test jobs.
