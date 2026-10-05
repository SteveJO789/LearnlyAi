// Bilingual UI strings, keyed by short dotted ids (not by the English text
// itself — the codebase already mixes English labels with Thai helper/error
// text, so "use the source string as the key" would break for every string
// that was already written in Thai). Add a key here, then call t("that.key")
// in the component; missing keys just render as the key itself so a typo
// is obvious instead of silently blank.

export type Dictionary = Record<string, string>;

export const en: Dictionary = {
  // --- Nav (SiteHeader + Account dropdown) ---
  "nav.create": "Create",
  "nav.lessons": "Lessons",
  "nav.home": "HOME",
  "nav.account": "Account",
  "nav.profile": "Profile",
  "nav.history": "History",
  "nav.settings": "Settings",
  "nav.logOut": "Log Out",

  // --- Account sidebar section/tab labels ---
  "sidebar.setting": "Setting",
  "sidebar.helpAndSupport": "Help & Support",
  "sidebar.personalInfo": "Personal Info",
  "sidebar.theme": "Theme",
  "sidebar.chat": "Chat",
  "sidebar.uploadedFiles": "Uploaded Files",
  "sidebar.testResults": "Test Results",
  "sidebar.changePassword": "Change Password",
  "sidebar.learningPreferences": "Learning Preferences",
  "sidebar.notifications": "Notifications",
  "sidebar.language": "Language",
  "sidebar.privacy": "Privacy",
  "sidebar.deleteAccount": "Delete Account",
  "sidebar.helpCenterFaq": "Help Center / FAQ",
  "sidebar.reportProblem": "Report a Problem",
  "sidebar.contactUs": "Contact Us",

  // --- Home page ---
  "home.greeting": "Hello",
  "home.welcome": "Welcome to LearnlyAI",
  "home.tagline":
    "Your AI tutor that breaks every problem down, step by step — so you actually understand, not just get the answer.",
  "home.start": "START",
  "home.whatIs": "What is LearnlyAI ?",
  "home.subheading": "Subheading",
  "home.body1": "Body text for whatever you'd like to add more to the subheading.",
  "home.body2": "Body text for whatever you'd like to share more.",
  "home.body3": "Body text for whatever you'd like to expand on the main point.",

  // --- Create page ---
  "create.title": "Create Learning Session",
  "create.subtitle":
    "What would you like to learn today? Type your question, or upload a file to get started.",
  "create.textAreaLabel": "text area",
  "create.placeholder": "Type your question here",
  "create.or": "or",
  "create.uploadPlaceholder": "Upload File or Image",
  "create.removeFile": "Remove file",
  "create.start": "Start Learning...",
  "create.starting": "Starting...",

  // --- Account Settings: shared page title ---
  "settings.pageTitle": "Your Account Settings",

  // --- Setting > Language tab ---
  "settings.language.title": "Language",
  "settings.language.description": "Choose the display language for the site",
  "settings.language.thai": "ไทย (Thai)",
  "settings.language.english": "English",
};

export const th: Dictionary = {
  "nav.create": "สร้างบทเรียน",
  "nav.lessons": "บทเรียน",
  "nav.home": "หน้าแรก",
  "nav.account": "บัญชี",
  "nav.profile": "โปรไฟล์",
  "nav.history": "ประวัติ",
  "nav.settings": "การตั้งค่า",
  "nav.logOut": "ออกจากระบบ",

  "sidebar.setting": "ตั้งค่า",
  "sidebar.helpAndSupport": "ช่วยเหลือ",
  "sidebar.personalInfo": "ข้อมูลส่วนตัว",
  "sidebar.theme": "ธีม",
  "sidebar.chat": "แชท",
  "sidebar.uploadedFiles": "ไฟล์ที่อัปโหลด",
  "sidebar.testResults": "ผลการทดสอบ",
  "sidebar.changePassword": "เปลี่ยนรหัสผ่าน",
  "sidebar.learningPreferences": "ค่าการเรียนรู้",
  "sidebar.notifications": "การแจ้งเตือน",
  "sidebar.language": "ภาษา",
  "sidebar.privacy": "ความเป็นส่วนตัว",
  "sidebar.deleteAccount": "ลบบัญชี",
  "sidebar.helpCenterFaq": "ศูนย์ช่วยเหลือ / คำถามที่พบบ่อย",
  "sidebar.reportProblem": "แจ้งปัญหา",
  "sidebar.contactUs": "ติดต่อเรา",

  "home.greeting": "สวัสดี",
  "home.welcome": "ยินดีต้อนรับสู่ LearnlyAI",
  "home.tagline":
    "ติวเตอร์ AI ที่ช่วยอธิบายทีละขั้นตอน ให้คุณเข้าใจจริงๆ ไม่ใช่แค่ได้คำตอบ",
  "home.start": "เริ่มเลย",
  "home.whatIs": "LearnlyAI คืออะไร?",
  "home.subheading": "หัวข้อย่อย",
  "home.body1": "เนื้อหาเพิ่มเติมสำหรับหัวข้อย่อยนี้",
  "home.body2": "เนื้อหาเพิ่มเติมที่อยากแชร์",
  "home.body3": "เนื้อหาขยายความจากประเด็นหลัก",

  "create.title": "สร้างเซสชันการเรียนรู้",
  "create.subtitle":
    "วันนี้อยากเรียนอะไร? พิมพ์คำถามของคุณ หรืออัปโหลดไฟล์เพื่อเริ่มต้น",
  "create.textAreaLabel": "ช่องข้อความ",
  "create.placeholder": "พิมพ์คำถามของคุณที่นี่",
  "create.or": "หรือ",
  "create.uploadPlaceholder": "อัปโหลดไฟล์หรือรูปภาพ",
  "create.removeFile": "นำไฟล์ออก",
  "create.start": "เริ่มเรียนเลย...",
  "create.starting": "กำลังเริ่ม...",

  "settings.pageTitle": "การตั้งค่าบัญชีของคุณ",

  "settings.language.title": "ภาษา",
  "settings.language.description": "เลือกภาษาที่ใช้แสดงผลในเว็บไซต์",
  "settings.language.thai": "ไทย (Thai)",
  "settings.language.english": "English",
};
