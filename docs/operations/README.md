# Operations guide

This how-to is the entry point for operators. The local Compose stack demonstrates dependencies and telemetry; production topology and credentials are environment-specific infrastructure as code.

## Observe service health

| Component      | Readiness signal                                  | Degraded behavior                                               |
| -------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| Web/API        | `/health/ready` plus dependency detail            | Read-only or non-AI paths remain available where safe           |
| Python service | `/health/live`, `/health/ready`                   | Parsing/AI requests queue or fail with retry guidance           |
| PostgreSQL     | connection plus trivial query                     | Mutations stop; do not serve stale authorization-sensitive data |
| Object storage | authenticated read/write probe to a canary prefix | Upload/download disabled; metadata remains visible              |
| OpenFGA        | gRPC health and check canary                      | Fail closed for protected operations                            |
| Temporal       | cluster health and task-queue backlog             | New durable work is accepted only when safely persisted         |
| Valkey         | ping and latency                                  | Fall back to direct sources; rate limiting must remain safe     |
| Telemetry      | collector exporter queue/failure metrics          | Application continues; alert on observability loss              |

Correlate a user-visible error with its correlation ID, then inspect the distributed trace, structured logs, metrics and append-oriented audit record. Logs and traces must not contain document bodies, prompts, tokens, signed URLs or secrets.

## Deploy safely

1. Review migrations for lock duration, backward compatibility and forward-fix strategy.
2. Back up authoritative data and verify current restore evidence.
3. Deploy code that tolerates both old and new schemas before destructive cleanup.
4. Run readiness, tenant-isolation, upload/search/citation and authorization canaries.
5. Monitor error-budget burn, queue age, database saturation and provider failure rate.
6. Roll back code when compatible; otherwise execute the reviewed forward fix. Never improvise a production schema rollback.

Workflow definitions and OpenFGA models are versioned artifacts. Existing Temporal executions remain pinned to compatible workflow code. Authorization model changes run fixture, compatibility and deny-path tests before the application begins using the new model ID.

## Minimum alerts

- API/search availability and latency burn rate;
- authentication or authorization-denial anomaly rate;
- permission cache invalidation failures;
- PostgreSQL connections, replication/WAL lag, disk and slow queries;
- object-store errors, capacity and replication/versioning health;
- Temporal task-queue age, workflow failures and retry storms;
- ingestion age/failure by stage and quarantine backlog;
- AI first-token latency, provider failures, cost/budget rejection and unsupported-claim rate;
- OpenTelemetry dropped spans/logs/metrics and exporter queue saturation;
- backup age, restore verification age and key/certificate expiry.

## Incident priorities

Contain cross-tenant exposure first: disable the affected retrieval/action path, revoke sessions or provider credentials as needed, preserve audit evidence, and notify the incident/security leads. Do not delete suspicious source objects or logs during investigation. For provider outages, open the circuit and keep document access/search available. For ingestion storms, pause new workflow starts while preserving durable state.

Follow the [disaster recovery runbook](disaster-recovery.md) for authoritative-data loss. Local service commands and ports are in [`infrastructure/README.md`](../../infrastructure/README.md).
