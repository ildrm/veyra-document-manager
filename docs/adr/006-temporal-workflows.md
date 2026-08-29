# ADR-006: Temporal for durable workflows

- Status: Accepted
- Date: 2026-08-29

## Context

Ingestion, approvals, timers, retries and AI steps can outlive requests and deployments. Database status fields plus ad hoc queues do not safely provide durable timers, human waits, retry history or deterministic resume behavior.

## Decision

Use Temporal for durable, multi-step workflows. HTTP mutations durably record intent and return promptly. Workflow definitions are versioned; running executions remain compatible with the code/version on which they started unless explicitly migrated.

Activities are idempotent, bounded by timeouts and retry policies, and store large payloads in canonical/object storage rather than workflow history. They recheck authorization before material side effects and use stable idempotency keys. Human approvals and high-risk agent actions are explicit workflow states.

## Consequences

- Crashes, timers and transient provider failures are handled with inspectable durable history.
- Engineers must follow deterministic workflow-code constraints and safe versioning patterns.
- Temporal SQL state is operationally critical but is not the canonical document/knowledge store.
- Simple best-effort local events need not become workflows; use Temporal only for durable coordination.

## Alternatives considered

- Cron plus database polling: rejected for complex waits, retries and operator visibility.
- Queue workers only: useful for individual jobs, but insufficient as the workflow state machine.
- Custom workflow engine: rejected because durability/versioning correctness is not product differentiation.
