import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { UserDb } from "../../prisma/db.js";
import { withApiWrite } from "../../prisma/api-write.js";
import { ApiError } from "../../shared/api-error.js";
import { createAssessmentSnapshot, type AssessmentPhase, type AssessmentSnapshot, type AssessmentTopic } from "./scoring.js";
import type { AssessmentRecord, AssessmentStore, GradedAnswer, LearningProfileDto, LearningProgressDto } from "./domain.js";

function readSnapshot(text: string, id: string, topic: string, phase: AssessmentPhase): AssessmentSnapshot | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new ApiError("ASSESSMENT_UNAVAILABLE", 503, "Stored assessment data is unavailable."); }
  if (value === null) return null;
  if (!value || typeof value !== "object" || !["linear-equations", "ohms-law"].includes(topic) ||
    !("language" in value) || !["th", "en"].includes(String(value.language))) {
    throw new ApiError("ASSESSMENT_UNAVAILABLE", 503, "The stored assessment snapshot is unsupported.");
  }
  const expected = createAssessmentSnapshot(id, topic as AssessmentTopic, phase, value.language as "th" | "en");
  // v1 question generation is immutable: do not silently repair malformed persisted data.
  if (!isDeepStrictEqual(value, expected)) throw new ApiError("ASSESSMENT_UNAVAILABLE", 503, "The assessment snapshot failed its integrity check.");
  return expected;
}

/** JWT-bound parameterized SQL on the existing Prisma 8 runtime. No privileged bypass. */
export class PrismaAssessmentStore implements AssessmentStore {
  constructor(private readonly client: UserDb, private readonly userId: string) {}

  async getSession(sessionId: string) {
    const plan = this.client.raw.sql`SELECT "id", "stage", "lifecycleState", "version"
      FROM public."LearningSession" WHERE "id" = ${sessionId} AND "userId" = ${this.userId}`
      .returnsRow({ id: "pg/text@1", stage: "pg/text@1", lifecycleState: "pg/text@1", version: "pg/int4@1" }).build();
    return (await this.client.query(plan).toArray())[0] ?? null;
  }

  async getAssessment(sessionId: string, phase: AssessmentPhase): Promise<AssessmentRecord | null> {
    const plan = this.client.raw.sql`SELECT a."id", a."learningSessionId", a."phase", COALESCE(a."topic", '') AS "topic",
      COALESCE(a."snapshot"::text, 'null') AS "snapshotJson", COALESCE(a."score", -1) AS "score",
      COALESCE(a."maxScore", -1) AS "maxScore", COALESCE(a."submissionHash", '') AS "submissionHash",
      COALESCE(to_char(a."submittedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '') AS "submittedAt"
      FROM public."Assessment" a JOIN public."LearningSession" s ON s."id" = a."learningSessionId"
      WHERE a."learningSessionId" = ${sessionId} AND a."phase" = ${phase} AND s."userId" = ${this.userId}`
      .returnsRow({ id: "pg/text@1", learningSessionId: "pg/text@1", phase: "pg/text@1", topic: "pg/text@1",
        snapshotJson: "pg/text@1", score: "pg/int4@1", maxScore: "pg/int4@1", submissionHash: "pg/text@1", submittedAt: "pg/text@1" }).build();
    const row = (await this.client.query(plan).toArray())[0];
    if (!row) return null;
    return { id: row.id, learningSessionId: row.learningSessionId, phase,
      topic: (row.topic || null) as AssessmentTopic | null, snapshot: readSnapshot(row.snapshotJson, row.id, row.topic, phase),
      score: row.score < 0 ? null : row.score, maxScore: row.maxScore < 0 ? null : row.maxScore,
      submittedAt: row.submittedAt || null, submissionHash: row.submissionHash || null };
  }

  async createAssessment(record: AssessmentRecord): Promise<boolean> {
    return withApiWrite(this.client, async tx => {
      const plan = this.client.raw.sql`INSERT INTO public."Assessment"
        ("id", "learningSessionId", "phase", "topic", "snapshot", "maxScore")
        SELECT ${record.id}, ${record.learningSessionId}, ${record.phase}, NULLIF(${record.topic ?? ""}, ''), ${JSON.stringify(record.snapshot)}::jsonb, ${record.maxScore ?? 0}
        WHERE EXISTS (SELECT 1 FROM public."LearningSession" WHERE "id" = ${record.learningSessionId} AND "userId" = ${this.userId})
        ON CONFLICT ("learningSessionId", "phase") DO NOTHING`.affectedCount().build();
      return (await tx.execute(plan)).affectedRows === 1;
    });
  }

