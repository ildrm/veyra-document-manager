CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE FUNCTION veyra_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE FUNCTION veyra_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE FUNCTION veyra_protect_document_version_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.organization_id IS DISTINCT FROM NEW.organization_id
     OR OLD.document_id IS DISTINCT FROM NEW.document_id
     OR OLD.storage_object_id IS DISTINCT FROM NEW.storage_object_id
     OR OLD.version_number IS DISTINCT FROM NEW.version_number
     OR OLD.version_label IS DISTINCT FROM NEW.version_label
     OR OLD.original_filename IS DISTINCT FROM NEW.original_filename
     OR OLD.media_type IS DISTINCT FROM NEW.media_type
     OR OLD.byte_size IS DISTINCT FROM NEW.byte_size
     OR OLD.sha256 IS DISTINCT FROM NEW.sha256
     OR OLD.created_by IS DISTINCT FROM NEW.created_by
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'document version identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  external_subject text NOT NULL,
  email citext NOT NULL,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
  roles text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_subject),
  UNIQUE (organization_id, email),
  UNIQUE (organization_id, id)
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, created_by) REFERENCES users(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE workspace_members (
  organization_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer', 'contributor', 'editor', 'manager')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (organization_id, workspace_id) REFERENCES workspaces(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, user_id) REFERENCES users(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE storage_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  bucket text NOT NULL,
  object_key text NOT NULL,
  state text NOT NULL CHECK (state IN ('quarantined', 'scanning', 'trusted', 'rejected', 'deleted')),
  media_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  encryption text NOT NULL DEFAULT 'SSE-S3',
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'infected', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  trusted_at timestamptz,
  UNIQUE (bucket, object_key),
  UNIQUE (organization_id, id)
);

CREATE INDEX storage_objects_dedup_idx
  ON storage_objects (organization_id, sha256)
  WHERE state IN ('quarantined', 'scanning', 'trusted');

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 500),
  media_type text NOT NULL,
  classification text NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('draft', 'processing', 'verified', 'needs_review')),
  processing_state text NOT NULL DEFAULT 'queued'
    CHECK (processing_state IN ('queued', 'scanning', 'extracting', 'analyzing', 'indexing', 'ready', 'failed')),
  processing_progress smallint NOT NULL DEFAULT 0 CHECK (processing_progress BETWEEN 0 AND 100),
  current_version_id uuid,
  customer text,
  project text,
  summary text,
  renewal_at timestamptz,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(customer, '') || ' ' || coalesce(project, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'C')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, workspace_id) REFERENCES workspaces(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, owner_id) REFERENCES users(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX documents_library_idx
  ON documents (organization_id, workspace_id, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX documents_search_idx ON documents USING gin (search_vector);

CREATE TABLE document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL,
  storage_object_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  version_label text NOT NULL CHECK (length(version_label) BETWEEN 1 AND 40),
  original_filename text NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 500),
  media_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  page_count integer CHECK (page_count > 0),
  extracted_text text,
  extraction_model text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, document_id, id),
  FOREIGN KEY (organization_id, document_id) REFERENCES documents(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, storage_object_id) REFERENCES storage_objects(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, created_by) REFERENCES users(organization_id, id) ON DELETE RESTRICT
);

ALTER TABLE documents ADD CONSTRAINT documents_current_version_fk
  FOREIGN KEY (organization_id, current_version_id)
  REFERENCES document_versions(organization_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE document_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  page_number integer NOT NULL CHECK (page_number > 0),
  text_content text NOT NULL,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(layout) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_version_id, page_number),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, document_version_id, id),
  FOREIGN KEY (organization_id, document_id) REFERENCES documents(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, document_id, document_version_id)
    REFERENCES document_versions(organization_id, document_id, id) ON DELETE CASCADE
);

CREATE TABLE document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  page_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  section text,
  content text NOT NULL CHECK (length(content) > 0),
  page_start_offset integer NOT NULL CHECK (page_start_offset >= 0),
  page_end_offset integer NOT NULL CHECK (page_end_offset > page_start_offset),
  embedding vector(1536),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_version_id, ordinal),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, document_version_id, id),
  FOREIGN KEY (organization_id, document_id) REFERENCES documents(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, document_id, document_version_id)
    REFERENCES document_versions(organization_id, document_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, document_version_id, page_id)
    REFERENCES document_pages(organization_id, document_version_id, id) ON DELETE CASCADE,
  CHECK (page_end_offset - page_start_offset >= length(content))
);

