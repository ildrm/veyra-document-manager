import type { Metadata } from 'next';
import { Badge, Button } from '@veyra/ui';
import { ArrowRight, CheckCircle2, FileText, GitCompareArrows, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { ids } from '@/lib/demo-data';

export const metadata: Metadata = { title: 'Knowledge' };

export default function KnowledgePage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-72px)] max-w-[1180px] px-4 py-6 sm:px-7 lg:py-9">
      <p className="text-xs font-medium text-[var(--color-muted)]">Verified knowledge</p>
      <h1 className="mt-2 text-[clamp(1.7rem,3vw,2.2rem)] font-semibold tracking-[-0.04em]">
        Contract commitments
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
        Claims stay connected to the exact source, effective period, authority, and review state.
      </p>

      <section
        className="mt-8 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]"
        aria-labelledby="current-truth"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <h2 id="current-truth" className="text-sm font-semibold">
            Current authoritative claim
          </h2>
          <Badge tone="success">
            <CheckCircle2 aria-hidden size={12} /> Verified
          </Badge>
          <span className="ml-auto text-xs text-[var(--color-muted)]">Effective May 12, 2025</span>
        </div>
        <div className="grid gap-6 p-5 md:grid-cols-[1fr_1.05fr]">
          <div>
            <p className="text-xs text-[var(--color-muted)]">Acme Corp · service_availability</p>
            <p className="mt-3 text-[28px] font-semibold tracking-[-0.035em] text-[var(--color-primary)]">
              99.95% monthly uptime
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted-strong)]">
              Signed customer agreement, current version v4. Scheduled Maintenance and Force Majeure
              are excluded.
            </p>
          </div>
          <Link
            href={`/documents/${ids.acmeDocument}`}
            className="evidence-thread rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] p-4 pl-5 outline-none hover:border-[var(--color-primary)] focus-visible:shadow-[var(--focus-ring)]"
          >
            <span className="flex items-center gap-2 text-xs font-semibold">
              <FileText aria-hidden size={15} className="text-[var(--color-primary)]" /> Acme Master
              Services Agreement · v4 · Page 8
            </span>
            <span className="reading-font mt-3 block text-[15px] leading-6">
              “…achieve <mark>99.95% monthly uptime</mark>, excluding Scheduled Maintenance…”
            </span>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)]">
              Inspect source <ArrowRight aria-hidden size={13} />
            </span>
          </Link>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="conflict-heading">
        <div className="flex items-center gap-2">
          <ShieldAlert aria-hidden size={17} className="text-[var(--color-warning)]" />
          <h2 id="conflict-heading" className="text-sm font-semibold">
            Related source needs review
          </h2>
          <Badge tone="warning">Potential conflict</Badge>
        </div>
        <article className="mt-3 grid gap-4 border-y border-[var(--color-border)] py-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[13px] font-semibold">Globex Service Level Schedule · v2</p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
              A related schedule says 99.9% monthly uptime. It applies to a different customer but
              shares the “Standard tier” taxonomy.
            </p>
          </div>
          <Button>
            <GitCompareArrows aria-hidden size={15} /> Compare evidence
          </Button>
        </article>
      </section>
    </main>
  );
}
