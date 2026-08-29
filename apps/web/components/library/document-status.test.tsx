import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { demoDocuments } from '@/lib/demo-data';
import { DocumentStatus } from './document-status';

describe('DocumentStatus', () => {
  it('presents a verified state with readable text', () => {
    render(<DocumentStatus document={demoDocuments[0]!} />);
    expect(screen.getByText('Verified')).toBeVisible();
  });

  it('presents processing progress to assistive technology', () => {
    render(
      <DocumentStatus
        document={{
          ...demoDocuments[0]!,
          status: 'processing',
          processingState: 'indexing',
          processingProgress: 72,
        }}
      />,
    );
    expect(screen.getByText(/Indexing/)).toHaveTextContent('72%');
  });
});
