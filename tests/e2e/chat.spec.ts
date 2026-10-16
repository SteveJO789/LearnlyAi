import { expect, test } from "@playwright/test";
import { seedBrowserAuth, sessionId, seededSession, stubCapabilities, stubSupabase, summaryOf } from "./fixtures";

test.beforeEach(async ({ context, page }) => {
  await seedBrowserAuth(context);
  await stubSupabase(context);
  await stubCapabilities(page);
});

test("Continue persists one correct turn, survives reload, and appears in History", async ({ page }) => {
  const session = seededSession();
  let interactions = 0;
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) });
  });
  await page.route(`**/api/learning-sessions/${sessionId}/interactions`, async (route) => {
    interactions += 1;
    const body = route.request().postDataJSON();
    expect(body).toEqual({ input: "Continue →", action: "ADVANCE" });
    session.messages.push(
      { id: "user-2", role: "USER", content: body.input, createdAt: "2026-10-16T10:06:00.000Z" },
      { id: "tutor-2", role: "TUTOR", content: { blocks: [{ id: "advance-1", type: "explanation", content: "Now compare 2/3 and 4/6." }] }, createdAt: "2026-10-16T10:07:00.000Z" },
    );
    session.progressPercent = 50;
    session.progress = { percent: 50, canAdvance: true, nextAction: "ADVANCE" };
    session.version += 1;
    session.updatedAt = "2026-10-16T10:07:00.000Z";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { blocks: [] } }) });
  });
  await page.route("**/api/learning-sessions", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [summaryOf(session)] }) });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });

  await page.goto(`/Chat/${sessionId}`);
  await expect(page.getByText("Equivalent fractions have the same value.")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Learning progress" })).toHaveAttribute("aria-valuenow", "25");
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByText("Now compare 2/3 and 4/6.")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Learning progress" })).toHaveAttribute("aria-valuenow", "50");
  await expect(page.getByText("Continue →", { exact: true })).toHaveCount(2);
  expect(interactions).toBe(1);

  await page.reload();
  await expect(page.getByText("Now compare 2/3 and 4/6.")).toBeVisible();
  await expect(page.getByText("Continue →", { exact: true })).toHaveCount(2);
  expect(interactions).toBe(1);

  await page.goto("/Account/History?tab=Chat");
  await page.getByRole("link", { name: /Fractions practice/ }).click();
  await expect(page).toHaveURL(new RegExp(`/Chat/${sessionId}$`));
  await expect(page.getByText("Now compare 2/3 and 4/6.")).toBeVisible();
  expect(interactions).toBe(1);
});

test("a committed turn with a lost POST response is reconciled without resubmitting", async ({ page }) => {
  const session = seededSession();
  let interactions = 0;
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) }));
  await page.route(`**/api/learning-sessions/${sessionId}/interactions`, async (route) => {
    interactions += 1;
    session.messages.push(
      { id: "user-2", role: "USER", content: "I think the answer is 2/3", createdAt: "2026-10-16T10:06:00.000Z" },
      { id: "tutor-2", role: "TUTOR", content: { blocks: [{ id: "feedback-1", type: "feedback", content: "Correct: 2/3 and 4/6 are equivalent.", result: "CORRECT" }] }, createdAt: "2026-10-16T10:07:00.000Z" },
    );
    session.version += 1;
    session.updatedAt = "2026-10-16T10:07:00.000Z";
    await route.abort("connectionreset");
  });

  await page.goto(`/Chat/${sessionId}`);
  const textbox = page.getByRole("textbox", { name: "Message" });
  await textbox.fill("I think the answer is 2/3");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Correct: 2/3 and 4/6 are equivalent.")).toBeVisible();
  await expect(page.getByText("I think the answer is 2/3", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Message" })).toBeEnabled();
  expect(interactions).toBe(1);
});

test("a committed turn with a failed detail refresh stays locked until reload", async ({ page }) => {
  const session = seededSession();
  let interactions = 0;
  let detailReads = 0;
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) => {
    detailReads += 1;
    if (detailReads === 2) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "temporary read failure" } }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) });
  });
  await page.route(`**/api/learning-sessions/${sessionId}/interactions`, async (route) => {
    interactions += 1;
    session.messages.push(
      { id: "user-2", role: "USER", content: "A response", createdAt: "2026-10-16T10:06:00.000Z" },
      { id: "tutor-2", role: "TUTOR", content: { blocks: [{ id: "feedback-1", type: "feedback", content: "Your answer was saved.", result: "CORRECT" }] }, createdAt: "2026-10-16T10:07:00.000Z" },
    );
    session.version += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { blocks: [] } }) });
  });

  await page.goto(`/Chat/${sessionId}`);
  await page.getByRole("textbox", { name: "Message" }).fill("A response");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator('[role="alert"]').filter({ hasText: "saved" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeDisabled();
  await page.reload();
  await expect(page.getByText("Your answer was saved.")).toBeVisible();
  await expect(page.getByText("A response", { exact: true })).toHaveCount(1);
  expect(interactions).toBe(1);
});

