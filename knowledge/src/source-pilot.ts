import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stringify } from "yaml";
import type { NormalizedUnit, ValidationIssue } from "./domain.js";
import { calculateSha256 } from "./acquisition.js";
import { compileJsonSchema, validateCanonicalDocument, validateWithSchema } from "./schema-validation.js";
import { loadSourceRegistry } from "./source-processing-policy.js";
import { validateSourceProcessing } from "./source-processing-validation.js";
import { toCanonicalKnowledgeDocument } from "./canonical-document.js";
import { parseKnowledgeMarkdown } from "./markdown-frontmatter.js";

interface Evidence {
  normalized_unit: string; normalized_sha256: string; source_id: string;
  artifact_id: string; artifact_sha256: string; source_document: string;
  chapter: string; section: string; excerpt: string;
}
const locator = (e: Evidence): string => `${e.artifact_id} :: ${e.source_document} :: ${e.chapter} :: ${e.section}`;

// This separate, draft-only envelope cannot stand in for verified image curation.
export function validateSourcePilot(root: string, document: Record<string, unknown>, file: string): ValidationIssue[] {
  if (!document.source_pilot) return [];
  const issues = validateWithSchema(compileJsonSchema(join(root, "schemas/source-pilot.schema.json")), document.source_pilot, file, "/source_pilot");
  if (issues.length) return issues;
  const add = (message: string): void => { issues.push({ file, path: "/source_pilot", keyword: "sourcePilotEvidence", message }); };
  if (document.status !== "draft") add("source pilots remain draft-only; explicit human curation is a separate workflow");
  if (document.curation) add("cannot mix source-pilot evidence with verified mathematical asset curation");
  const metadata = document.source_pilot as { evidence: Evidence[]; curriculum_mapping: string };
  const refs = document.source_refs as Array<{ source_id: string; locator?: string; usage: string }>;
  for (const e of metadata.evidence) {
    try {
      const bytes = readFileSync(join(root, e.normalized_unit));
      const unit = JSON.parse(bytes.toString("utf8")) as NormalizedUnit;
      if (calculateSha256(bytes) !== e.normalized_sha256 || unit.source_id !== e.source_id
        || unit.artifact_id !== e.artifact_id || unit.provenance.artifact_sha256 !== e.artifact_sha256
        || unit.locator.document !== e.source_document || unit.locator.chapter !== e.chapter || unit.locator.section !== e.section) {
        add("normalized checksum or exact source locator no longer matches evidence");
      }
      if (!unit.content.includes(e.excerpt) || /epub:|!\[|<img\b/i.test(e.excerpt)) add("evidence must be literal source text, never an unverified image transcription");
      if (!refs?.some((ref) => ref.source_id === e.source_id && ref.locator === locator(e) && ref.usage === "content_source")) add("each evidence selection requires its exact source_ref locator");
    } catch { add(`missing or unreadable normalized evidence: ${e.normalized_unit}`); }
  }
  const sections = document.sections as Array<{ slug: string; markdown: string }>;
  for (const section of sections ?? []) {
    if (/epub:|!\[|<img\b/i.test(section.markdown)) add("image assets cannot enter a text-only source pilot draft");
    if (section.slug !== "detailed-provenance" && metadata.evidence.some((e) => section.markdown.includes(e.excerpt))) add("original source wording belongs only in provenance, not student-facing sections");
  }
  if (metadata.curriculum_mapping === "prerequisite_candidate_pending_alignment"
    && JSON.stringify(document.grade_range) !== '["prerequisite"]') add("unmapped source grade cannot become a Thai curriculum grade");
  if (metadata.curriculum_mapping === "ipst_m4_introductory_logic_candidate"
    && !refs?.some((ref) => ref.source_id === "ipst-upper-secondary-math" && ref.usage === "curriculum_alignment_only" && ref.locator?.includes("proj14.ipst.ac.th/m4-6-math-basic/m4-math-basic/"))) add("M.4 mapping requires separate IPST alignment evidence");
  return issues;
}

export function generateSourcePilot(root: string, pilot: string): { draftPath: string; evidence: Evidence[] } {
  const mathematics = pilot === "mathematics-g10";
  if (!mathematics && pilot !== "open-logic") throw new Error("Pilot must be mathematics-g10 or open-logic");
  const state = validateSourceProcessing(root, loadSourceRegistry(root));
  if (!state.valid) throw new Error(state.issues.map((issue) => issue.message).join("; "));
  const artifactId = mathematics ? "siyavula-mathematics-g10-en-unbranded-pilot" : "open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107";
  const artifact = state.manifest!.artifacts.find((a) => a.artifact_id === artifactId);
  if (!artifact) throw new Error(`Acquire the pilot first: ${artifactId}`);
  const directory = `normalized/${artifact.source_id}/${artifactId}`;
  const records = readdirSync(join(root, directory)).filter((name) => name.endsWith(".json")).sort().map((name) => {
    const path = `${directory}/${name}`;
    const bytes = readFileSync(join(root, path));
    return { path, sha256: calculateSha256(bytes), unit: JSON.parse(bytes.toString("utf8")) as NormalizedUnit };
  });
  const selections = mathematics ? [
    { title: "Method for solving linear equations", excerpt: "An equation must always be balanced, whatever you do to the left-hand side, you must also do to the right-hand side." },
    { title: "Method for solving linear equations", excerpt: "6. Check the answer by substituting the solution back into the original equation." },
  ] : [
    { title: "Introduction", excerpt: "Propositional logic deals with !!{formula}s that are built from" },
    { title: "valuation and Satisfaction", excerpt: String.raw`\pValue{v}(\lnot !A) & = \begin{cases}
        \True & \text{if } \pValue{v}(!A) = \False;\\
        \False & \text{otherwise.}
      \end{cases}` },
  ];
  const evidence: Evidence[] = selections.map((s) => {
    const r = records.find((r) => r.unit.title === s.title && r.unit.content.includes(s.excerpt));
    if (!r) throw new Error(`Pilot source selection missing: ${s.title}`);
    return { normalized_unit: r.path, normalized_sha256: r.sha256, source_id: artifact.source_id,
      artifact_id: artifactId, artifact_sha256: artifact.sha256, source_document: r.unit.locator.document!,
      chapter: r.unit.locator.chapter, section: r.unit.locator.section, excerpt: s.excerpt };
  });
  const id = mathematics ? "mathematics.algebra.linear-equations.balance-preserving-operations" : "mathematics.foundations.logic.negation";
  const draftPath = mathematics ? "curation/drafts/mathematics/linear-equations/balance-preserving-operations.md" : "curation/drafts/mathematics/logic/negation.md";
  const metadata = {
    id, schema_version: "1.0", status: "draft", subject: "mathematics",
    grade_range: mathematics ? ["prerequisite"] : ["m4"],
    curriculum_track: mathematics ? "prerequisite" : "basic",
    curriculum_role: mathematics ? "prerequisite" : "enrichment",
    domain: mathematics ? "algebra" : "foundations", topic: mathematics ? "linear-equations" : "mathematical-logic",
    subtopic: mathematics ? "balance-preserving-operations" : "negation", content_type: "concept", difficulty: "foundational",
    title_th: mathematics ? "การรักษาสมดุลของสมการ" : "นิเสธของประพจน์",
    title_en: mathematics ? "Balance-preserving Equation Operations" : "Negation of a Proposition",
    language: "th", prerequisites: [],
    learning_objectives: mathematics ? ["อธิบายการดำเนินการเดียวกันทั้งสองข้างโดยรักษาเซตคำตอบ", "ตรวจคำตอบโดยแทนค่ากลับในสมการเดิม"] : ["สร้างนิเสธของประพจน์และหาค่าความจริงได้"],
    formula_ids: [mathematics ? "equation-addition-equivalence" : "logical-negation"],
    source_refs: [...evidence.map((e) => ({ source_id: e.source_id, locator: locator(e), usage: "content_source" })),
      ...(!mathematics ? [{ source_id: "ipst-upper-secondary-math", locator: "https://proj14.ipst.ac.th/m4-6-math-basic/m4-math-basic/ :: บทที่ 2 ตรรกศาสตร์เบื้องต้น (candidate topic alignment only)", usage: "curriculum_alignment_only" }] : [])],
    review: { content_status: "draft", math_physics_reviewed: false, language_reviewed: false }, version: "0.1.0",
    source_pilot: { schema_version: "1.0", authorship: "learnlyai", example_origin: "independently_authored_not_source_transcription",
      equation_image_policy: "excluded_pending_human_verification", curriculum_mapping: mathematics ? "prerequisite_candidate_pending_alignment" : "ipst_m4_introductory_logic_candidate", evidence },
  };
  const content = mathematics ? String.raw`
# Concept

การแก้สมการควรรักษาเซตคำตอบเดิม โดยทำการดำเนินการที่ย้อนกลับได้เหมือนกันทั้งสองข้าง

# Intuition

มองสมการเป็นตาชั่งที่สมดุล ถ้าเพิ่มหรือลดน้ำหนักเท่ากันทั้งสองฝั่ง ตาชั่งยังสมดุลอยู่

# Formal definition

สมการที่สมมูลกันมีเซตคำตอบเดียวกัน การบวกหรือลบจำนวนเดียวกันทั้งสองข้าง และการคูณหรือหารด้วยค่าคงตัวที่ไม่เป็นศูนย์ เป็นการแปลงที่ย้อนกลับได้

# Formula

ตัวแปรเป็นจำนวนจริง สูตรต่อไปนี้ LearnlyAI เขียนใหม่ ไม่ใช่ transcription ของภาพสมการ:

\[
a=b \iff a+c=b+c
\]

# Variables and units

ตัวแปร a, b, c แทนจำนวนจริง ไม่มีหน่วยกายภาพในตัวอย่างเชิงพีชคณิตนี้

| Symbol | Meaning | Unit |
|---|---|---|
| a | จำนวนจริงทางซ้าย | ไม่มีหน่วย (จำนวนจริง) |
| b | จำนวนจริงทางขวา | ไม่มีหน่วย (จำนวนจริง) |
| c | จำนวนจริงที่บวกทั้งสองข้าง | ไม่มีหน่วย (จำนวนจริง) |

# Conditions and limitations

ห้ามหารด้วยศูนย์ การคูณด้วยศูนย์ทำให้ข้อมูลคำตอบสูญหาย และการหารด้วยนิพจน์ที่มีตัวแปรอาจทำให้คำตอบบางค่าหายไป สมการเชิงเส้นแบบ ax+b=0 มีคำตอบเดียวเมื่อ a ไม่เป็นศูนย์; ถ้า a=0 ต้องพิจารณาว่า b เป็นศูนย์หรือไม่

# Worked example

ตัวอย่างต่อไปนี้ LearnlyAI แต่งขึ้นเอง ไม่คัดลอกจาก worked example ใน EPUB

## Problem

แก้สมการ \(2x+3=11\) เมื่อ x เป็นจำนวนจริง

## Solution

ลบ 3 ทั้งสองข้าง ได้ \(2x=8\) แล้วหารด้วย 2 ซึ่งไม่เป็นศูนย์ ได้ \(x=4\)

## Checked answer

\(x=4\) ไม่มีหน่วยกายภาพ เพราะโจทย์กำหนดเป็นจำนวนจริง ตรวจกลับ: \(2(4)+3=11\)

# Sanity check

แทนคำตอบลงในสมการก่อนแปลงและตรวจว่าค่าทั้งสองข้างเท่ากันจริง

# Common mistakes

- เปลี่ยนเพียงข้างเดียว หรือจำการย้ายข้างโดยไม่เข้าใจ inverse operation
- หารด้วยศูนย์หรือหารด้วยตัวแปรโดยไม่ตรวจเงื่อนไข
- ไม่แทนค่ากลับในสมการเดิม

# Retrieval summary

ร่างคำอธิบายการรักษาสมดุลสมการ การดำเนินการย้อนกลับได้ และการตรวจคำตอบด้วยการแทนค่า ยังไม่ใช่เอกสาร production และยังไม่ยืนยันชั้นเรียนไทย
` : String.raw`
# Concept

นิเสธของประพจน์เป็นประพจน์ใหม่ที่มีค่าความจริงตรงข้ามกับประพจน์เดิม

# Intuition

ถามว่าข้อความเดิม “ไม่เป็นจริง” หรือไม่ อย่าสับสนกับการเลือกข้อความที่ฟังดูตรงข้ามแต่ยังไม่ครอบคลุมทุกกรณี

# Formal definition

ถ้า p เป็นจริง นิเสธของ p เป็นเท็จ และถ้า p เป็นเท็จ นิเสธของ p เป็นจริง ภายใต้ตรรกศาสตร์คลาสสิกสองค่าความจริง

# Formula

สัญลักษณ์ LearnlyAI ใช้มาตรฐาน LaTeX แทน macro ของต้นฉบับ โดยยังต้องให้มนุษย์ตรวจความถูกต้อง:

\[
\neg p
\]

# Variables and units

p แทนประพจน์ ไม่ใช่จำนวนวัด จึงไม่มีหน่วยกายภาพ

| Symbol | Meaning | Unit |
|---|---|---|
| p | ประพจน์ | ไม่มีหน่วย (ค่าความจริง) |

# Conditions and limitations

ใช้กับข้อความที่เป็นประพจน์และมีค่าความจริงหนึ่งค่า ไม่ใช้กับคำสั่ง คำถาม หรือข้อความกำกวม ตารางนี้เป็นตรรกศาสตร์คลาสสิก ไม่ได้สรุปตรรกศาสตร์หลายค่าหรือ intuitionistic logic

| p | นิเสธของ p |
|---|---|
| T | F |
| F | T |

# Worked example

ตัวอย่างนี้ LearnlyAI เขียนใหม่ ไม่ได้คัดลอกโจทย์ต้นฉบับ

## Problem

ให้ p เป็น “7 เป็นจำนวนคู่” จงเขียนนิเสธและหาค่าความจริง

## Solution

ข้อความ p เป็นเท็จ นิเสธคือ “7 ไม่เป็นจำนวนคู่” จึงเป็นจริง

## Checked answer

นิเสธเป็นจริง; ค่าความจริงไม่มีหน่วยกายภาพ

# Sanity check

ค่าความจริงของประพจน์และนิเสธต้องต่างกัน ตรวจคำว่า “ไม่” ว่าปฏิเสธข้อความทั้งหมด ไม่เปลี่ยนความหมายบางส่วน

# Common mistakes

- ปฏิเสธแค่บางส่วนของข้อความ หรือใช้กับข้อความที่ไม่เป็นประพจน์
- สับสนค่าความจริงของ p กับค่าความจริงของนิเสธ
- ลืมว่ากรอบสองค่าความจริงเป็นเงื่อนไขของตารางนี้

# Retrieval summary

ร่างคำอธิบายนิเสธของประพจน์ พร้อมตารางสองค่าความจริงและตัวอย่างที่ LearnlyAI เขียนใหม่ Mapping เป็น candidate ของตรรกศาสตร์เบื้องต้น ม.4 ไม่ใช่การรับรองมาตรฐานหรือตัวชี้วัด
`;
  const provenance = `\n# Detailed provenance\n\nThai explanation and worked example: independently authored by LearnlyAI; no OCR, no image transcription, no automatic review. Source excerpts below are evidence/context only.\n\nArtifact SHA-256: ${artifact.sha256}. License: ${artifact.license}; see acquisition/source-pilot-licenses.json for artifact-specific evidence and upstream exceptions.\n\n${evidence.map((e) => `- ${locator(e)}\n  Normalized: ${e.normalized_unit} (SHA-256 ${e.normalized_sha256})\n\n\`\`\`text\n${e.excerpt}\n\`\`\`\n`).join("\n")}\n${mathematics ? "All source equation images remain excluded pending human verification. The source claims at most one solution without stating the nonzero leading coefficient; this draft states that condition explicitly. Thai grade alignment is pending. The existing review UI supports Physical Sciences Grade 11 only." : "Raw LaTeX retains !! tokens, \\iftag branches, and \\pValue macros without execution or expansion. This is a simplified candidate, not a translation of an entire university-level section. IPST Project 14 establishes the M.4 introductory logic topic only; exact learning-indicator alignment remains pending."}\n`;
  const markdown = `---\n${stringify(metadata)}---\n${content}${provenance}`;
  const canonical = toCanonicalKnowledgeDocument(parseKnowledgeMarkdown(markdown));
  const issues = [
    ...validateCanonicalDocument(canonical, compileJsonSchema(join(root, "schemas/knowledge.schema.json")), loadSourceRegistry(root), draftPath),
    ...validateSourcePilot(root, canonical, draftPath),
  ];
  if (issues.length) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
  mkdirSync(dirname(join(root, draftPath)), { recursive: true });
  writeFileSync(join(root, draftPath), markdown, { flag: "wx" }); // Never overwrite manual edits/review metadata.
  return { draftPath, evidence };
}
