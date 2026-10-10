# Private material Storage — เตรียม migration แล้ว ยังไม่สร้าง bucket จริง

ตรวจ LearnlyAI project 2026-10-10 แบบ read-only: storage.buckets และ storage.objects policies ยังว่าง เตรียม bucket `learnly-materials` แบบ private จำกัด3MiBและPDF/PNG/JPEG พร้อม8application-owned policies บน Supabase-owned objects ไม่เปลี่ยนAuth/session infrastructureหรือใช้service-role bypassในruntime

Prisma-generated migration `20261010T0752_private_material_storage` เดินจาก d17a8bc→8626880 เพิ่ม nullable `SourceMaterial.storageBucket` และcustom bucket/policy operationsผ่านsupported rawSql/self-emission Metadata bucketถูกpersistคู่storageKey ไม่แสดงinternal bucket/keyในAPI response TEXT/legacy rowsยังnullable ไม่มีการbackfillหรือแก้live data

เริ่มลองsame-hash custom migrationแล้วread-only db migrate --show ไม่เลือกoperationนั้น จึงเปลี่ยนเป็นactual additive schema edgeสำหรับbucket metadata ไม่commitunused scaffold ตรวจartifact/graph integrityผ่าน และpathจากactualproductionmarkerc7b3938เลือก4app deltasรวมstorage package โดยไม่replayfresh baseline **ยังไม่apply/signproduction schema**

## กฎสิทธิ์

- Authenticated ownerต้องตรงowner_id/Auth UID prefixและowned LearningSessionผ่าน User.authUserId รองรับlegacy application primary keyที่ไม่เท่ากับAuth UID
- INSERTเฉพาะactive owned session; SELECT/DELETEใช้owned sessionได้แม้completed เพื่ออ่านhistoryและcompensateหลังuploadก่อนDBsaveล้มเหลว
- Keyต้องมี3segments AuthUID/session/material.pdf|png|jpg ไม่ยอมรับextra folder, foreignprefix/sessionหรือSVG
- ไม่ให้UPDATE/upsertไฟล์ในbucketนี้ Permissive owner policiesมาคู่restrictiveguardsเพื่อไม่ให้broadexisting/futurepolicies OR-bypass ownership
- Anonymousมีseparate ALL restrictiveguardที่ปฏิเสธbucketนี้โดยไม่joinapptables เพราะanonไม่มีสิทธิ์อ่านUser/LearningSession ไม่grantapptablesให้anonเพื่อแก้policy
- Other bucketsยังใช้policiesเดิมได้ ไม่เปลี่ยนสิทธิ์avatar/teammate storage

Bucket MIME/size metadata ไม่แทน full byte validation/decoding ต้องเชื่อมrealPDF/OCR, APIownership check, durablepending-upload reconciliation และactualStorageAPI/RLS testsก่อนถือว่าuploadfeatureครบ Directownedraw objectไม่เป็นREADY SourceMaterialหรือreviewedKnowledgeผ่านStorageเพียงอย่างเดียว

## หลักฐาน

Actual PostgreSQL emptyclone/BEGIN-ROLLBACKตรวจ20canonicalpre/postchecks, privatebucketmetadata, legacyownedupload/read/delete, directupdate/upsertdenial, foreignsession/ownerprefix/key/extensiondenial, anon/cross-userread/delete, completedhistory/cleanupและotherbucketsผ่าน แม้fixtureจะมีbroadtruelegacy policiesทุกรูปแบบ ผลfixture_removed=true; post-auditproductionยัง0bucket/0policies ไม่มีliveStorageupload

Freshbaseline+storage migrationต่อเนื่องตรวจ**78SQLsteps/146canonicalchecks**ผ่านในscratchschema รวมstoragetableclones ไม่แทนactualPrismaexecutor/markerหรือproductiondeployment FilePrismaadapterSQLยืนยันpersiststorageBucketจริงในอีกrollbackfixture; transport/decoderเป็นinjectedfixture

พบverifiernamespacepostcheckbugและanonpolicyjoinprivilege42501จริง เก็บfailureไว้ใน[evidence](evidence/mvp-private-storage-verification.json) กฎanonถูกแก้ก่อนself-emit/ทดสอบซ้ำ ไม่มีการเปลี่ยนhistoricalmigrationhashes

คำสั่งจากservices/api:

```powershell
node node_modules/prisma/dist/prisma.js migration check --json
node scripts/render-private-storage-verification.mjs --output=<scratch.sql>
node scripts/render-historical-migration-verification.mjs --path=fresh --output=<scratch.sql>
```

สองrendererสร้างSQLเท่านั้น ต้องตรวจscopeแล้วใช้safefixture ไม่รันagainststorage/publicจริงโดยเปลี่ยนชื่อเอง BucketจริงและactualAuthfileupload/downloadยังไม่verified รอrealextractor/dependenciesและreviewedproductionmigration/environmentพร้อม

เอกสารที่ตรวจ: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) และinstalledPrisma8migration/extensionreferences
