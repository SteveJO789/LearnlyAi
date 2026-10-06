import { AIBoundaryError, normalizeProviderFailure } from "./ai-boundary-error.js";
import { buildTutorPrompt } from "./prompts/build-tutor-prompt.js";
import type { ModelProvider } from "./providers/model-provider.js";
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
    let content: string;
    try {
      const response = await this.provider.generate(buildTutorPrompt(context));
      content = response.content;
    } catch (error) {
      throw normalizeProviderFailure(error);
    }

    let value: unknown;
    try {
      value = JSON.parse(content);
    } catch (error) {
      throw new AIBoundaryError("AI_INVALID_OUTPUT", error);
    }

    const validation = validateTutorOutput(value);
    if (!validation.valid) throw new AIBoundaryError("AI_INVALID_OUTPUT", validation.errors);

    const output = value as TutorOutput;
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
      throw new AIBoundaryError("AI_INVALID_OUTPUT");
    }

    return output as ValidatedTutorOutput;
  }
}
