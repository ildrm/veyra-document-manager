import { Badge, cn } from '@veyra/ui';
import { CheckCircle2, CircleAlert, CircleDashed, LoaderCircle } from 'lucide-react';
import type { DocumentSummary } from '@veyra/contracts';

export function DocumentStatus({ document }: { document: DocumentSummary }) {
  if (document.status === 'processing') {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-primary)]">
        <LoaderCircle aria-hidden size={15} className="animate-spin motion-reduce:animate-none" />
        <span>
          {document.processingState === 'indexing' ? 'Indexing' : 'Processing'}{' '}
          <span className="tabular-nums">{document.processingProgress}%</span>
        </span>
      </span>
    );
  }
  if (document.status === 'verified') {
    return (
      <Badge tone="success">
        <CheckCircle2 aria-hidden size={12} /> Verified
      </Badge>
    );
  }
  if (document.status === 'needs_review') {
    return (
      <Badge tone="warning">
        <CircleAlert aria-hidden size={12} /> Needs review
      </Badge>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]')}>
      <CircleDashed aria-hidden size={14} /> Draft
    </span>
  );
}
