"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AccountSidebar from "../components/AccountSidebar"; // นำเข้า Sidebar กลาง
import SiteHeader from "../../components/SiteHeader";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import { listLearningSessions, type LearningSessionSummary } from "../../../lib/learning-sessions";

type TabType = "Chat" | "Lessons" | "Uploaded Files" | "Test Results";

interface FileItem {
  id: number;
  name: string;
  date: string;
}

interface ChatItem {
  id: string;
  title: string;
  lastMessage: string;
  date: string;
}

interface TestResultItem {
  id: number;
  title: string;
  imageUrl: string;
  pretestScore: number;
  posttestScore: number;
  date: string;
}

function HistoryContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType | null>(initialTab);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    const tabParam = searchParams.get("tab") as TabType | null;
    setActiveTab(tabParam);
  }, [searchParams]);

  const [sessionHistory, setSessionHistory] = useState<LearningSessionSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    listLearningSessions()
      .then(setSessionHistory)
      .catch((loadError) => {
        setHistoryError(
          loadError instanceof Error ? loadError.message : "Could not load history.",
        );
      });
  }, []);

  // These tabs intentionally show no fabricated data until their APIs exist.
  const filesHistory: FileItem[] = [];
  const testResultsHistory: TestResultItem[] = [];

  const chatHistory: ChatItem[] = sessionHistory.map((session) => ({
    id: session.id,
    title: session.title,
    lastMessage: `${session.stage} · ${session.progressPercent}% completed`,
    date: session.updatedAt.slice(0, 10),
  }));

  const lessonsHistory = sessionHistory;

  const filterByDate = (dateStr: string) => {
    if (!startDate && !endDate) return true;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  const filteredFiles = filesHistory.filter((item) => filterByDate(item.date));
  const filteredChats = chatHistory.filter((item) => filterByDate(item.date));
  const filteredLessons = lessonsHistory.filter((item) =>
    filterByDate(item.date)
  );
  const filteredTestResults = testResultsHistory.filter((item) =>
    filterByDate(item.date)
  );

  const formatDateDisplay = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-background text-text relative transition-colors duration-200">
      {/* Modal เปิดดูไฟล์ */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <div className="relative flex h-[85vh] w-[90vw] max-w-4xl flex-col items-center justify-center rounded-3xl bg-surface p-8 shadow-2xl">
            <button
              onClick={() => setSelectedFile(null)}
              className="absolute right-6 top-6 rounded-xl bg-secondary hover:opacity-80 px-6 py-2.5 text-sm font-medium text-text transition-all"
            >
              {t("history.back")}
            </button>
            <div className="flex flex-col items-center justify-center gap-6">
              <svg
                className="h-48 w-48 text-text"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002-2v-2"
                />
              </svg>
              <p className="text-xl font-medium">
                {selectedFile.name}
              </p>
            </div>
          </div>
        </div>
      )}

      <SiteHeader
        links={[
          { labelKey: "nav.create", href: "/Create" },
          { labelKey: "nav.lessons", href: "/Lessons" },
          { labelKey: "nav.home", href: "/Home" },
        ]}
      />

      {/* Main Content */}
      <main className="px-10 py-4 max-w-[1400px] mx-auto">
        <h1 className="mb-8 !text-[48px] font-bold tracking-tight whitespace-nowrap">
          {t("settings.pageTitle")}
        </h1>
        <br />

        <div className="flex gap-8 items-start">
          {/* เรียกใช้งาน Sidebar กลาง (กำหนดให้ activeSection เป็น History) */}
          <AccountSidebar activeSection="History" activeTab={activeTab} />

          {/* Right Main Display Panel */}
          <section className="flex-1 flex flex-col gap-4">
            {/* Filter Date Picker Bar */}
            {activeTab !== null ? (
              <div className="relative self-start">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="flex items-center gap-4 bg-secondary/80 border border-surface-border rounded-xl px-5 py-2.5 text-sm transition-all hover:bg-secondary"
                >
                  <span className="text-muted font-medium">{t("history.dateLabel")}</span>
                  <span className="text-muted font-normal">
                    {startDate || endDate
                      ? `${startDate || "dd/mm/yy"} - ${endDate || "dd/mm/yy"}`
                      : "dd/mm/yy-dd/mm/yy"}
                  </span>
                </button>

                {isDatePickerOpen && (
                  <div className="absolute left-0 top-12 z-20 w-72 rounded-2xl border border-surface-border bg-surface p-4 shadow-xl flex flex-col gap-3 text-xs">
                    <p className="font-medium">{t("history.selectDateRange")}</p>

                    <div className="flex flex-col gap-1">
                      <label className="text-muted">{t("history.from")}</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-lg border border-surface-border bg-transparent p-2 outline-none focus:border-primary text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-muted">{t("history.to")}</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded-lg border border-surface-border bg-transparent p-2 outline-none focus:border-primary text-xs"
                      />
                    </div>

                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-surface-border">
                      <button
                        type="button"
                        onClick={() => {
                          setStartDate("");
                          setEndDate("");
                        }}
                        className="text-muted hover:text-text"
                      >
                        {t("history.clear")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(false)}
                        className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 font-medium hover:opacity-90 transition-opacity"
                      >
                        {t("history.apply")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[42px]" />
            )}

            {/* Container เนื้อหาหลักของ History */}
            <div className="rounded-2xl border border-surface-border p-6 min-h-[650px] bg-surface flex flex-col justify-start">
              {historyError && (
                <p className="mb-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                  {historyError}
                </p>
              )}
              {/* หน้า Default: HISTORY */}
              {activeTab === null && (
                <div className="flex-1 min-h-[550px] flex items-center justify-center">
                  <h2 className="text-4xl font-bold tracking-widest text-muted uppercase">
                    {t("history.title")}
                  </h2>
                </div>
              )}

              {/* แท็บ Chat */}
              {activeTab === "Chat" && (
                <div className="flex flex-col gap-3 w-full">
                  {filteredChats.length === 0 ? (
                    <p className="text-muted text-sm text-center py-12">{t("history.noChats")}</p>
                  ) : (
                    filteredChats.map((chat) => (
                      <Link
                        key={chat.id}
                        href={`/Chat/${chat.id}`}
                        className="rounded-xl border border-surface-border p-4 bg-background hover:border-primary/60 transition-all cursor-pointer flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <h3 className="font-semibold text-sm">{chat.title}</h3>
                        </div>
                        <p className="text-xs text-muted pl-6">: {chat.lastMessage}</p>
                        <p className="text-[10px] text-muted pl-6">{chat.date}</p>
                      </Link>
                    ))
                  )}
                </div>
              )}

              {/* แท็บ Lessons */}
              {activeTab === "Lessons" && (
                <div className="grid grid-cols-3 gap-6 w-full items-start">
                  {filteredLessons.length === 0 ? (
                    <p className="text-muted text-sm col-span-3 text-center py-12">{t("history.noLessons")}</p>
                  ) : (
                    filteredLessons.map((lesson) => (
                      <Link
                        key={lesson.id}
                        href={`/Lessons/${lesson.id}`}
                        className="rounded-2xl border border-surface-border p-4 bg-background flex flex-col gap-3 hover:border-primary/60 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold text-sm">{lesson.title}</h3>
                          <span className="text-[10px] text-muted">{lesson.stage}</span>
                        </div>
                        <p className="text-[10px] text-muted">
                          {formatDateDisplay(lesson.updatedAt)}
                        </p>
                        <div className="mt-1 flex flex-col gap-1.5">
                          <p className="text-[11px] text-muted font-medium">
                            {lesson.progressPercent}{t("history.percentCompleted")}
                          </p>
                          <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${lesson.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              )}

              {/* แท็บ Uploaded Files */}
              {activeTab === "Uploaded Files" && (
                <div className="grid grid-cols-3 gap-4 w-full items-start">
                  {filteredFiles.length === 0 ? (
                    <p className="text-muted text-sm col-span-3 text-center py-12">{t("history.noFiles")}</p>
                  ) : (
                    filteredFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setSelectedFile(file)}
                        className="flex flex-col items-center justify-center rounded-xl border border-surface-border p-4 hover:border-primary/60 transition-all text-center group cursor-pointer bg-background"
                      >
                        <div className="mb-3">
                          <svg
                            className="h-10 w-10 text-muted group-hover:text-primary transition-colors"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div className="w-full overflow-hidden">
                          <p className="font-semibold text-xs truncate">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-muted mt-1">
                            {formatDateDisplay(file.date)}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* แท็บ Test Results */}
              {activeTab === "Test Results" && (
                <div className="grid grid-cols-3 gap-6 w-full items-start">
                  {filteredTestResults.length === 0 ? (
                    <p className="text-muted text-sm col-span-3 text-center py-12">{t("history.noTestResults")}</p>
                  ) : (
                    filteredTestResults.map((test) => (
                      <div
                        key={test.id}
                        className="rounded-2xl border border-surface-border p-4 bg-background flex flex-col gap-3 hover:border-primary/60 transition-all cursor-pointer"
                      >
                        <h3 className="font-semibold text-sm">{test.title}</h3>
                        <div className="w-full h-36 rounded-xl overflow-hidden bg-secondary">
                          <img
                            src={test.imageUrl}
                            alt={test.title}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <p className="text-[11px] text-muted font-medium">
                            {t("history.pretest")} {test.pretestScore}%
                          </p>
                          <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${test.pretestScore}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <p className="text-[11px] text-muted font-medium">
                            {t("history.posttest")} {test.posttestScore}%
                          </p>
                          <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${test.posttestScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
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

export default function HistoryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HistoryContent />
    </Suspense>
  );
}
