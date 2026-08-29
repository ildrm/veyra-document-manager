import type { Metadata } from 'next';
import { Badge } from '@veyra/ui';
import { CheckCircle2, Database, HardDrive, KeyRound, ShieldCheck, Waves } from 'lucide-react';

export const metadata: Metadata = { title: 'Administration' };

const boundaries = [
  {
    icon: KeyRound,
    name: 'Identity',
    value: 'OIDC adapter',
    note: 'Development identity is isolated from production configuration.',
  },
  {
    icon: ShieldCheck,
    name: 'Authorization',
    value: 'OpenFGA',
    note: 'Permissions are evaluated before retrieval.',
  },
  {
    icon: Database,
    name: 'Source of truth',
    value: 'PostgreSQL + pgvector',
    note: 'Tenant-owned rows carry organization boundaries and RLS.',
  },
  {
    icon: HardDrive,
    name: 'Object storage',
    value: 'S3-compatible',
    note: 'Originals remain quarantined until integrity checks pass.',
  },
  {
    icon: Waves,
    name: 'Observability',
    value: 'OpenTelemetry',
    note: 'Correlation IDs connect browser, API, policy, database, and AI traces.',
  },
];

export default function AdministrationPage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-72px)] max-w-[1080px] px-4 py-6 sm:px-7 lg:py-9">
      <p className="text-xs font-medium text-[var(--color-muted)]">Northstar Technologies</p>
      <h1 className="mt-2 text-[clamp(1.7rem,3vw,2.2rem)] font-semibold tracking-[-0.04em]">
        Platform foundations
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
        Security and platform boundaries for the current document-intelligence slice.
      </p>
      <div className="mt-8 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {boundaries.map(({ icon: Icon, name, value, note }) => (
          <section
            key={name}
            className="grid gap-3 py-4 sm:grid-cols-[40px_180px_1fr_auto] sm:items-center"
          >
            <span className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Icon aria-hidden size={17} />
            </span>
            <div>
              <h2 className="text-[13px] font-semibold">{name}</h2>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">{value}</p>
            </div>
            <p className="text-xs leading-5 text-[var(--color-muted-strong)]">{note}</p>
            <Badge tone="success">
              <CheckCircle2 aria-hidden size={11} /> Configured
            </Badge>
          </section>
        ))}
      </div>
      <p className="mt-6 text-xs leading-5 text-[var(--color-muted)]">
        Provider settings are environment-controlled and never expose development adapters in
        production mode.
      </p>
    </main>
  );
}
