import type { Metadata } from 'next';
import { Badge, Button } from '@veyra/ui';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  FileText,
  History,
  Search,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { ids } from '@/lib/demo-data';

export const metadata: Metadata = { title: 'Home' };

export default function HomePage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-72px)] max-w-[1180px] px-4 py-6 sm:px-7 lg:py-9">
      <p className="text-sm text-[var(--color-muted)]">Saturday, August 29</p>
      <h1 className="mt-1 text-[clamp(1.75rem,3vw,2.4rem)] font-semibold tracking-[-0.045em]">
        Good morning, Maya
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
        Here is the knowledge that needs your attention and the work you can continue.
      </p>

      <section className="mt-8" aria-labelledby="continue-heading">
        <div className="flex items-center justify-between">
          <h2 id="continue-heading" className="text-sm font-semibold">
            Continue working
          </h2>
          <Link
            href="/library"
            className="text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            Open Library
          </Link>
        </div>
        <Link
          href={`/documents/${ids.acmeDocument}`}
          className="mt-3 grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 outline-none hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:shadow-[var(--focus-ring)] sm:grid-cols-[auto_1fr_auto] sm:items-center"
        >
          <span className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
            <FileText aria-hidden size={19} />
          </span>
          <span>
            <span className="block text-sm font-semibold">Acme Master Services Agreement</span>
            <span className="mt-1 block text-xs text-[var(--color-muted)]">
              Page 8 · AI evidence panel open · Viewed 18 minutes ago
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)]">
            Continue <ArrowRight aria-hidden size={14} />
          </span>
        </Link>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <section aria-labelledby="attention-heading">
          <div className="flex items-center justify-between">
            <h2 id="attention-heading" className="text-sm font-semibold">
              Needs attention
            </h2>
            <Badge tone="warning">2 items</Badge>
          </div>
          <div className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            <article className="flex gap-3 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
                <ShieldAlert aria-hidden size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-semibold">Potential uptime conflict</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                  The Acme agreement says 99.95%; the service schedule still says 99.9%.
                </p>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="mt-2 -ml-2 text-[var(--color-primary)]"
                >
                  <Link href="/knowledge">
                    Review evidence <ArrowRight aria-hidden size={13} />
                  </Link>
                </Button>
              </div>
            </article>
            <article className="flex gap-3 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <CalendarClock aria-hidden size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-semibold">Acme renewal approaches in 44 days</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                  Owner Maya Chen · Renewal October 12, 2026
                </p>
              </div>
            </article>
          </div>
        </section>

        <section aria-labelledby="updates-heading">
          <h2 id="updates-heading" className="text-sm font-semibold">
            Knowledge updates
          </h2>
          <ol className="mt-3 space-y-4 border-l border-[var(--color-border)] pl-4">
            <li className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-[var(--color-background)] bg-[var(--color-success)]" />
              <p className="text-[13px] font-medium">Contract v4 verified</p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                Exact SLA evidence was linked to Section 7.2.
              </p>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-success)]">
                <CheckCircle2 aria-hidden size={12} /> 24 minutes ago
              </span>
            </li>
            <li className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-[var(--color-background)] bg-[var(--color-primary)]" />
              <p className="text-[13px] font-medium">Search index refreshed</p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                Customer contracts are searchable with current permissions.
              </p>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
                <History aria-hidden size={12} /> 31 minutes ago
              </span>
            </li>
          </ol>
        </section>
      </div>

      <section
        className="mt-9 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-6"
        aria-label="Quick actions"
      >
        <Button asChild variant="primary">
          <Link href="/ask">
            <BookOpenCheck aria-hidden size={15} /> Ask about a contract
          </Link>
        </Button>
        <Button asChild>
          <Link href="/search">
            <Search aria-hidden size={15} /> Search knowledge
          </Link>
        </Button>
      </section>
    </main>
  );
}
