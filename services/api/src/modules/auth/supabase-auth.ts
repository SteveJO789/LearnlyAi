import type { NextFunction, Request, Response } from "express";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type AuthenticatedRequest = Request & {
  authUser?: AuthenticatedUser;
  authToken?: string;
};

function readBearerToken(request: Request): string | null {
  const header = request.header("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

export function createSupabaseAuthenticator(options: { timeoutMs?: number; fetch?: typeof fetch } = {}) {
return async function authenticate(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const token = readBearerToken(request);
  if (!token) {
    response.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
        requestId: response.locals.requestId,
        details: [],
      },
    });
    return;
  }

  const config = getSupabaseConfig();
  if (!config) {
    response.status(503).json({
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "Authentication service is not configured.",
        requestId: response.locals.requestId,
        details: [],
      },
    });
    return;
  }

  try {
    const authResponse = await (options.fetch ?? fetch)(`${config.url}/auth/v1/user`, {
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
      headers: {
        authorization: `Bearer ${token}`,
        apikey: config.key,
      },
    });

    if (!authResponse.ok) {
      if (authResponse.status !== 401 && authResponse.status !== 403) {
        response.status(503).json({ error: {
          code: "AUTH_UNAVAILABLE", message: "Authentication service is temporarily unavailable.",
          requestId: response.locals.requestId, details: [],
        } });
        return;
      }
      response.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "The login session is invalid or expired.",
          requestId: response.locals.requestId,
          details: [],
        },
      });
      return;
    }

    const user = (await authResponse.json()) as {
      id?: unknown;
      email?: unknown;
      user_metadata?: Record<string, unknown> | null;
    };

    if (typeof user.id !== "string" || !user.id) {
      response.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "The login session is invalid.",
          requestId: response.locals.requestId,
          details: [],
        },
      });
      return;
    }

    const metadata = user.user_metadata ?? {};
    const email = typeof user.email === "string" ? user.email : null;
    const displayNameCandidate =
      metadata["username"] ??
      metadata["full_name"] ??
      metadata["name"];
    const avatarCandidate = metadata["avatar_url"] ?? metadata["picture"];

    request.authToken = token;
    request.authUser = {
      id: user.id,
      email,
      displayName:
        typeof displayNameCandidate === "string" && displayNameCandidate.trim()
          ? displayNameCandidate.trim()
          : email?.split("@")[0] ?? "User",
      avatarUrl:
        typeof avatarCandidate === "string" && avatarCandidate.trim()
          ? avatarCandidate
          : null,
    };
    next();
  } catch {
    response.status(503).json({
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "Authentication service is temporarily unavailable.",
        requestId: response.locals.requestId,
        details: [],
      },
    });
  }
};
}

export const requireSupabaseUser = createSupabaseAuthenticator();
