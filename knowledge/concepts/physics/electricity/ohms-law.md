---
id: physics.electricity.electric-circuits.ohms-law
schema_version: "1.0"
status: reviewed
review:
  content_status: reviewed
  math_physics_reviewed: true
  language_reviewed: true
  reviewer: Steve
  reviewed_at: 2026-10-01
subject: physics
grade_range:
  - m5
curriculum_track: additional
curriculum_role: required
curriculum: thai-basic-education-2551-revised-2560
domain: electricity
topic: electric-circuits
subtopic: ohms-law
content_type: concept
difficulty: core
title_th: กฎของโอห์ม
title_en: Ohm's Law
language: th
prerequisites:
  - physics.electricity.current
  - physics.electricity.potential-difference
  - physics.electricity.resistance
learning_objectives:
  - อธิบายความสัมพันธ์ระหว่างความต่างศักย์ กระแส และความต้านทานเมื่ออุณหภูมิคงที่
  - ใช้กฎของโอห์มโดยตรวจเงื่อนไขและหน่วยของปริมาณ
formula_ids:
  - formula.ohms-law
version: 0.2.0
source_refs:
  - source_id: siyavula-physical-sciences-g10-g12-ccby
    usage: content_source
    locator: "siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 ::
      OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11:
      Electric circuits :: 11.2 Ohm's Law"
  - source_id: siyavula-physical-sciences-g10-g12-ccby
    usage: content_source
    locator: "siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 ::
      OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11:
      Electric circuits :: 11.2 Ohm's Law"
  - source_id: siyavula-physical-sciences-g10-g12-ccby
    usage: content_source
    locator: "siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 ::
      OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11:
      Electric circuits :: 11.2 Ohm's Law > Using Ohm's Law > Worked example 1:
      Ohm's Law"
  - source_id: siyavula-physical-sciences-g10-g12-ccby
    usage: content_source
    locator: "siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 ::
      OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11:
      Electric circuits :: 11.2 Ohm's Law > Using Ohm's Law > Worked example 1:
      Ohm's Law"
  - source_id: siyavula-physical-sciences-g10-g12-ccby
    usage: content_source
    locator: "siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 ::
      OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11:
      Electric circuits :: 11.2 Ohm's Law > Using Ohm's Law > Worked example 1:
      Ohm's Law > Determine how to approach the problem"
  - source_id: siyavula-physical-sciences-g10-g12-ccby
    usage: content_source
    locator: "siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 ::
      OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11:
      Electric circuits :: 11.2 Ohm's Law > Using Ohm's Law > Worked example 1:
      Ohm's Law > Solve the problem"
