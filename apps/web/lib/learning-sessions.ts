"use client";

import { getSupabaseClient } from "./supabase";

export type LearningSessionSummary = {
  id: string;
  title: string;
  learningGoal: string | null;
  subject: string | null;
  state: string;
  lifecycleState: string;
  stage: string;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type PersistedLearningMessage = {
  id: string;
  role: "USER" | "TUTOR" | "SYSTEM";
  content: unknown;
  createdAt: string;
};

export type LearningSessionDetail = LearningSessionSummary & {
  messages: PersistedLearningMessage[];
  materials?: Array<{ id: string; type: string; status: string; normalizedText: string }>;
};

export class LearningApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
    error,
  } = await getSupabaseClient().auth.getSession();

  if (error) throw error;
  if (!session?.access_token) {
    throw new Error("Please log in before starting a learning session.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: { message?: string; requestId?: string; code?: string } }
    | null;

  if (!response.ok) {
    const message = payload?.error?.message ?? `Learning API request failed (${response.status}).`;
    const requestId = payload?.error?.requestId ?? response.headers.get("x-request-id");
    throw new LearningApiError(requestId ? `${message} (Request ID: ${requestId})` : message, response.status, payload?.error?.code);
  }

  if (!payload || !("data" in payload)) {
    throw new Error("Learning API returned an invalid response.");
  }

  return payload.data as T;
}

export async function authenticatedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/api/")) throw new Error("Authenticated requests require a same-origin API path.");
  const response = await fetch(path, { ...init, headers: await authHeaders(), cache: "no-store", redirect: "error" });
  return readResponse<T>(response);
}

export function createTextMaterial(sessionId: string, text: string) {
  return authenticatedRequest<{ materialId: string; type: "TEXT"; status: "READY"; normalizedText: string }>(
    `/api/learning-sessions/${encodeURIComponent(sessionId)}/materials`, { method: "POST", body: JSON.stringify({ type: "TEXT", text }) });
}

export function recoverLearningSession(sessionId: string) {
  return authenticatedRequest<{ id: string; lifecycleState: "ACTIVE"; stage: string; progressPercent: number }>(
    `/api/learning-sessions/${encodeURIComponent(sessionId)}/recovery`, { method: "POST", body: "{}" });
}

export async function createLearningSession(input: {
  title?: string;
  learningGoal?: string;
  subject?: string;
}): Promise<LearningSessionSummary> {
  const response = await fetch("/api/learning-sessions", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  return readResponse<LearningSessionSummary>(response);
}

export async function listLearningSessions(): Promise<LearningSessionSummary[]> {
  const response = await fetch("/api/learning-sessions", {
    headers: await authHeaders(),
    cache: "no-store",
  });
  return readResponse<LearningSessionSummary[]>(response);
}

export async function getLearningSession(
  sessionId: string,
): Promise<LearningSessionDetail> {
  const response = await fetch(
    `/api/learning-sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: await authHeaders(),
      cache: "no-store",
    },
  );
  return readResponse<LearningSessionDetail>(response);
}

export async function sendLearningInteraction<T>(input: {
  sessionId: string;
  message: string;
  action: "RESPOND" | "ADVANCE";
}): Promise<T> {
  const response = await fetch(
    `/api/learning-sessions/${encodeURIComponent(input.sessionId)}/interactions`,
    {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        input: input.message,
        action: input.action,
      }),
    },
  );

  return readResponse<T>(response);
}
