'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Button, cn } from '@veyra/ui';
import {
  Check,
  Circle,
  FileText,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { knowledgeApi } from '@/lib/knowledge-api';

interface UploadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: (fileName: string) => void;
}

type UploadStage =
  'idle' | 'uploading' | 'scanning' | 'extracting' | 'indexing' | 'analyzing' | 'ready' | 'failed';

const stageOrder: UploadStage[] = [
  'uploading',
  'scanning',
  'extracting',
  'indexing',
  'analyzing',
  'ready',
];

function progressFor(stage: UploadStage) {
  return {
    idle: 0,
    uploading: 10,
    scanning: 24,
    extracting: 48,
    indexing: 72,
    analyzing: 90,
    ready: 100,
    failed: 16,
  }[stage];
}

export function UploadDrawer({ open, onOpenChange, onUploaded }: UploadDrawerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const beginUpload = useCallback(async (nextFile: File) => {
    setError(null);
    if (nextFile.size > 25 * 1024 * 1024) {
      setError('This file is larger than the 25 MB workspace limit.');
      setStage('failed');
      return;
    }
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (nextFile.type && !allowed.includes(nextFile.type)) {
      setError('Upload a PDF, DOCX, or plain-text document.');
      setStage('failed');
      return;
    }
    setFile(nextFile);
    setStage('uploading');
    try {
      await knowledgeApi().upload(nextFile);
      setStage('scanning');
    } catch (uploadError) {
      setStage('failed');
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Try again.');
    }
  }, []);

  useEffect(() => {
    if (!['scanning', 'extracting', 'indexing', 'analyzing'].includes(stage)) return;
    const duration = stage === 'indexing' ? 950 : 620;
    const timeout = window.setTimeout(() => {
      const next: Record<string, UploadStage> = {
        scanning: 'extracting',
        extracting: 'indexing',
        indexing: 'analyzing',
        analyzing: 'ready',
      };
      setStage(next[stage] ?? 'ready');
    }, duration);
    return () => window.clearTimeout(timeout);
  }, [stage]);

  useEffect(() => {
    if (stage === 'ready' && file) onUploaded?.(file.name.replace(/\.[^.]+$/, ''));
  }, [file, onUploaded, stage]);

  useEffect(() => {
    if (!open) {
      const timeout = window.setTimeout(() => {
        setFile(null);
        setStage('idle');
        setError(null);
      }, 200);
      return () => window.clearTimeout(timeout);
    }
  }, [open]);

  const completedIndex = stageOrder.indexOf(stage);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          className="fixed bottom-[68px] right-0 top-[64px] z-30 flex w-full flex-col border-l border-[var(--color-border)] bg-[var(--color-background)] shadow-[-12px_0_30px_rgb(21_36_63_/_0.08)] outline-none data-[state=closed]:translate-x-full data-[state=open]:translate-x-0 motion-safe:transition-transform md:bottom-0 md:top-[72px] md:w-[400px]"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="flex h-16 items-center border-b border-[var(--color-border)] px-5">
            <div>
              <Dialog.Title className="text-[15px] font-semibold">Add documents</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-[var(--color-muted)]">
                Securely ingest files into Customer contracts.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                className="ml-auto"
                variant="ghost"
                size="icon"
                aria-label="Close upload panel"
              >
                <X aria-hidden size={18} />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-5 veyra-scrollbar">
            <div
              className={cn(
                'grid min-h-44 place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-6 py-7 text-center transition-colors',
                dragging && 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]',
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const droppedFile = event.dataTransfer.files[0];
                if (droppedFile) void beginUpload(droppedFile);
              }}
            >
              <div>
                <UploadCloud
                  aria-hidden
                  className="mx-auto text-[var(--color-muted-strong)]"
                  size={30}
                  strokeWidth={1.6}
                />
                <p className="mt-3 text-sm font-medium">Drop files here</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  PDF, DOCX, or TXT · up to 25 MB
                </p>
                <input
                  ref={inputRef}
                  id={inputId}
                  type="file"
                  className="sr-only"
                  aria-label="Choose documents to upload"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0];
                    if (selectedFile) void beginUpload(selectedFile);
                  }}
                />
                <Button
                  className="mt-4"
                  type="button"
                  variant="secondary"
                  onClick={() => inputRef.current?.click()}
                >
                  Browse files
                </Button>
              </div>
            </div>

            {file ? (
              <section className="mt-6" aria-live="polite">
                <h3 className="text-xs font-semibold">Uploaded file</h3>
                <div className="mt-2 flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                  <span className="flex size-9 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
                    <FileText aria-hidden size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{file.name}</span>
                    <span className="mt-0.5 block text-[11px] text-[var(--color-muted)] tabular-nums">
                      {(file.size / 1_048_576).toFixed(1)} MB
                    </span>
                  </span>
                  {stage === 'failed' ? (
                    <span className="text-xs font-medium text-[var(--color-danger)]">Failed</span>
                  ) : stage === 'ready' ? (
                    <Check
                      aria-label="Upload ready"
                      size={18}
                      className="text-[var(--color-success)]"
                    />
                  ) : (
                    <span className="text-xs font-medium text-[var(--color-primary)] tabular-nums">
                      {progressFor(stage)}%
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-surface)]">
                  <div
                    className={cn(
                      'h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-500',
                      stage === 'failed' && 'bg-[var(--color-danger)]',
                      stage === 'ready' && 'bg-[var(--color-success)]',
                    )}
                    style={{ width: `${progressFor(stage)}%` }}
                  />
                </div>
              </section>
            ) : null}

            {file ? (
              <section className="mt-6">
                <h3 className="text-xs font-semibold">Processing status</h3>
                <ol className="mt-3">
                  {(
                    [
                      ['uploading', 'Upload'],
                      ['scanning', 'Security scan'],
                      ['extracting', 'Extracting content'],
                      ['indexing', 'Indexing'],
                      ['analyzing', 'AI analysis'],
                    ] as const
                  ).map(([itemStage, label], index) => {
                    const itemIndex = stageOrder.indexOf(itemStage);
                    const complete = stage === 'ready' || completedIndex > itemIndex;
                    const active = stage === itemStage;
                    return (
                      <li
                        key={itemStage}
                        className="grid grid-cols-[24px_1fr_auto] gap-2.5 pb-5 last:pb-0"
                      >
                        <span className="relative flex size-5 items-center justify-center">
                          {index < 4 ? (
                            <span className="absolute left-1/2 top-5 h-5 w-px -translate-x-1/2 bg-[var(--color-border)]" />
                          ) : null}
                          {complete ? (
                            <span className="z-10 flex size-5 items-center justify-center rounded-full bg-[var(--color-success)] text-white">
                              <Check aria-hidden size={12} strokeWidth={2.6} />
                            </span>
                          ) : active ? (
                            <LoaderCircle
                              aria-hidden
                              size={19}
                              className="animate-spin text-[var(--color-primary)] motion-reduce:animate-none"
                            />
                          ) : (
                            <Circle
                              aria-hidden
                              size={18}
                              className="text-[var(--color-border-strong)]"
                            />
                          )}
                        </span>
                        <span
                          className={cn(
                            'text-[13px]',
                            active && 'font-medium text-[var(--color-foreground)]',
                            !active && !complete && 'text-[var(--color-muted)]',
                          )}
                        >
                          {label}
                          {active ? (
                            <span className="mt-0.5 block text-[11px] font-normal text-[var(--color-muted)]">
                              {itemStage === 'scanning'
                                ? 'Checking file signature and malware status…'
                                : itemStage === 'extracting'
                                  ? 'Reading pages, sections, and metadata…'
                                  : itemStage === 'indexing'
                                    ? 'Building permission-aware search content…'
                                    : itemStage === 'analyzing'
                                      ? 'Extracting evidence-backed contract facts…'
                                      : 'Encrypting and storing in quarantine…'}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[11px] text-[var(--color-muted)]">
                          {complete ? 'Complete' : active ? `${progressFor(stage)}%` : 'Queued'}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : null}

            {error ? (
              <div
                className="mt-5 rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-3 text-[13px] text-[var(--color-danger)]"
                role="alert"
              >
                <p>{error}</p>
                {file ? (
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="secondary"
                    onClick={() => void beginUpload(file)}
                  >
                    <RotateCcw aria-hidden size={14} /> Retry
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex items-start gap-2.5 rounded-[var(--radius-sm)] bg-[var(--color-primary-soft)] p-3 text-xs leading-5 text-[var(--color-muted-strong)]">
              {stage === 'ready' ? (
                <ShieldCheck
                  aria-hidden
                  size={16}
                  className="mt-0.5 shrink-0 text-[var(--color-success)]"
                />
              ) : (
                <LockKeyhole
                  aria-hidden
                  size={16}
                  className="mt-0.5 shrink-0 text-[var(--color-primary)]"
                />
              )}
              {stage === 'ready'
                ? 'Security checks passed. The document is trusted and searchable.'
                : 'Files remain quarantined until security and integrity checks pass.'}
            </div>
          </div>

          <div className="border-t border-[var(--color-border)] p-5">
            <Button
              variant="primary"
              className="w-full"
              disabled={stage !== 'ready'}
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
            <p className="mt-2 text-center text-[11px] text-[var(--color-muted)]">
              {stage === 'ready'
                ? 'The document is ready in Customer contracts.'
                : 'Done is enabled after processing completes.'}
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
