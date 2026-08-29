import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from './utils';

const badgeVariants = cva(
  'inline-flex min-h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium leading-none',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--color-surface)] text-[var(--color-muted-strong)]',
        info: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
        success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
        warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
        danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
