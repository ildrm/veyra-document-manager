'use client';

import { useMutation } from '@tanstack/react-query';
import type { AskResponse } from '@veyra/contracts';
import { Button, cn } from '@veyra/ui';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  MessageSquareText,
  Paperclip,
  Pin,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { demoAskResponse, ids } from '@/lib/demo-data';
import { knowledgeApi } from '@/lib/knowledge-api';

type Feedback = 'helpful' | 'unhelpful' | null;

export function AskClient() {
  const [question, setQuestion] = useState('What uptime have we committed to for Acme Corp?');
  const [composer, setComposer] = useState('');
  const [response, setResponse] = useState<AskResponse>(demoAskResponse);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [copied, setCopied] = useState(false);
  // The desktop rail is always visible through the `lg:block` class. Keeping the
  // mobile drawer closed initially prevents it from obscuring the conversation.
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [streamStatus, setStreamStatus] = useState('Applying permissions…');
  const askMutation = useMutation({
    mutationFn: (nextQuestion: string) => {
      setStreamingAnswer('');
      setStreamStatus('Applying permissions…');
      return knowledgeApi().askStream(
        {
          question: nextQuestion,
          workspaceId: ids.legalWorkspace,
          mode: 'quick_answer',
        },
        {
          onStatus: setStreamStatus,
          onToken: (token) => setStreamingAnswer((current) => current + token),
        },
      );
    },
    onSuccess: (result, nextQuestion) => {
      setQuestion(nextQuestion);
      setResponse(result);
      setComposer('');
      setFeedback(null);
      setEvidenceOpen(false);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = composer.trim();
    if (!normalized || askMutation.isPending) return;
    askMutation.mutate(normalized);
  };

  const copyAnswer = async () => {
    await navigator.clipboard?.writeText(response.answer);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const citation = response.citations[0];

  return (
    <main className="grid min-h-[calc(100vh-64px)] grid-cols-1 lg:h-[calc(100vh-72px)] lg:min-h-0 lg:grid-cols-[minmax(560px,1fr)_370px]">
      <section
        className="min-h-0 overflow-y-auto px-4 py-5 sm:px-7 lg:px-8 lg:py-7 veyra-scrollbar"
        aria-labelledby="ask-heading"
      >
        <div className="mx-auto max-w-[850px]">
          <h1
            id="ask-heading"
            className="text-[clamp(1.6rem,2.2vw,2rem)] font-semibold tracking-[-0.04em]"
          >
            Ask Veyra
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button>
              <FolderOpen aria-hidden size={15} /> Customer contracts{' '}
              <ChevronDown aria-hidden size={13} />
            </Button>
            <Button>
              <Sparkles aria-hidden size={15} /> Quick answer <ChevronDown aria-hidden size={13} />
            </Button>
          </div>

          <div className="mt-8">
            <p className="text-[17px] font-medium leading-7 sm:text-[19px]">{question}</p>
            <div className="mt-8" aria-live="polite" aria-busy={askMutation.isPending}>
              {askMutation.isPending && !streamingAnswer ? (
                <div className="py-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="relative flex size-5 items-center justify-center">
                      <span className="absolute size-5 animate-ping rounded-full bg-[var(--color-primary-soft)] motion-reduce:animate-none" />
                      <Sparkles
                        aria-hidden
                        size={15}
                        className="relative text-[var(--color-primary)]"
                      />
                    </span>
                    {streamStatus}
                  </div>
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--color-surface)]">
                    <div className="indeterminate-progress h-full w-1/3 rounded-full bg-[var(--color-primary)]" />
                  </div>
                  <ol className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--color-muted)]">
                    <li className="inline-flex items-center gap-1.5">
                      <Check aria-hidden size={13} className="text-[var(--color-success)]" />{' '}
                      Applied permissions
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <Search aria-hidden size={13} /> Searching contracts
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <FileText aria-hidden size={13} /> Reranking evidence
                    </li>
                  </ol>
                </div>
              ) : askMutation.isPending && streamingAnswer ? (
                <div>
                  <p className="text-[21px] font-semibold leading-[1.45] tracking-[-0.025em] sm:text-[24px]">
                    {streamingAnswer}
                    <span
                      className="ml-1 inline-block h-5 w-0.5 animate-pulse bg-[var(--color-primary)] align-middle motion-reduce:animate-none"
                      aria-hidden
                    />
                  </p>
                  <p className="mt-3 text-xs text-[var(--color-muted)]">{streamStatus}</p>
                </div>
              ) : askMutation.isError ? (
                <div
                  className="rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger)]"
                  role="alert"
                >
                  <p className="font-medium">Veyra could not complete that answer.</p>
                  <p className="mt-1 text-xs">
                    Document search remains available. Retry when the AI service is ready.
                  </p>
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() => askMutation.mutate(composer || question)}
                  >
                    Retry
                  </Button>
                </div>
              ) : response.sufficientEvidence ? (
                <>
                  <p className="text-[21px] font-semibold leading-[1.45] tracking-[-0.025em] sm:text-[24px]">
                    The current commitment is{' '}
                    <span className="text-[var(--color-primary)]">99.95% monthly uptime.</span>
                    <button
                      type="button"
                      className="ml-1 align-super text-[11px] font-semibold text-[var(--color-primary)] hover:underline focus-visible:rounded-sm focus-visible:shadow-[var(--focus-ring)]"
                      onClick={() => setEvidenceOpen(true)}
                      aria-label="Open citation 1"
                    >
                      [1]
                    </button>
                  </p>
                  <p className="mt-3 max-w-[720px] text-[15px] leading-7 text-[var(--color-muted-strong)]">
                    Scheduled Maintenance and Force Majeure events are excluded from the
                    availability calculation.
                  </p>
                </>
              ) : (
                <div className="rounded-[var(--radius-sm)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4">
                  <p className="text-sm font-semibold">
                    I don’t have enough authorized evidence to answer this.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-muted-strong)]">
                    Try widening the workspace scope or ask a document owner for access.
                  </p>
                </div>
              )}
            </div>

            {!askMutation.isPending && response.sufficientEvidence && citation ? (
              <section className="mt-7" aria-labelledby="sources-heading">
                <div className="flex items-center justify-between">
                  <h2
                    id="sources-heading"
                    className="text-xs font-semibold text-[var(--color-muted)]"
                  >
                    1 source
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEvidenceOpen(true)}
                    className="text-xs font-medium text-[var(--color-primary)] hover:underline lg:hidden"
                  >
                    View evidence
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setEvidenceOpen(true)}
                  className="evidence-thread mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 pl-5 text-left outline-none hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:shadow-[var(--focus-ring)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                      <FileText aria-hidden size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">
                        Acme Master Services Agreement · v4 · Page 8 · Section 7.2
                      </span>
                      <span className="reading-font mt-2 block rounded bg-[color-mix(in_srgb,var(--color-highlight)_62%,transparent)] px-2 py-1.5 text-[14px] leading-5">
                        “Service availability will be <mark>99.95% monthly uptime</mark>, excluding
                        Scheduled Maintenance…”
                      </span>
                    </span>
                    <span className="hidden shrink-0 border-l border-[var(--color-border)] pl-4 sm:block">
                      <span className="block text-[11px] text-[var(--color-success)]">
                        <CheckCircle2 aria-hidden size={12} className="mr-1 inline" />
                        Verified
                      </span>
                      <span className="mt-2 block text-[11px] text-[var(--color-success)]">
                        <ShieldCheck aria-hidden size={12} className="mr-1 inline" />
                        High confidence
                      </span>
                      <span className="mt-2 block text-[11px] text-[var(--color-muted-strong)]">
                        <ShieldCheck aria-hidden size={12} className="mr-1 inline" />
                        Exact match
                      </span>
                    </span>
                  </div>
                </button>
              </section>
            ) : null}

            {!askMutation.isPending ? (
              <div className="mt-5 flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] pb-4">
                <p className="mr-auto inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                  <CheckCircle2 aria-hidden size={14} className="text-[var(--color-success)]" />
                  Searched {response.searchedDocumentCount} documents · Used{' '}
                  {response.citations.length} source
                </p>
                <Button variant="ghost" size="sm" onClick={() => askMutation.mutate(question)}>
                  <RefreshCcw aria-hidden size={13} /> Regenerate
                </Button>
              </div>
            ) : null}

            {!askMutation.isPending ? (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => void copyAnswer()}>
                  {copied ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  variant={feedback === 'helpful' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFeedback('helpful')}
                  aria-pressed={feedback === 'helpful'}
                >
                  <ThumbsUp aria-hidden size={14} /> Helpful
                </Button>
                <Button
                  variant={feedback === 'unhelpful' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFeedback('unhelpful')}
                  aria-pressed={feedback === 'unhelpful'}
                >
                  <ThumbsDown aria-hidden size={14} /> Not helpful
                </Button>
                <span className="mx-1 hidden h-5 w-px bg-[var(--color-border)] sm:block" />
                <Button variant="ghost" size="sm">
                  <BookOpen aria-hidden size={14} /> Save to knowledge
                </Button>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <ExternalLink aria-hidden size={14} /> Open research
                </Button>
              </div>
            ) : null}

            <button
              type="button"
              className="mt-6 flex w-full items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left outline-none hover:border-[var(--color-border-strong)] focus-visible:shadow-[var(--focus-ring)]"
              onClick={() => {
                setQuestion('What uptime have we committed to for Beta Systems?');
                setResponse({
                  ...demoAskResponse,
                  answer: '',
                  sufficientEvidence: false,
                  citations: [],
                  searchedDocumentCount: 24,
                });
              }}
            >
              <MessageSquareText aria-hidden size={16} className="text-[var(--color-primary)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">
                  Try an insufficient-evidence answer
                </span>
                <span className="mt-1 block truncate text-xs text-[var(--color-muted)]">
                  What uptime have we committed to for Beta Systems?
                </span>
              </span>
              <ChevronDown aria-hidden size={15} />
            </button>

            <form onSubmit={submit} className="mt-5">
              <label htmlFor="ask-composer" className="sr-only">
                Ask a follow-up
              </label>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-3 shadow-[var(--shadow-sm)] focus-within:border-[var(--color-primary)] focus-within:shadow-[var(--focus-ring)]">
                <textarea
                  id="ask-composer"
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  placeholder="Ask a follow-up"
                  rows={2}
                  className="w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-[var(--color-muted)]"
                />
                <div className="mt-2 flex items-center gap-1">
                  <Button variant="ghost" size="icon" type="button" aria-label="Attach evidence">
                    <Paperclip aria-hidden size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" type="button">
                    <FolderOpen aria-hidden size={14} /> Customer contracts{' '}
                    <ChevronDown aria-hidden size={12} />
                  </Button>
                  <Button
                    className="ml-auto"
                    variant="primary"
                    size="icon"
                    type="submit"
                    disabled={!composer.trim() || askMutation.isPending}
                    aria-label="Send question"
                  >
                    <Send aria-hidden size={16} />
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-muted)]">
                Answers use only knowledge you’re authorized to access.
              </p>
            </form>
          </div>
        </div>
      </section>

      <aside
        className={cn(
          'border-l border-[var(--color-border)] bg-[var(--color-background)] lg:block',
          evidenceOpen
            ? 'fixed inset-x-0 bottom-[68px] top-[64px] z-30 overflow-y-auto shadow-[var(--shadow-md)] lg:static lg:min-h-0 lg:shadow-none'
            : 'hidden',
        )}
        aria-label="Evidence"
      >
        <div className="flex min-h-14 items-center border-b border-[var(--color-border)] px-5">
          <h2 className="text-base font-semibold">Evidence</h2>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={() => setEvidenceOpen(false)}
            aria-label="Close evidence panel"
          >
            <X aria-hidden size={18} />
          </Button>
        </div>
        <div className="p-5">
          <p className="text-xs text-[var(--color-muted)]">Selected source</p>
          <div className="mt-3 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <FileText aria-hidden size={18} />
            </span>
            <span>
              <span className="block text-[13px] font-semibold">
                Acme Master Services Agreement
              </span>
              <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                v4 · Page 8 · Section 7.2
              </span>
            </span>
          </div>
          <div className="mt-5 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-4">
            <h3 className="reading-font text-base font-semibold">
              7.2&nbsp;&nbsp; Service availability
            </h3>
            <p className="reading-font mt-3 text-[15px] leading-6">
              Provider will maintain and support the Services to achieve{' '}
              <mark>99.95% monthly uptime</mark>, excluding Scheduled Maintenance and Force Majeure
              events.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
              <Button size="sm" variant="primary" asChild>
                <Link href={`/documents/${ids.acmeDocument}`}>
                  <ExternalLink aria-hidden size={14} /> Open document
                </Link>
              </Button>
              <Button size="sm">
                <Pin aria-hidden size={14} /> Pin evidence
              </Button>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-[var(--color-border)] text-xs">
            {[
              ['Customer', 'Acme Corp'],
              ['Version', 'v4'],
              ['Effective', 'May 12, 2025'],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3 py-3">
                <dt className="text-[var(--color-muted)]">{label}</dt>
                <dd className="ml-auto font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] p-3 text-xs text-[var(--color-success)]">
            <ShieldCheck aria-hidden size={16} /> Authorized through Legal workspace
          </p>
        </div>
      </aside>
    </main>
  );
}
