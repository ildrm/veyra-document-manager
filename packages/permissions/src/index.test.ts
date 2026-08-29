import { describe, expect, it } from 'vitest';
import { documentRelations } from './index';

describe('permission vocabulary', () => {
  it('keeps view and management as explicit relationships', () => {
    expect(documentRelations).toContain('can_view');
    expect(documentRelations).toContain('can_manage');
  });
});
