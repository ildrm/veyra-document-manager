'use client';

import { Button } from '@veyra/ui';
import { CircleAlert, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Veyra page error', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="grid min-h-[calc(100vh-72px)] place-items-center p-6">
      <section className="max-w-md text-center" role="alert">
        <div className="mx-auto flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
          <CircleAlert aria-hidden size={21} />
        </div>
        <h1 className="mt-4 text-xl font-semibold">This page could not be loaded</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          Your documents are safe. Retry the request, or return to the library if the issue
          continues.
        </p>
        <Button className="mt-5" variant="primary" onClick={reset}>
          <RotateCcw aria-hidden size={15} /> Retry
        </Button>
      </section>
    </main>
  );
}
