-- Deterministic demonstration identities. These are local-development data, never credentials.
SELECT set_config('app.organization_id', '10000000-0000-4000-8000-000000000001', true);

INSERT INTO organizations (id, slug, name)
VALUES ('10000000-0000-4000-8000-000000000001', 'northstar', 'Northstar Systems')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, organization_id, external_subject, email, display_name, roles)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'dev:alice', 'alice@northstar.example', 'Alice Morgan', ARRAY['knowledge-admin']),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'dev:bob', 'bob@northstar.example', 'Bob Chen', ARRAY[]::text[])
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, organization_id, slug, name, description, created_by)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'customer-contracts',
  'Customer Contracts',
  'Approved commercial agreements and their evidence.',
  '20000000-0000-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (organization_id, workspace_id, user_id, role)
VALUES
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'manager'),
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'viewer')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO storage_objects (
  id, organization_id, bucket, object_key, state, media_type, byte_size, sha256, scan_status, trusted_at
)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'veyra-trusted',
  '10000000-0000-4000-8000-000000000001/contracts/acme-master-services-agreement-v7.pdf',
  'trusted',
  'application/pdf',
  184320,
  'd2a4f27c8d469b017aa7df885cf685eca1c58fba3d0e8245726e19a5e172b1a4',
  'clean',
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO documents (
  id, organization_id, workspace_id, owner_id, name, media_type, classification,
  status, processing_state, processing_progress, customer, project, summary, renewal_at
)
VALUES (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Acme Master Services Agreement',
  'application/pdf',
  'confidential',
  'verified',
  'ready',
  100,
  'Acme Corporation',
  'Project Atlas',
  'Signed enterprise agreement covering service levels, remedies, and renewal.',
  '2027-03-31T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_versions (
  id, organization_id, document_id, storage_object_id, version_number, version_label,
  original_filename, media_type, byte_size, sha256, page_count, extracted_text,
  extraction_model, created_by
)
VALUES (
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  7,
  'v7.0',
  'acme-master-services-agreement-v7.pdf',
  'application/pdf',
  184320,
  'd2a4f27c8d469b017aa7df885cf685eca1c58fba3d0e8245726e19a5e172b1a4',
  24,
  'Service Level Commitment. Provider commits to 99.95% monthly uptime for the Production Service. If availability falls below this level, Customer may request the service credits described in Schedule B.',
  'veyra-layout-2026-08',
  '20000000-0000-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

UPDATE documents
SET current_version_id = '60000000-0000-4000-8000-000000000001'
WHERE id = '50000000-0000-4000-8000-000000000001';

INSERT INTO document_pages (
  id, organization_id, document_id, document_version_id, page_number, text_content, layout
)
VALUES (
  '70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  14,
  'Service Level Commitment. Provider commits to 99.95% monthly uptime for the Production Service. If availability falls below this level, Customer may request the service credits described in Schedule B.',
  '{"width":612,"height":792,"source":"pdf-text"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_chunks (
  id, organization_id, document_id, document_version_id, page_id, ordinal, section,
  content, page_start_offset, page_end_offset
)
VALUES (
  '80000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  0,
  'Schedule A — Service Levels',
  'Service Level Commitment. Provider commits to 99.95% monthly uptime for the Production Service. If availability falls below this level, Customer may request the service credits described in Schedule B.',
  0,
  length('Service Level Commitment. Provider commits to 99.95% monthly uptime for the Production Service. If availability falls below this level, Customer may request the service credits described in Schedule B.')
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO processing_jobs (
  id, organization_id, document_id, document_version_id, state, stage, progress, attempt,
  started_at, completed_at
)
VALUES (
  '90000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  'succeeded',
  'index',
  100,
  1,
  now() - interval '12 seconds',
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_conversations (id, organization_id, user_id, workspace_id, title)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'Acme uptime commitment'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_messages (
  id, organization_id, conversation_id, role, content, sufficient_evidence,
  conflicting_evidence, provider, model, latency_ms
)
VALUES
  (
    'b0000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'user',
    'What uptime have we committed to for this customer?',
    NULL, NULL, NULL, NULL, NULL
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'assistant',
    'The agreement commits to 99.95% monthly uptime for the Production Service.',
    true, false, 'seeded-evidence', 'deterministic', 42
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_citations (
  id, organization_id, message_id, document_id, document_version_id, page_id, chunk_id,
  quote, page_start_offset, page_end_offset, confidence, verification_status, match_type
)
SELECT
  'c0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001',
  '99.95% monthly uptime',
  position('99.95% monthly uptime' in text_content) - 1,
  position('99.95% monthly uptime' in text_content) - 1 + length('99.95% monthly uptime'),
  0.99,
  'verified',
  'exact'
FROM document_pages
WHERE id = '70000000-0000-4000-8000-000000000001'
ON CONFLICT (id) DO NOTHING;

INSERT INTO audit_events (
  id, organization_id, actor_user_id, event_type, resource_type, resource_id,
  correlation_id, payload, occurred_at
)
VALUES (
  'd0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'document.processing.completed',
  'document',
  '50000000-0000-4000-8000-000000000001',
  'seed-flagship-contract',
  '{"version":"v7.0","result":"ready"}'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;

-- A second tenant is deliberately isolated and is used by tenant-boundary tests.
SELECT set_config('app.organization_id', '10000000-0000-4000-8000-000000000002', true);
INSERT INTO organizations (id, slug, name)
VALUES ('10000000-0000-4000-8000-000000000002', 'contoso', 'Contoso Research')
ON CONFLICT (id) DO NOTHING;
INSERT INTO users (id, organization_id, external_subject, email, display_name, roles)
VALUES (
  '20000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000002',
  'dev:mallory',
  'mallory@contoso.example',
  'Mallory Rivera',
  ARRAY['knowledge-admin']
)
ON CONFLICT (id) DO NOTHING;
