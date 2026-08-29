import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
        {icon}
      </div>
      <h2 className="text-base font-semibold text-[var(--color-foreground)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
