'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Button, cn } from '@veyra/ui';
import {
  Bell,
  BookOpen,
  ChevronsUpDown,
  Command,
  Home,
  LibraryBig,
  Menu,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Workflow,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Brand } from './brand';
import { CommandMenu } from './command-menu';

const navigation = [
  { label: 'Home', href: '/home', icon: Home },
  { label: 'Ask', href: '/ask', icon: Sparkles },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Library', href: '/library', icon: LibraryBig },
  { label: 'Knowledge', href: '/knowledge', icon: BookOpen },
  { label: 'Workflows', href: '/workflows', icon: Workflow, unavailable: true },
] as const;

const mobileNavigation = navigation.slice(0, 4);

function isSelected(pathname: string, href: string) {
  if (href === '/library' && pathname.startsWith('/documents/')) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <Tooltip.Provider delayDuration={450}>
      <div className="grid min-h-screen grid-cols-1 grid-rows-[64px_minmax(0,1fr)] bg-[var(--color-background)] md:grid-cols-[212px_minmax(0,1fr)] md:grid-rows-[72px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--color-border)] bg-[var(--color-background)] md:row-span-2 md:flex md:min-h-screen md:flex-col">
          <div className="flex h-[72px] items-center border-b border-[var(--color-border)] px-6">
            <Brand />
          </div>
          <nav aria-label="Primary navigation" className="flex-1 px-3 py-5">
            <ul className="space-y-1">
              {navigation.map(({ label, href, icon: Icon, ...item }) => {
                const selected = isSelected(pathname, href);
                const unavailable = 'unavailable' in item && item.unavailable;
                const link = (
                  <Link
                    href={unavailable ? '#' : href}
                    aria-current={selected ? 'page' : undefined}
                    aria-disabled={unavailable || undefined}
                    tabIndex={unavailable ? -1 : undefined}
                    className={cn(
                      'relative flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[13px] font-medium text-[var(--color-muted-strong)] outline-none transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)] focus-visible:shadow-[var(--focus-ring)]',
                      selected &&
                        'bg-[var(--color-primary-soft)] text-[var(--color-primary)] before:absolute before:-left-3 before:h-7 before:w-0.5 before:rounded-r before:bg-[var(--color-primary)]',
                      unavailable && 'cursor-not-allowed opacity-45 hover:bg-transparent',
                    )}
                  >
                    <Icon aria-hidden size={18} strokeWidth={1.8} />
                    {label}
                  </Link>
                );
                return (
                  <li key={href}>
                    {unavailable ? (
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            side="right"
                            className="z-50 rounded-[var(--radius-xs)] bg-[var(--color-foreground)] px-2.5 py-1.5 text-xs text-[var(--color-background)] shadow-[var(--shadow-md)]"
                          >
                            Available after the document core is approved
                            <Tooltip.Arrow className="fill-[var(--color-foreground)]" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 border-t border-[var(--color-border)] pt-4">
              <Link
                href="/administration"
                className="flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[13px] font-medium text-[var(--color-muted-strong)] hover:bg-[var(--color-surface)] focus-visible:shadow-[var(--focus-ring)]"
              >
                <Settings aria-hidden size={18} strokeWidth={1.8} />
                Administration
              </Link>
            </div>
          </nav>
          <button
            type="button"
            className="m-3 flex min-h-[58px] items-center gap-3 rounded-[var(--radius-sm)] border border-transparent px-3 text-left hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] focus-visible:shadow-[var(--focus-ring)]"
            aria-label="Switch organization, current organization Northstar Technologies"
          >
            <span className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary-soft)] text-xs font-semibold text-[var(--color-primary)]">
              NT
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">Northstar</span>
              <span className="block truncate text-[11px] text-[var(--color-muted)]">
                Technologies
              </span>
            </span>
            <ChevronsUpDown aria-hidden size={14} className="text-[var(--color-muted)]" />
          </button>
        </aside>

        <header className="col-span-1 flex items-center border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 md:col-start-2 md:px-6">
          <div className="flex flex-1 items-center gap-3 md:hidden">
            <Brand />
          </div>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="mx-auto hidden h-10 w-[min(420px,42vw)] items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 text-left text-sm text-[var(--color-muted)] shadow-[var(--shadow-sm)] outline-none hover:border-[var(--color-border-strong)] focus-visible:shadow-[var(--focus-ring)] md:flex"
          >
            <Search aria-hidden size={16} />
            <span className="flex-1 truncate">Search or run a command</span>
            <span className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[11px]">
              <Command aria-hidden size={11} /> K
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open search and commands"
              className="md:hidden"
              onClick={() => setCommandOpen(true)}
            >
              <Search aria-hidden size={20} />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
              <Bell aria-hidden size={18} />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-[var(--color-background)] bg-[var(--color-primary)]" />
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="ml-1 flex size-9 items-center justify-center rounded-full bg-[#dce9e3] text-xs font-semibold text-[#235a45] outline-none focus-visible:shadow-[var(--focus-ring)]"
                  aria-label="Open profile menu for Maya Chen"
                >
                  MC
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-52 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-1.5 shadow-[var(--shadow-md)]"
                >
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-semibold">Maya Chen</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      maya@northstar.example
                    </p>
                  </div>
                  <DropdownMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
                  <DropdownMenu.Item
                    onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    className="flex min-h-9 cursor-default items-center gap-2 rounded-[var(--radius-xs)] px-2.5 text-[13px] outline-none data-[highlighted]:bg-[var(--color-surface)]"
                  >
                    {resolvedTheme === 'dark' ? (
                      <Sun aria-hidden size={15} />
                    ) : (
                      <Moon aria-hidden size={15} />
                    )}
                    {resolvedTheme === 'dark' ? 'Use light theme' : 'Use dark theme'}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        <div className="min-w-0 overflow-x-hidden pb-[76px] md:col-start-2 md:row-start-2 md:pb-0">
          {children}
        </div>

        <nav
          aria-label="Mobile navigation"
          className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_94%,transparent)] px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {mobileNavigation.map(({ label, href, icon: Icon }) => {
            const selected = isSelected(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium text-[var(--color-muted)] outline-none focus-visible:shadow-[inset_var(--focus-ring)]',
                  selected &&
                    'text-[var(--color-primary)] before:absolute before:top-0 before:h-0.5 before:w-9 before:rounded-b before:bg-[var(--color-primary)]',
                )}
              >
                <Icon aria-hidden size={20} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium text-[var(--color-muted)] outline-none focus-visible:shadow-[inset_var(--focus-ring)]"
          >
            <Menu aria-hidden size={20} strokeWidth={1.8} />
            More
          </button>
        </nav>
      </div>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </Tooltip.Provider>
  );
}
