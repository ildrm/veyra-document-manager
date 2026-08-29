import type { Metadata } from 'next';
import { AskClient } from '@/components/ask/ask-client';

export const metadata: Metadata = { title: 'Ask Veyra' };

export default function AskPage() {
  return <AskClient />;
}
