# Threat model

Status: initial architecture review, 2026-08-29. Revisit this model when a new external integration, parser, provider, agent tool, authentication mode, or data store is introduced.

## Scope and objectives

The model covers browser, API, background/workflow processing, Python AI/ingestion, OIDC, OpenFGA, PostgreSQL, object storage, Valkey, telemetry, provider egress, webhooks and administrative access. The primary objectives are tenant isolation, confidentiality of documents and prompts, integrity/provenance of knowledge, durable auditability, safe file handling, and availability of ordinary document access when AI dependencies fail.

Protected assets include original and derived files, metadata and versions, permission tuples, identities/sessions, evidence and claims, legal holds/retention, audit events, provider credentials, prompts/responses, workflow state and encryption keys.

## Principal threats and controls

| Surface         | Threat                                                                    | Required controls                                                                                                                                             | Verification                                                          |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Authentication  | Token theft, issuer/audience confusion, session fixation                  | OIDC authorization code + PKCE, exact issuer/audience/algorithm checks, short sessions, secure cookies, MFA and revocation                                    | Negative token matrix; revoked-session test                           |
| Authorization   | IDOR, stale grants, cross-tenant access, privilege escalation             | Organization scope on every record, centralized OpenFGA checks, explicit deny, cache invalidation, RLS defense in depth                                       | Horizontal/vertical and inherited-permission tests                    |
| Search/RAG      | Confidential chunks retrieved then filtered after ranking                 | Resolve authorized scope before lexical/vector retrieval; recheck selected sources; permission-aware cache keys                                               | Canary document must never appear in search, citations or model input |
| Uploads/parsers | Malware, polyglot files, archive bombs, parser RCE, path traversal        | Private quarantine, MIME/signature and checksum checks, AV scan, expansion/page/time limits, isolated non-root workers, no execution, controlled egress       | Malicious corpus and resource-exhaustion tests                        |
| AI context      | Prompt injection, hidden instructions, exfiltration, unsafe tools         | Label content untrusted, immutable system policy, minimal context, DLP/provider policy, schema/citation validation, separately authorized tools and approvals | Injection and data-exfiltration evaluation set                        |
| Agent/workflow  | Confused deputy, replay, excessive retries, side effects after revocation | Workload identity + delegated actor, idempotency keys, bounded retries, authority recheck at side effects, human approval for high-risk actions               | Revocation-during-run and duplicate-delivery tests                    |
| API/webhooks    | Injection, SSRF, replay, brute force, unsafe redirects                    | Typed validation, parameterized queries, URL allow-list/DNS/IP checks, signed timestamped webhooks, rate limits, CSP and CSRF controls                        | Fuzzing, SSRF rebinding suite, signature/replay tests                 |
| Object storage  | Predictable keys, leaked signed URLs, untrusted promotion                 | Server-selected keys, private buckets, short-lived operation-bound URLs, versioning, separate quarantine/trusted credentials                                  | Expiry, verb/mime/key substitution tests                              |
| Data stores     | SQL injection, tenant query omission, destructive operator error          | Parameterized access, migration review, RLS, least privilege, encrypted backups and tested PITR                                                               | Static analysis, RLS integration tests, restore drills                |
| Supply chain    | Compromised package, image or CI action                                   | Lockfiles, pinned images/actions, provenance/SBOM where available, vulnerability and secret scanning, protected reviews                                       | CI policy and scheduled scan                                          |
| Telemetry/audit | Secrets/content in logs, audit tampering, trace cross-link leaks          | Allow-listed fields, source redaction, separate audit sink, append-oriented records, restricted access and retention                                          | Log scanning and audit integrity checks                               |
| Availability    | Provider outage, queue storm, expensive query, storage exhaustion         | Timeouts, bulkheads, budgets, circuit breakers, backpressure, pagination, quotas, graceful non-AI mode                                                        | Load/failure injection and capacity alerts                            |

## Security boundary rules

- A service identity does not imply an end-user grant. Delegation includes actor, organization, purpose, expiry and allowed actions.
- No client, workflow input or model output can select an unrestricted tenant scope, trusted object key, provider credential, or authorization result.
- Permission checks use immutable resource identifiers and the active model version. Denials are not cached longer than grants; revocation actively invalidates relevant positive caches.
- Human-readable evidence and audit metadata are exposed; hidden model reasoning is not stored or displayed.
- Legal hold and retention constraints take precedence over ordinary deletion workflows.

## Accepted development-only risks

The Compose environment binds ports to loopback but uses known development credentials, plaintext internal traffic, a development Keycloak mode, unauthenticated Valkey, and unauthenticated local telemetry. It is not suitable for shared hosts or production. Production requires managed secrets, private networking, TLS/mTLS or workload identity, per-service database principals, authenticated OpenFGA/telemetry, hardened parser isolation and monitored backup controls.

Security sign-off requires automated tenant and RAG-leakage tests, a parser sandbox review, external-provider data-processing approval, restore evidence, and resolution or explicit acceptance of high/critical dependency findings.
