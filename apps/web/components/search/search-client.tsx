'use client';

import { useQuery } from '@tanstack/react-query';
import type { SearchResult } from '@veyra/contracts';
import { Badge, Button, Skeleton, cn } from '@veyra/ui';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import { ids } from '@/lib/demo-data';
import { formatDate } from '@/lib/format';
import { highlightText } from '@/lib/highlight';
import { knowledgeApi } from '@/lib/knowledge-api';

interface FilterChip {
  id: string;
  label: string;
}

const initialFilters: FilterChip[] = [
  { id: 'type', label: 'Type: Contract' },
  { id: 'status', label: 'Status: Current' },
  { id: 'customer', label: 'Customer: Acme Corp' },
];

export function SearchClient() {
  const [input, setInput] = useState('customer uptime commitments');
  const [submittedQuery, setSubmittedQuery] = useState('customer uptime commitments');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const searchQuery = useQuery({
    queryKey: ['search', submittedQuery, filters.map((filter) => filter.id).join(',')],
    queryFn: ({ signal }) =>
      knowledgeApi().search(
        {
          query: submittedQuery,
          workspaceId: ids.legalWorkspace,
          type: filters.some((filter) => filter.id === 'type') ? 'contract' : undefined,
          customer: filters.some((filter) => filter.id === 'customer') ? 'Acme Corp' : undefined,
          limit: 25,
        },
        signal,
      ),
    enabled: submittedQuery.length > 0,
  });

  const results = useMemo(() => searchQuery.data?.items ?? [], [searchQuery.data]);
  const safeSelectedIndex = results.length > 0 ? Math.min(selectedIndex, results.length - 1) : 0;
  const selected = results[safeSelectedIndex];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = input.trim();
    if (!normalized) return;
    setSubmittedQuery(normalized);
    setSelectedIndex(0);
  };

  const moveSelection = (direction: -1 | 1) => {
    if (results.length === 0) return;
    setSelectedIndex((current) => (current + direction + results.length) % results.length);
  };

  const onResultKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1);
    }
    if (event.key === 'Enter' && selected) setMobilePreviewOpen(true);
  };

  return (
    <main className="min-h-[calc(100vh-64px)] px-4 py-5 sm:px-6 lg:h-[calc(100vh-72px)] lg:min-h-0 lg:overflow-hidden lg:px-6 lg:py-6">
      <div className="mx-auto flex h-full max-w-[1390px] flex-col">
        <h1 className="text-[clamp(1.6rem,2vw,2rem)] font-semibold tracking-[-0.04em]">Search</h1>
        <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2" role="search">
          <label className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-primary)] bg-[var(--color-surface-raised)] pl-3 shadow-[var(--focus-ring)] sm:max-w-[680px]">
            <Search aria-hidden size={17} className="shrink-0 text-[var(--color-muted)]" />
            <span className="sr-only">Search authorized knowledge</span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {input ? (
              <button
                type="button"
                onClick={() => setInput('')}
                className="flex size-9 shrink-0 items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                aria-label="Clear query"
              >
                <X aria-hidden size={16} />
              </button>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              className="h-11 rounded-l-none border-y-0 border-r-0 px-5"
            >
              Search
            </Button>
          </label>
          <Button className="h-11">
            <ShieldCheck aria-hidden size={15} /> All authorized knowledge{' '}
            <ChevronDown aria-hidden size={13} />
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() =>
                setFilters((current) => current.filter((item) => item.id !== filter.id))
              }
              className="inline-flex min-h-7 items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] px-2.5 text-xs text-[var(--color-muted-strong)] outline-none hover:text-[var(--color-primary)] focus-visible:shadow-[var(--focus-ring)]"
              aria-label={`Remove filter ${filter.label}`}
            >
              {filter.label} <X aria-hidden size={12} />
            </button>
          ))}
          {filters.length > 0 ? (
            <button
              type="button"
              onClick={() => setFilters([])}
              className="px-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              Clear all
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex min-h-8 items-center gap-3 border-b border-[var(--color-border)] pb-3 text-xs text-[var(--color-muted)]">
          {searchQuery.isFetching
            ? 'Searching authorized knowledge…'
            : `${Math.max(results.length, 8)} results · 142 ms`}
          <span className="ml-auto hidden items-center gap-1 sm:inline-flex">
            <kbd className="flex size-7 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
              <ArrowUp aria-hidden size={13} />
            </kbd>
            <kbd className="flex size-7 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
              <ArrowDown aria-hidden size={13} />
            </kbd>
            to move between results
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[190px_minmax(420px,1fr)_340px] xl:grid-cols-[210px_minmax(520px,1fr)_365px]">
          <aside
            className="hidden min-h-0 overflow-y-auto border-r border-[var(--color-border)] pr-4 pt-4 lg:block veyra-scrollbar"
            aria-label="Search facets"
          >
            <Facet
              title="Document type"
              options={[
                ['Contract', '6', true],
                ['Policy', '1', false],
                ['Brief', '1', false],
              ]}
            />
            <Facet
              title="Workspace"
              options={[
                ['Legal', '5', true],
                ['Customer Success', '2', false],
                ['Support', '1', false],
              ]}
            />
            <Facet
              title="Owner"
              options={[
                ['Legal Team', '4', false],
                ['Maya Chen', '2', false],
                ['Michael Chen', '1', false],
              ]}
            />
            <fieldset className="border-t border-[var(--color-border)] py-4">
              <legend className="mb-3 text-xs font-semibold">Modified</legend>
              {['Any time', 'Past 7 days', 'Past 30 days', 'Past 90 days'].map((label, index) => (
                <label
                  key={label}
                  className="flex min-h-7 items-center gap-2 text-xs text-[var(--color-muted-strong)]"
                >
                  <input
                    type="radio"
                    name="modified"
                    defaultChecked={index === 0}
                    className="size-3.5 accent-[var(--color-primary)]"
                  />{' '}
                  {label}
                </label>
              ))}
            </fieldset>
            <Facet
              title="Classification"
              options={[
                ['Public', '6', false],
                ['Internal', '2', false],
                ['Confidential', '0', false],
              ]}
            />
          </aside>

          <section
            className="min-h-0 overflow-y-auto border-r border-[var(--color-border)] lg:pl-0 veyra-scrollbar"
            aria-label="Search results"
            tabIndex={0}
            onKeyDown={onResultKeyDown}
          >
            {searchQuery.isLoading ? (
              <div>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="border-b border-[var(--color-border)] px-4 py-5">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="mt-2 h-3 w-2/5" />
                    <Skeleton className="mt-4 h-3 w-4/5" />
                  </div>
                ))}
              </div>
            ) : searchQuery.isError ? (
              <div className="p-8 text-center" role="alert">
                <p className="text-sm font-semibold">Search is temporarily unavailable</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Your library remains available while search recovers.
                </p>
                <Button className="mt-4" size="sm" onClick={() => void searchQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : results.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-semibold">No authorized results</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Try fewer filters or a broader phrase.
                </p>
              </div>
            ) : (
              <>
                {results.map((result, index) => (
                  <SearchResultRow
                    key={result.document.id}
                    result={result}
                    selected={index === safeSelectedIndex}
                    onSelect={() => {
                      setSelectedIndex(index);
                      if (window.matchMedia('(max-width: 1023px)').matches)
                        setMobilePreviewOpen(true);
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setInput('uptime commitments expiring this year');
                    setSubmittedQuery('uptime commitments expiring this year');
                  }}
                  className="m-3 flex w-[calc(100%-24px)] items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left text-xs outline-none hover:border-[var(--color-primary)] focus-visible:shadow-[var(--focus-ring)]"
                >
                  <Sparkles aria-hidden size={15} className="text-[var(--color-primary)]" />
                  Try:{' '}
                  <span className="font-medium text-[var(--color-primary)]">
                    uptime commitments expiring this year
                  </span>
                </button>
              </>
            )}
          </section>

          <aside
            className="hidden min-h-0 overflow-y-auto bg-[var(--color-background)] lg:block veyra-scrollbar"
            aria-label="Search result preview"
          >
            {selected ? <SearchPreview result={selected} /> : null}
          </aside>
        </div>
      </div>

      {mobilePreviewOpen && selected ? (
        <aside
          className="fixed inset-x-0 bottom-[68px] top-[64px] z-30 overflow-y-auto bg-[var(--color-background)] shadow-[var(--shadow-md)] lg:hidden veyra-scrollbar"
          aria-label="Search result preview"
        >
          <div className="sticky top-0 z-10 flex min-h-14 items-center border-b border-[var(--color-border)] bg-[var(--color-background)] px-4">
            <p className="text-sm font-semibold">Quick preview</p>
            <Button
              className="ml-auto"
              variant="ghost"
              size="icon"
              onClick={() => setMobilePreviewOpen(false)}
              aria-label="Close preview"
            >
              <X aria-hidden size={18} />
            </Button>
          </div>
          <SearchPreview result={selected} />
        </aside>
      ) : null}
    </main>
  );
}

function Facet({
  title,
  options,
}: {
  title: string;
  options: readonly (readonly [string, string, boolean])[];
}) {
  return (
    <fieldset className="border-t border-[var(--color-border)] py-4 first:border-0 first:pt-0">
      <legend className="mb-2.5 w-full text-xs font-semibold">{title}</legend>
      {options.map(([label, count, checked]) => (
        <label
          key={label}
          className="flex min-h-7 items-center gap-2 text-xs text-[var(--color-muted-strong)]"
        >
          <input
            type="checkbox"
            defaultChecked={checked}
            className="size-3.5 rounded accent-[var(--color-primary)]"
          />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="tabular-nums text-[var(--color-muted)]">{count}</span>
        </label>
      ))}
    </fieldset>
  );
}

function SearchResultRow({
  result,
  selected,
  onSelect,
}: {
  result: SearchResult;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative w-full border-b border-[var(--color-border)] px-4 py-4 text-left outline-none hover:bg-[var(--color-surface)] focus-visible:shadow-[inset_var(--focus-ring)] sm:px-5',
        selected &&
          'bg-[var(--color-primary-soft)] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[var(--color-primary)]',
      )}
      aria-current={selected ? 'true' : undefined}
    >
      <div className="flex items-start gap-3">
        <FileText aria-hidden size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="truncate text-[13px] font-semibold text-[var(--color-primary)]">
              {result.document.name}
            </span>
            <span className="ml-auto text-xs font-semibold tabular-nums">
              {Math.round(result.score * 100)}%
            </span>
          </span>
          <span className="mt-1 block text-[11px] text-[var(--color-primary)]">
            Legal / Customer contracts
          </span>
          <span className="mt-0.5 block text-[11px] text-[var(--color-muted)]">
            {result.document.versionLabel} · Page {result.pageNumber} · Updated{' '}
            {formatDate(result.document.updatedAt)}
          </span>
          <span className="mt-2.5 line-clamp-2 block text-xs leading-5 text-[var(--color-muted-strong)]">
            …{highlightText(result.snippet, result.matchedTerms)}…
          </span>
          {result.document.status === 'verified' ? (
            <Badge className="mt-2" tone="success">
              <CheckCircle2 aria-hidden size={11} /> Verified
            </Badge>
          ) : null}
        </span>
        <ChevronRight
          aria-hidden
          size={16}
          className="mt-1 shrink-0 text-[var(--color-muted)] lg:hidden"
        />
      </div>
    </button>
  );
}

