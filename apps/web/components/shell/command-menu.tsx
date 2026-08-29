'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@veyra/ui';
import {
  ArrowRight,
  FileQuestion,
  FileUp,
  FolderOpen,
  Home,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const commands = [
  { label: 'Open Library', hint: 'G then L', href: '/library', icon: FolderOpen },
  { label: 'Ask Veyra', hint: 'G then A', href: '/ask', icon: Sparkles },
  { label: 'Search knowledge', hint: '/', href: '/search', icon: Search },
  {
    label: 'Open Acme agreement',
    hint: 'Recent',
    href: '/documents/0198f7a0-7d14-7000-8000-000000000010',
    icon: FileQuestion,
  },
  { label: 'Go home', hint: 'G then H', href: '/home', icon: Home },
] as const;

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const visibleCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(normalized));
  }, [query]);

  const run = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const upload = () => {
    onOpenChange(false);
    router.push('/library');
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('veyra:open-upload')), 80);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setQuery('');
    onOpenChange(nextOpen);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/35 backdrop-blur-[2px] data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-safe:transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-[14vh] z-50 w-[min(620px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-md)] outline-none">
          <Dialog.Title className="sr-only">Command menu</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search documents, navigate the product, or start an action.
          </Dialog.Description>
          <div className="flex h-14 items-center gap-3 border-b border-[var(--color-border)] px-4">
            <Search aria-hidden size={18} className="text-[var(--color-muted)]" />
            <input
              autoFocus
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted)]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents or run a command…"
              aria-label="Search commands"
            />
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close command menu">
                <X aria-hidden size={17} />
              </Button>
            </Dialog.Close>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2 veyra-scrollbar">
            <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
              Actions
            </p>
            <button
              type="button"
              onClick={upload}
              className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 text-left text-sm outline-none hover:bg-[var(--color-surface)] focus-visible:bg-[var(--color-surface)] focus-visible:shadow-[var(--focus-ring)]"
            >
              <FileUp aria-hidden size={17} className="text-[var(--color-primary)]" />
              <span className="flex-1">Upload documents</span>
              <span className="text-xs text-[var(--color-muted)]">U</span>
            </button>
            <div className="my-2 border-t border-[var(--color-border)]" />
            <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
              Navigate
            </p>
            {visibleCommands.map(({ label, hint, href, icon: Icon }) => (
              <button
                key={href}
                type="button"
                onClick={() => run(href)}
                className="group flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 text-left text-sm outline-none hover:bg-[var(--color-surface)] focus-visible:bg-[var(--color-surface)] focus-visible:shadow-[var(--focus-ring)]"
              >
                <Icon aria-hidden size={17} className="text-[var(--color-muted-strong)]" />
                <span className="flex-1">{label}</span>
                <span className="text-xs text-[var(--color-muted)] group-hover:hidden">{hint}</span>
                <ArrowRight
                  aria-hidden
                  size={15}
                  className="hidden text-[var(--color-primary)] group-hover:block"
                />
              </button>
            ))}
            {visibleCommands.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[var(--color-muted)]">
                No commands match “{query}”.
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[11px] text-[var(--color-muted)]">
            <span>Results respect your current access.</span>
            <span>↑↓ Navigate · ↵ Open</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
