# หลักฐานตรวจสอบ MVP

อัปเดต 2026-10-10: **กำลังทำ — ยังไม่ IMPLEMENTATION COMPLETE และยังไม่ RELEASED**

2026-10-11: protectedfileupload/list/resume/review/hash-verifieddownloadและCreate→editableconfirmation→PRE implementแล้ว Metadatareviewไม่เปลี่ยนoriginalextract/hashหรือtrustedstatus; unconfirmedbinaryไม่เข้าAI API303/303, frontend23/23/typecheck/Webbuild, simulatedpersistent11/11PASS ActualcanonicalreviewSQL/RLSclones+fresh95steps/178checksPASS/rollback ไม่มีliveAuthStorage/browser/deploymentproof [หลักฐาน](evidence/mvp-file-journey-verification.json)

ล่าสุดตัวอ่านไฟล์จริง: PDF.js text extraction, fullPNG/JPEG decode/CRC/inflatecaps/EXIFและtha+engTesseractOCR/workerabort ทำงานกับactualsyntheticfixtures **10/10** Actualnpmtest/build **API299/299**, simulatedpersistent11/11PASS Pinnedmodels/workersเตรียมในbuildแล้ว แต่fileendpoint/UI/actualAuthStoragejourneyและdeploymentmemory/sizeยังไม่verified [หลักฐาน](evidence/mvp-real-file-extraction-verification.json)

