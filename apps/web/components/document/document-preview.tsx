'use client';

import { Button } from '@veyra/ui';
import { ChevronLeft, ChevronRight, Download, Expand, Minus, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';

interface DocumentPreviewProps {
  highlightPulse: boolean;
  onHighlightSettled: () => void;
}

export function DocumentPreview({ highlightPulse, onHighlightSettled }: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(8);

  const changeZoom = (next: number) => setZoom(Math.min(150, Math.max(75, next)));

  return (
    <section
      className="flex min-h-0 flex-col bg-[var(--color-surface)]"
      aria-label="Document preview"
    >
      <div className="flex min-h-12 items-center gap-1.5 border-b border-[var(--color-border)] bg-[var(--color-background)] px-2 sm:px-4">
        <label className="flex items-center gap-1.5 text-xs">
          <span className="sr-only">Page number</span>
          <input
            value={page}
            onChange={(event) =>
              setPage(Math.max(1, Math.min(24, Number(event.target.value) || 1)))
            }
            className="h-8 w-10 rounded-[var(--radius-xs)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-center outline-none tabular-nums focus-visible:shadow-[var(--focus-ring)]"
            inputMode="numeric"
            aria-label="Current page"
          />
          <span className="text-[var(--color-muted)]">/ 24</span>
        </label>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden size={15} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={page >= 24}
          onClick={() => setPage((value) => value + 1)}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden size={15} />
        </Button>
        <span className="mx-1 h-5 w-px bg-[var(--color-border)] sm:mx-2" />
        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => changeZoom(zoom - 25)}
            aria-label="Zoom out"
          >
            <Minus aria-hidden size={15} />
          </Button>
          <button
            type="button"
            onClick={() => setZoom(100)}
            className="h-8 min-w-[56px] rounded-[var(--radius-xs)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 text-xs tabular-nums hover:bg-[var(--color-surface)] focus-visible:shadow-[var(--focus-ring)]"
            aria-label={`Zoom ${zoom} percent, reset to 100 percent`}
          >
            {zoom}%
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => changeZoom(zoom + 25)}
            aria-label="Zoom in"
          >
            <Plus aria-hidden size={15} />
          </Button>
        </div>
        <span className="mx-1 hidden h-5 w-px bg-[var(--color-border)] sm:block" />
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-8 sm:inline-flex"
          aria-label="Rotate document"
        >
          <RotateCcw aria-hidden size={15} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto hidden size-8 sm:inline-flex"
          aria-label="Download document"
        >
          <Download aria-hidden size={15} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-8 sm:inline-flex"
          aria-label="Open full-screen preview"
        >
          <Expand aria-hidden size={15} />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-8 sm:py-6 veyra-scrollbar">
        <article
          className="reading-font mx-auto min-h-[720px] max-w-[760px] origin-top rounded-[2px] border border-[#d9dee7] bg-white px-[clamp(1.5rem,6vw,5.5rem)] py-[clamp(2.5rem,7vw,5.5rem)] text-[#171b25] shadow-[0_8px_24px_rgb(33_43_61_/_0.1)]"
          style={{ width: `${zoom}%`, maxWidth: zoom > 100 ? '900px' : '760px' }}
          aria-label="Page 8 of Acme Master Services Agreement"
        >
          <header className="mb-12 border-b border-[#d7d9df] pb-5 text-right font-[var(--font-ui)] text-[10px] uppercase tracking-[0.16em] text-[#687085]">
            Acme Master Services Agreement · Confidential
          </header>
          <p className="text-[17px] leading-8">
            used in accordance with this Agreement and the Documentation.
          </p>
          <section className="mt-8">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">
              7.2&nbsp;&nbsp; Service availability
            </h2>
            <p className="mt-4 text-[18px] leading-[1.65]">
              Provider will maintain and support the Services to achieve{' '}
              <mark
                id="evidence-clause"
                tabIndex={-1}
                onAnimationEnd={onHighlightSettled}
                className={highlightPulse ? 'ring-2 ring-[var(--color-primary)] ring-offset-2' : ''}
              >
                99.95% monthly uptime
              </mark>
              , excluding Scheduled Maintenance and Force Majeure events, measured in accordance
              with the Service Level Schedule.
            </p>
          </section>
          <section className="mt-8">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">
              7.3&nbsp;&nbsp; Support
            </h2>
            <p className="mt-4 text-[18px] leading-[1.65]">
              Provider will provide support to Customer in accordance with the Service Level
              Schedule. Support hours and response times are set forth in the Service Level
              Schedule.
            </p>
          </section>
          <section className="mt-8">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">
              7.4&nbsp;&nbsp; Service credits
            </h2>
            <p className="mt-4 text-[18px] leading-[1.65]">
              If Provider fails to meet the Service Availability Target in Section 7.2, Customer may
              be eligible for Service Credits as set forth in the Service Level Schedule.
            </p>
          </section>
          <section className="mt-8">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">
              7.5&nbsp;&nbsp; Exclusions
            </h2>
            <p className="mt-4 text-[18px] leading-[1.65]">
              Service availability is subject to exclusions for Scheduled Maintenance, Force
              Majeure, Customer-caused downtime, and Third-Party Services.
            </p>
          </section>
          <footer className="mt-16 text-center text-sm tabular-nums">8</footer>
        </article>
      </div>
      <footer className="hidden min-h-11 items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-background)] px-4 text-xs text-[var(--color-muted-strong)] sm:flex">
        <span className="inline-flex items-center gap-2 text-[var(--color-success)]">
          <span className="size-2 rounded-full bg-[var(--color-success)]" /> Ready
        </span>
        <span>Document intelligence is up to date</span>
      </footer>
    </section>
  );
}
