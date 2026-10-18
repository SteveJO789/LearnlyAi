import { expect, test, type Page } from "@playwright/test";
import { seedBrowserAuth, seededSession, stubSupabase, summaryOf } from "./fixtures";

// Browser journeys use the real Next app and SDK with deterministic same-origin API fixtures.
// They do not call an actual storage bucket, extraction provider, assessment service, or model.
const sessionId = "upload-session-001";
const materialId = "upload-material-001";
const receiptId = "upload-receipt-001";
const sourceText = "A fraction names equal parts of a whole.";
const reviewedText = "A fraction names equal parts of a whole. Check that the parts are equal.";
const pdfBytes = Buffer.from("%PDF-1.4\nE2E fixture document\n%%EOF\n");
const at = "2026-10-16T10:00:00.000Z";

function readyMaterial(text = sourceText) {
  return { id: materialId, materialId, type: "PDF", status: "READY", normalizedText: text,
    contentHash: "a".repeat(64), mimeType: "application/pdf", sizeBytes: pdfBytes.byteLength };
}
function fileHistoryItem(text: string, reviewed: boolean) {
  return { id: materialId, sessionId, sessionTitle: "Fractions from a handout", type: "PDF", mimeType: "application/pdf",
    sizeBytes: pdfBytes.byteLength, filename: "fractions.pdf", uploadedAt: at, normalizedText: text,
    reviewedByLearner: reviewed, canReview: true };
}
async function stubEnabledFeatures(page: Page) {
  await page.route("**/api/capabilities", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ data: { assessments: true, fileUploads: true } }),
  }));
}
async function stubSession(page: Page) {
  const session = seededSession({
    id: sessionId, title: "Fractions from a handout", learningGoal: "Understand fractions", subject: "Math",
    state: "PRE_TEST", stage: "EXPLAIN", progressPercent: 25,
    progress: { percent: 25, canAdvance: true, nextAction: "ADVANCE" }, version: 1,
    messages: [{ id: "tutor-start", role: "TUTOR", content: { blocks: [{ id: "start-block", type: "explanation",
      title: "Fractions", content: "Let’s learn from the reviewed material." }] }, createdAt: at }],
    materials: [{ id: materialId, type: "PDF", status: "READY", normalizedText: reviewedText }],
  });
  await page.route("**/api/learning-sessions/" + sessionId, route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ data: session }),
  }));
  await page.route("**/api/learning-sessions", async route => {
    if (route.request().method() === "POST") return route.fulfill({ status: 201, contentType: "application/json",
      body: JSON.stringify({ data: summaryOf(session) }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [summaryOf(session)] }) });
  });
  return session;
}

test("enabled file upload (synthetic API responses) is reviewed, assessed, learned from, and downloadable from History", async ({ context, page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedBrowserAuth(context);
  await stubSupabase(context);
  await stubEnabledFeatures(page);
  const session = await stubSession(page);
  let uploadPosts = 0;
  let reviewBody: { text: string } | null = null;
  let assessment: Record<string, unknown> | null = null;
  let interactionCount = 0;

  await page.route("**/api/learning-sessions/" + sessionId + "/materials/files", async route => {
    uploadPosts += 1;
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["content-type"]).toBe("application/pdf");
    expect(route.request().headers()["x-file-name"]).toBe("fractions.pdf");
    expect(route.request().postDataBuffer()).toEqual(pdfBytes);
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: readyMaterial() }) });
  });
  await page.route("**/api/learning-sessions/" + sessionId + "/materials/" + materialId + "/review", async route => {
    expect(route.request().method()).toBe("PATCH");
    const submitted = route.request().postDataJSON() as { text: string };
    reviewBody = submitted;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {
      materialId, status: "READY", normalizedText: submitted.text,
    } }) });
  });
  await page.route("**/api/learning-sessions/" + sessionId + "/assessments/**", async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "GET") {
      if (!pathname.endsWith("/PRE") || !assessment) return route.fulfill({ status: 404, contentType: "application/json",
        body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Assessment not found." } }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: assessment }) });
    }
    if (request.method() === "POST" && pathname.endsWith("/PRE")) {
      assessment = { id: "upload-pre-assessment", sessionId, phase: "PRE", topic: "linear-equations", language: "en",
        questions: [{ id: "upload-q1", prompt: "What is 2x when x is 0?", format: "NUMBER" }],
        score: null, maxScore: 1, submittedAt: null };
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: assessment }) });
    }
    if (request.method() === "POST" && pathname.endsWith("/submissions")) {
      assessment = { ...(assessment as Record<string, unknown>), score: 0, submittedAt: at,
        answers: [{ questionId: "upload-q1", response: 4, isCorrect: false, awardedScore: 0 }] };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: assessment }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { message: "Unstubbed assessment request." } }) });
  });
  await page.route("**/api/learning-sessions/" + sessionId + "/interactions", async route => {
    interactionCount += 1;
    expect((route.request().postDataJSON() as { action: string }).action).toBe("ADVANCE");
    session.messages.push({ id: "advanced-" + interactionCount, role: "TUTOR",
      content: { blocks: [{ id: "advanced-block-" + interactionCount, type: "explanation", content: "Equal parts have the same size." }] }, createdAt: at });
    session.version += 1;
    session.stage = "PRACTICE"; session.state = "LEARNING";
    session.progressPercent = 50; session.progress = { percent: 50, canAdvance: true, nextAction: "ADVANCE" };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { blocks: [] } }) });
  });
  await page.route("**/api/users/me/files?*", route => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ data: { items: [fileHistoryItem(reviewedText, true)], nextCursor: null } }) }));
  await page.route("**/api/users/me/files", route => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ data: { items: [fileHistoryItem(reviewedText, true)], nextCursor: null } }) }));
  await page.route("**/api/users/me/files/uploads*", route => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ data: { items: [], nextCursor: null } }) }));
  await page.route("**/api/learning-sessions/" + sessionId + "/materials/" + materialId + "/file", route => route.fulfill({
    status: 200, contentType: "application/pdf", headers: { "content-length": String(pdfBytes.byteLength) }, body: pdfBytes,
  }));

  await page.goto("/Create");
  await expect(page.getByRole("status").filter({ hasText: "Uploads are available." })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "fractions.pdf", mimeType: "application/pdf", buffer: pdfBytes });
  await page.getByRole("button", { name: "Read file" }).click();
  await expect(page.getByRole("status").filter({ hasText: "File read. Review the text before starting." })).toBeVisible();
  const materialEditor = page.getByLabel("Review extracted text and correct equations or units");
  await expect(materialEditor).toHaveValue(sourceText);
  await materialEditor.fill(reviewedText);
  await page.getByRole("button", { name: "Start Learning..." }).click();
  await expect(page).toHaveURL(new RegExp("/Assessment/" + sessionId + "\\?phase=PRE$"));
  expect(reviewBody).toEqual({ text: reviewedText });
  expect(uploadPosts).toBe(1);

  await page.getByLabel("Topic").selectOption("linear-equations");
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page.getByText("What is 2x when x is 0?")).toBeVisible();
  await page.getByLabel("Answer").fill("4");
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Score: 0/1" })).toBeVisible();
  await page.getByRole("link", { name: "Back to learning" }).click();
  await expect(page).toHaveURL(new RegExp("/Chat/" + sessionId + "$"));
  await expect(page.getByText("Let’s learn from the reviewed material.")).toBeVisible();
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByText("Equal parts have the same size.")).toBeVisible();
  expect(interactionCount).toBe(1);

  await page.goto("/Account/History?tab=Uploaded%20Files");
  const historyCard = page.getByRole("button", { name: /fractions\.pdf/ });
  await expect(historyCard).toBeVisible();
  await historyCard.click();
  const dialog = page.getByRole("dialog", { name: "fractions.pdf" });
  await expect(dialog.getByLabel("Extracted text for learning")).toHaveValue(reviewedText);
  const response = page.waitForResponse(res => res.url().includes("/materials/" + materialId + "/file"));
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download original file" }).click();
  await response;
  expect((await download).suggestedFilename()).toBe("fractions.pdf");
});

