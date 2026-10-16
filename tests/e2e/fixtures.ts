import { expect, type BrowserContext, type Page } from "@playwright/test";

export const sessionId = "e2e-session-001";
export const userId = "e2e-user-001";

export type MockSession = {
  id: string;
  title: string;
  learningGoal: string | null;
  subject: string | null;
  state: string;
  lifecycleState: string;
  stage: string;
  progressPercent: number;
  progress: { percent: number; canAdvance: boolean; nextAction: string | null };
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  messages: Array<{ id: string; role: "USER" | "TUTOR" | "SYSTEM"; content: unknown; createdAt: string }>;
  materials: Array<{ id: string; type: string; status: string; normalizedText: string }>;
};

export function seededSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    id: sessionId,
    title: "Fractions practice",
    learningGoal: "Understand equivalent fractions",
    subject: "Math",
    state: "ACTIVE",
    lifecycleState: "ACTIVE",
    stage: "EXPLAIN",
    progressPercent: 25,
    progress: { percent: 25, canAdvance: true, nextAction: "ADVANCE" },
    version: 2,
    createdAt: "2026-10-16T10:00:00.000Z",
    updatedAt: "2026-10-16T10:05:00.000Z",
    completedAt: null,
    messages: [
      { id: "user-1", role: "USER", content: "What is an equivalent fraction?", createdAt: "2026-10-16T10:01:00.000Z" },
      { id: "tutor-1", role: "TUTOR", content: { blocks: [{ id: "explain-1", type: "explanation", title: "Equivalent fractions", content: "Equivalent fractions have the same value." }] }, createdAt: "2026-10-16T10:02:00.000Z" },
    ],
    materials: [],
    ...overrides,
  };
}

export function summaryOf(session: MockSession) {
  const { messages: _messages, materials: _materials, ...summary } = session;
  return summary;
}

export async function seedBrowserAuth(context: BrowserContext) {
  await context.addInitScript(({ storageKey, authSession }) => {
    const initializedKey = "learnly-e2e-auth-initialized";
    if (!localStorage.getItem(initializedKey)) {
      localStorage.setItem(storageKey, JSON.stringify(authSession));
      localStorage.setItem(initializedKey, "true");
    }
    if (!localStorage.getItem("learnly-language")) localStorage.setItem("learnly-language", "en");
  }, {
    storageKey: "sb-e2e-auth-token",
    authSession: {
      access_token: "e2e-access-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: 1890000000,
      refresh_token: "e2e-refresh-token",
      user: {
        id: userId,
        aud: "authenticated",
        role: "authenticated",
        email: "learner@example.test",
        user_metadata: { username: "E2E learner" },
        app_metadata: { provider: "email", providers: ["email"] },
        created_at: "2026-10-16T10:00:00.000Z",
      },
    },
  });
}

export async function stubSupabase(context: BrowserContext, options: { failProfileReads?: number | true; failLogouts?: number | true } = {}) {
  let profileFailuresLeft: number | null = options.failProfileReads === true ? null : options.failProfileReads ?? 0;
  let logoutFailuresLeft: number | null = options.failLogouts === true ? null : options.failLogouts ?? 0;
  let activeUser = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "learner@example.test",
    user_metadata: { username: "E2E learner" },
    app_metadata: { provider: "email", providers: ["email"] },
    created_at: "2026-10-16T10:00:00.000Z",
  };
  await context.route("https://e2e.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/user") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(activeUser) });
    }
    if (url.pathname === "/auth/v1/token" && request.method() === "POST") {
      const credentials = request.postDataJSON() as { email?: string };
      if (credentials.email !== "learner.b@example.test") {
        return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "invalid login credentials", code: "invalid_credentials" }) });
      }
      activeUser = {
        id: "e2e-user-b", aud: "authenticated", role: "authenticated", email: "learner.b@example.test",
        user_metadata: { username: "Learner B" }, app_metadata: { provider: "email", providers: ["email"] },
        created_at: "2026-10-16T10:00:00.000Z",
      };
      const session = {
        access_token: "e2e-account-b-token", token_type: "bearer", expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "e2e-account-b-refresh", user: activeUser,
      };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
    }
    if (url.pathname === "/auth/v1/logout") {
      if (logoutFailuresLeft !== 0) {
        if (logoutFailuresLeft !== null) logoutFailuresLeft -= 1;
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "temporary logout outage" }) });
      }
      return route.fulfill({ status: 204, body: "" });
    }
    if (url.pathname === "/rest/v1/User") {
      const selectedColumns = url.searchParams.get("select") ?? "";
      const isProfileSelect = selectedColumns.includes("displayName");
      if (profileFailuresLeft !== 0 && isProfileSelect) {
        if (profileFailuresLeft !== null) profileFailuresLeft -= 1;
        return route.fulfill({ status: 503, headers: {
          "Retry-After": "0",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": "Retry-After",
        }, contentType: "application/json", body: JSON.stringify({ message: "temporary profile outage" }) });
      }
      const profileName = String(activeUser.user_metadata.username ?? "E2E learner");
      const profile = { id: activeUser.id, email: activeUser.email, displayName: profileName, avatarUrl: null };
      const body = request.method() === "GET" ? [profile] : profile;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Unstubbed Supabase request", path: url.pathname }) });
  });
  return {
    setProfileAvailable: () => { profileFailuresLeft = 0; },
    setLogoutAvailable: () => { logoutFailuresLeft = 0; },
  };
}

export async function stubCapabilities(page: Page, handler?: (count: number) => { status?: number; data?: unknown }) {
  let count = 0;
  await page.route("**/api/capabilities", async (route) => {
    count += 1;
    const result = handler?.(count) ?? { data: { assessments: false, fileUploads: false } };
    return route.fulfill({ status: result.status ?? 200, contentType: "application/json", body: JSON.stringify(result) });
  });
}

export async function expectEnglishChat(page: Page) {
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
}