function SearchPreview({ result }: { result: SearchResult }) {
  return (
    <div className="p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-6">{result.document.name}</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">v4 · Page 8</p>
        </div>
        <Badge tone="success">
          <CheckCircle2 aria-hidden size={11} /> Verified
        </Badge>
      </div>
      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold">Document excerpt</h3>
          <Badge>Section 7.2</Badge>
        </div>
        <h4 className="reading-font mt-5 text-base font-semibold">
          7.2&nbsp;&nbsp; Service availability
        </h4>
        <p className="reading-font mt-3 text-[15px] leading-6">
          Provider shall maintain the Service so that Customer experiences{' '}
          <mark>99.95% monthly uptime</mark>, excluding scheduled maintenance, measured in
          accordance with Exhibit B.
        </p>
      </div>
      <div className="mt-5 grid gap-2">
        <Button variant="primary" asChild>
          <Link href={`/documents/${ids.acmeDocument}`}>
            Open document <ExternalLink aria-hidden size={14} />
          </Link>
        </Button>
        <Button asChild>
          <Link href="/ask">Ask about this</Link>
        </Button>
      </div>
      <p className="mt-4 flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] p-3 text-xs text-[var(--color-success)]">
        <ShieldCheck aria-hidden size={15} /> You have access through Legal workspace
      </p>
      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        <h3 className="text-xs font-semibold">Related entity</h3>
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-[var(--color-primary)]">
          <Building2 aria-hidden size={17} /> Acme Corp
        </p>
        <p className="ml-6 mt-0.5 text-xs text-[var(--color-muted)]">Customer</p>
      </div>
      <dl className="mt-5 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)] pt-2 text-xs">
        <div className="flex py-2">
          <dt className="text-[var(--color-muted)]">Source</dt>
          <dd className="ml-auto text-right">Northstar Legal Repository</dd>
        </div>
        <div className="flex py-2">
          <dt className="text-[var(--color-muted)]">Workspace</dt>
          <dd className="ml-auto">Legal</dd>
        </div>
        <div className="flex py-2">
          <dt className="text-[var(--color-muted)]">Owner</dt>
          <dd className="ml-auto">Legal Team</dd>
        </div>
      </dl>
    </div>
  );
}
