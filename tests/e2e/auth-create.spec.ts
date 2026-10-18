import { expect, test } from "@playwright/test";
import { seedBrowserAuth, sessionId, seededSession, stubCapabilities, stubSupabase, summaryOf } from "./fixtures";

test("profile errors expose Retry without redirecting and recover in the same page", async ({ context, page }) => {
  await seedBrowserAuth(context);
  const supabase = await stubSupabase(context, { failProfileReads: true });
  await stubCapabilities(page);
  await page.goto("/Home");

  // Allow the real PostgREST retry policy to exhaust; the stub exposes its
  // zero-second Retry-After header to keep the transient failure deterministic.
  await expect(page.getByText("Could not load your account profile.")).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/Home$/);
  supabase.setProfileAvailable();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("E2E learner").first()).toBeVisible();
  await expect(page).toHaveURL(/\/Home$/);
});

test("Supabase Auth state persists into a second tab and logout broadcasts to protected pages", async ({ context, page }) => {
  await seedBrowserAuth(context);
  await stubSupabase(context);
  await stubCapabilities(page);
  await page.goto("/Home");
  await expect(page.getByText("E2E learner").first()).toBeVisible();

  const secondTab = await context.newPage();
  await stubCapabilities(secondTab);
  await secondTab.goto("/Home");
  await expect(secondTab.getByText("E2E learner").first()).toBeVisible();

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/SignIn$/);
  await expect(secondTab).toHaveURL(/\/SignIn$/);
  const thirdTab = await context.newPage();
  await stubCapabilities(thirdTab);
  await thirdTab.goto("/Home");
  await expect(thirdTab).toHaveURL(/\/SignIn$/);
  await expect(thirdTab.getByText("E2E learner")).toHaveCount(0);
});

test("signing into another account in a second tab remounts protected content for the new user", async ({ context, page }) => {
  await stubSupabase(context);
  await seedBrowserAuth(context);
  await stubCapabilities(page);
  await page.goto("/Home");
  await expect(page.getByText("E2E learner").first()).toBeVisible();

  const secondTab = await context.newPage();
  await stubCapabilities(secondTab);
  await secondTab.goto("/Home");
  await expect(secondTab.getByText("E2E learner").first()).toBeVisible();
  await secondTab.goto("/SignIn");
  await secondTab.getByRole("textbox", { name: "Email address" }).fill("learner.b@example.test");
  await secondTab.locator('input[name="password"]').fill("deterministic-e2e-password");
  await secondTab.getByRole("button", { name: "Sign In" }).click();
  await expect(secondTab).toHaveURL(/\/Home$/);
  await expect(secondTab.getByText("Learner B").first()).toBeVisible();
  await expect(page.getByText("Learner B").first()).toBeVisible();
  await expect(page.getByText("E2E learner").first()).toHaveCount(0);
  const thirdTab = await context.newPage();
  await stubCapabilities(thirdTab);
  await thirdTab.goto("/Home");
  await expect(thirdTab.getByText("Learner B").first()).toBeVisible();
});

test("logout from another tab hides an open Chat transcript", async ({ context, page }) => {
  await seedBrowserAuth(context);
  await stubSupabase(context);
  const session = seededSession();
  await stubCapabilities(page);
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) }));
  await page.goto(`/Chat/${sessionId}`);
  await expect(page.getByText("Equivalent fractions have the same value.")).toBeVisible();

  const secondTab = await context.newPage();
  await stubCapabilities(secondTab);
  await secondTab.goto("/Home");
  await expect(secondTab.getByText("E2E learner").first()).toBeVisible();
  await secondTab.getByRole("button", { name: "Account" }).click();
  await secondTab.getByRole("button", { name: "Log out" }).click();
  await expect(secondTab).toHaveURL(/\/SignIn$/);
  await expect(page).toHaveURL(/\/SignIn$/);
  await expect(page.getByText("Equivalent fractions have the same value.")).toHaveCount(0);
});

test("an unconfirmed server logout signs out locally and warns on Sign In", async ({ context, page }) => {
  await seedBrowserAuth(context);
  await stubSupabase(context, { failLogouts: true });
  await stubCapabilities(page);
  await page.goto("/Home");
  await expect(page.getByText("E2E learner").first()).toBeVisible();
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/SignIn$/);
  await expect(page.getByRole("status")).toHaveText("You are signed out on this device, but server sign-out could not be confirmed.");
  await expect(page.getByText("E2E learner")).toHaveCount(0);
  const nextTab = await context.newPage();
  await stubCapabilities(nextTab);
  await nextTab.goto("/Home");
  await expect(nextTab).toHaveURL(/\/SignIn$/);
});

