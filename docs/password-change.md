# เปลี่ยนรหัสผ่านด้วย Supabase Auth

หน้า Settings → Change Password ไม่ใช้ timer จำลองความสำเร็จแล้ว และอยู่หลัง RequireAuth แบบเดียวกับหน้าประวัติ

ขั้นตอน: validate input → อ่านผู้ใช้ปัจจุบันจาก Auth → สร้าง client สำหรับ operation นี้โดยไม่ persist/refresh/session-in-URL → ตรวจรหัสผ่านเดิมด้วย signInWithPassword → เทียบ user ID ให้ตรง → updateUser ด้วย password/current_password → แจ้งสำเร็จเมื่อ Auth ตอบรับผู้ใช้คนเดิม → signOut scope local เฉพาะ session ตรวจสอบ

Client หลักใน browser ไม่ถูก signIn/signOut/updateUser โดย helper นี้ ไม่มี custom Express session, admin/service-role key หรือการบันทึกรหัสผ่านใน DB/localStorage/log ล้างช่องหลังสำเร็จ และไม่ retry mutation อัตโนมัติ

การตรวจ identities ช่วยเลือกข้อความ error เท่านั้น ไม่ใช้สรุปว่าบัญชี Google ไม่มี password ถ้า Auth ตรวจ password ได้และ ID ตรง จะดำเนินการได้

## ผลลัพธ์

- input/confirmation ผิด: ไม่เรียก Auth
- current password ผิด/บัญชีไม่ตรง: ไม่ update password
- Auth policy/weak/same/rate limit: แสดงข้อความสองภาษา ไม่มี success ปลอม
- response mutation หาย/timeout: ระบุว่ายังยืนยันผลไม่ได้ ต้องตรวจว่ารหัสผ่านใหม่ใช้ได้ก่อนเปลี่ยนอีกครั้ง
- account lookup จำกัด20s และ isolated requests จำกัด15s/no redirect
- ผล cleanup ไม่แน่นอนไม่ย้อนข้อเท็จจริงว่า password update ที่ยืนยันแล้วสำเร็จ ไม่มี raw upstream error/token/password ถูกแสดง

การ revoke session และ password/MFA/nonce policy จริงยังขึ้นกับ Supabase project ต้องทดสอบด้วย isolated Auth accounts ก่อน release ยังไม่ได้เปลี่ยนรหัสผ่านของผู้ใช้จริงหรือส่ง email ในรอบนี้ บัญชี social-only ที่ยังไม่มี password จะมีข้อความให้จัดการกับ provider ไม่เพิ่ม password ให้โดยเงียบ

## หลักฐาน

[Evidence](evidence/mvp-password-change-verification.json): helper/input/identity/error/no browser-session replacement และ actual installed SDK/factory HTTP protocol ผ่าน injected offline transport พร้อม network-free CI ไม่มี live Auth/browser claim SDK เพิ่ม nullable PKCE fields ใน update payloadตาม implementationที่ตรวจจริง

UI Settings ส่วนอื่นยังมี prototype (preferences/privacy/delete account) ต้อง audit/implement ตาม approved scopeต่อ ไม่ถือว่า password fixทำให้ Settingsทั้งหน้าสมบูรณ์

อ้างอิง: [Supabase password security/current_password](https://supabase.com/docs/guides/auth/password-security), [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser) และ installed auth-js2.117 source/types
