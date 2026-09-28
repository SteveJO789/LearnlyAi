export type LearningErrorCode =
  | "VALIDATION_ERROR"
  | "SESSION_INACTIVE"
  | "INVALID_STAGE_TRANSITION"
  | "SESSION_CONFLICT";

const DEFINITIONS = {
  VALIDATION_ERROR: { status: 400, message: "The learning request is invalid." },
  SESSION_INACTIVE: { status: 409, message: "The learning session is no longer active." },
  INVALID_STAGE_TRANSITION: { status: 400, message: "The learning stage cannot advance." },
  SESSION_CONFLICT: { status: 409, message: "The learning session changed. Please retry." },
} as const;

export class LearningError extends Error {
  readonly code: LearningErrorCode;
  readonly status: number;
  readonly details: ReadonlyArray<{ path: string; message: string }>;

  constructor(code: LearningErrorCode, details: LearningError["details"] = []) {
    super(DEFINITIONS[code].message);
    this.name = "LearningError";
    this.code = code;
    this.status = DEFINITIONS[code].status;
    this.details = details;
  }
}
