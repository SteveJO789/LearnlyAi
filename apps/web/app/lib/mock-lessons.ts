// TODO(Seiya/Steve): this is a frontend-only placeholder standing in for
// GET /api/v1/learning-sessions (see docs/api-contract.md). It's the single
// source "Lessons", "Account/History", and the per-lesson "Learning Page"
// all read from, so they agree with each other and with the Chat session.
// Swap the LESSONS array below for a real fetch once the endpoint exists —
// every page that imports from here will pick it up automatically.

export type Unit = {
  id: string;
  name: string;
  progressPercent: number;
};

export type Lesson = {
  id: string;
  title: string;
  subject: string;
  imageUrl: string;
  progressPercent: number;
  date: string;
  sessionId: string;
  units: Unit[];
};

export const LESSONS: Lesson[] = [
  {
    id: "linear-equations",
    title: "Linear Equations",
    subject: "math",
    imageUrl:
      "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=800",
    progressPercent: 100,
    date: "2026-09-10",
    sessionId: "demo-session-001",
    units: [
      { id: "u1", name: "Unit 1 · Understanding variables", progressPercent: 100 },
      { id: "u2", name: "Unit 2 · Solving for x", progressPercent: 100 },
      { id: "u3", name: "Unit 3 · Word problems", progressPercent: 100 },
    ],
  },
  {
    id: "electric-current",
    title: "Electric Current",
    subject: "physics",
    imageUrl:
      "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=800",
    progressPercent: 65,
    date: "2026-09-18",
    sessionId: "demo-session-002",
    units: [
      { id: "u1", name: "Unit 1 · Voltage, current, resistance", progressPercent: 100 },
      { id: "u2", name: "Unit 2 · Ohm's law", progressPercent: 60 },
      { id: "u3", name: "Unit 3 · Series & parallel circuits", progressPercent: 0 },
    ],
  },
  {
    id: "calculus",
    title: "Calculus",
    subject: "math",
    imageUrl:
      "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=800",
    progressPercent: 20,
    date: "2026-09-25",
    sessionId: "demo-session-003",
    units: [
      { id: "u1", name: "Unit 1 · Limits", progressPercent: 60 },
      { id: "u2", name: "Unit 2 · Derivatives", progressPercent: 0 },
      { id: "u3", name: "Unit 3 · Integrals", progressPercent: 0 },
    ],
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
