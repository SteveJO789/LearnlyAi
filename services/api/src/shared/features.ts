import { ApiError } from "./api-error.js";
import type { RequestHandler } from "express";

export interface Features { assessments: boolean; fileUploads: boolean }
/** Operator switches only. Never derive these from a request or user metadata. */
export function readFeatures(env: NodeJS.ProcessEnv = process.env): Features {
  const assessments = env.LEARNLY_ASSESSMENTS_ENABLED === "true";
  return { assessments, fileUploads: assessments && env.LEARNLY_FILE_UPLOADS_ENABLED === "true" };
}
export function requireFeature(enabled: boolean): RequestHandler {
  return (_request, _response, next) => next(enabled ? undefined :
    new ApiError("FEATURE_DISABLED", 503, "This feature is not enabled in this environment."));
}
