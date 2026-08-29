'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Skeleton, cn } from '@veyra/ui';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronsRight,
  Ellipsis,
  PanelRightClose,
  PanelRightOpen,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { knowledgeApi } from '@/lib/knowledge-api';
import { DocumentPreview } from './document-preview';
import { IntelligencePanel } from './intelligence-panel';

export function DocumentDetailClient({ documentId }: { documentId: string }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [highlightPulse, setHighlightPulse] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const documentQuery = useQuery({
    queryKey: ['document', documentId],
    queryFn: ({ signal }) => knowledgeApi().getDocument(documentId, signal),
  });

  const openEvidence = () => {
    setHighlightPulse(true);
    window.setTimeout(() => {
      document
        .getElementById('evidence-clause')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('evidence-clause')?.focus({ preventScroll: true });
    }, 40);
  };

  const share = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setNotice('Secure document link copied. Access permissions still apply.');
    window.setTimeout(() => setNotice(null), 3200);
  };

  if (documentQuery.isLoading) {
    return (
      <main className="p-5" aria-label="Loading document" aria-busy="true">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="mt-4 h-9 w-96 max-w-full" />
        <div className="mt-5 grid h-[70vh] grid-cols-[1fr_360px] gap-px bg-[var(--color-border)]">
          <Skeleton className="rounded-none bg-[var(--color-surface)]" />
          <Skeleton className="rounded-none bg-[var(--color-background)]" />
        </div>
      </main>
    );
  }

  if (documentQuery.isError || !documentQuery.data) {
    return (
      <main className="grid min-h-[calc(100vh-72px)] place-items-center p-6" role="alert">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">The document is unavailable</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            It may have moved, or your access may have changed.
          </p>
          <Button className="mt-5" asChild>
            <Link href="/library">Return to Library</Link>
          </Button>
        </div>
      </main>
    );
  }

  const currentDocument = documentQuery.data;

  return (
    <main className="flex min-h-[calc(100vh-64px)] flex-col md:h-[calc(100vh-72px)] md:min-h-0">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 sm:px-5 md:flex md:min-h-[86px] md:items-center md:py-0">
        <div className="min-w-0 flex-1">
          <p className="hidden items-center gap-1.5 text-xs text-[var(--color-muted)] sm:flex">
            <Link href="/library" className="hover:text-[var(--color-primary)]">
              Legal
            </Link>
            <ChevronsRight aria-hidden size={12} />
            <Link href="/library" className="hover:text-[var(--color-primary)]">
              Customer contracts
            </Link>
          </p>
          <div className="flex min-w-0 items-center gap-2 sm:mt-2.5">
            <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0 sm:hidden">
              <Link href="/library" aria-label="Back to Library">
                <ChevronLeft aria-hidden size={20} />
              </Link>
            </Button>
            <h1 className="truncate text-[17px] font-semibold tracking-[-0.02em] sm:text-xl">
              {currentDocument.name}
            </h1>
            <Badge tone="success" className="hidden shrink-0 sm:inline-flex">
              <CheckCircle2 aria-hidden size={12} /> Verified
            </Badge>
            <span className="hidden h-6 min-w-10 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--color-border)] px-2 text-xs font-medium sm:inline-flex">
              v4
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 sm:mt-0">
          <div className="flex items-center gap-2 sm:hidden">
            <Badge tone="success">
              <CheckCircle2 aria-hidden size={12} /> Verified
            </Badge>
            <Badge>v4</Badge>
            <span className="text-xs text-[var(--color-muted)] tabular-nums">Page 8 of 24</span>
          </div>
          <Button className="ml-auto hidden sm:inline-flex" onClick={() => void share()}>
            <Share2 aria-hidden size={15} /> Share
          </Button>
          <Button variant="ghost" size="icon" aria-label="More document actions">
            <Ellipsis aria-hidden size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={() => setPanelOpen((value) => !value)}
            aria-label={panelOpen ? 'Collapse intelligence panel' : 'Open intelligence panel'}
            aria-pressed={panelOpen}
          >
            {panelOpen ? (
              <PanelRightClose aria-hidden size={18} />
            ) : (
              <PanelRightOpen aria-hidden size={18} />
            )}
          </Button>
        </div>
      </header>

      {notice ? (
        <div
          className="absolute right-4 top-[132px] z-40 max-w-sm rounded-[var(--radius-sm)] border border-[var(--color-success)] bg-[var(--color-success-soft)] px-3 py-2 text-xs text-[var(--color-success)] shadow-[var(--shadow-md)]"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <div
        className={cn(
          'grid min-h-0 flex-1 grid-cols-1 bg-[var(--color-border)]',
          panelOpen && 'lg:grid-cols-[minmax(540px,1fr)_380px]',
        )}
      >
        {panelOpen ? (
          <aside
            className="order-1 min-h-0 bg-[var(--color-background)] lg:order-2"
            aria-label="Document intelligence panel"
          >
            <IntelligencePanel document={currentDocument} onOpenEvidence={openEvidence} />
          </aside>
        ) : null}
        <div className="order-2 min-h-0 lg:order-1">
          <DocumentPreview
            highlightPulse={highlightPulse}
            onHighlightSettled={() => setHighlightPulse(false)}
          />
        </div>
      </div>
    </main>
  );
}
