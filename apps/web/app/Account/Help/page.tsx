"use client";

import { useState, useEffect, Suspense, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AccountSidebar from "../components/AccountSidebar";
import SiteHeader from "../../components/SiteHeader";
import { useLanguage } from "../../lib/i18n/LanguageContext";

type HelpTabType = "Help Center / FAQ" | "Report a Problem" | "Contact Us";

const TABS: HelpTabType[] = ["Help Center / FAQ", "Report a Problem", "Contact Us"];

// FAQ_ITEMS is built inside the component from the dictionary (see faqItems below)
// so it can switch language — kept out of module scope on purpose.

function HelpContent() {
  const { t } = useLanguage();
  const router = useRouter();

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    q: t(`help.faq.q${n}`),
    a: t(`help.faq.a${n}`),
  }));
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
      <SiteHeader
        links={[
          { labelKey: "nav.create", href: "/Create" },
          { labelKey: "nav.lessons", href: "/Lessons" },
          { labelKey: "nav.home", href: "/Home" },
        ]}
      />

      {/* Main Content */}
      <main className="px-10 py-4 max-w-[1400px] mx-auto">
        <h1 className="mb-2 text-[48px] font-bold tracking-tight whitespace-nowrap">
          {t("settings.pageTitle")}
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
                  <h3 className="text-xl font-bold">{t("help.faq.title")}</h3>
                  <p className="text-sm text-muted -mt-2">{t("help.faq.subtitle")}</p>

                  <div className="flex flex-col gap-2 mt-2">
                    {faqItems.map((item, index) => {
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
                    {t("help.faq.notFound")}{" "}
                    <button
                      type="button"
                      onClick={() => handleTabChange("Contact Us")}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      {t("help.faq.contactLink")}
                    </button>
                  </p>
                </div>
              )}

              {/* Report a Problem */}
              {activeTab === "Report a Problem" && (
                <div className="max-w-md flex flex-col gap-5">
                  <h3 className="text-xl font-bold">{t("help.report.title")}</h3>

                  {reportSubmitted ? (
                    <div className="rounded-xl border border-surface-border bg-background p-5 flex flex-col gap-3">
                      <p className="text-sm font-medium">{t("help.report.submittedTitle")}</p>
                      <p className="text-xs text-muted">{t("help.report.submittedDesc")}</p>
                      <button
                        type="button"
                        onClick={() => setReportSubmitted(false)}
                        className="self-start text-sm text-primary hover:underline cursor-pointer"
                      >
                        {t("help.report.reportAnother")}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleReportSubmit} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted">{t("help.report.issueType")}</label>
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
                              {type === "Bug" ? t("help.report.issueBug") : type === "AI Answer" ? t("help.report.issueAiAnswer") : t("help.report.issueOther")}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted">{t("help.report.describe")}</label>
                        <textarea
                          value={report.description}
                          onChange={(e) => setReport({ ...report, description: e.target.value })}
                          rows={5}
                          placeholder={t("help.report.placeholder")}
                          className="rounded-xl border border-surface-border bg-transparent p-3 text-sm outline-none focus:border-primary resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSendingReport || !report.description.trim()}
                        className="self-start rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isSendingReport ? t("help.report.sending") : t("help.report.submit")}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Contact Us */}
              {activeTab === "Contact Us" && (
                <div className="max-w-xl flex flex-col gap-6">
                  <h3 className="text-xl font-bold">{t("help.contact.title")}</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-surface-border bg-background p-4">
                      <p className="text-xs font-semibold text-muted">{t("help.contact.email")}</p>
                      <p className="text-sm font-medium mt-1">support@learnlyai.app</p>
                    </div>
                    <div className="rounded-xl border border-surface-border bg-background p-4">
                      <p className="text-xs font-semibold text-muted">{t("help.contact.hours")}</p>
                      <p className="text-sm font-medium mt-1">{t("help.contact.hoursValue")}</p>
                    </div>
                  </div>

                  {contactSent ? (
                    <div className="rounded-xl border border-surface-border bg-background p-5 flex flex-col gap-3 max-w-md">
                      <p className="text-sm font-medium">{t("help.contact.sentTitle")}</p>
                      <p className="text-xs text-muted">{t("help.contact.sentDesc")}</p>
                      <button
                        type="button"
                        onClick={() => setContactSent(false)}
                        className="self-start text-sm text-primary hover:underline cursor-pointer"
                      >
                        {t("help.contact.sendAgain")}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="flex flex-col gap-4 max-w-md">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted">{t("help.contact.subject")}</label>
                        <input
                          type="text"
                          value={contact.subject}
                          onChange={(e) => setContact({ ...contact, subject: e.target.value })}
                          className="rounded-xl border border-surface-border bg-transparent p-3 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted">{t("help.contact.message")}</label>
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
                        {isSendingContact ? t("help.contact.sending") : t("help.contact.send")}
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
