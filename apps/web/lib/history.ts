import type { LearningSessionSummary } from "./learning-sessions";
import type { LearningProgressDto } from "./assessments";

export type HistoryTab = "Chat" | "Lessons" | "Uploaded Files" | "Test Results";
export function historyTab(value: string | null): HistoryTab {
  return ["Chat", "Lessons", "Uploaded Files", "Test Results"].includes(value ?? "") ? value as HistoryTab : "Chat";
}
export type AssessmentHistoryItem = LearningProgressDto["comparisons"][number] & { title: string | null; updatedAt: string | null };
export function assessmentHistory(sessions: readonly LearningSessionSummary[], comparisons: LearningProgressDto["comparisons"]): AssessmentHistoryItem[] {
  const owned = new Map(sessions.map(session => [session.id, session]));
  return comparisons.filter(row => row.prePercent !== null || row.postPercent !== null).map(row => {
    const session = owned.get(row.sessionId);
    return { ...row, title: session?.title ?? null, updatedAt: session?.updatedAt ?? null };
  });
}
export function inHistoryDateRange(value: string | null, start: string, end: string): boolean {
  if (!start && !end) return true;
  if (!value) return false; // Never invent an assessment date from an absent session.
  const date = value.slice(0, 10);
  return (!start || date >= start) && (!end || date <= end);
}