test("Create retries feature loading, keeps file upload disabled, and starts from text", async ({ context, page }) => {
  await seedBrowserAuth(context);
  await stubSupabase(context);
  await stubCapabilities(page, (count) => count === 1
    ? { status: 503, data: { message: "capabilities unavailable" } }
    : { data: { assessments: false, fileUploads: true } });

  const session = seededSession({ messages: [] });
  let creates = 0;
  let interactions = 0;
  await page.route("**/api/learning-sessions", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [summaryOf(session)] }) });
    creates += 1;
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: summaryOf(session) }) });
  });
  await page.route(`**/api/learning-sessions/${sessionId}/interactions`, async (route) => {
    interactions += 1;
    const body = route.request().postDataJSON();
    expect(body).toEqual({ input: "Teach me fractions", action: "RESPOND" });
    session.messages.push(
      { id: "user-1", role: "USER", content: body.input, createdAt: "2026-10-16T10:06:00.000Z" },
      { id: "tutor-1", role: "TUTOR", content: { blocks: [{ id: "lesson-1", type: "explanation", content: "Fractions show parts of a whole." }] }, createdAt: "2026-10-16T10:07:00.000Z" },
    );
    session.version += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { blocks: [] } }) });
  });
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) }));

  await page.goto("/Create");
  await page.addStyleTag({ content: "*, *::before, *::after { animation-duration: 0s !important; animation-iteration-count: 1 !important; transition-duration: 0s !important; }" });
  await expect(page.getByText("Could not check feature availability.")).toBeVisible();
  const upload = page.getByRole("button", { name: /upload/i });
  await expect(upload).toBeDisabled();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("status")).toContainText("Uploads are not enabled");
  await expect(upload).toBeDisabled();

  const text = page.getByRole("textbox", { name: "text area" });
  await text.fill("Teach me fractions");
  await page.getByRole("button", { name: "Start Learning..." }).click({ force: true });
  await expect(page).toHaveURL(new RegExp(`/Chat/${sessionId}$`));
  await expect(page.getByText("Fractions show parts of a whole.")).toBeVisible();
  expect(creates).toBe(1);
  expect(interactions).toBe(1);
});

test("Create enforces the 8000 character text limit", async ({ context, page }) => {
  await seedBrowserAuth(context);
  await stubSupabase(context);
  await stubCapabilities(page);
  const session = seededSession({ messages: [] });
  let creates = 0;
  let interactions = 0;
  await page.route("**/api/learning-sessions", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [summaryOf(session)] }) });
    creates += 1;
    const body = route.request().postDataJSON();
    expect(body.title).toHaveLength(120);
    expect(body.title).toBe("x".repeat(120));
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: summaryOf(session) }) });
  });
  await page.route(`**/api/learning-sessions/${sessionId}/interactions`, async (route) => {
    interactions += 1;
    const body = route.request().postDataJSON();
    expect(body.input).toHaveLength(8000);
    session.messages.push(
      { id: "user-1", role: "USER", content: body.input, createdAt: "2026-10-16T10:06:00.000Z" },
      { id: "tutor-1", role: "TUTOR", content: { blocks: [{ id: "lesson-1", type: "explanation", content: "The full allowed input was sent." }] }, createdAt: "2026-10-16T10:07:00.000Z" },
    );
    session.version += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { blocks: [] } }) });
  });
  await page.route(`**/api/learning-sessions/${sessionId}`, async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: session }) }));
  await page.goto("/Create");
  await page.addStyleTag({ content: "*, *::before, *::after { animation-duration: 0s !important; animation-iteration-count: 1 !important; transition-duration: 0s !important; }" });
  const text = page.getByRole("textbox", { name: "text area" });
  await expect(text).toHaveAttribute("maxlength", "8000");
  await text.fill("x".repeat(8001));
  expect(await text.inputValue()).toHaveLength(8000);
  const start = page.getByRole("button", { name: "Start Learning..." });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page).toHaveURL(new RegExp(`/Chat/${sessionId}$`));
  await expect(page.getByText("The full allowed input was sent.")).toBeVisible();
  expect(creates).toBe(1);
  expect(interactions).toBe(1);
});
