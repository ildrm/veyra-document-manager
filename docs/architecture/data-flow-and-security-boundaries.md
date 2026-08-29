# Data flow and security boundaries

This explanation identifies where identity, trust, and data ownership change. Crossing a boundary requires validation, authorization, telemetry, and a typed failure response.

## Trust zones

| Zone               | Examples                                                       | Trust posture                                                            |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Untrusted edge     | Browser input, uploads, webhook bodies, connected repositories | Hostile until authenticated, validated, and policy checked               |
| Application        | Web server, API modules, workflow workers                      | Authenticated workload identity; least privilege per interface           |
| Processing sandbox | Parsers, OCR, extraction and preview workers                   | Handles hostile files/content with CPU, memory, time and network limits  |
| Data               | PostgreSQL, object storage, OpenFGA, Valkey                    | Private network; encrypted transport; scoped credentials                 |
| Provider egress    | Model, embedding, OCR and integration providers                | Deny by default; tenant policy, DLP and regional routing apply           |
| Operations         | Telemetry and audit access                                     | Separate privileged roles; redacted content and immutable audit controls |

## Upload and ingestion

```mermaid
sequenceDiagram
  participant U as User
  participant A as API
  participant F as OpenFGA
  participant Q as Quarantine bucket
  participant W as Temporal / worker
  participant T as Trusted bucket
  participant P as PostgreSQL

  U->>A: Create upload (identity, metadata, hash)
  A->>F: Check can_edit in target workspace/folder
  F-->>A: Authorized
  A-->>U: Short-lived quarantine upload URL
  U->>Q: Upload bytes
  U->>A: Complete upload with checksum
  A->>P: Commit version in scanning state + outbox event
  A->>W: Start idempotent ingestion workflow
  W->>Q: Read untrusted object in isolated worker
  W->>W: Signature, size, malware and archive checks
  W->>T: Promote immutable approved bytes / derived assets
  W->>P: Commit chunks, evidence provenance and ready state
```

The API never accepts a client-provided trusted-object key. Checksums, object size, MIME sniffing, archive expansion limits and malware status are verified server-side. Failed or timed-out processing leaves an inspectable state and audit event; it does not silently promote content.

## Permission-aware search and AI answers

```mermaid
sequenceDiagram
  participant U as User
  participant A as API
  participant F as OpenFGA
  participant R as Retrieval
  participant M as AI service / provider
  participant D as Audit log

  U->>A: Search or ask with access token
  A->>A: Validate issuer, audience, tenant and request
  A->>F: Resolve allowed workspace/document scope
  F-->>A: Authorized object set / checks
  A->>R: Retrieve only within authorized scope
  R-->>A: Ranked chunks with immutable source IDs
  A->>F: Recheck selected sources when policy requires
  A->>M: Redacted, bounded evidence context + policy
  M-->>A: Answer and citation candidates
  A->>A: Validate citations against supplied evidence
  A->>D: Append scope, sources, model/prompt version and outcome
  A-->>U: Stream answer with inspectable citations
```

Post-retrieval filtering is not an acceptable tenant boundary. Permission revocation invalidates affected caches and prevents subsequent retrieval, workflow activity, and agent actions. Long-running work rechecks authority at side-effect boundaries.

## Boundary controls

- Public APIs are versioned, rate-limited, schema-validated, and use idempotency keys for retryable mutations.
- Service calls carry workload identity, organization scope, correlation ID and trace context; they do not trust forwarded user identifiers without a signed delegation context.
- Object URLs are short lived, operation-specific, and bound to server-selected keys. Buckets are private.
- Provider egress sends the minimum authorized context and is blocked unless tenant policy permits the provider, model, region, and data class.
- Audit records capture security-sensitive intent and result without storing access tokens, secrets, full prompts, or unrestricted document text.
- Logs and traces use stable IDs and classifications; document content, credentials and signed URLs are redacted at source.