  async getAnswers(assessmentId: string): Promise<GradedAnswer[]> {
    const plan = this.client.raw.sql`SELECT x."questionId", x."response"::text AS "responseJson",
      COALESCE(x."isCorrect", false) AS "isCorrect", COALESCE(x."awardedScore", 0) AS "awardedScore"
      FROM public."AssessmentAnswer" x JOIN public."Assessment" a ON a."id" = x."assessmentId"
      JOIN public."LearningSession" s ON s."id" = a."learningSessionId"
      WHERE x."assessmentId" = ${assessmentId} AND s."userId" = ${this.userId} ORDER BY x."questionId"`
      .returnsRow({ questionId: "pg/text@1", responseJson: "pg/text@1", isCorrect: "pg/bool@1", awardedScore: "pg/int4@1" }).build();
    return (await this.client.query(plan).toArray()).map(row => {
      const response: unknown = JSON.parse(row.responseJson);
      if (typeof response !== "number" || !Number.isFinite(response)) throw new ApiError("ASSESSMENT_UNAVAILABLE", 503, "Stored assessment answers are unavailable.");
      return { questionId: row.questionId, response, isCorrect: row.isCorrect, awardedScore: row.awardedScore };
    });
  }

  async submitAssessment(record: AssessmentRecord, answers: GradedAnswer[], submissionHash: string, at: string): Promise<boolean> {
    return withApiWrite(this.client, async tx => {
      // Serialize profile updates for this learner without locking another learner's progress.
      await tx.execute(this.client.raw.sql`SELECT pg_advisory_xact_lock(hashtextextended(${this.userId}, 0))`.affectedCount().build());
      const score = answers.reduce((sum, answer) => sum + answer.awardedScore, 0);
      const update = this.client.raw.sql`UPDATE public."Assessment" a SET "score" = ${score}, "maxScore" = ${answers.length},
        "submittedAt" = ${at}::timestamptz, "submissionHash" = ${submissionHash}
        WHERE a."id" = ${record.id} AND a."learningSessionId" = ${record.learningSessionId} AND a."submittedAt" IS NULL
        AND EXISTS (SELECT 1 FROM public."LearningSession" s WHERE s."id" = a."learningSessionId" AND s."userId" = ${this.userId})`
        .affectedCount().build();
      if ((await tx.execute(update)).affectedRows !== 1) return false;
      for (const answer of answers) {
        await tx.execute(this.client.raw.sql`INSERT INTO public."AssessmentAnswer"
          ("id", "assessmentId", "questionId", "response", "isCorrect", "awardedScore")
          VALUES (${randomUUID()}, ${record.id}, ${answer.questionId}, ${JSON.stringify(answer.response)}::jsonb,
            ${answer.isCorrect}, ${answer.awardedScore})`.affectedCount().build());
      }
      if (record.phase !== "PRE") {
        const samples = this.client.raw.sql`SELECT DISTINCT ON (a."topic") a."topic", a."id", a."score", a."maxScore",
          to_char(a."submittedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "at"
          FROM public."Assessment" a JOIN public."LearningSession" s ON s."id" = a."learningSessionId"
          WHERE s."userId" = ${this.userId} AND a."phase" IN ('POST', 'TRANSFER') AND a."submittedAt" IS NOT NULL
          AND a."maxScore" > 0 AND a."topic" IS NOT NULL ORDER BY a."topic", a."submittedAt" DESC, a."id" DESC`
          .returnsRow({ topic: "pg/text@1", id: "pg/text@1", score: "pg/int4@1", maxScore: "pg/int4@1", at: "pg/text@1" }).build();
        const mastery: LearningProfileDto["mastery"] = {};
        const strengths: string[] = [], weakPoints: string[] = [];
        for (const sample of await tx.query(samples).toArray()) {
          if (!["linear-equations", "ohms-law"].includes(sample.topic)) continue;
          const percent = Math.round(sample.score * 100 / sample.maxScore);
          mastery[sample.topic as AssessmentTopic] = { percent, assessmentId: sample.id, sampleQuestions: sample.maxScore, assessedAt: sample.at };
          if (percent >= 80) strengths.push(sample.topic);
          if (percent < 50) weakPoints.push(sample.topic);
        }
        await tx.execute(this.client.raw.sql`INSERT INTO public."LearningProfile" ("userId", "mastery", "strengths", "weakPoints", "updatedAt")
          VALUES (${this.userId}, ${JSON.stringify(mastery)}::jsonb, ${JSON.stringify(strengths)}::jsonb,
            ${JSON.stringify(weakPoints)}::jsonb, ${at}::timestamptz)
          ON CONFLICT ("userId") DO UPDATE SET "mastery" = EXCLUDED."mastery", "strengths" = EXCLUDED."strengths",
            "weakPoints" = EXCLUDED."weakPoints", "updatedAt" = EXCLUDED."updatedAt"`.affectedCount().build());
      }
      return true;
    });
  }

