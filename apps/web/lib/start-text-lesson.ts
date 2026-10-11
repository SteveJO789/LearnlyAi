"use client";
import { createTextMaterial, sendLearningInteraction } from "./learning-sessions";
import type { Features } from "./features";

/** Return a destination only after the authenticated API accepts the input. */
export async function startTextLesson(sessionId: string, text: string, features: Features) {
  if (features.assessments) {
    await createTextMaterial(sessionId, text);
    return `/Assessment/${encodeURIComponent(sessionId)}?phase=PRE`;
  }
  await sendLearningInteraction({ sessionId, message: text, action: "RESPOND" });
  return `/Chat/${encodeURIComponent(sessionId)}`;
}
