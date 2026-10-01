# Alles für die Tiere

German-first, evidence-led public platform for sourced project histories and a stable current-action page. The product and delivery decisions are in [`plans/`](plans/).

## Local development

```sh
npm install
npm run dev
```

The public site starts with a clearly marked non-public fixture. It deliberately contains no live action destination or factual launch claim.

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

## Verification

```sh
npm test
npm run check
npm run build
```
