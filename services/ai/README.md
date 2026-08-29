# Knowledge AI and ingestion service

Internal FastAPI service for deterministic PDF/text extraction and evidence-bound
answers. It is deliberately stateless and provider-neutral. Its built-in
`evidence-only-local-v1` provider is real production logic: it extracts supported
claims and performs conservative extractive QA without a network model.

## Trust boundary

- Every route under `/v1` requires an internal bearer credential. There is no
  built-in credential and a missing `AI_INTERNAL_API_TOKEN` makes readiness fail.
- The caller must authorize document access before calling this service. Every
  answer evidence chunk must carry `authorized: true` and an authorization decision
  receipt. The service never searches for, fetches, or broadens evidence.
- Document/evidence text is untrusted data. Prompt-like phrases are detected and
  excluded from answering; they are never evaluated as instructions.
- Citations are checked against the supplied chunk after every provider call. A
  quote, source identity, or offset that is not exact causes a typed `502` response.
- PII signals expose category, offsets, and a redacted preview. Request bodies and
  extracted text are never logged.
- The upstream upload pipeline remains responsible for quarantine, malware scanning,
  tenant policy, and deciding when an object becomes trusted. PDF parsing should run
  with container/runtime isolation in production.

Offsets are zero-based, end-exclusive Unicode code-point offsets into normalized
text. They are not UTF-8 byte offsets or JavaScript UTF-16 offsets. Page separators
in normalized text are two newline characters. Every returned page, chunk, claim,
entity, PII signal, and citation can therefore be verified by slicing the associated
normalized text.

## Run locally

Python 3.12 or newer is required.

```bash
cd services/ai
python -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
AI_INTERNAL_API_TOKEN=development-only-change-me \
  .venv/bin/uvicorn knowledge_ai_service.app:app \
  --host 0.0.0.0 --port 8000 --reload
```

The probes are public so an orchestrator can use them:

- `GET /health/live` — process liveness
- `GET /health/ready` — provider and authentication configuration readiness

Protected request example:

```bash
curl -sS http://localhost:8000/v1/ingestion/extract \
  -H 'Authorization: Bearer development-only-change-me' \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-ID: local-example-1' \
  --data '{
    "filename": "contract.txt",
    "media_type": "text/plain",
    "document_id": "doc-1",
    "document_version_id": "version-7",
    "text": "Service availability is 99.95%, measured monthly."
  }'
```

`/v1/ingestion/extract` also accepts a multipart `file`, a multipart `text` field,
raw supported text, or raw PDF bytes. Supported types are PDF, UTF-8 plain text,
Markdown, and CSV. A text form feed creates a page boundary. PDF pages without an
extractable text layer are returned with `requires_ocr` warnings; OCR orchestration
is intentionally outside this first vertical slice.

Grounded answer example:

```bash
curl -sS http://localhost:8000/v1/answers/grounded \
  -H 'Authorization: Bearer development-only-change-me' \
  -H 'Content-Type: application/json' \
  --data '{
    "question": "What uptime is committed?",
    "evidence": [{
      "chunk_id": "chunk-1",
      "document_id": "doc-1",
      "document_version_id": "version-7",
      "document_title": "Customer agreement",
      "text": "Service availability is 99.95%, measured monthly.",
      "start_offset": 500,
      "end_offset": 549,
      "page_number": 4,
      "section": "Service Levels",
      "authority": "signed_contract",
      "authorized": true,
      "authorization_decision_id": "openfga-decision-123"
    }]
  }'
```

The built-in provider returns `99.95% monthly uptime.` with an exact evidence span.
It returns `insufficient_evidence` instead of guessing. Distinct SLA values are
returned with `conflict: true` and a citation for each value.

## Configuration

| Variable                     |       Default | Purpose                                   |
| ---------------------------- | ------------: | ----------------------------------------- |
| `AI_INTERNAL_API_TOKEN`      |          none | Required credential for protected routes  |
| `AI_ENVIRONMENT`             | `development` | Log/runtime environment label             |
| `AI_LOG_LEVEL`               |        `INFO` | Structured JSON log level                 |
| `AI_MAX_UPLOAD_BYTES`        |    `10485760` | Maximum document bytes                    |
| `AI_MAX_PDF_PAGES`           |         `500` | PDF page limit                            |
| `AI_MAX_EVIDENCE_CHUNKS`     |          `50` | Grounded-answer scope limit               |
| `AI_MAX_EVIDENCE_CHARACTERS` |      `250000` | Combined evidence text limit              |
| `AI_CHUNK_SIZE`              |        `1000` | Target normalized characters per chunk    |
| `AI_CHUNK_OVERLAP`           |         `120` | Overlap between adjacent same-page chunks |

Rotate the internal token through the deployment secret manager. The service accepts
`Authorization: Bearer ...`; `X-Internal-Api-Token` and the legacy-compatible
`X-Internal-Api-Key` exist for infrastructure that cannot set an Authorization
header. Never expose any of these values to a browser.

## Provider extension

`LLMProvider` is the explicit future-provider protocol. A provider must expose an ID,
readiness, and `answer_grounded`. It receives only authorized chunks. The HTTP layer
then validates that an answered result has citations and that each citation is an
exact span inside the matching authorized chunk. Provider configuration, timeouts,
retry budgets, data-residency policy, and model allowlists should be added before a
remote provider is enabled.

## Quality checks

```bash
cd services/ai
.venv/bin/ruff check .
.venv/bin/mypy src
.venv/bin/pytest
```

The suite covers authentication, typed errors/correlation IDs, deterministic hashes,
MIME/signature mismatches, PDF/text extraction, offset invariants, PII redaction,
prompt-injection inertness, insufficient evidence, the exact 99.95% answer and
citation, and conflicting SLA claims.

## Initial production assumptions and targets

These defaults make the first vertical slice concrete and should be revisited with
measured traffic:

- workload: 80% grounded-answer reads / 20% ingestion requests, up to 50 p99 QPS in
  year one; large OCR jobs are asynchronous and outside this synchronous process;
- tenancy: shared multi-tenant platform, but this service is stateless and receives
  only already-authorized evidence from the API gateway;
- sensitivity: internal/confidential data with PII, but not a PHI/PCI processing
  authorization; deployment policy may impose stronger controls;
- service target: 99.9% monthly availability, owned by the AI Gateway team as the
  named error-budget consumer; synchronous local-provider latency targets are p50
  100 ms, p95 500 ms, and p99 1,000 ms excluding upload transfer and PDF complexity;
- recovery: RPO 0 for this stateless service and RTO 15 minutes. Durable originals,
  jobs, and results belong to the primary API/object-store pipeline.

Operational alerts should cover readiness, HTTP error rate, p95/p99 latency, PDF
failure classes, evidence insufficiency, conflict rate, and worker saturation. Logs
contain correlation IDs and dimensions, not customer content.
