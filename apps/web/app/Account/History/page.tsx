"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AccountSidebar from "../components/AccountSidebar"; // นำเข้า Sidebar กลาง
import SiteHeader from "../../components/SiteHeader";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import { listLearningSessions, type LearningSessionSummary } from "../../../lib/learning-sessions";
import { getLearningProgress, type LearningProgressDto } from "../../../lib/assessments";
import { assessmentHistory, historyTab, inHistoryDateRange } from "../../../lib/history";
import { AssessmentHistory } from "../../components/assessment-history";
import RequireAuth from "../../components/require-auth";
import { FileHistoryCards, FileHistoryDetails } from "../../components/file-history";
import { listFileHistory, type FileHistoryItem } from "../../../lib/file-materials";
import { UploadHistory } from "../../components/upload-history";


interface ChatItem {
  id: string;
  title: string;
  lastMessage: string;
  date: string;
}

function HistoryContent() {
  const { t, language } = useLanguage();
  const searchParams = useSearchParams();
  const activeTab = historyTab(searchParams.get("tab"));
  const [selectedFile, setSelectedFile] = useState<FileHistoryItem | null>(null);
  const [files, setFiles] = useState<FileHistoryItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(activeTab === "Uploaded Files");
  const [filesError, setFilesError] = useState<string | null>(null);
  const [nextFileCursor, setNextFileCursor] = useState<string | null>(null);
  const [fileCursor, setFileCursor] = useState("");
  const [fileRetry, setFileRetry] = useState(0);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [sessionHistory, setSessionHistory] = useState<LearningSessionSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [comparisons, setComparisons] = useState<LearningProgressDto["comparisons"]>([]);
  const [resultsLoading, setResultsLoading] = useState(activeTab === "Test Results");
  const [resultsError, setResultsError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "Uploaded Files") return;
    let active = true;
    setHistoryLoading(true); setHistoryError(null);
    listLearningSessions()
      .then(rows => { if (active) setSessionHistory(rows); })
      .catch((loadError) => {
        if (active) setHistoryError(
          loadError instanceof Error ? loadError.message : "Could not load history.",
        );
      }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [retry, activeTab]);

  useEffect(() => {
    if (activeTab !== "Test Results") return;
    let active = true;
    setResultsLoading(true); setResultsError(null);
    getLearningProgress().then(progress => { if (active) setComparisons(progress.comparisons); })
      .catch(cause => { if (active) setResultsError(cause instanceof Error ? cause.message : "Could not load results."); })
      .finally(() => { if (active) setResultsLoading(false); });
    return () => { active = false; };
  }, [activeTab, retry]);

  useEffect(() => {
    setFileCursor(""); setFiles([]); setNextFileCursor(null);
  }, [startDate, endDate]);
  useEffect(() => {
    if (activeTab !== "Uploaded Files") return;
    const controller = new AbortController();
    setFilesLoading(true); setFilesError(null);
    listFileHistory({ after: fileCursor, from: startDate, to: endDate }, controller.signal)
      .then(page => { if (!controller.signal.aborted) {
        setFiles(previous => fileCursor ? [...previous, ...page.items.filter(item => !previous.some(loaded => loaded.id === item.id))] : page.items);
        setNextFileCursor(page.nextCursor);
      } }).catch(cause => { if (!controller.signal.aborted) setFilesError(cause instanceof Error ? cause.message : t("history.fileError")); })
      .finally(() => { if (!controller.signal.aborted) setFilesLoading(false); });
    return () => controller.abort();
  }, [activeTab, fileCursor, startDate, endDate, fileRetry, t]);
  const testResultsHistory = assessmentHistory(sessionHistory, comparisons);

  const chatHistory: ChatItem[] = sessionHistory.map((session) => ({
    id: session.id,
    title: session.title,
    lastMessage: `${t(`chat.stage.${session.stage}`)} · ${session.progressPercent}${t("history.percentCompleted")}`,
    date: session.updatedAt.slice(0, 10),
  }));

  const lessonsHistory = sessionHistory;

  const filterByDate = (dateStr: string) => {
    if (!startDate && !endDate) return true;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  const filteredChats = chatHistory.filter((item) => filterByDate(item.date));
  const filteredLessons = lessonsHistory.filter((item) =>
    filterByDate(item.updatedAt.slice(0, 10))
  );
  const filteredTestResults = testResultsHistory.filter(item => inHistoryDateRange(item.updatedAt, startDate, endDate));

  const formatDateDisplay = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-text relative transition-colors duration-200">
      {/* Modal เปิดดูไฟล์ */}
      {selectedFile && (
        <FileHistoryDetails key={selectedFile.id} file={selectedFile} language={language} onClose={() => setSelectedFile(null)}
          onReviewed={file => { setSelectedFile(file); setFiles(previous => previous.map(item => item.id === file.id ? file : item)); }} />
      )}

      <SiteHeader
        links={[
          { labelKey: "nav.create", href: "/Create" },
          { labelKey: "nav.lessons", href: "/Lessons" },
          { labelKey: "nav.home", href: "/Home" },
        ]}
      />

      {/* Main Content */}
      <main className="px-4 py-4 max-w-[1400px] mx-auto sm:px-10">
        <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-5xl">
          {t("history.title")}
        </h1>
        <br />

        <div className="flex flex-col gap-8 items-start lg:flex-row">
          {/* เรียกใช้งาน Sidebar กลาง (กำหนดให้ activeSection เป็น History) */}
          <AccountSidebar activeSection="History" activeTab={activeTab} />

          {/* Right Main Display Panel */}
          <section className="min-w-0 w-full flex-1 flex flex-col gap-4">
            {/* Filter Date Picker Bar */}
            {activeTab !== null ? (
              <div className="relative self-start">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  aria-expanded={isDatePickerOpen}
                  aria-controls="history-date-picker"
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
                  <div id="history-date-picker" className="absolute left-0 top-12 z-20 w-72 rounded-2xl border border-surface-border bg-surface p-4 shadow-xl flex flex-col gap-3 text-xs">
                    <p className="font-medium">{t("history.selectDateRange")}</p>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="history-date-from" className="text-muted">{t("history.from")}</label>
                      <input
                        type="date"
                        id="history-date-from"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-lg border border-surface-border bg-transparent p-2 outline-none focus:border-primary text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="history-date-to" className="text-muted">{t("history.to")}</label>
                      <input
                        type="date"
                        id="history-date-to"
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
              {activeTab !== "Uploaded Files" && (historyError || (activeTab === "Test Results" && resultsError)) && (
                <div role="alert" className="mb-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                  <p>{historyError || resultsError}</p>
                  <button type="button" onClick={() => setRetry(value => value + 1)} disabled={historyLoading || (activeTab === "Test Results" && resultsLoading)} className="mt-2 rounded-lg border border-danger/40 px-4 py-2 disabled:opacity-50">{t("history.retry")}</button>
                </div>
              )}
              {activeTab !== "Uploaded Files" && (historyLoading || (activeTab === "Test Results" && resultsLoading)) ? <p role="status" className="py-12 text-center text-muted">{t("history.loading")}</p> : null}
              {/* แท็บ Chat */}
              {activeTab === "Chat" && !historyLoading && !historyError && (
                <div className="flex flex-col gap-3 w-full">
                  {filteredChats.length === 0 ? (
                    <p className="text-muted text-sm text-center py-12">{t("history.noChats")}</p>
                  ) : (
                    filteredChats.map((chat) => (
                      <Link
                        key={chat.id}
                        href={`/Chat/${encodeURIComponent(chat.id)}`}
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
              {activeTab === "Lessons" && !historyLoading && !historyError && (
                <div className="grid grid-cols-1 gap-6 w-full items-start sm:grid-cols-2 xl:grid-cols-3">
                  {filteredLessons.length === 0 ? (
                    <p className="text-muted text-sm col-span-3 text-center py-12">{t("history.noLessons")}</p>
                  ) : (
                    filteredLessons.map((lesson) => (
                      <Link
                        key={lesson.id}
                        href={`/Lessons/${encodeURIComponent(lesson.id)}`}
                        className="rounded-2xl border border-surface-border p-4 bg-background flex flex-col gap-3 hover:border-primary/60 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold text-sm">{lesson.title}</h3>
                          <span className="text-[10px] text-muted">{t(`chat.stage.${lesson.stage}`)}</span>
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
                <div className="flex flex-col gap-4">
                  <UploadHistory language={language} from={startDate} to={endDate} onChanged={() => { setFileCursor(""); setFileRetry(value => value + 1); }} />
                  {filesError ? <div role="alert" className="rounded-xl border border-danger/40 p-3 text-sm text-danger">
                    <p>{filesError}</p><button type="button" disabled={filesLoading} onClick={() => setFileRetry(value => value + 1)}
                      className="mt-2 rounded-lg border border-danger/40 px-4 py-2 disabled:opacity-50">{t("history.retry")}</button>
                  </div> : null}
                  {filesLoading ? <p role="status" className="py-6 text-center text-muted">{t("history.loading")}</p> : null}
                  {(!filesError && !filesLoading) || files.length ? <FileHistoryCards items={files} language={language} onSelect={setSelectedFile} /> : null}
                  {nextFileCursor ? <button type="button" disabled={filesLoading} onClick={() => setFileCursor(nextFileCursor)}
                    className="self-start rounded-xl border border-surface-border px-4 py-2 text-sm disabled:opacity-50">{t("history.moreFiles")}</button> : null}
                </div>
              )}

              {/* แท็บ Test Results */}
              {activeTab === "Test Results" && !historyLoading && !resultsLoading && !resultsError && (
                <AssessmentHistory items={filteredTestResults} language={language} />
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
    <Suspense fallback={<div role="status">Loading… / กำลังโหลด…</div>}>
      <RequireAuth><HistoryContent /></RequireAuth>
    </Suspense>
  );
}
