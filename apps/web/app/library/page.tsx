import type { Metadata } from 'next';
import { LibraryClient } from '@/components/library/library-client';

export const metadata: Metadata = { title: 'Customer contracts' };

export default function LibraryPage() {
  return <LibraryClient />;
}
