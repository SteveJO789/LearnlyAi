import type { LearningProgress } from "./learning-sessions";

const AUTO_SEND_UNAVAILABLE = "unavailable" as const;

export function readAutoSendAttempt(sessionId: string): number | null | typeof AUTO_SEND_UNAVAILABLE {
  try {
    const stored = sessionStorage.getItem(`learnlyai:chat-auto-send:${sessionId}`);
    if (stored === null) return null;
    const baseVersion = Number(stored);
    return Number.isSafeInteger(baseVersion) && baseVersion >= 0 ? baseVersion : AUTO_SEND_UNAVAILABLE;
  } catch {
    return AUTO_SEND_UNAVAILABLE;
  }
}

export function markAutoSendAttempt(sessionId: string, baseVersion: number): boolean {
  try {
    sessionStorage.setItem(`learnlyai:chat-auto-send:${sessionId}`, String(baseVersion));
    return true;
  } catch {
    return false;
  }
}

export function clearAutoSendAttempt(sessionId: string): void {
  try {
    sessionStorage.removeItem(`learnlyai:chat-auto-send:${sessionId}`);
  } catch {
    // A retained marker is safer than silently replaying the first message.
  }
}

export type ChatActionState = {
  hydrating: boolean;
  loading: boolean;
  loadError: boolean;
  lifecycleState: string;
  stage?: string;
  assessmentCheckPending: boolean;
  pendingPre: boolean;
};

export function canRespond(state: ChatActionState): boolean {
  return !state.hydrating && !state.loading && !state.loadError &&
    state.lifecycleState === "ACTIVE" && state.stage !== "REVIEW" && !state.assessmentCheckPending && !state.pendingPre;
}

export function canAdvance(state: ChatActionState & {
  stage: string;
  progress: LearningProgress | null;
}): boolean {
  if (!canRespond(state) || !state.progress?.canAdvance) return false;
  return state.stage !== "REVIEW";
}

export function progressPercent(progress: LearningProgress | null | undefined): number | null {
  if (!progress || !Number.isFinite(progress.percent)) return null;
  return Math.min(100, Math.max(0, Math.round(progress.percent)));
}

export function isCurrentSessionVersion(currentVersion: number | null, incomingVersion: number): boolean {
  return currentVersion === null || incomingVersion >= currentVersion;
}

export function confirmsActionCommit(input: {
  baseVersion: number | null;
  baseMessageIds: ReadonlySet<string>;
  detail: { version: number; messages: Array<{ id: string; role: string; content: unknown }> };
  submittedInput: string;
}): boolean {
  if (input.baseVersion === null || input.detail.version <= input.baseVersion) return false;
  return input.detail.messages.some(message =>
    message.role === "USER" && !input.baseMessageIds.has(message.id) && message.content === input.submittedInput,
  );
}

export function confirmsActionFailure(input: {
  baseVersion: number | null;
  baseMessageIds: ReadonlySet<string>;
  detail: { version: number; lifecycleState: string; messages: Array<{ id: string; role: string; content: unknown }> };
  submittedInput: string;
}): boolean {
  return input.baseVersion !== null && input.detail.version > input.baseVersion &&
    input.detail.lifecycleState === "FAILED" &&
    !confirmsActionCommit({ ...input, detail: input.detail });
}
