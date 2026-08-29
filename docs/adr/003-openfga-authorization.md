# ADR-003: OpenFGA relationship authorization

- Status: Accepted
- Date: 2026-08-29

## Context

Authorization must cover organizations, groups, nested folders, workspaces, document exceptions, guests and evidence. Scattered role checks cannot safely express inheritance or permission-aware retrieval.

## Decision

Use OpenFGA as the centralized relationship authorization engine, with the API as policy enforcement point. Version and test the model; persist active store/model IDs as deployment configuration. Resolve authorization before search or AI retrieval, and recheck selected resources or material side effects when revocation risk warrants it.

The initial model supports organization/workspace inheritance, group membership, folder/document grants, explicit blocks, immutable versions and evidence. PostgreSQL tenant predicates/RLS remain defense in depth. Authentication and business attributes remain outside OpenFGA; the application translates trusted context into checks or reviewed tuples.

## Consequences

- Permission behavior is reviewable and testable independently from endpoint code.
- OpenFGA availability becomes security-critical; protected operations fail closed.
- Tuple lifecycle, model compatibility, cache invalidation and consistency choices need operational tooling.
- Bulk/list retrieval needs bounded authorization patterns rather than one remote call per result.

## Alternatives considered

- Roles stored and checked in endpoint code: rejected because inheritance and exceptions become inconsistent.
- PostgreSQL ACL joins only: viable at small scope, but rejected as the sole policy engine for evolving ReBAC semantics.
- Authorization embedded in search filters only: rejected because it cannot protect non-search actions and risks stale leakage.
