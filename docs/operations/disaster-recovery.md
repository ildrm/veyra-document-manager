# Backup and disaster recovery

PostgreSQL and object storage are authoritative. Search indexes, caches, previews, embeddings and other derived projections must be reproducible from versioned source data and code.

## Initial recovery objectives

These targets require validation in each production environment.

| Data class                               | Target RPO              | Target RTO                | Recovery source                                            |
| ---------------------------------------- | ----------------------- | ------------------------- | ---------------------------------------------------------- |
| PostgreSQL business/audit data           | 15 minutes              | 4 hours                   | Encrypted base backup + continuous WAL/PITR                |
| Original and immutable object versions   | 15 minutes              | 4 hours                   | Versioned, encrypted cross-failure-domain replication      |
| Keycloak, OpenFGA and Temporal SQL state | 15 minutes              | 4 hours                   | Their isolated PostgreSQL databases                        |
| Search/vector projections                | Rebuildable             | 24 hours for full rebuild | PostgreSQL + trusted object versions + versioned pipelines |
| Valkey and local telemetry caches        | No durability objective | 1 hour                    | Empty restart / upstream replay where supported            |

Legal-hold, retention and regional requirements may require stricter objectives and immutable backup retention.

## Backup controls

- Encrypt backups with separately governed keys; restrict backup principals from modifying source data.
- Take regular PostgreSQL base backups and continuously archive WAL. Monitor backup completion, WAL continuity and restore age.
- Enable object versioning and replication; protect retention/lock configuration from ordinary application roles.
- Capture schema migration versions, OpenFGA model IDs, Keycloak realm/client configuration, Temporal workflow code versions and deployment manifests with each recovery point.
- Keep at least one logically and administratively isolated copy. A replication target alone is not protection from credential compromise or destructive automation.
- Treat audit retention and legal holds as policy inputs to backup expiration.

## Restore order

1. Declare the incident, stop writes and preserve evidence. Select a recovery point that satisfies integrity and legal requirements.
2. Restore private networking, secret/key access and infrastructure definitions without exposing data services publicly.
3. Restore PostgreSQL databases and verify checksums, migration state, tenant counts, audit continuity and point-in-time cutoff.
4. Restore object versions and verify a sampled manifest of keys, sizes and SHA-256 hashes before enabling downloads.
5. Start Keycloak and OpenFGA; validate token issuance, model IDs, tuple counts and explicit deny canaries.
6. Start Temporal with compatible workflow code; inspect running executions and task queues before workers resume side effects.
7. Start the API in restricted mode. Run tenant-isolation, document access and signed-object tests.
8. Rebuild search/vector and derived artifacts from canonical versions. Do not restore an index that is newer than its source records.
9. Re-enable background ingestion, then clients, while watching error budgets and reconciliation reports.
10. Record actual RPO/RTO, gaps, approvals and corrective actions.

## Drills and evidence

Run an automated backup verification at least daily and a production-like restore drill at least quarterly and after material storage changes. A successful drill includes application-level checks, not merely a database process starting: verify multiple tenants, permission denial, an immutable version/hash, an evidence citation, an audit event and one resumable workflow. Store drill results outside the recovered environment.
