import { Router } from "express";
import { requireSupabaseUser, type AuthenticatedRequest } from "../auth/supabase-auth.js";
import { authenticatedDb, verifiedUser } from "../../shared/authenticated-context.js";
import { ApiError } from "../../shared/api-error.js";
import { PrismaTextMaterials, normalizeTextMaterial } from "./text-materials.js";

export function createMaterialRouter() {
  const router = Router({ mergeParams: true });
  router.use(requireSupabaseUser);
  router.post("/", async (request: AuthenticatedRequest, response, next) => {
    try {
      if (!request.is("application/json")) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", 415, "Use application/json for text material.");
      const body: unknown = request.body;
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["type", "text"].includes(key)) ||
        !("type" in body) || body.type !== "TEXT" || !("text" in body)) {
        throw new ApiError("VALIDATION_ERROR", 400, "Use type TEXT and text for this material request.");
      }
      const sessionId = request.params.sessionId;
      if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 128) throw new ApiError("VALIDATION_ERROR", 400, "A valid session id is required.");
      const text = normalizeTextMaterial(body.text);
      const store = new PrismaTextMaterials(await authenticatedDb(request), verifiedUser(request).id);
      response.status(201).json({ data: await store.create(sessionId, text) });
    } catch (error) { next(error); }
  });
  return router;
}
