'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { Badge, Button } from '@veyra/ui';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Link2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { DocumentDetail } from '@veyra/contracts';

interface IntelligencePanelProps {
  document: DocumentDetail;
  onOpenEvidence: () => void;
}

export function IntelligencePanel({ document, onOpenEvidence }: IntelligencePanelProps) {
  const citation = document.citations[0];
  return (
    <Tabs.Root defaultValue="ai" className="flex min-h-0 flex-col bg-[var(--color-background)]">
      <Tabs.List
        aria-label="Document intelligence"
        className="grid min-h-12 grid-cols-4 border-b border-[var(--color-border)] px-2"
      >
        {(
          [
            ['overview', 'Overview'],
            ['ai', 'AI'],
            ['metadata', 'Metadata'],
            ['versions', 'Versions'],
          ] as const
        ).map(([value, label]) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className="relative px-2 text-xs font-medium text-[var(--color-muted)] outline-none hover:text-[var(--color-foreground)] focus-visible:shadow-[inset_var(--focus-ring)] data-[state=active]:text-[var(--color-primary)] data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-[var(--color-primary)]"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content
        value="ai"
        className="min-h-0 flex-1 overflow-y-auto p-4 outline-none sm:p-5 veyra-scrollbar"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
          Your question
        </p>
        <div className="mt-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-primary-soft)] p-3 text-[13px] leading-5">
          What uptime have we committed to for this customer?
        </div>

        <div className="mt-6 flex items-center gap-2 text-[13px] font-semibold">
          <Sparkles aria-hidden size={17} className="text-[var(--color-primary)]" /> Answer
        </div>
        <p className="mt-3 text-[22px] font-semibold leading-tight tracking-[-0.025em] text-[var(--color-primary)] sm:text-[24px]">
          99.95% monthly uptime.
        </p>
        <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted-strong)]">
          Scheduled Maintenance and Force Majeure events are excluded from the calculation.
        </p>

        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">Evidence</h3>
          <Badge tone="info">1 exact source</Badge>
        </div>
        {citation ? (
          <button
            type="button"
            onClick={onOpenEvidence}
            className="evidence-thread mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-primary)] bg-[var(--color-surface-raised)] p-3 pl-4 text-left shadow-[var(--shadow-sm)] outline-none hover:bg-[var(--color-primary-soft)] focus-visible:shadow-[var(--focus-ring)]"
            aria-label="Open citation on page 8"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <FileText aria-hidden size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">
                  Master Services Agreement · v4 · Page 8
                </span>
                <span className="reading-font mt-2 block rounded bg-[color-mix(in_srgb,var(--color-highlight)_66%,transparent)] px-2 py-1.5 text-[14px] leading-5">
                  “…achieve <mark>99.95% monthly uptime</mark>, excluding Scheduled Maintenance and
                  Force Majeure events…”
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
                    <CheckCircle2 aria-hidden size={13} /> High confidence
                  </span>
                  <span className="inline-flex items-center gap-1 text-[var(--color-muted-strong)]">
                    <ShieldCheck aria-hidden size={13} /> Exact match
                  </span>
                </span>
              </span>
              <ChevronRight
                aria-hidden
                size={16}
                className="mt-1 shrink-0 text-[var(--color-primary)]"
              />
            </div>
          </button>
        ) : null}

        <div className="mt-6 border-t border-[var(--color-border)] pt-5">
          <h3 className="text-[13px] font-semibold">Extracted facts</h3>
          <dl className="mt-2 divide-y divide-[var(--color-border)] rounded-[var(--radius-sm)] border border-[var(--color-border)]">
            <div className="flex items-center gap-3 px-3 py-3 text-xs">
              <CalendarDays aria-hidden size={15} className="text-[var(--color-muted)]" />
              <dt>Renewal</dt>
              <dd className="ml-auto font-medium tabular-nums">Oct 12, 2026</dd>
            </div>
            <div className="flex items-center gap-3 px-3 py-3 text-xs">
              <UserRound aria-hidden size={15} className="text-[var(--color-muted)]" />
              <dt>Owner</dt>
              <dd className="ml-auto font-medium">Maya Chen</dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost">
            <MessageSquareText aria-hidden size={14} /> Ask a follow-up
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenEvidence}>
            <Link2 aria-hidden size={14} /> Open source
          </Button>
        </div>
        <p className="mt-6 text-[11px] leading-5 text-[var(--color-muted)]">
          AI responses are grounded in knowledge you’re authorized to access.
        </p>
      </Tabs.Content>

      <Tabs.Content
        value="overview"
        className="min-h-0 flex-1 overflow-y-auto p-5 outline-none veyra-scrollbar"
      >
        <h3 className="text-sm font-semibold">Agreement overview</h3>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-muted-strong)]">
          {document.summary}
        </p>
        <dl className="mt-5 space-y-4 text-xs">
          <div>
            <dt className="text-[var(--color-muted)]">Customer</dt>
            <dd className="mt-1 font-medium">{document.customer}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Project</dt>
            <dd className="mt-1 font-medium">{document.project}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Security classification</dt>
            <dd className="mt-1 capitalize font-medium">{document.classification}</dd>
          </div>
        </dl>
      </Tabs.Content>

      <Tabs.Content
        value="metadata"
        className="min-h-0 flex-1 overflow-y-auto p-5 outline-none veyra-scrollbar"
      >
        <h3 className="text-sm font-semibold">Structured metadata</h3>
        <dl className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)] text-xs">
          {[
            ['Document type', 'Master services agreement'],
            ['Customer', 'Acme Corp'],
            ['Effective date', 'May 12, 2025'],
            ['Renewal date', 'Oct 12, 2026'],
            ['Governing law', 'Delaware'],
            ['Classification', 'Confidential'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start gap-3 py-3">
              <dt className="text-[var(--color-muted)]">{label}</dt>
              <dd className="ml-auto text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </Tabs.Content>

      <Tabs.Content
        value="versions"
        className="min-h-0 flex-1 overflow-y-auto p-5 outline-none veyra-scrollbar"
      >
        <h3 className="text-sm font-semibold">Version history</h3>
        <ol className="mt-4 space-y-4">
          {[
            ['v4', 'Current · Verified', 'May 12, 2025'],
            ['v3', 'Superseded', 'Apr 18, 2025'],
            ['v2', 'Superseded', 'Jan 30, 2025'],
          ].map(([version, status, date]) => (
            <li
              key={version}
              className="flex gap-3 border-b border-[var(--color-border)] pb-4 last:border-0"
            >
              <span className="flex size-8 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-surface)] text-xs font-semibold">
                {version}
              </span>
              <span className="text-xs">
                <span className="block font-medium">{status}</span>
                <span className="mt-1 block text-[var(--color-muted)]">{date}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-8"
                aria-label={`Open version ${version}`}
              >
                <ExternalLink aria-hidden size={14} />
              </Button>
            </li>
          ))}
        </ol>
      </Tabs.Content>
    </Tabs.Root>
  );
}
