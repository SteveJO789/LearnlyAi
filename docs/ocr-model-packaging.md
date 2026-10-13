# ไฟล์โมเดล OCR ไทย/อังกฤษ

เตรียม trained language data จาก official `tesseract-ocr/tessdata_fast` revision `87416418657359cb625c412a48b6e1d6d41c29bd` และ LICENSE จริงแล้ว รวม 5,197,046 bytes ตรวจขนาดและ SHA-256 ของทั้งสามไฟล์ได้ และมี runtime verifier ที่อ่านเฉพาะ local files ไม่มี runtime CDN download

นี่คือ **model packaging/integrity เท่านั้น ยังไม่ใช่ OCR feature ที่ทำงานแล้ว** Tesseract.js/image decoder/PDF extraction dependencies ยังติด npm NVM4306 และรออนุมัติ same-version repair นอก repository ไม่ติดตั้งหรือเรียก npm-cli ผ่านทางอื่น ไม่มี Mock OCR แทน runtime

## คำสั่ง

จาก `services/api` ใช้ Node 24:

```powershell
# ดาวน์โหลดเฉพาะ official pinned artifacts ที่ขาด/ไม่ตรง hash
node scripts/prepare-ocr-models.mjs --download

# ตรวจ cached artifacts โดยไม่ดาวน์โหลด
node scripts/prepare-ocr-models.mjs
```

มี npm scripts `ocr:prepare-models:download` และ `ocr:prepare-models` สำหรับเมื่อ package manager ใช้ได้ ผลอยู่ใน ignored `services/api/runtime-ocr/` ไม่ commit binary assets generated data และยังไม่เพิ่มคำสั่งนี้เข้า build/Vercel includeFiles จนกว่า real OCR adapter พร้อม ห้ามถือว่าไฟล์โมเดลที่อยู่เฉพาะ local จะติดไปกับ deployment เอง

Source manifest อยู่ใน `src/modules/input/ocr-models.json`; runtime verifier `verifyOcrModels` ต้องตรวจ eng/tha/LICENSE ทุกไฟล์ก่อนใช้ จะไม่ fetch เองเมื่อ missing/corrupt Model downloader จำกัดเวลา, pinned HTTPS URL/no redirects, streamed decoded byte count/hash, atomic verified-file replacement และปฏิเสธ symlink targets หาก HTTP gzip LICENSE จะตรวจ decompressed bytes ตามที่ Node fetch คืน ไม่เอา compressed Content-Length ไปเทียบกับขนาดไฟล์หลัง decode

## หลักฐานและงานถัดไป

- Actual official asset download + subsequent offline verification PASS
- Integrity/downloader tests4/4; API266/266 และ compile PASS ไม่มี paid calls
- ไม่ทดสอบ recognition ภาษาไทย/อังกฤษ, math OCR accuracy, malformed image decoding, OCR worker timeout/termination, worker memory, runtime asset bundle หรือ deployment ใน milestone นี้
- ต่อ real Tesseract.js adapter พร้อม local language path/gzip=false, decoded-image limits, bounded abortable worker lifecycle, original text/image fixtures และ PDF text extraction หลัง npm ใช้ได้ จากนั้น wire endpoints/UI/private Storage/RLS และ production packaging

แหล่งที่ตรวจ: [Tesseract local installation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md), [official pinned model repository](https://github.com/tesseract-ocr/tessdata_fast/tree/87416418657359cb625c412a48b6e1d6d41c29bd), [LICENSE](https://github.com/tesseract-ocr/tessdata_fast/blob/87416418657359cb625c412a48b6e1d6d41c29bd/LICENSE)
