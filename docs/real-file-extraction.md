# ตัวอ่าน PDF และ OCR จริง

`RealFileTextExtractor` ใช้ PDF.js และ Tesseract.js ใน Node24 worker แยกต่อไฟล์ ไม่มี Mock extractor หรือบริการ OCR เสียเงิน จำกัด3MiB/10หน้า/8000characters/12MP, ไม่ตัดข้อความที่เกินขนาด ปิด worker ก่อนคืนผลหรือ error และรับได้หนึ่งงานต่อprocess หาก busy ให้ retry503 ไม่เก็บคิวไม่จำกัด

PDFอ่าน text layerแบบstream รักษาเลขหน้ารวมหน้าว่าง ปฏิเสธไฟล์เข้ารหัส/ไฟล์เสีย/เกินหน้า/เกินข้อความ หากPDFเป็นภาพสแกนอย่างเดียวจะคืน NO_EXTRACTABLE_TEXT; page rendering/OCR ของPDFยังไม่ทำ ภาพPNGตรวจCRCทุกchunkและขนาดข้อมูลinflateก่อนdecode ภาพJPEGใช้strictdecodeพร้อมmemory/pixel capsและhonorEXIForientation ภาพถูกnormalizeเฉพาะbufferสำหรับOCR ไม่เปลี่ยนoriginalbytes/hashที่จะเก็บ

OCRใช้tha+eng modelsที่pinrevision/hash/licenseไว้และตรวจไฟล์ก่อนเริ่ม ไม่มีruntimeCDN/modeldownload ค่าconfidenceเป็นผลจากOCR ไม่ใช่คำยืนยันว่าทุกสมการถูกต้อง ทดสอบไทย/อังกฤษด้วยภาพสังเคราะห์ที่ทีมเขียนเอง ไม่ใช้ภาพทดสอบเป็นreviewedKnowledge

Workerไม่รับenvironment credentials และไม่เผยlibrary stdout/stderr ส่วนที่เรียกfetchถูกปิดทั้งwrapperหลักและOCRworker การยกเลิกรอactualthreadtermination การจำกัดheapของNodeไม่ครอบคลุมWASM/ArrayBufferทั้งหมด จึงยังต้องตรวจmemory/runtimeจริงบนdeployment อย่าใช้ผลunitแทนข้อพิสูจน์นั้น ดู [Node24 worker limits](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html) และ [Vercel function limits](https://vercel.com/docs/functions/limitations)

BuildเตรียมverifiedOCRassetsและcopycompiledworkers2ไฟล์ไปruntime-workers; vercelincludeFilesครอบคลุมmodels/workers/dynamicdependenciesและตัดsourcemaps Generatedbinary/compiledassetsไม่commit สิทธิ์CDยังเฉพาะdevelop ไม่ได้deployfeaturebranch

หลักฐาน: realextraction10/10, fullAPI299/299, persistent simulated11/11/buildPASS และsource-only/relocatedsnapshotก่อนEXIFเพิ่ม297/8/4PASS ดู [verification](evidence/mvp-real-file-extraction-verification.json) และ [fixture provenance](../services/api/test/fixtures/README.md) กรณีไม่ผ่านก่อนแก้ถูกเก็บไว้ ไม่อ้างทั่วไปเรื่องhandwriting/mathnotationaccuracy

งานถัดไป: authenticated upload/list/resume/download APIs, user review/edit ของข้อความOCR, frontend journey และrealAuth→Prisma→Storage tests Canonicalvectorpersistence/runtimeยังแยกเป็นงานที่ขาด ไม่ใช้Mockแทน
