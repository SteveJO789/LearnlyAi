import { expect, test } from "@playwright/test";
import { seedBrowserAuth, sessionId, seededSession, stubSupabase, summaryOf } from "./fixtures";

test("Assessment waits for capability checks, offers retry, then shows the disabled state", async ({ context, page }) => {
  await seedBrowserAuth(context);
  await stubSupabase(context);
  let releaseInitial!: () => void;
  let requestedInitial!: () => void;
  const initialGate = new Promise<void>((resolve) => { releaseInitial = resolve; });
  const initialRequest = new Promise<void>((resolve) => { requestedInitial = resolve; });
  let capabilityRequests = 0;
  let assessmentRequests = 0;
  await page.route("**/api/capabilities", async (route) => {
    capabilityRequests += 1;
    if (capabilityRequests === 1) {
      requestedInitial();
      await initialGate;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "temporarily unavailable" } }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { assessments: false, fileUploads: false } }) });
  });
  await page.route("**/api/learning-sessions/**/assessments/**", async (route) => {
    assessmentRequests += 1;
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { message: "Assessment was not found." } }) });
  });

  await page.goto(`/Assessment/${sessionId}?phase=PRE`);
  await initialRequest;
  await expect(page.getByRole("status")).toContainText("Checking whether assessments are available");
  await expect(page.getByText("Assessments are not enabled.")).toHaveCount(0);
  releaseInitial();
  await expect(page.getByRole("alert").filter({ hasText: "Feature availability could not be checked. Please retry." }))
    .toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("status")).toContainText("Assessments are not enabled.");
  await expect(page.getByRole("link", { name: "Return to lesson" })).toHaveAttribute("href", `/Chat/${sessionId}`);
  expect(capabilityRequests).toBe(2);
  expect(assessmentRequests).toBe(0);
});

