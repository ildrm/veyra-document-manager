# API and AI provider boundaries

The API is the policy enforcement point for clients. The Python service is a replaceable processing boundary. External AI/OCR/search vendors are adapters behind internal ports, never dependencies of domain modules.

## Public API boundary

The browser and approved integrations call versioned REST endpoints under `/api/v1`. Each request passes authentication, organization resolution, input validation, authorization, rate limiting, domain logic, audit policy and response shaping in that order. Resource identifiers never imply access.

All list endpoints use bounded cursor pagination. Retryable create/action endpoints accept idempotency keys. Errors use a stable envelope containing a safe code, user-facing message, correlation ID and field details where appropriate. Raw exceptions, SQL errors and provider payloads remain internal.

## Internal processing contract

The API sends the AI service a scoped job or request containing:

- organization and actor/delegated service identity;
- immutable document/version and authorized chunk identifiers;
- requested capability and policy/profile version;
- data classification, provider allow-list, region and budget;
- correlation, trace, idempotency and deadline metadata.

The service returns typed derived facts with provenance: output schema version, source offsets/pages, confidence, provider/model and prompt versions, token/cost counters, and safety signals. The API validates these results before committing canonical records. Workers do not invent tenant scope or write permission tuples.

Large file transfer uses short-lived, operation-specific object URLs rather than embedding bytes in JSON. Provider calls receive only the minimum evidence required for the operation.

## Provider ports

Provider-specific SDKs implement capabilities such as:

```text
generateText(request) -> GeneratedText
generateStructuredOutput(schema, request) -> ValidatedObject
createEmbeddings(chunks) -> EmbeddingBatch
rerankDocuments(query, candidates) -> RankedCandidates
classifyContent(content, taxonomy) -> Classifications
extractEntities(content) -> EntityMentions
extractClaims(content) -> EvidenceBackedClaims
summarize(content) -> Summary
evaluateAnswer(answer, evidence, rubric) -> Evaluation
```

Domain and workflow code depends on these ports, not model names or vendor response objects. The router chooses an adapter from tenant policy, capability, classification, region, latency and cost budgets. The checked-in `evidence-only` adapter is a deterministic development/test implementation and is not represented as a production model.

## Safety and failure rules

- Retrieved content is labeled untrusted data. It cannot override system policy or grant tools.
- Structured outputs are schema-validated; citations must resolve to evidence provided in the request.
- Retries apply only to transient, idempotent operations and honor deadlines and provider rate limits.
- Circuit breakers and budgets stop cascading provider failures. Document access and non-AI search continue.
- Provider credentials stay in the service secret store and are never returned to the API, browser, logs, prompts or workflow history.
- Prompts and responses are retained only under tenant policy. Telemetry records hashes, versions, latency, usage and safe identifiers by default.
- Agent tools use separately authorized, narrowly scoped actions with approval gates for material side effects.
