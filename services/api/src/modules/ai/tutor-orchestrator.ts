import { AIBoundaryError, normalizeProviderFailure, type ModelOutputDiagnostics } from "./ai-boundary-error.js";
import { buildTutorPrompt } from "./prompts/build-tutor-prompt.js";
import type { ModelProvider } from "./providers/model-provider.js";
import type { ModelResponse } from "./providers/model-provider.js";
import type { TutorContext } from "./tutor-context.js";
import type { Citation, TutorOutput, ValidatedTutorOutput } from "./tutor-output.js";
import { validateTutorOutput } from "./tutor-output-validator.js";

export interface TutorOrchestrator {
  generate(context: TutorContext): Promise<ValidatedTutorOutput>;
}

function sameCitation(left: Citation, right: Citation): boolean {
  return left.id === right.id && left.title === right.title && left.sourceType === right.sourceType
    && left.url === right.url && left.page === right.page;
}

export class DefaultTutorOrchestrator implements TutorOrchestrator {
  constructor(private readonly provider: ModelProvider) {}

  async generate(context: TutorContext): Promise<ValidatedTutorOutput> {
    let response: ModelResponse;
    try {
      response = await this.provider.generate(buildTutorPrompt(context));
    } catch (error) {
      throw normalizeProviderFailure(error);
    }

    const finishReason = response.finishReason?.trim().toLowerCase();
    const count = (value: number | undefined): number | undefined => Number.isSafeInteger(value) && value! >= 0 ? value : undefined;
    const diagnostics = (subtype: ModelOutputDiagnostics["subtype"]): ModelOutputDiagnostics => ({
      subtype, outputCharacters: response.content.length,
      ...(finishReason ? { finishReason: ["stop", "length", "content_filter"].includes(finishReason)
        ? finishReason as "stop" | "length" | "content_filter" : "other" } : {}),
      inputTokens: count(response.usage?.inputTokens), outputTokens: count(response.usage?.outputTokens),
    });
    // Even parseable JSON with finish_reason=length is an incomplete generation.
    if (finishReason === "length") throw new AIBoundaryError("AI_INVALID_OUTPUT", undefined, diagnostics("MODEL_OUTPUT_TRUNCATED"));

    let value: unknown;
    try {
      value = JSON.parse(response.content);
    } catch {
      throw new AIBoundaryError("AI_INVALID_OUTPUT", undefined, diagnostics("MODEL_OUTPUT_INVALID_JSON"));
    }

    const validation = validateTutorOutput(value);
    if (!validation.valid) throw new AIBoundaryError("AI_INVALID_OUTPUT", validation.errors, diagnostics("MODEL_OUTPUT_SCHEMA_INVALID"));

    // Validate the entire provider envelope FIRST. Missing/wrongly typed metadata,
    // unknown fields, invalid blocks and broken citation references are never repaired.
    // Schema-valid engine-field echoes have no authority over session state.
    const output: TutorOutput = { ...(value as TutorOutput), sessionId: context.sessionId,
      responseId: context.responseId, stage: context.outputStage, progress: { ...context.progress } };
    const canonical = validateTutorOutput(output);
    if (!canonical.valid) throw new AIBoundaryError("AI_INVALID_OUTPUT", canonical.errors, diagnostics("MODEL_OUTPUT_SCHEMA_INVALID"));
    const referencedIds = new Set(output.blocks.flatMap((block) => block.citationIds ?? []));
    const knowledgeIds = new Set(context.sourceMaterials.filter((source) => source.knowledge).map((source) => source.citation.id));
    // A schema-valid output must also belong to this particular engine request.
    if (output.sessionId !== context.sessionId || output.responseId !== context.responseId
      || output.stage !== context.outputStage
      || output.progress.percent !== context.progress.percent
      || output.progress.canAdvance !== context.progress.canAdvance
      || output.progress.nextAction !== context.progress.nextAction
      || output.citations.some((citation) => !referencedIds.has(citation.id)
        || !context.sourceMaterials.some((source) => sameCitation(citation, source.citation)))
      || (knowledgeIds.size > 0 && !output.citations.some((citation) => knowledgeIds.has(citation.id) && referencedIds.has(citation.id)))) {
      throw new AIBoundaryError("AI_INVALID_OUTPUT", undefined, diagnostics("MODEL_OUTPUT_CITATION_INVALID"));
    }

    return output as ValidatedTutorOutput;
  }
}
