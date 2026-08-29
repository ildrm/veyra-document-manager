import type { ReactNode } from 'react';

export function highlightText(text: string, terms: readonly string[]): ReactNode {
  const normalizedTerms = terms.filter(Boolean).sort((a, b) => b.length - a.length);
  if (normalizedTerms.length === 0) return text;
  const escaped = normalizedTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const expression = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text.split(expression).map((part, index) => {
    const isMatch = normalizedTerms.some((term) => term.toLowerCase() === part.toLowerCase());
    return isMatch ? <mark key={`${part}-${index}`}>{part}</mark> : part;
  });
}
