import type { LearningStage } from "../../learning/domain.js";
import type { ModelRequest } from "../providers/model-provider.js";
import type { TutorContext } from "../tutor-context.js";
import { getTutorOutputSchema } from "../tutor-output-contract.js";
import { ASSESSMENT_PROMPT } from "./assessment-prompt.js";
import { DIAGNOSE_PROMPT } from "./diagnose-prompt.js";
import { EXPLAIN_PROMPT } from "./explain-prompt.js";
import { PRACTICE_PROMPT } from "./practice-prompt.js";
import { REVIEW_PROMPT } from "./review-prompt.js";
import { TUTOR_SYSTEM_PROMPT } from "./system-prompt.js";
import { adaptiveInstructions, selectAdaptivePolicy } from "./adaptive-policy.js";

const STAGE_PROMPTS: Record<LearningStage, string> = {
  DIAGNOSE: DIAGNOSE_PROMPT,
  EXPLAIN: EXPLAIN_PROMPT,
  PRACTICE: PRACTICE_PROMPT,
  ASSESS: ASSESSMENT_PROMPT,
  REVIEW: REVIEW_PROMPT,
};

export function buildTutorPrompt(context: TutorContext): ModelRequest {
  const { previousMessages, ...task } = context;
  const teachingPolicy = selectAdaptivePolicy(context);
  return {
    messages: [
      {
        role: "system",
        content: `${TUTOR_SYSTEM_PROMPT}\n\n${STAGE_PROMPTS[context.stage]}\n\n${adaptiveInstructions(teachingPolicy)}\n\nTutor Output schema:\n${JSON.stringify(getTutorOutputSchema())}\n\nThe final task's teachingPolicy is server-selected for THIS turn. Its language and mode override previous assistant language/style and stage prose instructions. For ACKNOWLEDGE, give only a brief acknowledgement in that language; no recap of answers, even if history is in another language. Do not echo teachingPolicy into Tutor Output.`,
      },
      ...previousMessages,
      // JSON keeps source text/metadata in task data; never interpolate it into the system message.
      { role: "user", content: JSON.stringify({ ...task, teachingPolicy }) },
    ],
    temperature: 0.2,
    maxOutputTokens: 2048,
    responseFormat: { type: "json_object" },
    metadata: { operation: "tutor", correlationId: context.responseId, sessionId: context.sessionId },
  };
}
