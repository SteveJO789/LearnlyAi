export type SourceProcessingErrorCode =
  | "ACQUISITION_INVALID"
  | "DUPLICATE_ARTIFACT"
  | "NORMALIZATION_FAILED"
  | "RAW_ARTIFACT_MODIFIED"
  | "SOURCE_BLOCKED"
  | "SOURCE_NOT_INGESTIBLE"
  | "SOURCE_REGISTRY_INVALID"
  | "SOURCE_UNSUPPORTED"
  | "UNKNOWN_SOURCE"
  | "UNSUPPORTED_FORMAT";

export class SourceProcessingError extends Error {
  constructor(
    readonly code: SourceProcessingErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SourceProcessingError";
  }
}
