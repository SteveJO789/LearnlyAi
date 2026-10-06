import type { NormalizedLocator } from "./domain.js";

export interface VerifiedAsset {
  asset_id: string;
  kind: "equation" | "diagram";
  artifact_id: string;
  source_id: string;
  artifact_sha256: string;
  source_document: string;
  locator: Required<Pick<NormalizedLocator, "chapter" | "section">>;
  original_asset_reference: string;
  transcription: string | null;
  latex: string | null;
  verification: {
    status: "pending" | "verified" | "rejected";
    reviewer: string | null;
    verified_at: string | null;
    method: "human_transcription" | null;
  };
}

export interface CurationSelection {
  selection_id: string;
  kind: "definition" | "equation" | "diagram" | "worked_example";
  normalized_unit: string;
  source_id: string;
  artifact_id: string;
  source_document: string;
  locator: VerifiedAsset["locator"];
  asset_ids: string[];
}

export interface CurationAnswer {
  value: number | null;
  unit: string;
  quantity: "potential_difference" | "electric_current" | "resistance";
  unit_required: true;
  asset_id: string;
}

export interface CurationInput {
  schema_version: "1.0";
  concept_id: string;
  authorship: "learnlyai";
  formula_asset_id: string;
  selections: CurationSelection[];
  student_content: {
    concept: string; intuition: string; formal_definition: string; conditions: string;
    sanity_check: string; common_mistakes: string; retrieval_summary: string;
  };
  worked_example: {
    problem_template_th: string;
    solution_template_th: string;
    equation_asset_ids: string[];
    answer: CurationAnswer;
  };
}

export interface CurationProvenance {
  concept_id: string;
  authorship: "learnlyai";
  input_sha256: string;
  formula_asset_id: string;
  selections: CurationSelection[];
  asset_snapshots: Array<{ asset_id: string; sha256: string }>;
  answer: CurationAnswer;
}