curation:
  concept_id: physics.electricity.electric-circuits.ohms-law
  authorship: learnlyai
  input_sha256: c96d940a806945f7f8b0640835d5758f473e188f87ac364f7b9300931bac1cb5
  formula_asset_id: ohms-law-formula
  selections:
    - selection_id: definition
      kind: definition
      normalized_unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00740.json
      source_id: siyavula-physical-sciences-g10-g12-ccby
      artifact_id: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5
      source_document: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html
      locator:
        chapter: "Chapter 11: Electric circuits"
        section: 11.2 Ohm's Law
      asset_ids: []
    - selection_id: formula
      kind: equation
      normalized_unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00740.json
      source_id: siyavula-physical-sciences-g10-g12-ccby
      artifact_id: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5
      source_document: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html
      locator:
        chapter: "Chapter 11: Electric circuits"
        section: 11.2 Ohm's Law
      asset_ids:
        - ohms-law-formula
    - selection_id: example-diagram
      kind: diagram
      normalized_unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00755.json
      source_id: siyavula-physical-sciences-g10-g12-ccby
      artifact_id: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5
      source_document: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html
      locator:
        chapter: "Chapter 11: Electric circuits"
        section: "11.2 Ohm's Law > Using Ohm's Law > Worked example 1: Ohm's Law"
      asset_ids:
        - ohms-example-diagram
    - selection_id: example-problem
      kind: worked_example
      normalized_unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00755.json
      source_id: siyavula-physical-sciences-g10-g12-ccby
      artifact_id: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5
      source_document: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html
      locator:
        chapter: "Chapter 11: Electric circuits"
        section: "11.2 Ohm's Law > Using Ohm's Law > Worked example 1: Ohm's Law"
      asset_ids:
        - ohms-example-diagram
        - ohms-example-resistance-part-1
        - ohms-example-resistance-part-2
        - ohms-example-current-part-1
        - ohms-example-current-part-2
    - selection_id: example-approach
      kind: worked_example
      normalized_unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00756.json
      source_id: siyavula-physical-sciences-g10-g12-ccby
      artifact_id: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5
      source_document: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html
      locator:
        chapter: "Chapter 11: Electric circuits"
        section: "11.2 Ohm's Law > Using Ohm's Law > Worked example 1: Ohm's Law >
          Determine how to approach the problem"
      asset_ids:
        - ohms-example-approach
    - selection_id: example-solution
      kind: worked_example
      normalized_unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00757.json
      source_id: siyavula-physical-sciences-g10-g12-ccby
      artifact_id: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5
      source_document: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html
      locator:
        chapter: "Chapter 11: Electric circuits"
        section: "11.2 Ohm's Law > Using Ohm's Law > Worked example 1: Ohm's Law > Solve
          the problem"
      asset_ids:
        - ohms-solution-quantity-1
        - ohms-solution-quantity-2
        - ohms-solution-quantity-3
        - ohms-example-solution
  asset_snapshots:
    - asset_id: ohms-law-formula
      sha256: 20e7a46f237f8cb0d0f13dc17f672077dcd4364f64dd141763995f2c9e53585d
    - asset_id: ohms-example-diagram
      sha256: 8b1192f37bf864c47c64081e8358d34b918bb065c1a2a85e67df0262de823f0f
    - asset_id: ohms-example-resistance-part-1
      sha256: e6530ad760fffb96631723d29621453f43fda398ec1e79b76364b5cb76c662bb
    - asset_id: ohms-example-resistance-part-2
      sha256: 3b88720229cede1f5bb82b8403ef2c2f6b2d4cdb8069d588fe0f7d20003b2646
    - asset_id: ohms-example-current-part-1
      sha256: 9ee2d3d803a584d5d1b0cde39c3d66a7269081906489e1d4b2d6fadca07076af
    - asset_id: ohms-example-current-part-2
      sha256: 69a47b64f76ef20940a743150dc336cfd1d853f7cafd05b510aa481d5b019259
    - asset_id: ohms-example-approach
      sha256: 3c3afce6efaf564d94a6d84c80cd5a4cb10abc45183a774d09b34daf2e705783
    - asset_id: ohms-solution-quantity-1
      sha256: 248fe23cad362319a4dfa9cb5223eeed0161d3fc7719f3a01a6169b07c70ecaa
    - asset_id: ohms-solution-quantity-2
      sha256: 4d8786e161bb1aee561fc0d62732b82ccbfb54cc333ac387c1a5ae2bb6012c11
    - asset_id: ohms-solution-quantity-3
      sha256: c5f8d2c4646b0f54e41d8a256f7ef20cb527920ddc3740239dd7d0a3af54e678
    - asset_id: ohms-example-solution
      sha256: 080120e3602ea13c49b63a7bdcf7081498a455ff830e334a8a9be442d9733f3b
  answer:
    value: 40
    unit: V
    quantity: potential_difference
    unit_required: true
    asset_id: ohms-example-solution
---

# Concept

กฎของโอห์มเชื่อมโยงความต่างศักย์ไฟฟ้า กระแสไฟฟ้า และความต้านทานของตัวนำที่มีพฤติกรรมโอห์มมิก

# Intuition

เมื่อความต้านทานคงที่ การเพิ่มความต่างศักย์ทำให้กระแสเพิ่มตามสัดส่วน หากความต่างศักย์เท่าเดิมแต่ความต้านทานเพิ่ม กระแสจะลดลง

# Formal Definition

สำหรับตัวนำโอห์มมิกที่อุณหภูมิและสภาพทางกายภาพคงที่ กระแสไฟฟ้าแปรผันตรงกับความต่างศักย์ระหว่างปลายตัวนำ อัตราส่วนความต่างศักย์ต่อกระแสจึงคงที่และเรียกว่าความต้านทาน

# Formula

\[
I = \frac{V}{R}
\]

# Variables and Units

| Symbol | Meaning | SI unit |
|---|---|---|
| V | ความต่างศักย์ไฟฟ้า | volt (V) |
| I | กระแสไฟฟ้า | ampere (A) |
| R | ความต้านทาน | ohm (Ω) |

# Conditions and Limitations

ตรวจว่าอุปกรณ์อยู่ในช่วงโอห์มมิกและอุณหภูมิไม่เปลี่ยนอย่างมีนัยสำคัญ ใช้ค่าความต่างศักย์และกระแสของอุปกรณ์เดียวกัน ไม่ใช้ความต้านทานคงที่กับอุปกรณ์ทุกชนิดโดยอัตโนมัติ

# Worked Example

## Problem

พิจารณาตัวต้านทานในวงจรที่ระบุต้นฉบับไว้ในส่วน Detailed Provenance

ตัวต้านทานมีค่า 10 Ohm และกระแสที่ผ่านตัวต้านทานมีค่า 4 ampere จงหาความต่างศักย์ระหว่างปลายตัวต้านทาน

## Solution

เลือกความสัมพันธ์ที่ผ่านการตรวจจากต้นฉบับแล้ว

\[
R = \frac{V}{I}
\]

แทนค่าความต้านทานและกระแส พร้อมตรวจหน่วยทุกขั้น

\[
R = \frac{V}{I} , RI = \frac{V}{I} I , V = IR, R = 10\,\Omega , I = 4\,\mathrm{A} , V = 40\,\mathrm{V}
\]

