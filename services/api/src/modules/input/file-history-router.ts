import { Router, type RequestHandler } from "express";
import { requireSupabaseUser, type AuthenticatedRequest } from "../auth/supabase-auth.js";
import { authenticatedDb, verifiedUser } from "../../shared/authenticated-context.js";
import { appUserIdForAuthUser } from "../../shared/app-user.js";
import { PrismaFileHistory, fileHistoryQuery } from "./file-history.js";
import { readFeatures, requireFeature } from "../../shared/features.js";

export interface FileHistoryRouterOptions {
  enabled?: boolean;
  authenticate?: RequestHandler;
  store?: (request: AuthenticatedRequest) => Promise<Pick<PrismaFileHistory, "list" | "listReceipts">>;
}
export function createFileHistoryRouter(options: FileHistoryRouterOptions = {}) {
  const router = Router();
  router.use(options.authenticate ?? requireSupabaseUser);
  router.use(requireFeature(options.enabled ?? readFeatures().fileUploads));
  const store = options.store ?? (async (request: AuthenticatedRequest) => {
    const user = verifiedUser(request), client = await authenticatedDb(request);
    return new PrismaFileHistory(client, await appUserIdForAuthUser(client, user.id));
  });
  router.get("/", async (request: AuthenticatedRequest, response, next) => {
    try {
      const query = fileHistoryQuery(request.query);
      response.set("cache-control", "private, no-store").json({ data: await (await store(request)).list(query) });
    } catch (error) { next(error); }
  });
  router.get("/uploads", async (request: AuthenticatedRequest, response, next) => {
    try {
      const query = fileHistoryQuery(request.query);
      response.set("cache-control", "private, no-store").json({ data: await (await store(request)).listReceipts(query) });
    } catch (error) { next(error); }
  });
  return router;
}
