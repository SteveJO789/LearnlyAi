"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { respondToLearning, type LearningAction, type TutorOutput } from "./api";
import BlockView, { CitationList } from "./blocks";

type UserTurn = { id: string; role: "user"; text: string };
type TutorTurn = { id: string; role: "tutor"; output: TutorOutput };
type Turn = UserTurn | TutorTurn;

type PendingRequest = { action: LearningAction; input: string };

type Props = {
  sessionId: string;
  learningGoal?: string;
  subject?: string;
};

function SidebarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16" />
    </svg>
  );
}

export default function LearningSession({ sessionId, learningGoal, subject }: Props) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const lastRequest = useRef<PendingRequest | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const turnCounter = useRef(0);

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
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ");
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

  function advance() {
    if (loading) return;
    void run({ action: "ADVANCE", input: "" });
  }

  function retry() {
    if (loading || !lastRequest.current) return;
    void run(lastRequest.current);
  }

  function startNewSession() {
    router.push(`/Chat/${crypto.randomUUID()}`);
  }

  return (
    <div className="flex h-dvh bg-white text-neutral-900">
      <aside
        inert={!sidebarOpen}
        className={`fixed inset-y-0 left-0 z-20 shrink-0 overflow-hidden bg-neutral-50 transition-[width] duration-200 md:static ${
          sidebarOpen ? "w-72 border-r border-neutral-200" : "w-0"
        }`}
      >
        <div className="flex h-full w-72 flex-col gap-6 p-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-lg font-medium tracking-wide">
              LOGO
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-200"
            >
              <SidebarIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={startNewSession}
            className="rounded-lg bg-black px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-neutral-800"
          >
            + New session
          </button>

          <div className="text-sm text-neutral-500">
            <p className="mb-1 font-medium text-neutral-700">Current session</p>
            <p className="break-all font-mono text-xs">{sessionId}</p>
            {subject && <p className="mt-2">วิชา: {subject}</p>}
            {learningGoal && <p className="mt-1">เป้าหมาย: {learningGoal}</p>}
          </div>

          <Link href="/" className="mt-auto text-sm text-neutral-500 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
                aria-expanded={false}
                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
              >
                <SidebarIcon />
              </button>
            )}
            <h1 className="text-base font-medium text-neutral-700">Learning session</h1>
          </div>

          {percent !== null && (
            <div className="flex items-center gap-3">
              <div
                role="progressbar"
                aria-label="Learning progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-2 w-28 overflow-hidden rounded-full bg-neutral-200 sm:w-44"
              >
                <div
                  className="h-full rounded-full bg-black transition-[width] duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-sm tabular-nums text-neutral-500">{percent}%</span>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
            {turns.length === 0 && !loading && !error && (
              <div className="py-16 text-center">
                <p className="text-2xl text-neutral-700">วันนี้อยากเรียนเรื่องอะไร?</p>
                {learningGoal && (
                  <p className="mt-3 text-neutral-500">เป้าหมาย: {learningGoal}</p>
                )}
              </div>
            )}

            {turns.map((turn) => {
              if (turn.role === "user") {
                return (
                  <div key={turn.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-neutral-100 px-4 py-3">
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
              <div className="flex items-center gap-3 text-neutral-500" aria-live="polite">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="size-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
                  <span className="size-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
                  <span className="size-2 animate-bounce rounded-full bg-neutral-400" />
                </span>
                AI กำลังคิด…
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
              >
                <p>⚠️ {error}</p>
                <button
                  type="button"
                  onClick={retry}
                  className="self-start rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium hover:bg-red-100"
                >
                  ลองอีกครั้ง
                </button>
              </div>
            )}

            {lastTurn?.role === "tutor" && !loading && (
              <div>
                <button
                  type="button"
                  onClick={advance}
                  className={
                    progress?.canAdvance
                      ? "rounded-lg bg-black px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-neutral-800"
                      : "rounded-lg border border-neutral-300 bg-white px-6 py-3 text-base font-medium text-neutral-700 hover:border-neutral-900"
                  }
                >
                  Continue →
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-neutral-200 px-4 pb-5 pt-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit(draft);
            }}
            className="mx-auto flex w-full max-w-3xl items-end gap-3 rounded-3xl border border-neutral-300 bg-white p-2 pl-5 focus-within:border-neutral-900"
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
              placeholder="พิมพ์โจทย์หรือคำตอบของคุณ"
              aria-label="Message"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-base outline-none field-sizing-content placeholder:text-neutral-400"
            />
            <button
              type="submit"
              disabled={loading || draft.trim().length === 0}
              aria-label="Send"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-neutral-400">
            Enter เพื่อส่ง · Shift+Enter ขึ้นบรรทัดใหม่
          </p>
        </div>
      </div>
    </div>
  );
}