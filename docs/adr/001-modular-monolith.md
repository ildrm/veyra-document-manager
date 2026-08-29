# ADR-001: Modular monolith first

- Status: Accepted
- Date: 2026-08-29

## Context

The product spans documents, permissions, search, knowledge, audit and workflows, but the first teams need atomic domain changes and fast feedback. Premature service boundaries would add distributed transactions, operational burden and inconsistent policy enforcement before independent scaling needs are known.

## Decision

Build the Node.js backend as a NestJS modular monolith. Each domain owns its entities, migrations, repositories and public application interfaces. Modules do not reach into another module's persistence implementation. Use in-process calls/events for local coordination and a transactional outbox when delivery must survive a commit.

Keep Python parsing/AI as a separate service because it has a distinct runtime, dependency and sandbox/scaling profile. OpenFGA, Temporal, identity and storage remain infrastructure dependencies rather than domain microservices.

Extract a module only when measured independent scale, deployment cadence, resilience, ownership or security isolation outweighs distributed-system cost.

## Consequences

- Cross-domain invariants can commit atomically and are easier to test and operate.
- Strict module boundaries and architecture tests are required to prevent a disguised big ball of mud.
- A future extraction needs an explicit API/event contract and data migration, but the interface seam already exists.
- One API deployment can affect several modules; bulkheads and dependency timeouts still matter.

## Alternatives considered

- Microservices from the start: rejected because boundaries and scale are not yet evidenced.
- One unstructured application module: rejected because it prevents ownership and later extraction.
- Serverless function per endpoint: rejected because workflows, shared policy and connection-heavy data paths would fragment.
