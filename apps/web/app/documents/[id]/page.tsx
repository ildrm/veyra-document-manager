import type { Metadata } from 'next';
import { DocumentDetailClient } from '@/components/document/document-detail-client';

export const metadata: Metadata = { title: 'Acme Master Services Agreement' };

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentDetailClient documentId={id} />;
}
