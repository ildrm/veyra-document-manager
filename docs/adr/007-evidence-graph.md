# ADR-007: Evidence graph anchored to immutable sources

- Status: Accepted
- Date: 2026-08-29

## Context

AI answers and organizational decisions must explain which version, page/section and source span supports a claim. A generic entity graph without provenance, time or verification cannot distinguish extracted suggestions from accepted knowledge.

## Decision

Represent entities, relations, claims, evidence and verifications as first-class relational records in PostgreSQL. Evidence points to an immutable document version and exact location where available. Claims carry subject, predicate, value/units, effective/expiry time, confidence, authority, extraction model/prompt version and verification status.

Machine output begins unverified. Contradictions remain linked rather than overwritten. AI answers expose authorized evidence, source authority, dates and conflicts, never hidden chain-of-thought. Evidence authorization inherits from its source version and is checked before retrieval.

Use indexed foreign keys, recursive queries and materialized projections for initial graph access. Add a graph database only after measured traversal workloads cannot meet budgets and only as a rebuildable projection.

## Consequences

- Every accepted answer/decision can be traced to stable source coordinates and extraction lineage.
- Versioning and supersession add schema and UI complexity but prevent silent historical mutation.
- Duplicate/entity resolution and human verification need explicit workflows and audit events.
- Permission filtering can fragment a claim's visible evidence; responses must state when evidence is unavailable rather than infer from hidden sources.

## Alternatives considered

- Store extracted JSON blobs on documents: rejected because claims cannot be independently verified, queried or versioned.
- Neo4j as the initial source of truth: deferred because another transactional/backup system is not yet justified.
- Let model responses serve as knowledge: rejected because outputs lack durable provenance and governance.
