export interface ValidationIssue {
  file: string;
  path: string;
  keyword: string;
  message: string;
}

export interface MarkdownSection {
  heading: string;
  slug: string;
  level: number;
  markdown: string;
}

export interface ParsedKnowledgeMarkdown {
  frontmatter: Record<string, unknown>;
  sections: MarkdownSection[];
}

export interface SourceRecord {
  source_id: string;
  rag_permission_status:
    | "allowed"
    | "internally_authored"
    | "reference_only"
    | "unclear"
    | "do_not_ingest";
  [key: string]: unknown;
}

export interface SourceManifest {
  schema_version: string;
  sources: SourceRecord[];
  [key: string]: unknown;
}

export interface LoadedKnowledgeDocument {
  sourcePath: string;
  relativePath: string;
  document: Record<string, unknown>;
}

export interface KnowledgeValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  documents: LoadedKnowledgeDocument[];
  productionDocuments: LoadedKnowledgeDocument[];
}

export type AcquisitionPermission = "allowed" | "internally_authored";

export interface AcquisitionArtifact {
  source_id: string;
  artifact_id: string;
  filename: string;
  raw_path: string;
  sha256: string;
  acquired_at: string;
  parser_version: string;
  license_status: AcquisitionPermission;
  license: string;
  source_url: string;
}

export interface AcquisitionManifest {
  schema_version: "1.0";
  artifacts: AcquisitionArtifact[];
}

export interface NormalizedLocator {
  chapter: string;
  section: string;
  document?: string;
  offset_start?: number;
  offset_end?: number;
}

export interface NormalizedProvenance {
  artifact_sha256: string;
  raw_path: string;
  source_url: string;
  license_status: AcquisitionPermission;
  parser_version: string;
}

export interface NormalizedUnit {
  source_id: string;
  artifact_id: string;
  locator: NormalizedLocator;
  title: string;
  content: string;
  math: string[];
  language: "en";
  content_format: "markdown" | "latex";
  provenance: NormalizedProvenance;
  assets?: NormalizedAsset[];
  normalization_warnings?: NormalizationWarning[];
}

export interface NormalizedAsset {
  kind: "image" | "math_image";
  archive_path: string;
  alt: string;
}

export type NormalizationWarning = "image_math_requires_review" | "image_requires_review" | "complex_table_requires_review" | "latex_macros_requires_review";

export interface SourceProcessingValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  manifest?: AcquisitionManifest;
  normalizedRecords: NormalizedUnit[];
}