CREATE INDEX document_chunks_search_idx ON document_chunks USING gin (search_vector);
CREATE INDEX document_chunks_document_idx
  ON document_chunks (organization_id, document_id, document_version_id, ordinal);

CREATE TABLE processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued', 'running', 'retry_wait', 'succeeded', 'failed', 'cancelled')),
  stage text NOT NULL DEFAULT 'scan',
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, document_id) REFERENCES documents(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, document_id, document_version_id)
    REFERENCES document_versions(organization_id, document_id, id) ON DELETE CASCADE
);

CREATE INDEX processing_jobs_claim_idx
  ON processing_jobs (organization_id, available_at, created_at)
  WHERE state IN ('queued', 'retry_wait');

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid,
  event_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  correlation_id text NOT NULL,
  ip_address inet,
  user_agent text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, actor_user_id) REFERENCES users(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX audit_events_timeline_idx
  ON audit_events (organization_id, occurred_at DESC, id DESC);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbox_events_pending_idx
  ON outbox_events (organization_id, available_at, created_at)
  WHERE processed_at IS NULL;

CREATE TABLE ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  workspace_id uuid,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, user_id) REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, workspace_id) REFERENCES workspaces(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  sufficient_evidence boolean,
  conflicting_evidence boolean,
  provider text,
  model text,
  latency_ms integer CHECK (latency_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, conversation_id) REFERENCES ai_conversations(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE ai_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  page_id uuid NOT NULL,
  chunk_id uuid NOT NULL,
  quote text NOT NULL CHECK (length(quote) > 0),
  page_start_offset integer NOT NULL CHECK (page_start_offset >= 0),
  page_end_offset integer NOT NULL CHECK (page_end_offset > page_start_offset),
  confidence real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  verification_status text NOT NULL
    CHECK (verification_status IN ('verified', 'machine_extracted', 'needs_review')),
  match_type text NOT NULL CHECK (match_type IN ('exact', 'semantic', 'hybrid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, message_id) REFERENCES ai_messages(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, document_id) REFERENCES documents(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, document_id, document_version_id)
    REFERENCES document_versions(organization_id, document_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, document_version_id, page_id)
    REFERENCES document_pages(organization_id, document_version_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, document_version_id, chunk_id)
    REFERENCES document_chunks(organization_id, document_version_id, id) ON DELETE RESTRICT,
  CHECK (page_end_offset - page_start_offset = length(quote))
);

CREATE INDEX ai_citations_message_idx ON ai_citations (organization_id, message_id);

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION veyra_set_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION veyra_set_updated_at();
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION veyra_set_updated_at();
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION veyra_set_updated_at();
CREATE TRIGGER document_versions_identity_immutable BEFORE UPDATE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION veyra_protect_document_version_identity();
CREATE TRIGGER processing_jobs_updated_at BEFORE UPDATE ON processing_jobs
  FOR EACH ROW EXECUTE FUNCTION veyra_set_updated_at();
CREATE TRIGGER ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION veyra_set_updated_at();
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION veyra_reject_mutation();

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members FORCE ROW LEVEL SECURITY;
ALTER TABLE storage_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_objects FORCE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pages FORCE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_citations FORCE ROW LEVEL SECURITY;

CREATE POLICY organizations_tenant ON organizations
  USING (id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY users_tenant ON users
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY workspaces_tenant ON workspaces
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY workspace_members_tenant ON workspace_members
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY storage_objects_tenant ON storage_objects
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY documents_tenant ON documents
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY document_versions_tenant ON document_versions
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY document_pages_tenant ON document_pages
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY document_chunks_tenant ON document_chunks
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY processing_jobs_tenant ON processing_jobs
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY audit_events_tenant ON audit_events
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY outbox_events_tenant ON outbox_events
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY ai_conversations_tenant ON ai_conversations
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY ai_messages_tenant ON ai_messages
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY ai_citations_tenant ON ai_citations
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
