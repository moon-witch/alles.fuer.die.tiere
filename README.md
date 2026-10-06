# Alles für die Tiere

German-first, evidence-led public platform for sourced project histories and a stable current-action page. The product and delivery decisions are in [`plans/`](plans/).

## Local development

```sh
npm install
npm run dev
```

The public project list and `/jetzt` show safe empty states until sourced content and a current action have been published.

To use the temporary reveal screen locally, set `REVEAL_GATE_ENABLED=true`, `REVEAL_GATE_PASSWORD`, and `SESSION_SECRET` in `.env`. Keep the gate disabled for normal local development.

## Database

Start an ephemeral local PostgreSQL 17 instance:

```sh
docker compose -f infra/compose/local-postgres.yml up -d
DATABASE_URL=postgres://app_write:local-development-only@127.0.0.1:54329/alles_fuer_die_tiere npm run db:migrate
```

The local database is stored in Docker tmpfs and is removed when its container stops. Production values belong in Coolify, never in this repository.

## Private admin and chat

The chat uses the OpenAI Responses API only on the server. It has no tool that can publish content: its first mutation can only create an evidence-backed private claim draft.

Before the first login, configure `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` in the deployment environment. Then run:

```sh
npm run admin:bootstrap
```

The bootstrap command is deliberately one-time: it refuses to overwrite an existing account.

The steward can prepare and publish the current `/jetzt` action at `/admin/aktuelle-hilfe`. The preview shows the recipient, entered destination, source, expiry, and fallback before confirmation. Publish an indefinite action first; a later action with an expiry must select an existing published indefinite fallback. Check the source and any destination redirects manually before confirming. The site does not read or alter Malte's Instagram bio automatically.

At `/admin/inhalte`, the steward can create a private project and a source-backed claim draft. The claim preview shows the exact supporting passage before publication. A confirmed claim creates an immutable project-page revision and Activity events; public project pages read only that published revision. Until a project has a published claim, its private draft does not appear on the public site.

At `/admin/quellen`, the steward can capture an official public page into a private SeaweedFS snapshot and prepare a linked claim draft. The web resource uses `S3_ENDPOINT`, `S3_BUCKET_RAW=raw`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and optionally `S3_REGION` (defaults to `eu-central-1`). The bucket must already exist and must not be publicly readable. The earlier names `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` remain accepted. The other configured buckets (`private`, `public`, `backups`) are reserved for later features. A failed fetch or storage write leaves the public site unchanged and creates an attention item. Source captures are limited to 2 MB, use HTTPS only, and do not automatically publish a fact. Social-post content is not captured through this form.

The private `Dockerfile.worker` image verifies newly published revisions and can capture manual sources through the PostgreSQL job table. Apply migration `0004` and deploy it with `DATABASE_URL`. Set `PUBLICATION_VERIFY_JOBS_ENABLED=true` on the web resource to enqueue new publication checks. To move source capture off the web request, also give the worker raw-bucket S3 access, then set `SOURCE_OBSERVATION_JOBS_ENABLED=true` on the web resource. Both flags are opt-in; the worker never publishes content. See [the worker runbook](docs/operations/job-queue.md).

The steward can inspect recent Activity at `/admin/verlauf`, including the operation and publication revision behind a public change. An eligible current-action change or published project claim can be reversed from its Activity detail page after reviewing the preview. A newer publication blocks the reversal and creates an attention item in `/admin/aufgaben`; a successful reversal creates a new operation and leaves the earlier records intact. Marking an attention item resolved requires a short note and never changes the public site. While the temporary reveal gate is enabled, `robots.txt` disallows indexing and the sitemap exposes no project routes.

## Verification

```sh
npm test
npm run check
npm run build
```
