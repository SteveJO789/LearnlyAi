import RequireAuth from "../../components/require-auth";
import AssessmentSession from "./assessment-session";
import type { AssessmentPhase } from "../../../lib/assessments";

export default async function AssessmentPage({ params, searchParams }: {
  params: Promise<{ sessionId: string }>; searchParams: Promise<{ phase?: string | string[] }>;
}) {
  const [{ sessionId }, query] = await Promise.all([params, searchParams]);
  const value = (Array.isArray(query.phase) ? query.phase[0] : query.phase)?.toUpperCase();
  const phase: AssessmentPhase = value === "POST" || value === "TRANSFER" ? value : "PRE";
  return <RequireAuth><main className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-10 text-text sm:px-8">
    <AssessmentSession key={`${sessionId}:${phase}`} sessionId={sessionId} phase={phase} />
  </main></RequireAuth>;
}
