---
id: mathematics.foundations.logic.implication
schema_version: 1.0
status: draft
subject: mathematics
grade_range: [m4]
curriculum_track: mixed
curriculum_role: required
curriculum: thai-basic-education-2551-revised-2560
domain: foundations
topic: mathematical-logic
subtopic: implication
content_type: concept
difficulty: core
title_th: "ประพจน์เงื่อนไข"
title_en: "Implication"
language: th
prerequisites:
  - mathematics.foundations.logic.statement-proposition
  - mathematics.foundations.logic.truth-value
learning_objectives:
  - "แปลความหมายของ p → q ได้"
  - "หาค่าความจริงของประพจน์เงื่อนไขจากค่าความจริงของ p และ q ได้"
source_refs:
  - source_id: open-logic-project
    usage: content_source
  - source_id: ipst-upper-secondary-math
    usage: curriculum_alignment_only
review:
  content_status: draft
  math_physics_reviewed: false
  language_reviewed: false
version: 0.1.0
---

# Concept

ประพจน์เงื่อนไขเขียนเป็น

\[
p \rightarrow q
\]

อ่านว่า “ถ้า p แล้ว q”

# Truth Condition

ประพจน์ \(p \rightarrow q\) เป็นเท็จเพียงกรณีเดียว คือเมื่อ \(p\) เป็นจริง แต่ \(q\) เป็นเท็จ

| p | q | p → q |
|---|---|---|
| T | T | T |
| T | F | F |
| F | T | T |
| F | F | T |

# Intuition

ข้อความ “ถ้า p แล้ว q” ให้คำมั่นไว้เฉพาะกรณีที่ p เกิดขึ้น ดังนั้นกรณีที่ p เป็นจริงแต่ q ไม่เกิดขึ้นจึงเป็นกรณีที่คำกล่าวนี้ผิด

# Common Mistakes

- คิดว่า p → q หมายถึง p และ q ต้องเป็นจริงพร้อมกัน
- สับสน implication กับ biconditional
- สับสน converse กับ contrapositive

# Retrieval Summary

ใช้ตอบคำถามเกี่ยวกับ if-then, p → q, ตารางค่าความจริง และเหตุผลที่ implication เป็นเท็จเฉพาะกรณี T → F
