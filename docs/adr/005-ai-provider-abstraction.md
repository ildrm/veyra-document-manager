# ADR-005: Capability-based AI provider abstraction

- Status: Accepted
- Date: 2026-08-29

## Context

Tenants differ in approved vendors, regions, data policies, cost and model capability. Provider SDK calls spread through domain code would make governance, evaluation and replacement unreliable.

## Decision

Define internal capability ports for generation, structured output, embeddings, reranking, classification, extraction, summarization and evaluation. Provider adapters live only in the Python service integration layer. A policy router selects an adapter using tenant allow-lists, data class, region, capability, budget and health.

Requests carry authorized evidence, schema/prompt versions, deadline and trace context. Responses carry provenance, usage and safety metadata. A deterministic `evidence-only` adapter supports development/tests without pretending to be a production model.

## Consequences

- Providers and models can be evaluated or replaced without rewriting domain workflows.
- The common contract may not expose every vendor feature; provider-specific extensions require explicit reviewed capability contracts.
- Routing, evaluation datasets, prompt/version registries and cost accounting become first-class platform concerns.
- No adapter may bypass authorization, DLP, retention or audit policy.

## Alternatives considered

- Direct SDK usage in each feature: rejected because it scatters policy and vendor coupling.
- One permanent provider: rejected because enterprise residency and procurement needs vary.
- A lowest-common-denominator text endpoint only: rejected because structured output, embeddings and reranking need typed capability semantics.
