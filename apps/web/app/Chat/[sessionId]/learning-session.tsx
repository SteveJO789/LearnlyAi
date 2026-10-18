"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { respondToLearning, type LearningAction, type TutorOutput } from "./api";
import { getLearningSession, LearningApiError, recoverLearningSession, type LearningProgress, type LearningSessionDetail } from "../../../lib/learning-sessions";
import { canAdvance as canAdvanceFromState, canRespond, clearAutoSendAttempt, confirmsActionCommit, confirmsActionFailure, isCurrentSessionVersion, markAutoSendAttempt, progressPercent, readAutoSendAttempt } from "../../../lib/chat-session";
import { getAssessment } from "../../../lib/assessments";
import { useFeatures } from "../../../lib/features";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import BlockView, { CitationList } from "./blocks";
import CuteLoadingPopup from "../../components/CuteLoadingPopup";

type UserTurn = { id: string; role: "user"; text: string };
type TutorTurn = { id: string; role: "tutor"; output: TutorOutput };
type Turn = UserTurn | TutorTurn;

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
  const features = useFeatures();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionStage, setSessionStage] = useState("EXPLAIN");
  const [sessionProgress, setSessionProgress] = useState<LearningProgress | null>(null);
  const [lifecycleState, setLifecycleState] = useState("UNKNOWN");
  const [restoredInput, setRestoredInput] = useState<string | undefined>();
  const [postSubmitted, setPostSubmitted] = useState(false);
  const [pendingPre, setPendingPre] = useState(false);
  const [sessionFailed, setSessionFailed] = useState(false);
  const [assessmentCheckPending, setAssessmentCheckPending] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const actionLock = useRef(false);
  const hydrationEpoch = useRef(0);
  const activeSessionId = useRef(sessionId);
  activeSessionId.current = sessionId;
  const sessionSnapshot = useRef<{ version: number | null; messageIds: Set<string> }>({ version: null, messageIds: new Set() });
  const unknownAction = useRef<{ baseVersion: number | null; baseMessageIds: Set<string>; input: string } | null>(null);
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

  const hydrate = useCallback(async (session: LearningSessionDetail, isActive: () => boolean) => {
    const restored = session.messages.flatMap<Turn>((message): Turn[] => {
          if (message.role === "USER" && typeof message.content === "string") {
            return [{ id: message.id, role: "user" as const, text: message.content }];
          }

          if (
            message.role === "TUTOR" &&
            message.content &&
            typeof message.content === "object" &&
            Array.isArray((message.content as TutorOutput).blocks)
          ) {
            return [{
              id: message.id,
              role: "tutor" as const,
              output: message.content as TutorOutput,
            }];
          }

          return [];
        });

    const unresolved = unknownAction.current;
    if (!isActive() || !isCurrentSessionVersion(sessionSnapshot.current.version, session.version) ||
      (unresolved && unresolved.baseVersion !== null && session.version <= unresolved.baseVersion)) return false;
    const epoch = ++hydrationEpoch.current;
    setTurns(restored);
    setSessionStage(session.stage);
    setSessionProgress(session.progress ?? null);
    setLifecycleState(session.lifecycleState);
    setSessionFailed(session.lifecycleState === "FAILED");
    sessionSnapshot.current = { version: session.version, messageIds: new Set(session.messages.map(message => message.id)) };
    const autoSendBaseVersion = readAutoSendAttempt(sessionId);
    if (typeof autoSendBaseVersion === "number" && session.version > autoSendBaseVersion &&
      session.messages.some(message => message.role === "USER")) clearAutoSendAttempt(sessionId);
    setPendingPre(false);
    setPostSubmitted(false);
    setAssessmentCheckPending(false);
    setRestoredInput(session.materials?.find(material => material.type === "TEXT" && material.status === "READY")?.normalizedText);
    turnCounter.current = restored.length;

    const needsPre = features.assessments && session.state === "PRE_TEST" && session.stage === "EXPLAIN";
    const needsPost = features.assessments && session.stage === "ASSESS";
    if (needsPre || needsPost) setAssessmentCheckPending(true);
    const assessmentIfPresent = (phase: "PRE" | "POST") => getAssessment(sessionId, phase).catch(cause => {
      if (cause instanceof LearningApiError && cause.status === 404) return null;
      throw cause;
    });
    try {
      const [pre, post] = await Promise.all([
        needsPre ? assessmentIfPresent("PRE") : Promise.resolve(null),
        needsPost ? assessmentIfPresent("POST") : Promise.resolve(null),
      ]);
      if (!isActive() || epoch !== hydrationEpoch.current || sessionSnapshot.current.version !== session.version) return false;
      setPendingPre(Boolean(needsPre && !pre?.submittedAt));
      setPostSubmitted(Boolean(post?.submittedAt));
    } finally {
      if (isActive() && epoch === hydrationEpoch.current && sessionSnapshot.current.version === session.version) {
        setAssessmentCheckPending(false);
      }
    }
    if (session.lifecycleState === "FAILED" && isActive()) setError(t("chat.failedSession"));
    return true;
  }, [features.assessments, sessionId, t]);

  const refreshSession = useCallback(async (isActive: () => boolean) => {
    const session = await getLearningSession(sessionId);
    if (isActive()) {
      const applied = await hydrate(session, isActive);
      if (!applied || !isActive()) return;
      const pending = unknownAction.current;
      const outcomeConfirmed = !pending || confirmsActionCommit({
        baseVersion: pending.baseVersion,
        baseMessageIds: pending.baseMessageIds,
        detail: session,
        submittedInput: pending.input,
      }) || confirmsActionFailure({
        baseVersion: pending.baseVersion,
        baseMessageIds: pending.baseMessageIds,
        detail: session,
        submittedInput: pending.input,
      });
      if (!outcomeConfirmed) {
        setError("The action outcome is still unknown. Reload the session to confirm before continuing.");
        setLoadFailed(true);
        return;
      }
      if (pending) unknownAction.current = null;
      setError(session.lifecycleState === "FAILED" ? t("chat.failedSession") : null);
      setLoadFailed(false);
    }
  }, [hydrate, sessionId, t]);

  useEffect(() => {
    if (!features.loaded) return;
    let active = true;
    const isActive = () => active;
    setHydrating(true);
    if (!unknownAction.current) {
      setError(null);
      setLoadFailed(false);
    }
    setPendingPre(false);
    setPostSubmitted(false);
    setAssessmentCheckPending(false);
    void refreshSession(isActive)
      .catch((loadError) => {
        if (!active) return;
        setLoadFailed(true);
        setError(loadError instanceof Error ? loadError.message : t("chat.unknownError"));
      })
      .finally(() => { if (active) setHydrating(false); });
    return () => { active = false; };
  }, [sessionId, t, features.loaded, refreshSession]);

  const lastTutorTurn = [...turns]
    .reverse()
    .find((turn): turn is TutorTurn => turn.role === "tutor");
  const percent = progressPercent(sessionProgress);

  function nextId() {
    turnCounter.current += 1;
    return `turn-${turnCounter.current}`;
  }

  async function run(action: LearningAction, input: string) {
    if (actionLock.current) return;
    actionLock.current = true;
    const requestSessionId = sessionId;
    const isCurrentSession = () => activeSessionId.current === requestSessionId;
    const baseVersion = sessionSnapshot.current.version;
    const baseMessageIds = new Set(sessionSnapshot.current.messageIds);
    unknownAction.current = { baseVersion, baseMessageIds, input };
    setLoading(true);
    setError(null);

    try {
      await respondToLearning({
        sessionId: requestSessionId,
        input,
        action,
      });
      if (!isCurrentSession()) return;
      try {
        const detail = await getLearningSession(requestSessionId);
        if (!isCurrentSession()) return;
        const committed = confirmsActionCommit({ baseVersion, baseMessageIds, detail, submittedInput: input });
        const applied = await hydrate(detail, isCurrentSession);
        if (committed) unknownAction.current = null;
        if ((!applied || !committed) && isCurrentSession()) {
          setLoadFailed(true);
          setError("Your response was saved, but the latest session state could not be confirmed. Reload this page to continue.");
        }
      } catch (syncError) {
        if (!isCurrentSession()) return;
        setLoadFailed(true);
        setError(`Your response was saved, but the latest session could not be loaded. Reload this page to continue. ${syncError instanceof Error ? syncError.message : ""}`.trim());
      }
    } catch (err) {
      if (!isCurrentSession()) return;
      const message = err instanceof Error ? err.message : t("chat.unknownError");
      try {
        const detail = await getLearningSession(requestSessionId);
        if (!isCurrentSession()) return;
        const applied = await hydrate(detail, isCurrentSession);
        if (!applied) throw new Error("A newer session state is already loaded.");
        const definitiveRejection = typeof err === "object" && err !== null &&
          "status" in err && typeof err.status === "number" && err.status >= 400 && err.status < 500;
        const committed = confirmsActionCommit({ baseVersion, baseMessageIds, detail, submittedInput: input });
        const failedWithoutCommit = confirmsActionFailure({ baseVersion, baseMessageIds, detail, submittedInput: input });
        if (definitiveRejection || committed || failedWithoutCommit) {
          if (definitiveRejection) clearAutoSendAttempt(requestSessionId);
          unknownAction.current = null;
          setLoadFailed(false);
          setError(message);
        } else {
          unknownAction.current = { baseVersion, baseMessageIds, input };
          setLoadFailed(true);
          setError(`${message} The action outcome is still unknown. Reload the session to confirm before continuing.`);
        }
      } catch {
        if (!isCurrentSession()) return;
        const definitiveRejection = typeof err === "object" && err !== null &&
          "status" in err && typeof err.status === "number" && err.status >= 400 && err.status < 500;
        if (definitiveRejection) {
          unknownAction.current = null;
          clearAutoSendAttempt(requestSessionId);
        }
        setLoadFailed(true);
        setError(`${message} Session state could not be confirmed. Reload this page before continuing.`);
      }
    } finally {
      actionLock.current = false;
      if (isCurrentSession()) setLoading(false);
    }
  }

  function submit(text: string) {
    const input = text.trim();
    if (!input || actionLock.current || !canRespond({ hydrating, loading, loadError: loadFailed, lifecycleState, stage: sessionStage, assessmentCheckPending, pendingPre })) return;

    setTurns((previous) => [...previous, { id: nextId(), role: "user", text: input }]);
    setDraft("");
    void run("RESPOND", input);
  }

  // Only auto-send a Create-page question when this persisted session is empty.
  // This avoids duplicating the first message after a refresh.
  useEffect(() => {
    if (hydrating || pendingPre || assessmentCheckPending || sessionFailed || loadFailed || didAutoSend.current || turns.length > 0) return;
    const firstInput = restoredInput ?? initialInput;
    if (firstInput && firstInput.trim()) {
      const storedAttempt = readAutoSendAttempt(sessionId);
      if (storedAttempt === "unavailable") {
        didAutoSend.current = true;
        setDraft(firstInput);
        setError("Automatic send could not be recorded safely. Review the message and send it manually.");
        return;
      }
      if (storedAttempt !== null) {
        didAutoSend.current = true;
        setDraft(firstInput);
        setError("A first message may already have been sent. Review the session before sending it again.");
        return;
      }
      const baseVersion = sessionSnapshot.current.version;
      if (baseVersion === null || !markAutoSendAttempt(sessionId, baseVersion)) {
        didAutoSend.current = true;
        setDraft(firstInput);
        setError("Automatic send could not be recorded safely. Review the message and send it manually.");
        return;
      }
      didAutoSend.current = true;
      submit(firstInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrating, pendingPre, assessmentCheckPending, sessionFailed, loadFailed, initialInput, restoredInput, turns.length]);

  function advance() {
    if (actionLock.current || !canAdvanceFromState({ hydrating, loading, loadError: loadFailed, lifecycleState, stage: sessionStage,
      assessmentCheckPending, pendingPre, progress: sessionProgress })) return;
    if (features.assessments && sessionStage === "ASSESS" && !postSubmitted) { router.push(`/Assessment/${sessionId}?phase=POST`); return; }
    const input = t("chat.continue");
    setTurns((previous) => [...previous, { id: nextId(), role: "user", text: input }]);
    void run("ADVANCE", input);
  }

  async function retry() {
    if (loading || hydrating) return;
    const requestSessionId = sessionId;
    const isCurrentSession = () => activeSessionId.current === requestSessionId;
    setLoading(true); setError(null);
    try {
      const session = await getLearningSession(requestSessionId);
      if (!isCurrentSession()) return;
      const pending = unknownAction.current;
      if (pending && confirmsActionFailure({
        baseVersion: pending.baseVersion,
        baseMessageIds: pending.baseMessageIds,
        detail: session,
        submittedInput: pending.input,
      })) unknownAction.current = null;
      if (session.lifecycleState === "FAILED") {
        await recoverLearningSession(requestSessionId);
        if (isCurrentSession()) clearAutoSendAttempt(requestSessionId);
      }
      if (!isCurrentSession()) return;
      const refreshed = await getLearningSession(requestSessionId);
      if (!isCurrentSession()) return;
      const applied = await hydrate(refreshed, isCurrentSession);
      if (!applied) {
        if (unknownAction.current) {
          setError("The action outcome is still unknown. Reload the session to confirm before continuing.");
          setLoadFailed(true);
          return;
        }
        throw new Error("A newer session state is already loaded. Reload before continuing.");
      }
      const unresolvedAction = unknownAction.current;
      const outcomeConfirmed = !unresolvedAction || confirmsActionCommit({
        baseVersion: unresolvedAction.baseVersion,
        baseMessageIds: unresolvedAction.baseMessageIds,
        detail: refreshed,
        submittedInput: unresolvedAction.input,
      });
      if (outcomeConfirmed) {
        unknownAction.current = null;
        setError(refreshed.lifecycleState === "FAILED" ? t("chat.failedSession") : null);
        setLoadFailed(false);
      } else {
        setError("The action outcome is still unknown. Reload the session to confirm before continuing.");
        setLoadFailed(true);
      }
    } catch (cause) {
      if (!isCurrentSession()) return;
      setLoadFailed(true);
      setError(cause instanceof Error ? cause.message : t("chat.unknownError"));
    } finally {
      if (isCurrentSession()) setLoading(false);
    }
  }

  function startNewSession() {
    router.push("/Create");
  }

  return (
    <div className="flex h-dvh bg-background text-text">
      {hydrating && <CuteLoadingPopup message="กำลังเปิดห้องเรียน..." detail="กำลังโหลดประวัติและเตรียมแชทให้พร้อม 💫" />}
      <aside
        inert={!sidebarOpen}
        className={`fixed inset-y-0 left-0 z-20 shrink-0 overflow-hidden bg-surface transition-[width] duration-200 md:static ${
          sidebarOpen ? "w-72 border-r border-surface-border" : "w-0"
        }`}
      >
        <div className="flex h-full w-72 flex-col gap-6 p-4">
          <div className="flex items-center justify-between">
            <Link href="/Home" className="text-lg font-medium tracking-wide">
              LearnlyAI
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
            <div><h1 className="text-base font-medium text-muted">{t("chat.title")}</h1>
              <p className="mt-1 text-xs text-muted">{t(`chat.stage.${sessionStage}`)}</p></div>
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
            {hydrating && (
              <div className="py-16 text-center text-muted">{t("chat.thinking")}</div>
            )}

            {turns.length === 0 && !hydrating && !loading && !error && (
              <div className="py-16 text-center">
                <p className="text-2xl text-muted">{t("chat.whatToLearn")}</p>
                {learningGoal && (
                  <p className="mt-3 text-muted">{t("chat.goal")} {learningGoal}</p>
                )}
              </div>
            )}

            {pendingPre && !hydrating ? <Link href={`/Assessment/${sessionId}?phase=PRE`}
              className="rounded-xl bg-primary px-5 py-3 text-center text-primary-foreground">{t("chat.preTest")}</Link> : null}

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
                      interactive={isLatest && canRespond({ hydrating, loading, loadError: loadFailed, lifecycleState, stage: sessionStage, assessmentCheckPending, pendingPre })}
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

            {canAdvanceFromState({ hydrating, loading, loadError: loadFailed, lifecycleState, assessmentCheckPending, pendingPre,
              stage: sessionStage, progress: sessionProgress }) && (
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
              disabled={!canRespond({ hydrating, loading, loadError: loadFailed, lifecycleState, stage: sessionStage, assessmentCheckPending, pendingPre })}
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
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-base text-text outline-none field-sizing-content placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={!canRespond({ hydrating, loading, loadError: loadFailed, lifecycleState, stage: sessionStage, assessmentCheckPending, pendingPre }) || draft.trim().length === 0}
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
