"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { respondToLearning, type LearningAction, type TutorOutput } from "./api";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import BlockView, { CitationList } from "./blocks";

type UserTurn = { id: string; role: "user"; text: string };
type TutorTurn = { id: string; role: "tutor"; output: TutorOutput };
type Turn = UserTurn | TutorTurn;

type PendingRequest = { action: LearningAction; input: string };

type Props = {
  sessionId: string;
  learningGoal?: string;
  subject?: string;
  initialInput?: string;
};

function SidebarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16" />
    </svg>
  );
}

export default function LearningSession({ sessionId, learningGoal, subject, initialInput }: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const lastRequest = useRef<PendingRequest | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const turnCounter = useRef(0);
  const didAutoSend = useRef(false);

  // Start with the sidebar closed on phones so it doesn't cover the chat.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, loading, error]);

  const lastTurn = turns[turns.length - 1];
  const lastTutorTurn = [...turns]
    .reverse()
    .find((turn): turn is TutorTurn => turn.role === "tutor");
  const progress = lastTutorTurn?.output.progress;
  const percent =
    progress && Number.isFinite(progress.percent)
      ? Math.min(100, Math.max(0, Math.round(progress.percent)))
      : null;

  function nextId() {
    turnCounter.current += 1;
    return `turn-${turnCounter.current}`;
  }

  async function run(request: PendingRequest) {
    lastRequest.current = request;
    setLoading(true);
    setError(null);

    try {
      const output = await respondToLearning({
        sessionId,
        input: request.input,
        learningGoal,
        subject,
        action: request.action,
      });
      setTurns((previous) => [...previous, { id: nextId(), role: "tutor", output }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("chat.unknownError"));
    } finally {
      setLoading(false);
    }
  }

  function submit(text: string) {
    const input = text.trim();
    if (!input || loading) return;

    setTurns((previous) => [...previous, { id: nextId(), role: "user", text: input }]);
    setDraft("");
    void run({ action: "RESPOND", input });
  }

  // Auto-send the question the learner already typed on the Create page,
  // so they don't have to retype it here. Runs once per page load.
  useEffect(() => {
    if (didAutoSend.current) return;
    if (initialInput && initialInput.trim()) {
      didAutoSend.current = true;
      submit(initialInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInput]);

  function advance() {
    if (loading) return;
    void run({ action: "ADVANCE", input: "Continue" });
  }

  function retry() {
    if (loading || !lastRequest.current) return;
    void run(lastRequest.current);
  }

  function startNewSession() {
    router.push(`/Chat/${crypto.randomUUID()}`);
  }

  return (
    <div className="flex h-dvh bg-background text-text">
      <aside
        inert={!sidebarOpen}
        className={`fixed inset-y-0 left-0 z-20 shrink-0 overflow-hidden bg-surface transition-[width] duration-200 md:static ${
          sidebarOpen ? "w-72 border-r border-surface-border" : "w-0"
        }`}
      >
        <div className="flex h-full w-72 flex-col gap-6 p-4">
          <div className="flex items-center justify-between">
            <Link href="/Home" className="text-lg font-medium tracking-wide">
              LOGO
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              className="rounded-lg p-2 text-muted hover:bg-secondary"
            >
              <SidebarIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={startNewSession}
            className="rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground shadow-sm hover:opacity-90"
          >
            {t("chat.newSession")}
          </button>

          <div className="text-sm text-muted">
            <p className="mb-1 font-medium text-text">{t("chat.currentSession")}</p>
            <p className="break-all font-mono text-xs">{sessionId}</p>
            {subject && <p className="mt-2">{t("chat.subject")} {subject}</p>}
            {learningGoal && <p className="mt-1">{t("chat.goal")} {learningGoal}</p>}
          </div>

          <Link href="/Home" className="mt-auto text-sm text-muted hover:underline">
            {t("chat.backToHome")}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-surface-border px-4 py-3">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
                aria-expanded={false}
                className="rounded-lg p-2 text-muted hover:bg-secondary"
              >
                <SidebarIcon />
              </button>
            )}
            <h1 className="text-base font-medium text-muted">{t("chat.title")}</h1>
          </div>

          {percent !== null && (
            <div className="flex items-center gap-3">
              <div
                role="progressbar"
                aria-label="Learning progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-2 w-28 overflow-hidden rounded-full bg-secondary sm:w-44"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-sm tabular-nums text-muted">{percent}%</span>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
            {turns.length === 0 && !loading && !error && (
              <div className="py-16 text-center">
                <p className="text-2xl text-muted">{t("chat.whatToLearn")}</p>
                {learningGoal && (
                  <p className="mt-3 text-muted">{t("chat.goal")} {learningGoal}</p>
                )}
              </div>
            )}

            {turns.map((turn) => {
              if (turn.role === "user") {
                return (
                  <div key={turn.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-3">
                      {turn.text}
                    </p>
                  </div>
                );
              }

              const isLatest = turn.id === lastTutorTurn?.id;

              return (
                <div key={turn.id} className="flex flex-col gap-3">
                  {turn.output.blocks.map((block, index) => (
                    <BlockView
                      key={`${block.id}-${index}`}
                      block={block}
                      interactive={isLatest && !loading}
                      onChoose={submit}
                    />
                  ))}
                  <CitationList citations={turn.output.citations} />
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-3 text-muted" aria-live="polite">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="size-2 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                  <span className="size-2 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                  <span className="size-2 animate-bounce rounded-full bg-muted" />
                </span>
                {t("chat.thinking")}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger"
              >
                <p>⚠️ {error}</p>
                <button
                  type="button"
                  onClick={retry}
                  className="self-start rounded-lg border border-danger/40 bg-background px-4 py-2 text-sm font-medium hover:bg-danger/10"
                >
                  {t("chat.retry")}
                </button>
              </div>
            )}

            {lastTurn?.role === "tutor" && progress?.canAdvance && !loading && (
              <div>
                <button
                  type="button"
                  onClick={advance}
                  className="rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-sm hover:opacity-90"
                >
                  {t("chat.continue")}
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-surface-border px-4 pb-5 pt-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit(draft);
            }}
            className="mx-auto flex w-full max-w-3xl items-end gap-3 rounded-3xl border border-surface-border bg-surface p-2 pl-5 focus-within:border-primary"
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit(draft);
                }
              }}
              rows={1}
              placeholder={t("chat.placeholder")}
              aria-label={t("chat.messageAriaLabel")}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-base outline-none field-sizing-content placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={loading || draft.trim().length === 0}
              aria-label={t("chat.sendAriaLabel")}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted">
            {t("chat.sendHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
