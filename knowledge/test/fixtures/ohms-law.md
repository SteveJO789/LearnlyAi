---
id: physics.electricity.electric-circuits.ohms-law
schema_version: 1.0
status: reviewed
review:
  content_status: reviewed
  math_physics_reviewed: true
  language_reviewed: true
  reviewer: "Steve"
  reviewed_at: "2026-09-29"
subject: physics
grade_range: [m5]
curriculum_track: additional
curriculum_role: required
curriculum: thai-basic-education-2551-revised-2560
domain: electricity
topic: electric-circuits
subtopic: ohms-law
content_type: concept
difficulty: core
title_th: "กฎของโอห์ม"
title_en: "Ohm's Law"
language: th
prerequisites:
  - physics.electricity.current
  - physics.electricity.potential-difference
  - physics.electricity.resistance
learning_objectives:
  - "อธิบายความสัมพันธ์ระหว่างความต่างศักย์ กระแส และความต้านทานได้"
  - "ใช้ V = IR เพื่อคำนวณตัวแปรที่ไม่ทราบค่าได้เมื่อเงื่อนไขเหมาะสม"
formula_ids:
  - formula.ohms-law
source_refs:
  - source_id: siyavula-physical-sciences-g10-g12-ccby
    usage: content_source
  - source_id: ipst-upper-secondary-physics
    usage: curriculum_alignment_only
interactive_resources:
  - provider: "PhET Interactive Simulations"
    activity: "Circuit Construction Kit"
    purpose: "ทดลองผลของการเปลี่ยนแรงดันและความต้านทานต่อกระแส"
    ingestion: false
version: 0.1.0
---

# Concept

กฎของโอห์มอธิบายความสัมพันธ์ระหว่างความต่างศักย์ไฟฟ้า \(V\) กระแสไฟฟ้า \(I\) และความต้านทาน \(R\)

# Formula

\[
V = IR
\]

# Variables and Units

| Symbol | Meaning | SI unit |
|---|---|---|
| V | ความต่างศักย์ไฟฟ้า | volt (V) |
| I | กระแสไฟฟ้า | ampere (A) |
| R | ความต้านทาน | ohm (Ω) |

# Conditions and Limitations

ใช้ความสัมพันธ์นี้กับอุปกรณ์หรือช่วงการทำงานที่ความสัมพันธ์ระหว่าง \(V\) และ \(I\) เป็นเชิงเส้นและความต้านทานสามารถถือว่าคงที่ได้

# Worked Example

## Problem

ตัวต้านทาน \(4\,\Omega\) ต่อกับแหล่งจ่าย \(12\,V\)

## Solution

\[
I = \frac{V}{R}
\]

\[
I = \frac{12}{4} = 3\,A
\]

## Checked Answer

\(I = 3\,A\)

# Sanity Check

เมื่อแรงดันคงเดิม ถ้าความต้านทานเพิ่ม กระแสควรลดลง ซึ่งสอดคล้องกับ \(I = V/R\)

# Common Mistakes

- ไม่แปลง mA เป็น A ก่อนคำนวณ
- สับสนหน่วย V, A และ Ω
- ใช้ V = IR โดยไม่ตรวจว่าอุปกรณ์อยู่ในช่วงที่สามารถประมาณเป็น ohmic ได้

# Retrieval Summary

ใช้สำหรับคำถามเกี่ยวกับ V = IR, ความสัมพันธ์ V-I-R, ผลของการเพิ่มหรือลดความต้านทาน และการคำนวณวงจร DC เบื้องต้น