test("an unknown POST outcome stays locked through stale Retry data until a newer version confirms it", async ({ page }) => {
  const session = seededSession();
  let detailReads = 0;
  let interactions = 0;
  let commitPublished = false;
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) => {
    detailReads += 1;
    if (!commitPublished && detailReads === 2) {
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "temporary read failure" } }) });
    }
    if (commitPublished && session.version === 2) {
      session.messages.push(
        { id: "user-2", role: "USER", content: "Please explain the next step", createdAt: "2026-10-16T10:06:00.000Z" },
        { id: "tutor-2", role: "TUTOR", content: { blocks: [{ id: "feedback-2", type: "explanation", content: "The next step is confirmed." }] }, createdAt: "2026-10-16T10:07:00.000Z" },
      );
      session.version += 1;
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) });
  });
  await page.route(`**/api/learning-sessions/${sessionId}/interactions`, async (route) => {
    interactions += 1;
    await route.abort("connectionreset");
  });

  await page.goto(`/Chat/${sessionId}`);
  await page.getByRole("textbox", { name: "Message" }).fill("Please explain the next step");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator('[role="alert"]').filter({ hasText: "Session state could not be confirmed" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeDisabled();

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator('[role="alert"]').filter({ hasText: "action outcome is still unknown" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeDisabled();
  expect(interactions).toBe(1);

  commitPublished = true;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("The next step is confirmed.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeEnabled();
  expect(interactions).toBe(1);
});

test("an ambiguous Create auto-send survives reload without replaying its first POST", async ({ page }) => {
  const session = seededSession({ messages: [] });
  let interactions = 0;
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) }));
  await page.route(`**/api/learning-sessions/${sessionId}/interactions`, async (route) => {
    interactions += 1;
    await route.abort("connectionreset");
  });

  await page.goto(`/Chat/${sessionId}?input=${encodeURIComponent("Introduce me to fractions")}`);
  await expect(page.locator('[role="alert"]').filter({ hasText: "Session state could not be confirmed" })).toBeVisible();
  expect(interactions).toBe(1);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("Introduce me to fractions");
  await expect(page.locator('[role="alert"]').filter({ hasText: "A first message may already have been sent" })).toBeVisible();
  expect(interactions).toBe(1);
});

test("double clicking Continue while the request is pending sends one interaction", async ({ page }) => {
  const session = seededSession();
  let interactions = 0;
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) }));
  await page.route(`**/api/learning-sessions/${sessionId}/interactions`, async (route) => {
    interactions += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    const body = route.request().postDataJSON();
    session.messages.push(
      { id: "user-2", role: "USER", content: body.input, createdAt: "2026-10-16T10:06:00.000Z" },
      { id: "tutor-2", role: "TUTOR", content: { blocks: [{ id: "advance-1", type: "explanation", content: "Advanced once." }] }, createdAt: "2026-10-16T10:07:00.000Z" },
    );
    session.version += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { blocks: [] } }) });
  });

  await page.goto(`/Chat/${sessionId}`);
  const button = page.getByRole("button", { name: "Continue →" });
  await button.dblclick();
  await expect(page.getByText("Continue →", { exact: true })).toHaveCount(2);
  expect(interactions).toBe(1);
});

test("Chat Retry clears an initial load error and restores enabled controls", async ({ page }) => {
  const session = seededSession();
  let reads = 0;
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) => {
    reads += 1;
    if (reads === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "temporary read failure" } }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) });
  });
  await page.goto(`/Chat/${sessionId}`);
  await expect(page.locator('[role="alert"]').filter({ hasText: "temporary read failure" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeDisabled();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Equivalent fractions have the same value.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continue →" })).toBeEnabled();
});

test("a FAILED session can be recovered before Continue becomes available", async ({ page }) => {
  const session = seededSession({ lifecycleState: "FAILED" });
  let recoveryRequests = 0;
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) }));
  await page.route(`**/api/learning-sessions/${sessionId}/recovery`, async (route) => {
    recoveryRequests += 1;
    session.lifecycleState = "ACTIVE";
    session.version += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: sessionId, lifecycleState: "ACTIVE", stage: session.stage, progressPercent: session.progressPercent } }) });
  });

  await page.goto(`/Chat/${sessionId}`);
  await expect(page.locator('[role="alert"]').filter({ hasText: "could not complete the last request" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeDisabled();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continue →" })).toBeEnabled();
  expect(recoveryRequests).toBe(1);
});

test("REVIEW stage blocks responses and Continue even when progress says it can advance", async ({ page }) => {
  const session = seededSession({ stage: "REVIEW", progress: { percent: 100, canAdvance: true, nextAction: "ADVANCE" }, progressPercent: 100 });
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) }));
  await page.goto(`/Chat/${sessionId}`);
  await expect(page.getByRole("heading", { name: "Learning session" })).toBeVisible();
  await expect(page.getByText("Review", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue →" })).toHaveCount(0);
});

