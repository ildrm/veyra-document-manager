import type { HTMLAttributes } from 'react';
import { cn } from './utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-[var(--radius-xs)] bg-[var(--color-surface)] motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}
