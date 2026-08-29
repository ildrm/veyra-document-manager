import { Skeleton } from '@veyra/ui';

export default function Loading() {
  return (
    <main className="p-6 lg:p-8" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-5 h-9 w-72" />
      <Skeleton className="mt-3 h-4 w-48" />
      <div className="mt-8 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(180px,2fr)_1fr_1fr_1fr] gap-5 border-b border-[var(--color-border)] p-4 last:border-0"
          >
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </main>
  );
}
