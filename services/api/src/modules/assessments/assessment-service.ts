import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "../../shared/api-error.js";
import { createAssessmentSnapshot, publicAssessmentQuestions, scoreAssessment,
  type AssessmentLanguage, type AssessmentPhase, type AssessmentTopic } from "./scoring.js";
import type { AssessmentRecord, AssessmentStore } from "./domain.js";

const notFound = () => new ApiError("NOT_FOUND", 404, "Learning session was not found.");
const conflict = () => new ApiError("ASSESSMENT_CONFLICT", 409, "The assessment cannot be changed. Reload the current assessment.");

export class AssessmentService {
  constructor(private readonly store: AssessmentStore,
    private readonly id = randomUUID, private readonly now = () => new Date().toISOString()) {}

  private async requireSession(sessionId: string) {
    const session = await this.store.getSession(sessionId);
    if (!session) throw notFound();
    return session;
  }

  private dto(record: AssessmentRecord) {
    if (!record.snapshot) throw new ApiError("ASSESSMENT_UNAVAILABLE", 503, "This assessment does not have a supported question snapshot.");
    return { id: record.id, sessionId: record.learningSessionId, phase: record.phase,
      topic: record.topic, language: record.snapshot.language, questions: publicAssessmentQuestions(record.snapshot),
      score: record.score, maxScore: record.maxScore, submittedAt: record.submittedAt };
  }

  async create(sessionId: string, phase: AssessmentPhase, topic: AssessmentTopic, language: AssessmentLanguage) {
    const session = await this.requireSession(sessionId);
    const existing = await this.store.getAssessment(sessionId, phase);
    if (existing) {
      if (existing.topic !== topic || existing.snapshot?.language !== language) throw conflict();
      return this.dto(existing);
    }
    if (session.lifecycleState !== "ACTIVE" || (phase !== "PRE" && session.stage !== "ASSESS" && phase !== "TRANSFER")) {
      throw new ApiError("INVALID_ASSESSMENT_STAGE", 409, "Start this assessment at the appropriate learning stage.");
    }
    if (phase === "TRANSFER" && !["PRACTICE", "ASSESS"].includes(session.stage)) {
      throw new ApiError("INVALID_ASSESSMENT_STAGE", 409, "Transfer practice is not available at this stage.");
    }
    if (phase === "PRE" && session.stage !== "DIAGNOSE" && !(session.stage === "EXPLAIN" && session.version === 0)) {
      throw new ApiError("INVALID_ASSESSMENT_STAGE", 409, "Take the pre-test before starting the lesson.");
    }
    if (phase !== "PRE") {
      const baseline = await this.store.getAssessment(sessionId, "PRE");
      if (baseline && baseline.topic !== topic) throw new ApiError("ASSESSMENT_TOPIC_MISMATCH", 409, "Use the same topic as the pre-test for this learning session.");
    }
    const id = this.id();
    const record: AssessmentRecord = { id, learningSessionId: sessionId, phase, topic,
      snapshot: createAssessmentSnapshot(id, topic, phase, language), score: null, maxScore: 3,
      submittedAt: null, submissionHash: null };
    if (!await this.store.createAssessment(record)) {
      const winner = await this.store.getAssessment(sessionId, phase);
      if (!winner || winner.topic !== topic || winner.snapshot?.language !== language) throw conflict();
      return this.dto(winner);
    }
    return this.dto(record);
  }

  async get(sessionId: string, phase: AssessmentPhase) {
    await this.requireSession(sessionId);
    const record = await this.store.getAssessment(sessionId, phase);
    if (!record) throw new ApiError("NOT_FOUND", 404, "Assessment was not found.");
    return { ...this.dto(record), answers: record.submittedAt ? await this.store.getAnswers(record.id) : [] };
  }

  async submit(sessionId: string, phase: AssessmentPhase, input: unknown) {
    const session = await this.requireSession(sessionId);
    const record = await this.store.getAssessment(sessionId, phase);
    if (!record) throw new ApiError("NOT_FOUND", 404, "Create the assessment before submitting answers.");
    if (!record.snapshot) throw new ApiError("ASSESSMENT_UNAVAILABLE", 503, "The assessment snapshot is unavailable.");
    const graded = scoreAssessment(record.snapshot, input);
    const hash = createHash("sha256").update(JSON.stringify(graded.answers.map(answer => [answer.questionId, answer.response]))).digest("hex");
    if (record.submittedAt) {
      if (record.submissionHash !== hash) throw conflict();
      return this.get(sessionId, phase);
    }
    if (session.lifecycleState !== "ACTIVE") throw new ApiError("SESSION_INACTIVE", 409, "The learning session is no longer active.");
    if (!await this.store.submitAssessment(record, graded.answers, hash, this.now())) {
      const winner = await this.store.getAssessment(sessionId, phase);
      if (winner?.submissionHash !== hash) throw conflict();
    }
    return this.get(sessionId, phase);
  }
}
