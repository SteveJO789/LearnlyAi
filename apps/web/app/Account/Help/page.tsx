"use client";

import { useState, useEffect, Suspense, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import AccountSidebar from "../components/AccountSidebar";

type HelpTabType = "Help Center / FAQ" | "Report a Problem" | "Contact Us";

const TABS: HelpTabType[] = ["Help Center / FAQ", "Report a Problem", "Contact Us"];

const FAQ_ITEMS = [
  {
    q: "LearnlyAI ช่วยอะไรฉันได้บ้าง?",
    a: "LearnlyAI เป็นติวเตอร์ AI ที่ช่วยสอนทีละขั้นตอนผ่านคำถามนำทางและคำใบ้ แทนที่จะให้คำตอบทันที เพื่อให้คุณเข้าใจที่มาที่ไปจริงๆ",
  },
  {
    q: "ฉันอัปโหลดไฟล์แบบไหนได้บ้าง?",
    a: "รองรับข้อความ, PDF และรูปภาพ ระบบจะอ่านเนื้อหาแล้วสร้างบทเรียนให้ตรงกับโจทย์ของคุณ",
  },
  {
    q: "ถ้าคำตอบของ AI ผิด ฉันควรทำอย่างไร?",
    a: "กด Report a Problem แจ้งปัญหานั้นมาได้เลย ทีมงานจะตรวจสอบและปรับปรุงคุณภาพคำตอบต่อไป",
  },
  {
    q: "ข้อมูลของฉันถูกเก็บไว้ที่ไหน และปลอดภัยแค่ไหน?",
    a: "ข้อมูลถูกเก็บอย่างปลอดภัยและใช้เพื่อปรับปรุงประสบการณ์การเรียนของคุณเท่านั้น ปรับการตั้งค่าความเป็นส่วนตัวได้ที่หน้า Setting > Privacy",
  },
  {
    q: "ยกเลิกหรือลบบัญชีได้อย่างไร?",
    a: "ไปที่ Setting > Delete Account แล้วทำตามขั้นตอนยืนยัน การลบบัญชีจะลบข้อมูลทั้งหมดอย่างถาวร",
  },
];

function HelpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as HelpTabType | null;

  const [activeTab, setActiveTab] = useState<HelpTabType>(
    tabParam && TABS.includes(tabParam) ? tabParam : "Help Center / FAQ"
  );

  useEffect(() => {
    if (tabParam && TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: HelpTabType) => {
    setActiveTab(tab);
    router.push(`/Account/Help?tab=${encodeURIComponent(tab)}`, { scroll: false });
  };

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // --- Report a Problem ---
  const [report, setReport] = useState({ type: "Bug", description: "" });
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);

  const handleReportSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!report.description.trim()) return;
    setIsSendingReport(true);
    setTimeout(() => {
      setIsSendingReport(false);
      setReportSubmitted(true);
      setReport({ type: "Bug", description: "" });
    }, 1200);
  };

  // --- Contact Us ---
  const [contact, setContact] = useState({ subject: "", message: "" });
  const [contactSent, setContactSent] = useState(false);
  const [isSendingContact, setIsSendingContact] = useState(false);

  const handleContactSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!contact.subject.trim() || !contact.message.trim()) return;
    setIsSendingContact(true);
    setTimeout(() => {
      setIsSendingContact(false);
      setContactSent(true);
      setContact({ subject: "", message: "" });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-background text-text relative transition-colors duration-200">
      {/* Header */}
      <header className="flex items-center justify-between px-10 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          LOGO
        </Link>
        <div className="flex gap-4">
          <Link href="/Create" className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
            Create
          </Link>
          <Link href="/Lessons" className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
            Lessons
          </Link>
          <Link href="/Home" className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
            HOME
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-10 py-4 max-w-[1400px] mx-auto">
        <h1 className="mb-2 text-[48px] font-bold tracking-tight whitespace-nowrap">
          Your Account Settings
        </h1>
        <div className="h-4" />

        <div className="flex gap-8 items-start">
          <AccountSidebar activeSection="Help" activeTab={activeTab} />

          {/* Right Main Display Panel */}
          <section className="flex-1 flex flex-col gap-4">
            <div className="h-[42px]" />

            <div className="rounded-2xl border border-surface-border p-8 min-h-[650px] bg-surface flex flex-col justify-start">
              {/* Help Center / FAQ */}
              {activeTab === "Help Center / FAQ" && (
                <div className="max-w-xl flex flex-col gap-4">
                  <h3 className="text-xl font-bold">Help Center / FAQ</h3>
                  <p className="text-sm text-muted -mt-2">คำถามที่พบบ่อย</p>

                  <div className="flex flex-col gap-2 mt-2">
                    {FAQ_ITEMS.map((item, index) => {
                      const isOpen = openFaq === index;
                      return (
                        <div
                          key={item.q}
                          className="rounded-xl border border-surface-border bg-background overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setOpenFaq(isOpen ? null : index)}
                            className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium cursor-pointer"
                          >
                            <span>{item.q}</span>
                            <span
                              className={`text-muted transition-transform shrink-0 ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            >
                              ▾
                            </span>
                          </button>
                          {isOpen && (
                            <p className="px-4 pb-4 text-sm text-muted leading-relaxed">
                              {item.a}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-sm text-muted mt-4">
                    หาคำตอบที่ต้องการไม่เจอ?{" "}
                    <button
                      type="button"
                      onClick={() => handleTabChange("Contact Us")}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      ติดต่อเรา
                    </button>
                  </p>
                </div>
              )}

              {/* Report a Problem */}
              {activeTab === "Report a Problem" && (
                <div className="max-w-md flex flex-col gap-5">
                  <h3 className="text-xl font-bold">Report a Problem</h3>

                  {reportSubmitted ? (
                    <div className="rounded-xl border border-surface-border bg-background p-5 flex flex-col gap-3">
                      <p className="text-sm font-medium">✓ ได้รับรายงานของคุณแล้ว ขอบคุณครับ</p>
                      <p className="text-xs text-muted">
                        ทีมงานจะตรวจสอบและติดต่อกลับหากต้องการข้อมูลเพิ่มเติม
                      </p>
                      <button
                        type="button"
                        onClick={() => setReportSubmitted(false)}
                        className="self-start text-sm text-primary hover:underline cursor-pointer"
                      >
                        แจ้งปัญหาอื่นเพิ่ม
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleReportSubmit} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted">Issue Type</label>
                        <div className="flex gap-2">
                          {(["Bug", "AI Answer", "Other"] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setReport({ ...report, type })}
                              className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-all cursor-pointer ${
                                report.type === type
                                  ? "border-primary bg-secondary font-semibold"
                                  : "border-surface-border hover:border-primary/60"
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted">
                          Describe what happened
                        </label>
                        <textarea
                          value={report.description}
                          onChange={(e) => setReport({ ...report, description: e.target.value })}
                          rows={5}
                          placeholder="เล่าให้เราฟังว่าเกิดอะไรขึ้น ขั้นตอนที่ทำก่อนเจอปัญหาคืออะไร..."
                          className="rounded-xl border border-surface-border bg-transparent p-3 text-sm outline-none focus:border-primary resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSendingReport || !report.description.trim()}
                        className="self-start rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isSendingReport ? "Sending..." : "Submit Report"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Contact Us */}
              {activeTab === "Contact Us" && (
                <div className="max-w-xl flex flex-col gap-6">
                  <h3 className="text-xl font-bold">Contact Us</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-surface-border bg-background p-4">
                      <p className="text-xs font-semibold text-muted">Email</p>
                      <p className="text-sm font-medium mt-1">support@learnlyai.app</p>
                    </div>
                    <div className="rounded-xl border border-surface-border bg-background p-4">
                      <p className="text-xs font-semibold text-muted">Support Hours</p>
                      <p className="text-sm font-medium mt-1">จันทร์–ศุกร์ 9:00–18:00</p>
                    </div>
                  </div>

                  {contactSent ? (
                    <div className="rounded-xl border border-surface-border bg-background p-5 flex flex-col gap-3 max-w-md">
                      <p className="text-sm font-medium">✓ ส่งข้อความถึงเราแล้ว</p>
                      <p className="text-xs text-muted">ทีมงานจะติดต่อกลับทางอีเมลโดยเร็วที่สุด</p>
                      <button
                        type="button"
                        onClick={() => setContactSent(false)}
                        className="self-start text-sm text-primary hover:underline cursor-pointer"
                      >
                        ส่งข้อความอีกครั้ง
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="flex flex-col gap-4 max-w-md">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted">Subject</label>
                        <input
                          type="text"
                          value={contact.subject}
                          onChange={(e) => setContact({ ...contact, subject: e.target.value })}
                          className="rounded-xl border border-surface-border bg-transparent p-3 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted">Message</label>
                        <textarea
                          value={contact.message}
                          onChange={(e) => setContact({ ...contact, message: e.target.value })}
                          rows={5}
                          className="rounded-xl border border-surface-border bg-transparent p-3 text-sm outline-none focus:border-primary resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSendingContact || !contact.subject.trim() || !contact.message.trim()}
                        className="self-start rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isSendingContact ? "Sending..." : "Send Message"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function HelpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HelpContent />
    </Suspense>
  );
}
