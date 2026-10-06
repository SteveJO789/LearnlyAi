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
};

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
    | { data?: T; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? `Learning API request failed (${response.status}).`,
    );
  }

  if (!payload || !("data" in payload)) {
    throw new Error("Learning API returned an invalid response.");
  }

  return payload.data as T;
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
