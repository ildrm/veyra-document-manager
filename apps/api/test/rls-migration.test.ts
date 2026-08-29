import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const tenantTables = [
  'organizations',
  'users',
  'workspaces',
  'workspace_members',
  'storage_objects',
  'documents',
  'document_versions',
  'document_pages',
  'document_chunks',
  'processing_jobs',
  'audit_events',
  'outbox_events',
  'ai_conversations',
  'ai_messages',
  'ai_citations',
] as const;

describe('tenant RLS migration', () => {
  it('forces fail-closed RLS on every tenant-owned table', async () => {
    const sql = await readFile(
      new URL('../src/database/migrations/0001_document_intelligence.up.sql', import.meta.url),
      'utf8',
    );
    for (const table of tenantTables) {
      expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      expect(sql).toContain(`CREATE POLICY ${table}_tenant ON ${table}`);
    }
    expect(sql).toContain("current_setting('app.organization_id', true)");
  });
});
