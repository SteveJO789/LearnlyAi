import type { TutorOutputStage, TutorProgress } from "../ai/tutor-output.js";
import type { LearningRequest, LearningSession, LearningStage } from "./domain.js";
import { LearningError } from "./learning-errors.js";

export const LEARNING_STAGES: readonly LearningStage[] = [
  "DIAGNOSE", "EXPLAIN", "PRACTICE", "ASSESS", "REVIEW",
];

const STAGE_POLICY: Record<LearningStage, { outputStage: TutorOutputStage; progress: TutorProgress }> = {
  DIAGNOSE: { outputStage: "PRE_TEST", progress: { percent: 0, canAdvance: true, nextAction: "SUBMIT_ASSESSMENT" } },
  EXPLAIN: { outputStage: "LEARNING", progress: { percent: 25, canAdvance: true, nextAction: "CONTINUE" } },
  PRACTICE: { outputStage: "LEARNING", progress: { percent: 50, canAdvance: true, nextAction: "ANSWER" } },
  ASSESS: { outputStage: "POST_TEST", progress: { percent: 75, canAdvance: true, nextAction: "SUBMIT_ASSESSMENT" } },
  REVIEW: { outputStage: "COMPLETED", progress: { percent: 100, canAdvance: false, nextAction: null } },
};

export function getStagePolicy(stage: LearningStage): { outputStage: TutorOutputStage; progress: TutorProgress } {
  return structuredClone(STAGE_POLICY[stage]);
}

export function determineStage(
  session: LearningSession | null,
  action: LearningRequest["action"],
  initialStage: LearningStage = "EXPLAIN",
): LearningStage {
  if (!session) {
    if (action === "ADVANCE") throw new LearningError("INVALID_STAGE_TRANSITION");
    return initialStage;
  }
  if (session.state !== "ACTIVE") throw new LearningError("SESSION_INACTIVE");
  if (action !== "ADVANCE") return session.stage;
  const nextStage = LEARNING_STAGES[LEARNING_STAGES.indexOf(session.stage) + 1];
  if (!session.progress.canAdvance || !nextStage) {
    throw new LearningError("INVALID_STAGE_TRANSITION");
  }
  return nextStage;
}
