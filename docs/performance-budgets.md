# Performance budgets

These are initial service-level indicators and engineering budgets, not measured production claims. Report p50/p95/p99 and error rate by organization-independent cohorts; validate with representative document sizes, 100,000 documents, 1,000,000 chunks and concurrent searches before changing a target.

## User-facing budgets

| Journey                       | Target                     | Measurement boundary                                             |
| ----------------------------- | -------------------------- | ---------------------------------------------------------------- |
| Largest Contentful Paint      | p75 ≤ 2.5 s                | Mobile-equivalent field data                                     |
| Interaction to Next Paint     | p75 ≤ 200 ms               | Field data, excluding deliberate upload input latency            |
| Cumulative Layout Shift       | p75 ≤ 0.10                 | Full page lifecycle                                              |
| Cached route transition       | p95 ≤ 500 ms               | Interaction to useful content/skeleton replacement               |
| API read                      | p95 ≤ 300 ms, p99 ≤ 800 ms | Edge receipt to response, excluding streamed bodies              |
| API mutation acknowledgement  | p95 ≤ 500 ms               | Durable commit/queue acknowledgement, not background completion  |
| Search first page             | p95 ≤ 1.0 s, p99 ≤ 2.0 s   | Query receipt to permission-checked results                      |
| Search suggestion             | p95 ≤ 200 ms               | Warm service, bounded prefix query                               |
| AI first token                | p95 ≤ 2.5 s                | Ask receipt through authorized retrieval to first streamed token |
| AI citation finalization      | ≤ 1 s after final token    | Citation validation and audit completion                         |
| Upload acceptance             | p95 ≤ 750 ms               | Completion signal to durable `scanning` state                    |
| Background progress freshness | p95 ≤ 5 s                  | Worker state change to visible UI event                          |

AI provider latency is reported separately but is not excluded from the user-facing measurement. When the provider exceeds the budget, the UI must remain responsive, show progress/cancel affordances, and preserve non-AI features.

## Resource and query budgets

- Initial route JavaScript should remain below 200 KiB gzip; rich editors, graph canvases and workflow designers load only on routes that use them.
- List APIs default to at most 50 items and cap at 200. Use keyset/cursor pagination for unbounded collections.
- Ordinary request paths target no more than 20 database statements and no N+1 query growth. Any query over 100 ms in a representative environment emits a slow-query signal and receives `EXPLAIN (ANALYZE, BUFFERS)` review.
- Search candidate pools are bounded before reranking and model context. The LLM never receives an entire large document when a small authorized evidence set suffices.
- Upload, parsing and embedding concurrency is quota-controlled per organization and globally. Worker CPU, memory, archive expansion, pages and execution time have hard limits.
- Telemetry overhead targets less than 3% CPU and 2% request latency at p95; sampling preserves errors and high-risk audit spans.

## Reliability budgets

Initial monthly objectives are 99.9% API availability, 99.5% permission-checked search success, 99.5% accepted-upload completion, and 99.0% AI answer-start success where an approved provider is configured. AI failures do not consume the ordinary document-access SLO.

Burn-rate alerts use both fast (1 hour) and slow (6/24 hour) windows. A budget breach blocks feature expansion in the affected path until instrumentation identifies the bottleneck and a measured remediation is accepted.

## Test gates

CI checks static bundle regressions when build artifacts exist. Scheduled or release-candidate tests run browser journeys, API/search load, ingestion throughput and permission-leak canaries on production-like data. Results, hardware, dataset, concurrency, cache state and commit SHA are retained together; isolated laptop timings do not redefine these budgets.
