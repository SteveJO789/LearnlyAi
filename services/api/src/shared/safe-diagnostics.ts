/** Allowlisted operational fields only. Never pass dependency exceptions here. */
export function logSessionLoadFailure(
  requestId: string,
  phase: "auth" | "session" | "messages" | "response",
): void {
  console.error("[learning-session-detail] failed", { requestId, phase });
}
