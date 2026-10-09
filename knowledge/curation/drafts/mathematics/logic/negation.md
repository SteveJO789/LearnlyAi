---
id: mathematics.foundations.logic.negation
schema_version: "1.0"
status: draft
subject: mathematics
grade_range:
  - m4
curriculum_track: basic
curriculum_role: enrichment
domain: foundations
topic: mathematical-logic
subtopic: negation
content_type: concept
difficulty: foundational
title_th: นิเสธของประพจน์
title_en: Negation of a Proposition
language: th
prerequisites: []
learning_objectives:
  - สร้างนิเสธของประพจน์และหาค่าความจริงได้
formula_ids:
  - logical-negation
source_refs:
  - source_id: open-logic-project
    locator: "open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107 ::
      OpenLogic-1e960beff9ed7835bf3e3f1335e21af3439cd107/content/propositional-\
      logic/syntax-and-semantics/introduction.tex :: Syntax and Semantics ::
      Introduction"
    usage: content_source
  - source_id: open-logic-project
    locator: "open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107 ::
      OpenLogic-1e960beff9ed7835bf3e3f1335e21af3439cd107/content/propositional-\
      logic/syntax-and-semantics/valuations-sat.tex :: Syntax and Semantics ::
      valuation and Satisfaction"
    usage: content_source
  - source_id: ipst-upper-secondary-math
    locator: "https://proj14.ipst.ac.th/m4-6-math-basic/m4-math-basic/ :: บทที่ 2
      ตรรกศาสตร์เบื้องต้น (candidate topic alignment only)"
    usage: curriculum_alignment_only
review:
  content_status: draft
  math_physics_reviewed: false
  language_reviewed: false
version: 0.1.0
source_pilot:
  schema_version: "1.0"
  authorship: learnlyai
  example_origin: independently_authored_not_source_transcription
  equation_image_policy: excluded_pending_human_verification
  curriculum_mapping: ipst_m4_introductory_logic_candidate
  evidence:
    - normalized_unit: normalized/open-logic-project/open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107/00004.json
      normalized_sha256: 74db295e0f1097da3d769581fd65144bad2fb6fb94ac86166189468f493e0bf1
      source_id: open-logic-project
      artifact_id: open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107
      artifact_sha256: ac565ee57b35dda8ac043dcbbc10322b5b4002f12abcbc0b0c5c2ddbea426849
      source_document: OpenLogic-1e960beff9ed7835bf3e3f1335e21af3439cd107/content/propositional-logic/syntax-and-semantics/introduction.tex
      chapter: Syntax and Semantics
      section: Introduction
      excerpt: Propositional logic deals with !!{formula}s that are built from
    - normalized_unit: normalized/open-logic-project/open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107/00009.json
      normalized_sha256: c6cdd6c785d4d7d5fb823f70189652bbfe0a7078a74e4cc2659d182a4cb52260
      source_id: open-logic-project
      artifact_id: open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107
      artifact_sha256: ac565ee57b35dda8ac043dcbbc10322b5b4002f12abcbc0b0c5c2ddbea426849
      source_document: OpenLogic-1e960beff9ed7835bf3e3f1335e21af3439cd107/content/propositional-logic/syntax-and-semantics/valuations-sat.tex
      chapter: Syntax and Semantics
      section: valuation and Satisfaction
      excerpt: |-
        \pValue{v}(\lnot !A) & = \begin{cases}
                \True & \text{if } \pValue{v}(!A) = \False;\\
                \False & \text{otherwise.}
              \end{cases}
---

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

# Detailed provenance

Thai explanation and worked example: independently authored by LearnlyAI; no OCR, no image transcription, no automatic review. Source excerpts below are evidence/context only.

Artifact SHA-256: ac565ee57b35dda8ac043dcbbc10322b5b4002f12abcbc0b0c5c2ddbea426849. License: CC BY 4.0 unless otherwise noted; see acquisition/source-pilot-licenses.json for artifact-specific evidence and upstream exceptions.

- open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107 :: OpenLogic-1e960beff9ed7835bf3e3f1335e21af3439cd107/content/propositional-logic/syntax-and-semantics/introduction.tex :: Syntax and Semantics :: Introduction
  Normalized: normalized/open-logic-project/open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107/00004.json (SHA-256 74db295e0f1097da3d769581fd65144bad2fb6fb94ac86166189468f493e0bf1)

```text
Propositional logic deals with !!{formula}s that are built from
```

- open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107 :: OpenLogic-1e960beff9ed7835bf3e3f1335e21af3439cd107/content/propositional-logic/syntax-and-semantics/valuations-sat.tex :: Syntax and Semantics :: valuation and Satisfaction
  Normalized: normalized/open-logic-project/open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107/00009.json (SHA-256 c6cdd6c785d4d7d5fb823f70189652bbfe0a7078a74e4cc2659d182a4cb52260)

```text
\pValue{v}(\lnot !A) & = \begin{cases}
        \True & \text{if } \pValue{v}(!A) = \False;\\
        \False & \text{otherwise.}
      \end{cases}
```

Raw LaTeX retains !! tokens, \iftag branches, and \pValue macros without execution or expansion. This is a simplified candidate, not a translation of an entire university-level section. IPST Project 14 establishes the M.4 introductory logic topic only; exact learning-indicator alignment remains pending.