## Checked Answer

\(V = 40\,\mathrm{V}\)

# Sanity Check

ตรวจหน่วยของคำตอบและแทนค่ากลับในความสัมพันธ์ที่ตรวจแล้ว เมื่อความต้านทานเท่าเดิม ความต่างศักย์ที่มากขึ้นควรให้กระแสมากขึ้น

# Common Mistakes

- ใช้กระแสหน่วยมิลลิแอมแปร์ร่วมกับหน่วยเอสไอโดยไม่แปลง
- นำความต่างศักย์กับกระแสจากคนละส่วนของวงจรมาใช้ร่วมกัน
- ถือว่าความต้านทานคงที่แม้อุณหภูมิหรือช่วงการทำงานเปลี่ยน

# Retrieval Summary

แนวคิดกฎของโอห์มสำหรับความสัมพันธ์ระหว่างความต่างศักย์ กระแส และความต้านทาน รวมถึงเงื่อนไขโอห์มมิก หน่วยเอสไอ และการตรวจคำตอบของวงจรไฟฟ้ากระแสตรงเบื้องต้น

# Detailed Provenance

- definition: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 :: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11: Electric circuits :: 11.2 Ohm's Law
  Normalized unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00740.json
- equation: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 :: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11: Electric circuits :: 11.2 Ohm's Law
  Normalized unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00740.json
- diagram: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 :: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11: Electric circuits :: 11.2 Ohm's Law > Using Ohm's Law > Worked example 1: Ohm's Law
  Normalized unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00755.json
- worked_example: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 :: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11: Electric circuits :: 11.2 Ohm's Law > Using Ohm's Law > Worked example 1: Ohm's Law
  Normalized unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00755.json
- worked_example: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 :: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11: Electric circuits :: 11.2 Ohm's Law > Using Ohm's Law > Worked example 1: Ohm's Law > Determine how to approach the problem
  Normalized unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00756.json
- worked_example: siyavula-physical-sciences-g11-en-ccby-3d893a4364f5 :: OPS/xhtml/science11/11-electric-circuits-01.cnxmlplus.html :: Chapter 11: Electric circuits :: 11.2 Ohm's Law > Using Ohm's Law > Worked example 1: Ohm's Law > Solve the problem
  Normalized unit: normalized/siyavula-physical-sciences-g10-g12-ccby/siyavula-physical-sciences-g11-en-ccby-3d893a4364f5/00757.json

- Asset ohms-law-formula: OPS/xhtml/science11/equation/958d8685992c1e383de8f53c8407b72d.png; verified by Steve on 2026-10-01
- Asset ohms-example-diagram: OPS/xhtml/science11/pspicture/115f62b5cb3bc58df40566ac68b62ca5.png; verified by Steve on 2026-10-01
- Asset ohms-example-resistance-part-1: OPS/xhtml/science11/equation/8649b53cb58ca3be9d670ff659b49286.png; verified by Steve on 2026-10-01
- Asset ohms-example-resistance-part-2: OPS/xhtml/science11/equation/14779726770d4163b02b70dd770c4b29.png; verified by Steve on 2026-10-01
- Asset ohms-example-current-part-1: OPS/xhtml/science11/equation/74e86883bef0e0d41fcfaefc9fa34aa1.png; verified by Steve on 2026-10-01
- Asset ohms-example-current-part-2: OPS/xhtml/science11/equation/0fabba31c8038dc23878966c759da49b.png; verified by Steve on 2026-10-01
- Asset ohms-example-approach: OPS/xhtml/science11/equation/9b2ed768b617f67e1221233cac9b8d1d.png; verified by Steve on 2026-10-01
- Asset ohms-solution-quantity-1: OPS/xhtml/science11/equation/e1e1d3d40573127e9ee0480caf1283d6.png; verified by Steve on 2026-10-01
- Asset ohms-solution-quantity-2: OPS/xhtml/science11/equation/dd7536794b63bf90eccfd37f9b147d7f.png; verified by Steve on 2026-10-01
- Asset ohms-solution-quantity-3: OPS/xhtml/science11/equation/5206560a306a2e085a437fd258eb57ce.png; verified by Steve on 2026-10-01
- Asset ohms-example-solution: OPS/xhtml/science11/equation/f4fc9c4b2019001565f443a461414bc2.png; verified by Steve on 2026-10-01

เนื้อหาสำหรับผู้เรียนเรียบเรียงโดย LearnlyAI ข้อมูลต้นฉบับใช้เป็นบริบทและหลักฐานอ้างอิง การตรวจภาพสมการไม่ใช่การอนุมัติเอกสารฉบับนี้

ประวัติการแก้ transcription ตามคำสั่งผู้ใช้: reviews/corrections/26e2cb969b81403be090de55cc3c25ccb70c9592d80a3c49cb0a96d6b9e8b35d-20261001T103533Z.json การอนุมัติระดับเอกสารอ้างอิงผู้ตรวจและวันที่ใน review metadata แยกจากการตรวจ asset
