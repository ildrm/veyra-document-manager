# ADR-004: PostgreSQL-first hybrid search

- Status: Accepted
- Date: 2026-08-29

## Context

Search must combine lexical relevance, vectors, metadata, authority, freshness and permissions. Adding OpenSearch immediately would create another operational and consistency surface before query volume and analyzer needs are known.

## Decision

Start with PostgreSQL full-text search plus pgvector. Build a bounded pipeline: normalize intent, resolve authorized scope, run lexical/vector retrieval with metadata/temporal filters, fuse ranks, rerank a limited candidate set, revalidate sources, and return highlighted results with provenance.

Preserve a search adapter and versioned index events so OpenSearch can become a derived projection. Introduce it when measured scale or requirements such as sophisticated analyzers, high-cardinality facets, typo tolerance or independent query scaling exceed the PostgreSQL design.

## Consequences

- The initial system has fewer consistency and recovery paths and can ship a complete secure slice sooner.
- PostgreSQL indexes, vector dimensions, candidate bounds and query plans require performance tests on realistic data.
- Search writes are transactional with canonical data initially; a future external index will be eventually consistent and needs reconciliation/rebuild tooling.
- Permission scope remains outside engine-specific ranking, so changing the search adapter cannot weaken the security order.

## Alternatives considered

- OpenSearch from day one: deferred because its current operational cost exceeds demonstrated need.
- Vector-only retrieval: rejected because exact terms, identifiers and policy language need lexical retrieval.
- External hosted search as authority: rejected because tenant policy and source recovery must remain under platform control.
