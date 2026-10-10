import { Router, raw, type RequestHandler } from "express";
import { requireSupabaseUser, type AuthenticatedRequest } from "../auth/supabase-auth.js";
import { authenticatedDb, verifiedUser } from "../../shared/authenticated-context.js";
import { ApiError } from "../../shared/api-error.js";
import { PrismaTextMaterials, normalizeTextMaterial } from "./text-materials.js";
import { appUserIdForAuthUser } from "../../shared/app-user.js";
import { PrismaFileMaterials } from "./prisma-file-materials.js";
import { PrivateMaterialStorage, materialStorageKey } from "./private-material-storage.js";
import { FileIngestion } from "./file-ingestion.js";
import { RealFileTextExtractor } from "./real-file-text-extractor.js";
import { MAX_FILE_BYTES, type FileEnvelope } from "./file-envelope.js";

export interface MaterialApiContext {
  texts: Pick<PrismaTextMaterials, "create" | "list">;
  files: Pick<PrismaFileMaterials, "listUploads" | "getFile" | "review">;
  ingestion: Pick<FileIngestion, "ingest" | "resume">;
  storage(bucket: string): Pick<PrivateMaterialStorage, "download">;
}
export interface MaterialRouterOptions {
  /** Explicit test ports; defaults use verified Auth, Prisma, real extraction and private Storage. */
  authenticate?: RequestHandler;
  context?: (request: AuthenticatedRequest) => Promise<MaterialApiContext>;
}
function identity(value: unknown) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/u.test(value)) throw new ApiError("VALIDATION_ERROR", 400, "A valid resource id is required.");
  return value;
}
async function defaultContext(request: AuthenticatedRequest): Promise<MaterialApiContext> {
  const user = verifiedUser(request), client = await authenticatedDb(request);
  const appId = await appUserIdForAuthUser(client, user.id), files = new PrismaFileMaterials(client, appId);
  const storage = (bucket: string) => {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new ApiError("STORAGE_UNAVAILABLE", 503, "Private file storage is not configured.");
    return new PrivateMaterialStorage({ url, bucket, publishableKey: key, token: request.authToken!, authUserId: user.id });
  };
  return { texts: new PrismaTextMaterials(client, appId), files, storage,
    get ingestion() { return new FileIngestion(files, storage("learnly-materials"), new RealFileTextExtractor(), user.id); } };
}

export function createMaterialRouter(options: MaterialRouterOptions = {}) {
  const router = Router({ mergeParams: true });
  router.use(options.authenticate ?? requireSupabaseUser);
  const context = options.context ?? defaultContext;
  router.get("/", async (request: AuthenticatedRequest, response, next) => {
    try { response.json({ data: await (await context(request)).texts.list(identity(request.params.sessionId)) }); }
    catch (error) { next(error); }
  });
  router.get("/uploads", async (request: AuthenticatedRequest, response, next) => {
    try { response.json({ data: await (await context(request)).files.listUploads(identity(request.params.sessionId)) }); }
    catch (error) { next(error); }
  });
  router.post("/files", (request, _response, next) => {
    if (!["application/pdf", "image/png", "image/jpeg"].includes(request.get("content-type")?.split(";", 1)[0]?.toLowerCase() ?? "")) {
      next(new ApiError("UNSUPPORTED_MEDIA_TYPE", 415, "Use PDF, PNG or JPEG file bytes.")); return;
    }
    next();
  }, raw({ type: () => true, limit: MAX_FILE_BYTES, inflate: false }), async (request: AuthenticatedRequest, response, next) => {
    const controller = new AbortController(), closed = () => { if (!response.writableEnded) controller.abort(); };
    response.once("close", closed);
    try {
      const sessionId = identity(request.params.sessionId);
      let filename: string;
      try { filename = decodeURIComponent(request.get("x-file-name") ?? ""); } catch { throw new ApiError("VALIDATION_ERROR", 400, "Use a valid encoded filename."); }
      if (!Buffer.isBuffer(request.body) || !filename) throw new ApiError("VALIDATION_ERROR", 400, "File bytes and filename are required.");
      const data = await (await context(request)).ingestion.ingest(sessionId, request.body,
        request.get("content-type")!.split(";", 1)[0]!, filename, controller.signal);
      response.status(201).json({ data });
    } catch (error) { next(error); }
    finally { response.removeListener("close", closed); }
  });
  router.post("/uploads/:materialId/resume", async (request: AuthenticatedRequest, response, next) => {
    try {
      if (!request.is("application/json") || !request.body || typeof request.body !== "object" || Array.isArray(request.body) || Object.keys(request.body).length) {
        throw new ApiError("VALIDATION_ERROR", 400, "Use an empty JSON object for upload recovery.");
      }
      response.json({ data: await (await context(request)).ingestion.resume(identity(request.params.sessionId), identity(request.params.materialId)) });
    } catch (error) { next(error); }
  });
  router.patch("/:materialId/review", async (request: AuthenticatedRequest, response, next) => {
    try {
      const body = request.body;
      if (!request.is("application/json") || !body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !("text" in body)) {
        throw new ApiError("VALIDATION_ERROR", 400, "Use text only for material review.");
      }
      const text = normalizeTextMaterial(body.text);
      response.json({ data: await (await context(request)).files.review(identity(request.params.sessionId), identity(request.params.materialId), text) });
    } catch (error) { next(error); }
  });
  router.get("/:materialId/file", async (request: AuthenticatedRequest, response, next) => {
    try {
      const sessionId = identity(request.params.sessionId), id = identity(request.params.materialId), services = await context(request);
      const row = await services.files.getFile(sessionId, id);
      const extension = row.mimeType === "application/pdf" ? "pdf" : row.mimeType === "image/png" ? "png" : row.mimeType === "image/jpeg" ? "jpg" : null;
      if (!extension || row.storageKey !== materialStorageKey(verifiedUser(request).id, sessionId, id, extension)) throw new ApiError("INVALID_UPLOAD_RECEIPT", 503, "The stored file identity could not be verified.");
      const file: FileEnvelope = { type: extension === "pdf" ? "PDF" : "IMAGE", extension, mimeType: row.mimeType as FileEnvelope["mimeType"],
        contentHash: row.contentHash, sizeBytes: row.sizeBytes, filename: row.filename };
      const bytes = await services.storage(row.storageBucket).download(row.storageKey, file);
      response.set({ "content-type": file.mimeType, "content-disposition": `attachment; filename="material.${extension}"; filename*=UTF-8''${encodeURIComponent(row.filename || `material.${extension}`)}`,
        "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
      response.send(bytes);
    } catch (error) { next(error); }
  });
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
      response.status(201).json({ data: await (await context(request)).texts.create(sessionId, text) });
    } catch (error) { next(error); }
  });
  return router;
}
