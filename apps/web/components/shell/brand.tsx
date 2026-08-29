export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-[var(--color-foreground)]">
      <svg
        aria-hidden="true"
        className="size-7 text-[var(--color-primary)]"
        viewBox="0 0 28 28"
        fill="none"
      >
        <path d="M3 6.5 8.5 4 14 14 9 24 3 21.5 8 14 3 6.5Z" fill="currentColor" />
        <path d="m14 14 5.5-10L25 6.5 20 14l5 7.5L19 24l-5-10Z" fill="currentColor" opacity=".72" />
      </svg>
      {compact ? null : <span className="text-[20px] font-semibold tracking-[-0.04em]">Veyra</span>}
    </span>
  );
}
