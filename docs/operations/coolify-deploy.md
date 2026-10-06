# Coolify deployment

## Purpose

Run the password-protected pilot from the repository Docker image. Coolify provides HTTPS, routing, and private service networking; the application provides the public and `/admin` routes.

## Web application resource

Create one **Dockerfile** application resource from this repository.

- Root directory: repository root
- Dockerfile: `Dockerfile`
- Ports Exposes: `3000`
- Domains: `https://allesfuerdietiere.earth:3000,https://www.allesfuerdietiere.earth:3000` (`:3000` selects the internal container port; visitors use normal HTTPS)
- Health check path: `/healthz`
- Health check expected response: HTTP 200
- Restart policy: `unless-stopped`
- Memory limit: 384 MiB
- Automatic deployment: disabled until a reviewed deployment workflow is agreed

Attach only `allesfuerdietiere.earth` and `www.allesfuerdietiere.earth` after DNS points to the server. Configure Coolify's canonical-domain redirect from `www` to the apex. Save the domain settings and redeploy so the proxy picks up the routes. The application-wide reveal gate stays enabled until Joshua removes it through `REVEAL_GATE_ENABLED=false`.

Do not expose PostgreSQL, SeaweedFS, or future worker/MCP ports publicly. The web service is the only application resource with a public domain.

## Internal operations resource

Create a second, private Coolify application from the same repository using `Dockerfile.ops`. It has no domain, public port, or HTTP health check. Give it the database-related environment variables and start it only when an operational command is needed. Its container stays running so Coolify's terminal can execute migration and bootstrap commands; stop it afterward. The smaller web image deliberately excludes migrations and bootstrap tooling.

## Publication verification worker

Create a separate private Coolify application from the same reviewed commit using `Dockerfile.worker`. It has no domain, public port, or HTTP health check. Give it the same internal `DATABASE_URL` as the web application, connect it to the database's destination network, set restart policy `unless-stopped`, and limit memory to 384 MiB. The worker handles one PostgreSQL job at a time, starts on container startup, and polls once per minute while idle. Its current handler validates stored publication revisions through the same data readers used by public routes; it does not make an HTTP rendering request, fetch sources, or modify published content.

Apply migration `0004` with `npm run db:migrate` from the private operations resource before starting the worker. Once the worker runs reliably, set `PUBLICATION_VERIFY_JOBS_ENABLED=true` **on the web application** and redeploy the web application. New project and current-action publications, including restored revisions from reverts, then enqueue a verification job in the same database transaction. Keep this flag false until the worker is running; an absent worker otherwise leaves jobs pending. A terminal failure creates one private Needs Attention item. Do not run more than one worker replica on the launch server.

To move manual source capture into the worker, also give the worker the same internal raw-bucket S3 settings as the web application and connect it to the SeaweedFS network. After redeploying the worker, set `SOURCE_OBSERVATION_JOBS_ENABLED=true` on the web application and redeploy it. Leave the flag unset until the worker can reach both PostgreSQL and SeaweedFS. The admin form otherwise keeps its synchronous behavior. `MA_FOREST_POLL_ENABLED=true` on the worker separately opts into the observe-only official-source poll after its [runbook](ma-forest-poll.md) has been reviewed; it never publishes content.

## Required application environment

Set these as Coolify secrets, never in the repository:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | PostgreSQL resource's Internal URL, copied in full from Coolify |
| `PUBLIC_SITE_URL` | `https://allesfuerdietiere.earth` |
| `SESSION_SECRET` | random, base64-encoded 32-byte secret |
| `REVEAL_GATE_ENABLED` | `true` |
| `REVEAL_GATE_PASSWORD` | password-manager generated reveal password |
| `OPENAI_API_KEY` | OpenAI project key |
| `OPENAI_MODEL` | `gpt-5.4-mini` unless deliberately changed |
| `ADMIN_BOOTSTRAP_EMAIL` | Joshua's private email address |
| `ADMIN_BOOTSTRAP_PASSWORD` | password-manager generated admin password |

Generate `SESSION_SECRET` with `openssl rand -base64 32`.

To save the database connection, open the web application in Coolify, then **Configuration → Environment Variables → Add**. Set the key to `DATABASE_URL` and paste the PostgreSQL resource's complete **Internal URL** as its value. Mark it as a secret and **Runtime Variable**, and disable **Build Variable**. Save, then deploy or restart the web application. Add the same `DATABASE_URL` to the private operations resource for migrations and account bootstrap. Coolify supplies it to the container; it does not belong in a Dockerfile or Git commit. If the password contains reserved URL characters (for example `@`, `:`, `/`, or `#`), percent-encode those characters in the URL's password component.

The Internal URL works for resources on the same Coolify destination network. It usually does not resolve on a laptop, so a local `.env` may need a different development URL. The default `postgres` account can perform the first migration and bootstrap; create a narrower application role before the public release.

## SeaweedFS environment

The source inbox now uses the `raw` bucket for private snapshots. The other buckets are reserved for later assets and backups. Variable names only identify buckets; they do not create them.

For Coolify's SeaweedFS service, the S3 gateway runs in the `seaweedfs-master` container on port `8333`; the admin UI and master UI are different endpoints. The web application and SeaweedFS service must share a Docker network. Enable **Connect To Predefined Network** on the SeaweedFS service and redeploy it, then use `http://<seaweedfs-master-container-name>:8333` as the web application's `S3_ENDPOINT`. Do not use `localhost`, a public proxy URL, or the filer/admin port. If the hostname resolves but connections are refused after joining the second network, add `-s3.ip.bind=0.0.0.0` to the service's `weed server` command and redeploy SeaweedFS; this makes the gateway listen on both container interfaces. The read-only check at `/admin/quellen` confirms bucket access but does not test object upload permissions.

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

The initial Coolify Internal URL normally uses the `postgres` account. It can run the first migration and bootstrap. Before the public release, provision separate credentials: `migration_owner` for migrations, `app_write` for the web application, `worker_write` for the future worker, and `app_read` for read-only public rendering. Retain the `postgres` account for database administration and role provisioning.

## First deployment

1. Configure the database, web environment, internal PostgreSQL hostname, and domain. Deploy the current password-only web image; a healthy deployment returns HTTP 200 from `/healthz` even before migrations.
2. Deploy the operations resource from the same commit, using `Dockerfile.ops`, with the PostgreSQL Internal URL as its secret runtime `DATABASE_URL`. Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` there as secret runtime variables too. It needs no public domain or health check.
3. In that resource's Terminal, run `npm run db:migrate`. This applies only migrations not yet recorded in PostgreSQL. The current release includes `0000` through `0003`; `0003` removes the old `totp_secret` column. If the database already holds users or other data, take a database backup before running it.
4. In the same Terminal, run `npm run admin:bootstrap` once. It creates the password-protected steward account and refuses to overwrite an existing one.
5. Confirm `/` opens the reveal-password screen, `/healthz` returns `{"status":"ok"}`, and `/admin/login` accepts the new account. Remove the bootstrap email and password from the operations resource, then stop that resource.

## Failure and recovery

If the health check fails, inspect the Coolify deployment logs. Coolify's HTTP health check runs inside the container and needs `curl` or `wget`; the web Dockerfile installs `curl` in its final image. A `curl: not found` or `wget: not found` error points to an older image or an incorrect Dockerfile path. If the HTTP request itself fails, check the application logs and `/healthz` response, then verify the internal `DATABASE_URL` if the application needs it to start. Roll back to the previous image if needed. Do not disable the reveal gate to diagnose a deployment. The database must be restored only from a tested encrypted backup procedure.
