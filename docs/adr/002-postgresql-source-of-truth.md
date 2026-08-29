# ADR-002: PostgreSQL as source of truth

- Status: Accepted
- Date: 2026-08-29

## Context

Documents have relational metadata, immutable versions, policies, claims, evidence, audit and workflow references that require transactions and tenant constraints. Search/vector and graph-like access are important, but must not create competing truths.

## Decision

Use PostgreSQL as the canonical store for business metadata, permission references, knowledge/evidence records, audit metadata and transactional outbox events. Model critical fields relationally; use JSONB for genuinely variable, validated extensions. Every tenant-owned row includes an organization boundary, with row-level security as defense in depth.

Use pgvector and PostgreSQL full-text search initially. Store large files and immutable derived artifacts in S3-compatible object storage with hashes and version IDs. Treat Valkey and future OpenSearch indexes as rebuildable projections.

## Consequences

- Transactions, referential integrity, temporal constraints and operational recovery share one mature platform.
- Index design, connection limits, partitioning and migration lock behavior require deliberate review.
- Search and graph workloads may eventually need specialized stores; canonical IDs and outbox events make those projections rebuildable.
- PostgreSQL backups are necessary but insufficient without coordinated object-version recovery.

## Alternatives considered

- Document database as primary: rejected because core invariants are relational and JSON flexibility does not replace schema design.
- Dedicated vector database as primary: rejected because embeddings are derived data.
- Graph database as primary: rejected until measured traversal workloads justify another consistency and operations boundary.
