export function formatDate(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(new Date(value));
}

export function formatRelativeDate(value: string) {
  const days = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
  const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  if (Math.abs(days) < 30) return relative.format(days, 'day');
  return formatDate(value);
}
