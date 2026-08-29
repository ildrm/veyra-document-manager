'use client';

import { useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { DocumentSummary } from '@veyra/contracts';
import { Badge, Button, EmptyState, Skeleton, cn } from '@veyra/ui';
import {
  ArrowDownUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  FileArchive,
  FileText,
  Filter,
  FolderOpen,
  Grid2X2,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  UploadCloud,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/format';
import { knowledgeApi } from '@/lib/knowledge-api';
import { DocumentStatus } from './document-status';
import { UploadDrawer } from './upload-drawer';

const column = createColumnHelper<DocumentSummary>();

export function LibraryClient() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [recentUpload, setRecentUpload] = useState<string | null>(null);
  const documentsQuery = useQuery({
    queryKey: ['documents'],
    queryFn: ({ signal }) => knowledgeApi().listDocuments(signal),
  });

  useEffect(() => {
    const listener = () => setUploadOpen(true);
    window.addEventListener('veyra:open-upload', listener);
    return () => window.removeEventListener('veyra:open-upload', listener);
  }, []);

  const data = useMemo(() => documentsQuery.data?.items ?? [], [documentsQuery.data]);
  const columns = useMemo(
    () => [
      column.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all visible documents"
            checked={table.getIsAllRowsSelected()}
            ref={(input) => {
              if (input) input.indeterminate = table.getIsSomeRowsSelected();
            }}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="size-4 accent-[var(--color-primary)]"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.name}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="size-4 accent-[var(--color-primary)]"
          />
        ),
      }),
      column.accessor('name', {
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
              <FileText aria-hidden size={17} strokeWidth={1.8} />
            </span>
            {row.index === 0 ? (
              <Link
                href={`/documents/${row.original.id}`}
                className="truncate text-[13px] font-medium hover:text-[var(--color-primary)] hover:underline focus-visible:rounded-sm focus-visible:shadow-[var(--focus-ring)]"
              >
                {row.original.name}
              </Link>
            ) : (
              <span className="truncate text-[13px] font-medium">{row.original.name}</span>
            )}
          </div>
        ),
      }),
      column.display({
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <DocumentStatus document={row.original} />,
      }),
      column.display({
        id: 'owner',
        header: 'Owner',
        cell: ({ row }) => (
          <span className="flex items-center gap-2 text-xs">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#dce9e3] text-[9px] font-semibold text-[#235a45]">
              {row.original.owner.name
                .split(' ')
                .map((part) => part[0])
                .join('')}
            </span>
            <span className="truncate">{row.original.owner.name}</span>
          </span>
        ),
      }),
      column.display({
        id: 'updated',
        header: 'Updated',
        cell: ({ row }) => (
          <span className="text-xs text-[var(--color-muted-strong)] tabular-nums">
            {formatDate(row.original.updatedAt)}
          </span>
        ),
      }),
      column.display({
        id: 'renewal',
        header: 'Renewal',
        cell: ({ row }) => (
          <span
            className={cn(
              'text-xs text-[var(--color-muted-strong)] tabular-nums',
              row.index === 0 && 'font-medium text-[var(--color-warning)]',
            )}
          >
            {formatDate(row.original.renewalAt)}
          </span>
        ),
      }),
      column.accessor('classification', {
        header: 'Classification',
        cell: (info) => (
          <span className="text-xs capitalize text-[var(--color-muted-strong)]">
            {info.getValue()}
          </span>
        ),
      }),
      column.display({
        id: 'actions',
        header: () => <span className="sr-only">Document actions</span>,
        cell: ({ row }) => (
          <Button variant="ghost" size="icon" aria-label={`More actions for ${row.original.name}`}>
            <Ellipsis aria-hidden size={17} />
          </Button>
        ),
      }),
    ],
    [],
  );

  // TanStack Table intentionally exposes stateful callbacks that React Compiler must not memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: query, rowSelection: selection },
    onRowSelectionChange: setSelection,
    onGlobalFilterChange: setQuery,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  const selectedCount = table.getSelectedRowModel().rows.length;
  const openUpload = useCallback(() => setUploadOpen(true), []);

  return (
    <main className="min-h-[calc(100vh-72px)] px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
      <div
        className={cn(
          'mx-auto max-w-[1320px] transition-[padding] duration-200',
          uploadOpen && 'xl:pr-[400px]',
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted)]">
              <FolderOpen aria-hidden size={14} /> Library
            </p>
            <h1 className="mt-3 text-[clamp(1.55rem,2vw,2rem)] font-semibold tracking-[-0.035em]">
              Customer contracts
            </h1>
            <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
              24 documents · Updated moments ago
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="lg" onClick={openUpload}>
              <UploadCloud aria-hidden size={17} /> Upload
            </Button>
            <Button size="lg" className="hidden sm:inline-flex">
              <Plus aria-hidden size={16} /> New view
              <ChevronDown aria-hidden size={14} />
            </Button>
          </div>
        </div>

        {recentUpload ? (
          <div
            className="mt-5 flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-success)] bg-[var(--color-success-soft)] px-3 py-2 text-[13px] text-[var(--color-success)]"
            role="status"
          >
            <span>“{recentUpload}” is trusted, indexed, and ready to search.</span>
            <button
              type="button"
              className="font-medium hover:underline"
              onClick={() => setRecentUpload(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <section className="mt-6" aria-label="Document library">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-3">
            <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 sm:max-w-[320px]">
              <Search aria-hidden size={15} className="text-[var(--color-muted)]" />
              <span className="sr-only">Search this library</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--color-muted)]"
                placeholder="Search this library…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {['Status', 'Owner', 'Renewal'].map((filter) => (
              <Button key={filter} size="sm" className="hidden sm:inline-flex">
                {filter} <ChevronDown aria-hidden size={13} />
              </Button>
            ))}
            <Button size="sm" className="sm:hidden" aria-label="Open filters">
              <Filter aria-hidden size={15} /> Filters
            </Button>
            <Button size="sm" className="ml-auto hidden lg:inline-flex">
              <FileArchive aria-hidden size={14} /> Active contracts{' '}
              <ChevronDown aria-hidden size={13} />
            </Button>
            <div className="hidden items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] p-0.5 sm:flex">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 bg-[var(--color-surface)]"
                aria-label="List view"
              >
                <List aria-hidden size={14} />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Grid view">
                <Grid2X2 aria-hidden size={14} />
              </Button>
            </div>
            <Button variant="ghost" size="icon" aria-label="Sort documents">
              <ArrowDownUp aria-hidden size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Customize columns"
              className="hidden sm:inline-flex"
            >
              <SlidersHorizontal aria-hidden size={15} />
            </Button>
          </div>

          {selectedCount > 0 ? (
            <div className="flex min-h-12 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3">
              <Badge tone="info">{selectedCount} selected</Badge>
              <Button size="sm">
                Add to workflow <ChevronDown aria-hidden size={13} />
              </Button>
              <Button size="sm" className="hidden sm:inline-flex">
                Change owner
              </Button>
              <button
                type="button"
                className="ml-auto text-xs font-medium text-[var(--color-primary)] hover:underline"
                onClick={() => setSelection({})}
              >
                Clear
              </button>
            </div>
          ) : null}

          {documentsQuery.isLoading ? (
            <div className="overflow-hidden border-x border-b border-[var(--color-border)]">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1.8fr_1fr_1fr] gap-6 border-b border-[var(--color-border)] p-4 last:border-0"
                >
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : documentsQuery.isError ? (
            <div
              className="border-x border-b border-[var(--color-border)] py-6 text-center"
              role="alert"
            >
              <p className="text-sm font-medium">Documents could not be loaded</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Check your connection and retry this view.
              </p>
              <Button className="mt-4" size="sm" onClick={() => void documentsQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : table.getRowModel().rows.length === 0 ? (
            <EmptyState
              icon={<FileArchive aria-hidden size={20} />}
              title="No contracts match these filters"
              description="Clear a filter or upload a contract to make its obligations and evidence searchable."
              action={<Button onClick={openUpload}>Upload a contract</Button>}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-b-[var(--radius-md)] border-x border-b border-[var(--color-border)] lg:block veyra-scrollbar">
                <table className="w-full min-w-[920px] table-fixed border-collapse text-left">
                  <caption className="sr-only">Customer contract documents</caption>
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr
                        key={headerGroup.id}
                        className="h-11 border-b border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-muted)]"
                      >
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className={cn(
                              'px-3 font-semibold',
                              header.id === 'select' && 'w-10',
                              header.id === 'name' && 'w-[30%]',
                              header.id === 'actions' && 'w-12',
                            )}
                            scope="col"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row, rowIndex) => (
                      <tr
                        key={row.id}
                        className={cn(
                          'h-[68px] border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)]',
                          row.getIsSelected() && 'bg-[var(--color-primary-soft)]',
                          rowIndex === 0 &&
                            !row.getIsSelected() &&
                            'bg-[color-mix(in_srgb,var(--color-primary-soft)_42%,transparent)]',
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-3 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[var(--color-border)] border-b border-[var(--color-border)] lg:hidden">
                {table.getRowModel().rows.map((row, index) => (
                  <li key={row.id} className="py-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                        aria-label={`Select ${row.original.name}`}
                        className="mt-1 size-4 accent-[var(--color-primary)]"
                      />
                      <div className="min-w-0 flex-1">
                        {index === 0 ? (
                          <Link
                            href={`/documents/${row.original.id}`}
                            className="block truncate text-sm font-semibold hover:text-[var(--color-primary)]"
                          >
                            {row.original.name}
                          </Link>
                        ) : (
                          <p className="truncate text-sm font-semibold">{row.original.name}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <DocumentStatus document={row.original} />
                          <span className="text-xs text-[var(--color-muted)]">
                            {row.original.versionLabel}
                          </span>
                          <span className="text-xs text-[var(--color-muted)]">
                            {row.original.owner.name}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`More actions for ${row.original.name}`}
                      >
                        <Ellipsis aria-hidden size={17} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="flex min-h-14 flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
            <span>Showing 1–5 of 24 documents</span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled
                aria-label="Previous page"
              >
                <ChevronLeft aria-hidden size={15} />
              </Button>
              <Button
                size="sm"
                className="min-w-8 bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
              >
                1
              </Button>
              <Button variant="ghost" size="sm" className="min-w-8">
                2
              </Button>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Next page">
                <ChevronRight aria-hidden size={15} />
              </Button>
            </div>
          </div>
        </section>
      </div>

      <UploadDrawer open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={setRecentUpload} />
    </main>
  );
}
