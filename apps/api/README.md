# @veyra/api

NestJS 12 modular-monolith API for Veyra's first evidence-first document intelligence slice:

`secure upload → quarantine → asynchronous extraction → library/detail → permission-scoped search → grounded Ask`

## Run locally

From the repository root:

```bash
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm --filter @veyra/api dev
```

Copy the repository `.env.example` into your normal secret-injection workflow. The API-specific
example is [`.env.example`](./.env.example). `AI_INTERNAL_API_TOKEN` is required and is sent to
FastAPI as `Authorization: Bearer …`; the example value is development-only.

The development identity adapter requires both headers on protected requests:

```text
x-dev-organization-id: 10000000-0000-4000-8000-000000000001
x-dev-user-id:         20000000-0000-4000-8000-000000000001
```

Those IDs resolve to a real seeded database user. Roles, email, and organization membership are
never trusted from request headers. Development identity and authorization adapters refuse to
start in `NODE_ENV=production`.

Swagger UI is at `/docs`; OpenAPI JSON is at `/docs/openapi.json`.

## Module and trust boundaries

- `auth` exposes one authentication port. `OidcAuthenticationAdapter` performs discovery and
  asymmetric JWT verification. `DevelopmentAuthenticationAdapter` is local/test-only; it is not a
  production identity provider or a substitute for session lifecycle, MFA, SCIM, or revocation.
- `authorization` is the only permission decision boundary. `OpenFgaAuthorizationAdapter` uses
  Check/ListObjects. `DevelopmentAuthorizationAdapter` is deliberately limited to organization
  admin, workspace membership, and ownership semantics. Controllers contain no role checks.
- `database` creates a transaction-local `app.organization_id` for every tenant repository call.
  SQL also carries explicit organization predicates and the schema forces fail-closed RLS.
- `storage` is an S3-compatible port backed by AWS SDK v3. Downloads are 60-second signed URLs and
  are issued only for `trusted + clean` objects.
- `processing` persists a durable outbox event, attempts immediate asynchronous dispatch, reads the
  quarantined object, and calls FastAPI `/v1/ingestion/extract`. Extracted pages/chunks remain in
  `analyzing` until an external malware scanner calls the authenticated processing callback with a
  clean result. Only that callback promotes the object to trusted storage.
- `search` resolves the OpenFGA scope before passing query text to PostgreSQL. Full-text SQL applies
  the authorized document/workspace IDs and tenant RLS in the retrieval statement.
- `ask` follows the same order: identity → authorization scope → authorized chunks → FastAPI
  `/v1/answers/grounded`. Every provider citation is revalidated against the exact authorized
  Unicode code-point span before it is persisted or returned.

### Deliberately external production responsibilities

No development adapter is described as production-ready. A deployment still needs:

- a configured OIDC provider and an OpenFGA store/model/tuple writer;
- a `NOSUPERUSER NOBYPASSRLS` PostgreSQL runtime role that does not own the tables (the Docker
  bootstrap superuser is for local development only);
- a malware scanner that owns the clean/infected decision and invokes
  `POST /internal/v1/processing/callback` with `x-internal-api-key`;
- a durable outbox worker for retrying pending events across organizations. The in-process path is
  best-effort only and leaves failures pending with exponential retry metadata;
- lifecycle cleanup for retained quarantine copies after successful promotion;
- a DOCX-to-supported-ingestion converter. Upload validation accepts DOCX into quarantine, while
  the current FastAPI extraction endpoint processes PDF/plain-text inputs;
- backup/restore operations, key rotation, audit export/WORM policy, and SLO instrumentation.

These are provider seams, not silent mocks.

## HTTP surface

| Route                                     | Purpose                                                         |
| ----------------------------------------- | --------------------------------------------------------------- |
| `GET /health/live`                        | Process liveness                                                |
| `GET /health/ready`                       | PostgreSQL, S3 buckets, and FastAPI readiness                   |
| `GET /v1/documents`                       | Permission-filtered cursor page                                 |
| `POST /v1/documents/upload`               | Streaming multipart validation, SHA-256, quarantine, job/outbox |
| `GET /v1/documents/:id`                   | Detail and persisted citations                                  |
| `GET /v1/documents/:id/download`          | Short-lived trusted-object URL                                  |
| `GET /v1/documents/:id/processing/events` | Processing-state SSE                                            |
| `GET /v1/search`                          | Permission-aware PostgreSQL full-text search                    |
| `POST /v1/ask`                            | JSON grounded answer fallback                                   |
| `POST /v1/ask/stream`                     | SSE events: `status`, `token`, `citation`, `complete`, `error`  |

All responses carry `x-correlation-id`. Errors use a stable `{ error: { code, message,
correlationId, details? } }` envelope and do not expose stack traces.

## Schema and migrations

`src/database/migrations` contains ordered up/down SQL. The initial schema covers organizations,
users, workspaces/members, documents/immutable versions, storage objects, pages/chunks,
processing jobs, audit/outbox, conversations/messages/citations, full-text indexes, pgvector, and
RLS on every tenant-owned table. `db:migrate` uses an advisory lock and records applied versions.

The deterministic seed provides two organizations and a verified contract whose exact evidence is:
`99.95% monthly uptime`, page 14, version v7.0. The second tenant exists specifically for isolation
verification.

## Initial capacity and reliability assumptions

These are starting design targets, not measured production claims:

- shared-database multi-tenancy; confidential/PII-bearing document content;
- read-heavy workload, initially below 100 p99 requests/second per deployment;
- p95 below 500 ms for metadata/full-text endpoints excluding external AI latency;
- 99.9% monthly API availability, with the platform owner consuming the error budget;
- RPO at most 15 minutes and RTO at most 4 hours.

Revisit pool sizing, FGA ListObjects scale, search architecture, and partitioning before a forecast
of 100,000+ documents per organization or 1,000+ p99 requests/second. OpenSearch is the intended
advanced retrieval boundary; PostgreSQL remains the source of truth.

## Verification

```bash
corepack pnpm --filter @veyra/api typecheck
corepack pnpm --filter @veyra/api test
corepack pnpm --filter @veyra/api build
```

Tests cover exact citation acceptance/tampering, cross-tenant denial, forced RLS policy coverage,
and upload signature/hash behavior. Migration and seed SQL are also suitable for validation against
the local pgvector PostgreSQL container.