งาน follow-up อยู่ใน [Draft PR #78](https://github.com/SteveJO789/LearnlyAi/pull/78) เริ่มจาก develop `5022c28` และรวมงานล่าสุดของทีม `875575f` แล้ว งานเดิมใน primary checkout/stash ยังอยู่ครบ ไม่มี auto-merge PR หรือ force push หลักฐาน local/fixture ด้านล่างไม่เท่ากับระบบที่ deploy จริง

ล่าสุดหลังปลดnpm/ติดตั้งdependencies: actual `npm test` build/full API **289/289**, simulatedpersistent11/11 และmigrationintegrityPASS Canonical **076ce83** เพิ่มatomic FINALIZED + restrictive exact-PENDING Storage guard Actualclones47checks/metadata/replay/isolationcases และfresh4packages92steps/173checksPASS ทั้งหมดrollback ไม่มีproductionapply/actualStorageHTTPหรือrealPDF/OCR proof [หลักฐาน](evidence/mvp-storage-journal-gate-verification.json) Dependenciesพร้อมสำหรับimplementationแล้ว

ล่าสุด: เพิ่ม durable FileUpload ก่อนส่ง bytesและexplicit resume หลังตรวจ authenticated stored bytes/hash Cancellation commitก่อนdeleteและsaveรับexactPENDINGเพื่อกันresurrection/race API **288/288**, file/Storage **26/26**, simulated persistent11/11/compile/migrationintegrityPASS Canonicaltip **26370da**, actual empty-clone journal/RLS/FK/state checksและfresh3packages **89steps/167checksPASS**, rollbackหมด Production FileUploadยังไม่สร้าง ไม่มี real PDF/OCR/Storage/Auth→Prisma/endpoint/UI proof [หลักฐาน](evidence/mvp-durable-file-upload-verification.json)

ล่าสุดหลัง integration: API **278/278**, Web **20/20**/typecheck/production build PASS, Knowledge hotfix under Vercel-like parent env **4/4** และ fresh source-only API **278/278** + relocated runtime **4/4** PASS รักษา auth/brand/loading/mobile UI ของทีม CD เฉพาะ develop ไม่มี workflow diff GitHub deploy checks ของdevelop875575f ผ่าน Web/API แต่ไม่มี real runtime/browser smoke หรือ integration deployment [หลักฐาน](evidence/mvp-develop-integration-verification.json)

หลักฐานใหม่หลังรายงานฐานเดิม: API**272/272**/compile และpersistent simulated11/11 PASS Actual OpenRouter embeddings1536 + pgvectorTEMP query ผ่าน8regressioncasesหลังพบnative-model mismatch/role42501/falsepositive2casesและแก้จากหลักฐานจริง ปรับembeddinginputให้มีreviewed title/topicและexactinputhash Newembeddingrequests6calls รวมเดิม54calls reportedUS$0.02963331572/reservedUS$0.6515484 จากUS$1 ไม่มีbudgetreset/retry/fallback [รายละเอียดและlimits](evidence/mvp-live-embedding-verification.json) Canonicalpersistentindex/runtimeและPDF/OCRยังไม่ครบ

PrivateStorage milestoneเดิม: **API274/274**, integration11/11/compile/migrationintegrityPASS canonicaltipเมื่อบันทึก**8626880** เพิ่มnullableSourceMaterial.storageBucketและpreparedprivatebucket8policies Actualrollbackfixture20checks/RLS casesและfreshbaseline+delta**78steps/146checksPASS**, fixture_removed=true Productionauditตอนนั้น0bucket/0policies ไม่มีactualStorageHTTP/productionapply [หลักฐาน](evidence/mvp-private-storage-verification.json) ไม่เพิ่มpaidcallsและไม่เปลี่ยนCDpolicy

## ฟีเจอร์และ issue evidence

File receipt milestone: แก้การลบไฟล์ผิดเมื่อ COMMIT สำเร็จแต่ connection ส่ง error ตรวจ exact receipt หลัง owned parent lock ก่อน compensation เก็บไฟล์เมื่อ UNKNOWN; **API278/278**, file11/11 และ simulated persistent11/11/compile PASS Actual empty-clone PostgreSQL receipt/ownership checks PASS และ rollback หมด ไม่ใช่ real network-loss/Storage/concurrent Prisma proof ไม่มี schema change/paid calls [หลักฐาน](evidence/mvp-file-receipt-verification.json) Durable upload receipt/process-crash reconciliation ยังขาด

| ฟีเจอร์ / issue | Implementation และหลักฐาน | สิ่งที่ยังขาด |
|---|---|---|
| Auth / #5 #6 | รักษา Supabase Google/email/verification, callback→Home, verified Bearer/profile; auth regression ผ่าน | real login/browser journey รอบปัจจุบัน |
| Session / #8 #9 #14 | Prisma persistence/history, legacy ownership, engine-owned stage/progress, explicit FAILED recovery + atomic event; integration11/11 และ [recovery SQL](evidence/mvp-recovery-rls-verification.json) | real Auth/browser retry และ ambiguous network receipt |
| RAG / #11 #12 | Reviewed Ohm pilot, lexical history-aware retrieval, runtime packaging, exact citations/strict schema; [vector gate/SQL](evidence/mvp-vector-search-verification.json) | canonical vector contract, reviewed ingestion/storage/runtime wiring และ relevance calibration |
| Embeddings / #3 #11 | deterministic complete-paragraph chunks/hash/provenance และ bounded real OpenRouter transport; offline tests | pgvector extension pack, real stored/query embeddings และ live quality evidence |
| Adaptive / #39 | 5 multi-turn offline scenarios; live5conversations/13turns ผ่าน structure/citation/engine gates; [numeric fixes](evidence/mvp-numeric-followup-verification.json) | educator review/broader topic-model coverage; generic hintsยังอาจสมมติโจทย์ |
| Assessment / #13 | PRE/POST/TRANSFER, immutable snapshots, deterministic scoring/receipts, atomic answers/profile; [API→Prisma→DB6groups](evidence/mvp-assessment-db-verification.json) | broader exercise bank, public migrations และ real Auth/browser journey |
| Profile/History / #16 | owned mastery/latest samples/paired scoresผ่านAPI; actual PRE/POST History; [frontend20/20/build](evidence/mvp-history-verification.json) | browser/mobile/keyboard QA |
| Input / #15 | TEXT; realPDF/image/OCR/workerpackaging และdurablejournal/RLS; [extraction](evidence/mvp-real-file-extraction-verification.json) | privateStorage/Auth, endpoints/UI/userreview/retention และrealconcurrentrecovery/generalrecognitionaccuracy |
| OCR assets / #15 | official pinned eng/tha/LICENSE5,197,046bytes download/hash/offline verification; [artifact tests4/4](evidence/mvp-ocr-model-packaging-verification.json) | recognition/accuracy, worker limits, OCR build/runtime bundle และ deployed smoke |
| Learning UI / #9 | Create→PRE→Chat→POST, structured blocks, stage/progress และ3interactive widgets | complete browser E2E และ uploads |
| Database / #2 #3 | canonical migrations/grants/RLS เตรียมแล้ว; [fresh baseline68SQLsteps/126checks](evidence/mvp-fresh-baseline-verification.json) และ isolated ownership/rollback tests | actual Prisma executor/marker verification และ compatible production schema |
| Release / #14 | local API tests/build/source-only packagingผ่าน; develop Web/API checksผ่าน | production migration, real deployed E2E/smoke/security gate และ integration-head CI |

Acceptance criteria/dependencies รายข้ออยู่ใน [ตัวติดตามงาน](mvp-completion-tracker.md) Issue ที่ยังไม่ครบยังเปิดอยู่ ไม่มีการปิดเพียงเพราะเขียนโค้ด

## สถาปัตยกรรมและ API

คง Next.js/React/TypeScript, Express modular monolith, Node24/npm, Supabase Auth/PostgreSQL/Prisma/RLS และ ModelProvider Mock/OpenRouter ไม่เปลี่ยน Tutor Output schema หรือ deterministic engine-owned state ไม่มี Docker/Azure/custom authentication sessions

เพิ่ม protected assessment/profile/progress/TEXT material APIs ตาม [API contract](api-contract.md) และ `POST /learning-sessions/{id}/recovery` รับ `{}` เท่านั้น กู้คืนเฉพาะ FAILED session ของเจ้าของ Lifecycle/version และ SYSTEM event อยู่ใน transaction เดียว ไม่เปลี่ยน stage/progress หรือส่ง operational eventให้AI ไม่ซ่อม rejected model output/automatic provider retry

Resolve application User primary key ผ่าน verified authUserId เพื่อรักษาประวัติ/ชื่อ/avatarบัญชีเก่า โดยไม่เปลี่ยน Auth identity/production rows Embedding HTTP adapterอยู่ AI/providers; Knowledgeใช้ ports และ database candidatesต้องตรง current reviewed content/exact provenanceก่อนมี trusted citations

File serviceไม่มี default/Mock extractorถูก wire เข้า runtime TEXTทำงานได้ ส่วน file/OCR/vector foundationsยังไม่ใช่ complete upload/semantic-search feature ดู [file pipeline](file-input-foundation.md), [vector integration](vector-retrieval-integration.md), [OCR packaging](ocr-model-packaging.md)

## ผลทดสอบและคำสั่ง

| การตรวจ | ผลล่าสุดและขอบเขต |
|---|---|
| API compile/offline suite | **299/299 PASS**ผ่านactual npm test/build; realPDF/OCR tests local/offline และMockAI ไม่มี paid model callsในCI |
| File orchestration/Storage | **26/26 PASS**; injected extractor/Storage/DB + streamed HTTP fixtures รวม durable restart/byte-integrity/cancellation ไม่ใช่ decoding/live upload proof |
| Vector retrieval | **8/8 PASS**; review/hash/embedding-input/provenance/intent gates และ parameter binding |
| OCR artifact integrity | **4/4 PASS**; actual official download/offline verificationแยกจากunit tests |
| Persistent integration | **11/11 PASS**; simulated Auth/DB harness ไม่ใช่ real OAuth |
| Frontend | **20/20**, typecheck/Web production build PASSหลังรวม develop875575f; ยังไม่มี browser/mobile/keyboard QA |
| Fresh source-only export | Durable snapshotก่อนfinal cleanup helper/last assertion: **API287/287 + relocated Knowledge4/4 PASS**, deterministic9files; copied dependencies ไม่ใช่current-head/freshnpm/OCR proof |
| CI | [CI205 PASS](https://github.com/SteveJO789/LearnlyAi/actions/runs/38049322385) ที่code9a1f2b6: API/Web install/typecheck/tests/build และfresh runtime/persistent integrationทำจริง ไม่ใช่skipped deployment; later docs-only changesไม่ขยายruntime coverage |

จาก `services/api`:

```powershell
node node_modules/typescript/bin/tsc -p tsconfig.json
node --test test/*.test.mjs
node --experimental-test-module-mocks --test test/persisted-rag.integration.mjs
node scripts/verify-fresh-runtime.mjs
node scripts/prepare-ocr-models.mjs --download
node scripts/prepare-ocr-models.mjs
```

สองคำสั่งOCRตรวจmodel assetsเท่านั้น ไม่ทดสอบ recognition Generated runtime-ocrต้องรวมในbuild/deploymentเมื่อadapterพร้อม ไม่ถือว่าlocal cacheติดไปdeploymentเอง Fresh source-only checksรอบนี้ไม่พิสูจน์ OCR model bundle

จาก `apps/web`: `node scripts/run-tests.mjs`, typecheckตามnpm script และ `node node_modules/next/dist/bin/next build` Build successไม่แทนbrowser/mobile/keyboard proof

Live OpenRouterรวม54calls (Tutor48/embeddings6) reported **US$0.02963331572**, conservative reservations **US$0.6515484** จากเพดานเดิมUS$1 เก็บledger/failed roundsแยก ไม่รีเซ็ตเมื่อresume Tutor structural/citation/state checksผ่าน ไม่อ้างว่าทุก teaching-quality criterionผ่าน Hintอาจสมมติโจทย์และ acknowledgementอาจrecap Embedding/PG8casesเป็นregressionที่เคยตรวจแล้ว ไม่ใช่independent broadercorpus proof; raw historical evidenceไม่ถูกเขียนทับ

## Database และ security verification

- Persistent isolated fixtureที่ผู้ใช้อนุมัติ: API→Prisma→PostgreSQL scoring/idempotency/concurrency/ownership/rollback6groupsผ่านและลบfixtureแล้ว ใช้synthetic signed identities/Auth transport ไม่ใช่OAuthจริง
- Ownership/material/recovery/vector/file SQLตรวจในempty clones/BEGIN-ROLLBACK, fixture_removed=true ไม่copy/แก้production learner rows File/vector SQLมาจากcompiled adaptersแต่executeผ่านSupabase MCP ไม่ใช่actual Auth→Prisma transport proof
- Real file SQLพบnonexistent enum cast42704ที่compile/unit/CIไม่จับ: canonical SourceMaterial type/statusเก็บpg/text แก้bound parameterแล้ว SQL/RLS/metadata/legacy owner/PRE gate/failed-update atomic rollback/cross-user/FKผ่าน อีกfailureเป็นverifier json=jsonb mismatch เก็บทั้งสองไว้ในevidence
- Historical graph integrityไม่เท่ากับphysical replay พบmissing-policy failureจริง เก็บold hashesและเพิ่มfresh @empty baseline ผ่าน68steps/126checks Databaseเดิมต้องเดินจากverified actual marker ไม่replay baseline/old destructive cleanup
- Production read-only Prisma verifyไม่ผ่าน: exit4/verificationOk=false/hash mismatch, marker storageHash=c7b3938544e5e74ca8b9f22476cc7dbb3d987938d552a6e2214b5edd941b8665 ก่อนcurrent8626880 Assessmentยังขาดtopic/snapshot/submissionHash/write-policy deltasและprivateStorage packageยังไม่apply ไม่sign public production schema
- Default/deployed devAI routesปิด, Auth/readinessมีbounded deadlines, loggingใช้safe request ID/phase และJWT ownership/RLS/API-write guards ReadinessตรวจDB SELECT1/reviewed Knowledge/Auth configurationเท่านั้น ไม่ตรวจschema migration/OAuth/model availability
- Actual Storage RLS/cross-user upload-download-delete, full file decoding/worker bounds และfull browser security journeyยังไม่verified จึงยังไม่ผ่านrelease security gate

## Deployment และ blockers

1. **npm resolved:** ผู้ใช้ขอปลดบล็อกแล้ว ซ่อมnpm11.19.0จากverified official archive/hashพร้อมbackupและsupported nvm reshim `npm --version`, install pinned PDF/OCR/image/pgvector deps14packages, lint/ls PASSในshellสิทธิ์ครบ Restricted tool sandboxยังNVM4306; ใช้authorized context ไม่bypass blocked scripts Actual extraction/OCR/vector runtimeยังpending [หลักฐาน](evidence/mvp-npm-repair-verification.json)
2. **Production DB incompatible:** public migrations/executor/marker verificationยังไม่สำเร็จ ไม่มีnon-production branchใช้ได้ Isolated fixture/cleanup approvalไม่เท่ากับอนุญาตdestructive live-data changes
3. **Runtime/deployment verification:** develop875575f GitHub statuses ผ่านทั้ง Web/API หลังhotfixของทีม [API deployment](https://vercel.com/webdev-bd06/learnly-ai/7JdBtG2RzLR7Khseo6gTeQ5oh5kR) จึงไม่ใช้5022 API build failureเป็นcurrent blocker Vercel inspectionเรียกไม่ได้ (Unknown tool), real runtime/Auth/browser smokeและintegration deploymentยังไม่verified
4. **Incomplete integrations:** real PDF/OCR, private Storage/upload-list-resume UI/retention UX, canonical pgvector ingestion/runtime, real Auth/browser/mobile E2E และbroader reviewed corpus/educator review

**CD เฉพาะ develop** ตามคำสั่งผู้ใช้ Feature/integration deploymentsต้องskip ไม่มีauto-merge/deployโดยagent Local/CI successไม่ใช่production success

## Release checklist

- [ ] ทุกapplicable issue criterionมีworking implementation/evidence
- [ ] PDF/image/OCR/private Storage/endpoints/UI/reconciliationครบ
- [ ] Reviewed pgvector ingestion/query/runtime/semantic quality gatesครบ
- [ ] Login→Create→Input/Upload→Learn→Assess→Persist→History→Profile ผ่านreal browser/mobile/keyboard E2E
- [ ] Prisma executor/migration graph/marker/ownership controlsverifiedในsafe environment
- [ ] Public migrationผ่านreview/authorizationและproduction schema compatible
- [ ] Current CI/typecheck/production builds/OCR/Knowledge bundlesผ่าน
- [ ] Current Web/API deployed smoke และreal dependency readinessผ่าน
- [ ] Environment/operations/API documentationตรงimplementation ไม่มีcritical/high release blocker
- [ ] Authorized deployment + real production smokeสำเร็จ ก่อนใช้คำว่า RELEASED
