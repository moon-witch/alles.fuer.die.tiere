# Coolify deployment

## Purpose

Run the password-protected pilot from the repository Docker image. Coolify provides HTTPS, routing, and private service networking; the application provides the public and `/admin` routes.

## Web application resource

Create one **Dockerfile** application resource from this repository.

- Root directory: repository root
- Dockerfile: `Dockerfile`
- Exposed port: `3000`
- Health check path: `/healthz`
- Health check expected response: HTTP 200
- Restart policy: `unless-stopped`
- Memory limit: 384 MiB
- Automatic deployment: disabled until a reviewed deployment workflow is agreed

Attach only `allesfuerdietiere.earth` and `www.allesfuerdietiere.earth` after DNS points to the server. Configure Coolify's canonical-domain redirect from `www` to the apex. The application-wide reveal gate stays enabled until Joshua removes it through `REVEAL_GATE_ENABLED=false`.

Do not expose PostgreSQL, SeaweedFS, or future worker/MCP ports publicly. The web service is the only application resource with a public domain.

## Internal operations resource

Create a second, private Coolify application from the same repository using `Dockerfile.ops`. It has no domain and no public port. Give it the database-related environment variables and start it only when an operational command is needed. The smaller web image deliberately excludes migrations and bootstrap tooling.

## Required application environment

Set these as Coolify secrets, never in the repository:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | internal PostgreSQL URL for the `app_write` role |
| `PUBLIC_SITE_URL` | `https://allesfuerdietiere.earth` |
| `SESSION_SECRET` | random, base64-encoded 32-byte secret |
| `REVEAL_GATE_ENABLED` | `true` |
| `REVEAL_GATE_PASSWORD` | password-manager generated reveal password |
| `OPENAI_API_KEY` | OpenAI project key |
| `OPENAI_MODEL` | `gpt-5.4-mini` unless deliberately changed |
| `TOTP_ENCRYPTION_KEY` | random, base64-encoded 32-byte secret |
| `ADMIN_BOOTSTRAP_EMAIL` | Joshua's private email address |
| `ADMIN_BOOTSTRAP_PASSWORD` | password-manager generated admin password |
| `ADMIN_BOOTSTRAP_TOTP_SECRET` | base32 secret enrolled in Joshua's authenticator app |

Generate `SESSION_SECRET` and `TOTP_ENCRYPTION_KEY` separately with `openssl rand -base64 32`.

## SeaweedFS environment reserved for the next implementation slice

Configure these now if the bucket names are known. The application will begin using them when source snapshots and assets are wired in.

| Variable | Value |
| --- | --- |
| `S3_ENDPOINT` | internal SeaweedFS S3 endpoint, including `http://` and port |
| `S3_REGION` | `eu-central-1` |
| `S3_ACCESS_KEY` | application-scoped S3 access key |
| `S3_SECRET_KEY` | matching application-scoped S3 secret |
| `S3_BUCKET_RAW` | `raw` |
| `S3_BUCKET_PRIVATE` | `private` |
| `S3_BUCKET_PUBLIC` | `public` |
| `S3_BUCKET_BACKUPS` | `backups` |

Buckets remain private. Only the application may stream approved assets; SeaweedFS does not receive a public Coolify domain.

## PostgreSQL roles

Use separate credentials: `migration_owner` for migrations, `app_write` for the web application, `worker_write` for the future worker, and `app_read` for read-only public rendering. The current web application needs only `app_write`. Retain the `postgres` administrative account only for database administration and role provisioning.

## First deployment

1. Configure the database, web environment, internal PostgreSQL hostname, and domain.
2. Deploy the web application. A healthy deployment returns HTTP 200 from `/healthz`.
3. In the internal operations resource terminal, run `npm run db:migrate` once using `migration_owner` credentials.
4. Change `DATABASE_URL` in that operations resource to the `app_write` role, then run `npm run admin:bootstrap` once. It creates the steward account and encrypts its TOTP secret.
5. Confirm `/` opens the reveal-password screen, `/healthz` returns `{"status":"ok"}`, and `/admin/login` accepts the newly created TOTP account.

## Failure and recovery

If the health check fails, use the Coolify deployment logs, verify the internal `DATABASE_URL`, and roll back to the previous image. Do not disable the reveal gate to diagnose a deployment. The database must be restored only from a tested encrypted backup procedure.