  async getLearningProfile(): Promise<LearningProfileDto | null> {
    const plan = this.client.raw.sql`SELECT "mastery"::text AS "mastery", "strengths"::text AS "strengths", "weakPoints"::text AS "weakPoints",
      to_char("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"
      FROM public."LearningProfile" WHERE "userId" = ${this.userId}`
      .returnsRow({ mastery: "pg/text@1", strengths: "pg/text@1", weakPoints: "pg/text@1", updatedAt: "pg/text@1" }).build();
    const row = (await this.client.query(plan).toArray())[0];
    if (!row) return null;
    return { mastery: JSON.parse(row.mastery), strengths: JSON.parse(row.strengths), weakPoints: JSON.parse(row.weakPoints), updatedAt: row.updatedAt };
  }

  async getProgress(): Promise<LearningProgressDto> {
    const aggregate = this.client.raw.sql`SELECT COUNT(*)::int AS "sessionCount",
      COUNT(*) FILTER (WHERE "lifecycleState" = 'COMPLETED')::int AS "completedSessionCount",
      COALESCE(ROUND(AVG("progressPercent")), 0)::int AS "averageProgressPercent"
      FROM public."LearningSession" WHERE "userId" = ${this.userId}`
      .returnsRow({ sessionCount: "pg/int4@1", completedSessionCount: "pg/int4@1", averageProgressPercent: "pg/int4@1" }).build();
    const comparisons = this.client.raw.sql`SELECT a."learningSessionId" AS "sessionId", COALESCE(a."topic", '') AS "topic",
      COALESCE(MAX(a."score" * 100.0 / NULLIF(a."maxScore", 0)) FILTER (WHERE a."phase" = 'PRE'), -1)::int AS "prePercent",
      COALESCE(MAX(a."score" * 100.0 / NULLIF(a."maxScore", 0)) FILTER (WHERE a."phase" = 'POST'), -1)::int AS "postPercent"
      FROM public."Assessment" a JOIN public."LearningSession" s ON s."id" = a."learningSessionId"
      WHERE s."userId" = ${this.userId} AND a."submittedAt" IS NOT NULL AND a."phase" IN ('PRE', 'POST')
      GROUP BY a."learningSessionId", a."topic" ORDER BY MAX(a."submittedAt") DESC LIMIT 100`
      .returnsRow({ sessionId: "pg/text@1", topic: "pg/text@1", prePercent: "pg/int4@1", postPercent: "pg/int4@1" }).build();
    const [totals, pairs] = await Promise.all([this.client.query(aggregate).toArray(), this.client.query(comparisons).toArray()]);
    const first = totals[0]!;
    return { ...first, comparisons: pairs.map(pair => ({ sessionId: pair.sessionId, topic: pair.topic,
      prePercent: pair.prePercent < 0 ? null : pair.prePercent, postPercent: pair.postPercent < 0 ? null : pair.postPercent,
      deltaPercent: pair.prePercent < 0 || pair.postPercent < 0 ? null : pair.postPercent - pair.prePercent })) };
  }
}
