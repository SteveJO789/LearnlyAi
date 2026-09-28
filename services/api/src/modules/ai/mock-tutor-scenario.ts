import type { ModelRequest } from "./providers/model-provider.js";
import type { TutorContext } from "./tutor-context.js";
import type { LearningBlock, TutorOutput } from "./tutor-output.js";

// Learning-specific scenario injected into the generic MockModelProvider.
// IDs come from the task; content is deterministic and uses no API or database.
export function mockTutorScenario(request: ModelRequest): TutorOutput {
  const task = JSON.parse(request.messages.at(-1)!.content) as TutorContext;
  const compactInput = task.studentInput.replace(/\s+/g, "").toLowerCase();
  let block: LearningBlock;
  switch (task.stage) {
    case "DIAGNOSE":
      block = { id: "blk_diagnose", type: "guided_question", content: "ถ้า x + 4 = 10 ค่า x เท่ากับเท่าไร?", expectedInput: "NUMBER" };
      break;
    case "PRACTICE":
    case "ASSESS":
      block = {
        id: `blk_${task.stage.toLowerCase()}`, type: "quiz", questionId: `q_${task.stage.toLowerCase()}`,
        prompt: task.stage === "PRACTICE" ? "ลองแก้สมการ 3x + 6 = 15" : "จงแก้สมการ 4x + 8 = 20 พร้อมอธิบายวิธีคิด",
        format: "NUMBER",
      };
      break;
    case "REVIEW":
      block = { id: "blk_review", type: "explanation", title: "Mock review", content: "ทบทวน: ใช้การดำเนินการเดียวกันทั้งสองข้างเพื่อแยกตัวแปร แล้วแทนค่ากลับเพื่อตรวจคำตอบ" };
      break;
    default:
      block = {
        id: "blk_explain", type: "explanation", title: "Mock explanation",
        content: ["2x+4=10", "แก้สมการ2x+4=10"].includes(compactInput)
          ? "เริ่มจาก 2x + 4 = 10 ลบ 4 ทั้งสองข้างได้ 2x = 6 แล้วหารทั้งสองข้างด้วย 2 ได้ x = 3 ตรวจคำตอบ: 2(3) + 4 = 10"
          : `ตัวอย่างคำตอบจาก mock สำหรับ: ${task.studentInput}\nแบ่งโจทย์เป็นขั้นตอนเล็ก ๆ และตรวจเหตุผลของแต่ละขั้นก่อนดำเนินการต่อ`,
      };
  }
  return {
    schemaVersion: "1.0", responseId: task.responseId, sessionId: task.sessionId,
    stage: task.outputStage, blocks: [block], progress: task.progress, citations: [],
  };
}