test("enabled assessments (synthetic API responses) score pre/post tests and report zero comparison across Chat, Test Results, Home, and Profile", async ({ context, page }) => {
  await seedBrowserAuth(context);
  await stubSupabase(context);
  await page.route("**/api/capabilities", async (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ data: { assessments: true, fileUploads: false } }),
  }));

  const session = seededSession({
    state: "PRE_TEST", stage: "EXPLAIN", progressPercent: 25,
    progress: { percent: 25, canAdvance: true, nextAction: "ADVANCE" },
  });
  let preAssessment: Record<string, unknown> | null = null;
  let postAssessment: Record<string, unknown> | null = null;
  let interactions = 0;
  const answeredPhases: string[] = [];
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ data: session }),
  }));
  await page.route(`**/api/learning-sessions/${sessionId}/assessments/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const phase = path.includes("/PRE/") || path.endsWith("/PRE") ? "PRE" : "POST";
    const current = phase === "PRE" ? preAssessment : postAssessment;
    if (path.endsWith("/submissions") && request.method() === "POST") {
      const submitted = request.postDataJSON() as { answers: Array<{ questionId: string; answer: number }> };
      expect(submitted.answers).toEqual([{ questionId: `${phase.toLowerCase()}-q1`, answer: 0 }]);
      const result = {
        ...(current as Record<string, unknown>), score: 0, submittedAt: "2026-10-16T11:00:00.000Z",
        answers: [{ questionId: `${phase.toLowerCase()}-q1`, response: 0, isCorrect: false, awardedScore: 0 }],
      };
      if (phase === "PRE") preAssessment = result;
      else postAssessment = result;
      answeredPhases.push(phase);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: result }) });
    }
    if (request.method() === "GET") {
      if (!current) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Assessment was not found." } }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: current }) });
    }
    if (request.method() === "POST" && (path.endsWith("/PRE") || path.endsWith("/POST"))) {
      const body = request.postDataJSON() as { topic: string; language: string };
      expect(body).toEqual({ topic: "linear-equations", language: "en" });
      const created = {
        id: `${phase.toLowerCase()}-assessment`, sessionId, phase, topic: "linear-equations", language: "en",
        questions: [{ id: `${phase.toLowerCase()}-q1`, prompt: phase === "PRE" ? "Solve 2x = 0" : "What is 2x when x is 0?", format: "NUMBER" }],
        score: null, maxScore: 1, submittedAt: null,
      };
      if (phase === "PRE") preAssessment = created;
      else postAssessment = created;
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: created }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { message: "Unstubbed assessment request." } }) });
  });
  await page.route(`**/api/learning-sessions/${sessionId}/interactions`, async (route) => {
    interactions += 1;
    const request = route.request().postDataJSON() as { input: string; action: string };
    expect(request.action).toBe("ADVANCE");
    session.messages.push(
      { id: `advance-user-${interactions}`, role: "USER", content: request.input, createdAt: `2026-10-16T11:0${interactions}:00.000Z` },
      { id: `advance-tutor-${interactions}`, role: "TUTOR", content: { blocks: [{ id: `tutor-block-${interactions}`, type: "explanation", content: `Advanced to phase ${interactions}.` }] }, createdAt: `2026-10-16T11:0${interactions}:30.000Z` },
    );
    if (session.stage === "EXPLAIN") {
      session.stage = "PRACTICE"; session.state = "LEARNING";
      session.progressPercent = 50; session.progress = { percent: 50, canAdvance: true, nextAction: "ADVANCE" };
    } else if (session.stage === "PRACTICE") {
      session.stage = "ASSESS"; session.state = "POST_TEST";
      session.progressPercent = 75; session.progress = { percent: 75, canAdvance: true, nextAction: "SUBMIT_ASSESSMENT" };
    } else {
      session.stage = "REVIEW"; session.state = "COMPLETED"; session.lifecycleState = "COMPLETED";
      session.progressPercent = 100; session.progress = { percent: 100, canAdvance: false, nextAction: null };
      session.completedAt = "2026-10-16T11:10:00.000Z";
    }
    session.version += 1;
    session.updatedAt = "2026-10-16T11:10:00.000Z";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { blocks: [] } }) });
  });

  const comparison = { sessionId, topic: "linear-equations", prePercent: 0, postPercent: 0, deltaPercent: 0 };
  await page.route("**/api/learning-sessions", async (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ data: [summaryOf(session)] }),
  }));
  await page.route("**/api/users/me/progress", async (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ data: {
      sessionCount: 1, completedSessionCount: 1, averageProgressPercent: 100, comparisons: [comparison],
    } }),
  }));
  await page.route("**/api/users/me/learning-profile", async (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ data: {
      mastery: { "linear-equations": { percent: 0, assessmentId: "post-assessment", sampleQuestions: 1, assessedAt: "2026-10-16T11:00:00.000Z" } },
      strengths: [], weakPoints: ["linear-equations"], updatedAt: "2026-10-16T11:00:00.000Z",
    } }),
  }));

  await page.goto(`/Assessment/${sessionId}?phase=PRE`);
  await page.getByLabel("Topic").selectOption("linear-equations");
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page.getByText("Solve 2x = 0")).toBeVisible();
  await page.getByLabel("Answer").fill("0");
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Score: 0/1" })).toBeVisible();
  await page.getByRole("link", { name: "Back to learning" }).click();
  await expect(page).toHaveURL(new RegExp(`/Chat/${sessionId}$`));

  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByText("Advanced to phase 1.")).toBeVisible();
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByText("Advanced to phase 2.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue →" })).toBeVisible();
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page).toHaveURL(new RegExp(`/Assessment/${sessionId}\\?phase=POST$`));
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page.getByText("What is 2x when x is 0?")).toBeVisible();
  await page.getByLabel("Answer").fill("0");
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Score: 0/1" })).toBeVisible();
  await page.getByRole("link", { name: "Back to learning" }).click();
  await expect(page).toHaveURL(new RegExp(`/Chat/${sessionId}$`));
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByText("Review", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Learning progress" })).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByRole("textbox", { name: "Message" })).toBeDisabled();
  expect(answeredPhases).toEqual(["PRE", "POST"]);
  expect(interactions).toBe(3);

  await page.goto("/Account/History?tab=Test%20Results");
  await expect(page.getByRole("heading", { name: "Fractions practice" })).toBeVisible();
  await expect(page.getByText(/Pretest: 0%/)).toBeVisible();
  await expect(page.getByText(/Posttest: 0%/)).toBeVisible();
  await expect(page.getByText(/Change: \+0 percentage points/)).toBeVisible();

  await page.goto("/Home");
  await expect(page.getByRole("heading", { name: "Before / after learning" })).toBeVisible();
  await expect(page.getByText(/Pre: 0% → Post: 0% \(0\)/)).toBeVisible();
  await page.goto("/Account/Profile");
  await expect(page.getByRole("heading", { name: "Before / after learning" })).toBeVisible();
  await expect(page.getByText(/Pre: 0% → Post: 0% \(0\)/)).toBeVisible();
});