test("ambiguous file upload (synthetic API responses) is receipt-checked and resumed without re-upload", async ({ context, page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedBrowserAuth(context);
  await stubSupabase(context);
  await stubEnabledFeatures(page);
  await stubSession(page);
  let uploadPosts = 0, receiptLookups = 0, resumes = 0;
  let reviewBody: { text: string } | null = null;

  await page.route("**/api/learning-sessions/" + sessionId + "/materials/files", async route => {
    uploadPosts += 1;
    expect(route.request().headers()["x-file-name"]).toBe("fractions.pdf");
    // The server may have persisted a receipt before the response was lost.
    return route.fulfill({ status: 503, contentType: "application/json",
      body: JSON.stringify({ error: { code: "TEMPORARY_FAILURE", message: "Upload outcome is unknown." } }) });
  });
  await page.route("**/api/learning-sessions/" + sessionId + "/materials/uploads", async route => {
    receiptLookups += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [
      { id: receiptId, state: "PENDING", type: "PDF", filename: "fractions.pdf", createdAt: at },
    ] }) });
  });
  await page.route("**/api/learning-sessions/" + sessionId + "/materials/uploads/" + receiptId + "/resume", async route => {
    resumes += 1;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({});
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: readyMaterial() }) });
  });
  await page.route("**/api/learning-sessions/" + sessionId + "/materials/" + materialId + "/review", async route => {
    const submitted = route.request().postDataJSON() as { text: string };
    reviewBody = submitted;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {
      materialId, status: "READY", normalizedText: submitted.text,
    } }) });
  });
  await page.route("**/api/learning-sessions/" + sessionId + "/assessments/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET") return route.fulfill({ status: 404, contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Assessment not found." } }) });
    if (route.request().method() === "POST" && path.endsWith("/PRE")) return route.fulfill({ status: 201, contentType: "application/json",
      body: JSON.stringify({ data: { id: "recovered-pre", sessionId, phase: "PRE", topic: "linear-equations", language: "en",
        questions: [], score: null, maxScore: 0, submittedAt: null } }) });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { message: "Unstubbed assessment request." } }) });
  });

  await page.goto("/Create");
  await page.locator('input[type="file"]').setInputFiles({ name: "fractions.pdf", mimeType: "application/pdf", buffer: pdfBytes });
  await page.getByRole("button", { name: "Read file" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Upload outcome is unknown." })).toBeVisible();
  await page.getByRole("button", { name: "Check existing uploads" }).click();
  await expect(page.getByRole("button", { name: "Check/restore fractions.pdf" })).toBeVisible();
  await page.getByRole("button", { name: "Check/restore fractions.pdf" }).click();
  await expect(page.getByRole("status").filter({ hasText: "File read. Review the text before starting." })).toBeVisible();
  await expect(page.getByLabel("Review extracted text and correct equations or units")).toHaveValue(sourceText);
  expect(uploadPosts).toBe(1);
  expect(receiptLookups).toBe(1);
  expect(resumes).toBe(1);
  await page.getByRole("button", { name: "Start Learning..." }).click();
  await expect(page).toHaveURL(new RegExp("/Assessment/" + sessionId + "\\?phase=PRE$"));
  expect(reviewBody).toEqual({ text: sourceText });
  expect(uploadPosts).toBe(1);
});
