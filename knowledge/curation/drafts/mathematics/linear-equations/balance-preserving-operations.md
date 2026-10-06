---
id: mathematics.algebra.linear-equations.balance-preserving-operations
schema_version: "1.0"
status: draft
subject: mathematics
grade_range:
  - prerequisite
curriculum_track: prerequisite
curriculum_role: prerequisite
domain: algebra
topic: linear-equations
subtopic: balance-preserving-operations
content_type: concept
difficulty: foundational
title_th: การรักษาสมดุลของสมการ
title_en: Balance-preserving Equation Operations
language: th
prerequisites: []
learning_objectives:
  - อธิบายการดำเนินการเดียวกันทั้งสองข้างโดยรักษาเซตคำตอบ
  - ตรวจคำตอบโดยแทนค่ากลับในสมการเดิม
formula_ids:
  - equation-addition-equivalence
source_refs:
  - source_id: siyavula-mathematics-g10-g12-ccby
    locator: "siyavula-mathematics-g10-en-unbranded-pilot ::
      OPS/xhtml/maths10/04-equations-and-inequalities-01.cnxmlplus.html ::
      Chapter 4: Equations and inequalities :: 4.2 Solving linear equations >
      Method for solving linear equations"
    usage: content_source
  - source_id: siyavula-mathematics-g10-g12-ccby
    locator: "siyavula-mathematics-g10-en-unbranded-pilot ::
      OPS/xhtml/maths10/04-equations-and-inequalities-01.cnxmlplus.html ::
      Chapter 4: Equations and inequalities :: 4.2 Solving linear equations >
      Method for solving linear equations"
    usage: content_source
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
  curriculum_mapping: prerequisite_candidate_pending_alignment
  evidence:
    - normalized_unit: normalized/siyavula-mathematics-g10-g12-ccby/siyavula-mathematics-g10-en-unbranded-pilot/00002.json
      normalized_sha256: 7c356196e76c3579b53fca5340c7c43da629eba7f8ab5fec5e173c249c1585df
      source_id: siyavula-mathematics-g10-g12-ccby
      artifact_id: siyavula-mathematics-g10-en-unbranded-pilot
      artifact_sha256: 881f0968936e797a6f0fa4df305b92641c52add3812871ae39a791c2ee1e4a99
      source_document: OPS/xhtml/maths10/04-equations-and-inequalities-01.cnxmlplus.html
      chapter: "Chapter 4: Equations and inequalities"
      section: 4.2 Solving linear equations > Method for solving linear equations
      excerpt: An equation must always be balanced, whatever you do to the left-hand
        side, you must also do to the right-hand side.
    - normalized_unit: normalized/siyavula-mathematics-g10-g12-ccby/siyavula-mathematics-g10-en-unbranded-pilot/00002.json
      normalized_sha256: 7c356196e76c3579b53fca5340c7c43da629eba7f8ab5fec5e173c249c1585df
      source_id: siyavula-mathematics-g10-g12-ccby
      artifact_id: siyavula-mathematics-g10-en-unbranded-pilot
      artifact_sha256: 881f0968936e797a6f0fa4df305b92641c52add3812871ae39a791c2ee1e4a99
      source_document: OPS/xhtml/maths10/04-equations-and-inequalities-01.cnxmlplus.html
      chapter: "Chapter 4: Equations and inequalities"
      section: 4.2 Solving linear equations > Method for solving linear equations
      excerpt: 6. Check the answer by substituting the solution back into the original
        equation.
---

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

# Detailed provenance

Thai explanation and worked example: independently authored by LearnlyAI; no OCR, no image transcription, no automatic review. Source excerpts below are evidence/context only.

Artifact SHA-256: 881f0968936e797a6f0fa4df305b92641c52add3812871ae39a791c2ee1e4a99. License: CC BY 4.0 for the verified Grade 10 English unbranded EPUB; see acquisition/source-pilot-licenses.json for artifact-specific evidence and upstream exceptions.

- siyavula-mathematics-g10-en-unbranded-pilot :: OPS/xhtml/maths10/04-equations-and-inequalities-01.cnxmlplus.html :: Chapter 4: Equations and inequalities :: 4.2 Solving linear equations > Method for solving linear equations
  Normalized: normalized/siyavula-mathematics-g10-g12-ccby/siyavula-mathematics-g10-en-unbranded-pilot/00002.json (SHA-256 7c356196e76c3579b53fca5340c7c43da629eba7f8ab5fec5e173c249c1585df)

```text
An equation must always be balanced, whatever you do to the left-hand side, you must also do to the right-hand side.
```

- siyavula-mathematics-g10-en-unbranded-pilot :: OPS/xhtml/maths10/04-equations-and-inequalities-01.cnxmlplus.html :: Chapter 4: Equations and inequalities :: 4.2 Solving linear equations > Method for solving linear equations
  Normalized: normalized/siyavula-mathematics-g10-g12-ccby/siyavula-mathematics-g10-en-unbranded-pilot/00002.json (SHA-256 7c356196e76c3579b53fca5340c7c43da629eba7f8ab5fec5e173c249c1585df)

```text
6. Check the answer by substituting the solution back into the original equation.
```

All source equation images remain excluded pending human verification. The source claims at most one solution without stating the nonzero leading coefficient; this draft states that condition explicitly. Thai grade alignment is pending. The existing review UI supports Physical Sciences Grade 11 only.