test("PRE assessment lookup keeps Chat actions disabled until assessment state is known", async ({ page }) => {
  const session = seededSession({ state: "PRE_TEST", stage: "EXPLAIN" });
  await page.route("**/api/capabilities", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { assessments: true, fileUploads: true } }) }));
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) }));
  let assessmentRequested!: () => void;
  const requested = new Promise<void>((resolve) => { assessmentRequested = resolve; });
  let releaseAssessment!: () => void;
  const release = new Promise<void>((resolve) => { releaseAssessment = resolve; });
  await page.route(`**/api/learning-sessions/${sessionId}/assessments/PRE`, async (route) => {
    assessmentRequested();
    await release;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {
      id: "assessment-pre", sessionId, phase: "PRE", topic: "linear-equations", language: "en",
      questions: [{ id: "q1", prompt: "Solve x + 2 = 4", format: "NUMBER" }], score: 1, maxScore: 1,
      submittedAt: "2026-10-16T10:05:00.000Z",
    } }) });
  });

  await page.goto(`/Chat/${sessionId}`);
  await requested;
  await expect(page.getByRole("textbox", { name: "Message" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue →" })).toHaveCount(0);
  releaseAssessment();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continue →" })).toBeEnabled();
});

test("POST assessment lookup keeps Chat actions disabled until assessment state is known", async ({ page }) => {
  const session = seededSession({ state: "ACTIVE", stage: "ASSESS", progress: { percent: 90, canAdvance: true, nextAction: "ADVANCE" }, progressPercent: 90 });
  await page.route("**/api/capabilities", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { assessments: true, fileUploads: true } }) }));
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) }));
  let assessmentRequested!: () => void;
  const requested = new Promise<void>((resolve) => { assessmentRequested = resolve; });
  let releaseAssessment!: () => void;
  const release = new Promise<void>((resolve) => { releaseAssessment = resolve; });
  await page.route(`**/api/learning-sessions/${sessionId}/assessments/POST`, async (route) => {
    assessmentRequested();
    await release;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {
      id: "assessment-post", sessionId, phase: "POST", topic: "linear-equations", language: "en",
      questions: [{ id: "q1", prompt: "Solve x + 2 = 4", format: "NUMBER" }], score: null, maxScore: 1,
      submittedAt: null,
    } }) });
  });

  await page.goto(`/Chat/${sessionId}`);
  await requested;
  await expect(page.getByRole("textbox", { name: "Message" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue →" })).toHaveCount(0);
  releaseAssessment();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continue →" })).toBeEnabled();
});

test("mobile Chat keeps the sidebar toggle and keyboard retry flow usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = seededSession();
  let interactions = 0;
  let commitPublished = false;
  let commitAdded = false;
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) => {
    if (commitPublished && !commitAdded) {
      commitAdded = true;
      session.messages.push(
        { id: "user-mobile", role: "USER", content: "Mobile keyboard answer", createdAt: "2026-10-16T10:06:00.000Z" },
        { id: "tutor-mobile", role: "TUTOR", content: { blocks: [{ id: "feedback-mobile", type: "feedback", content: "The mobile answer is confirmed." }] }, createdAt: "2026-10-16T10:07:00.000Z" },
      );
      session.version += 1;
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) });
  });
  await page.route(`**/api/learning-sessions/${sessionId}/interactions`, async (route) => {
    interactions += 1;
    expect(route.request().postDataJSON()).toEqual({ input: "Mobile keyboard answer", action: "RESPOND" });
    await route.abort("connectionreset");
  });

  await page.goto(`/Chat/${sessionId}`);
  await expect(page.getByRole("button", { name: "Open sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Open sidebar" }).click();
  await expect(page.getByRole("button", { name: "Close sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Close sidebar" }).click();
  const message = page.getByRole("textbox", { name: "Message" });
  await message.fill("Mobile keyboard answer");
  await message.press("Enter");
  await expect(page.locator('[role="alert"]').filter({ hasText: "Session state could not be confirmed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
  expect(interactions).toBe(1);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator('[role="alert"]').filter({ hasText: "action outcome is still unknown" })).toBeVisible();
  await expect(message).toBeDisabled();
  expect(interactions).toBe(1);
  commitPublished = true;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("The mobile answer is confirmed.")).toBeVisible();
  await expect(message).toBeEnabled();
  expect(interactions).toBe(1);
});
