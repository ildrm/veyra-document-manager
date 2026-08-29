import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from './utils';

const buttonVariants = cva(
  'inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] border px-3 text-[13px] font-medium outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--motion-fast)] focus-visible:shadow-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
  {
    variants: {
      variant: {
        primary:
          'border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:border-[var(--color-primary-hover)] hover:bg-[var(--color-primary-hover)] dark:text-[var(--color-background)]',
        secondary:
          'border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-foreground)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]',
        ghost:
          'border-transparent bg-transparent text-[var(--color-muted-strong)] hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)]',
        danger:
          'border-[var(--color-danger)] bg-[var(--color-danger)] text-white hover:brightness-95 dark:text-[var(--color-background)]',
      },
      size: {
        sm: 'min-h-8 px-2.5 text-xs',
        md: 'min-h-9 px-3',
        lg: 'min-h-11 px-4 text-sm',
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
