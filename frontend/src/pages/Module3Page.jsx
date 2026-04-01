import { useEffect, useMemo, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import SegmentTabs from "../components/SegmentTabs";
import { recruitmentService } from "../services/recruitmentService";
import { jobOrderService } from "../services/jobOrderService";
import { CANDIDATE_STATUSES, CANDIDATE_STATUS_LABELS } from "../utils/constants";
import { formatDate } from "../utils/format";
import { getErrorMessage } from "../utils/toast";
import { useI18n } from "../i18n/I18nProvider";

const STORAGE_EXAM_KEY = "ihrms_m3_exam_records";
const STORAGE_TRAINING_KEY = "ihrms_m3_training_records";

const initialExamForm = {
  candidateId: "",
  jobOrderId: "",
  examDate: "",
  note: "",
};

const initialTrainingForm = {
  candidateId: "",
  moduleName: "",
  sessionDate: "",
  trainer: "",
  score: "",
  note: "",
};

function safeLoadArray(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function formatShortDate(value, locale) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function getInitials(name) {
  if (!name) return "--";
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getCandidateLabel(candidate) {
  if (!candidate) return "-";
  return `CCCD ${candidate.citizen_id || "-"} - ${candidate.full_name || "-"}`;
}

function Module3Page() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState("exam-list");
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [jobOrders, setJobOrders] = useState([]);
  const [examForm, setExamForm] = useState(initialExamForm);
  const [trainingForm, setTrainingForm] = useState(initialTrainingForm);
  const [examRecords, setExamRecords] = useState(() => safeLoadArray(STORAGE_EXAM_KEY));
  const [trainingRecords, setTrainingRecords] = useState(() =>
    safeLoadArray(STORAGE_TRAINING_KEY)
  );
  const [kanbanBoard, setKanbanBoard] = useState([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_EXAM_KEY, JSON.stringify(examRecords));
  }, [examRecords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_TRAINING_KEY, JSON.stringify(trainingRecords));
  }, [trainingRecords]);

  useEffect(() => {
    async function loadMasterData() {
      setLoading(true);
      setNotice({ type: "", text: "" });
      try {
        const [candRes, jobRes, kanbanRes] = await Promise.all([
          recruitmentService.getCandidates({ page: 1, limit: 200 }),
          jobOrderService.getJobOrders({ page: 1, limit: 200 }),
          recruitmentService.getKanban({ limit_per_status: 50 }),
        ]);

        setCandidates(candRes.data || []);
        setJobOrders(jobRes.data || []);
        setKanbanBoard(kanbanRes.data || []);
      } catch (err) {
        setNotice({ type: "error", text: getErrorMessage(err) });
      } finally {
        setLoading(false);
      }
    }

    loadMasterData();
  }, []);

  const candidateMap = useMemo(() => {
    const map = new Map();
    candidates.forEach((candidate) => map.set(String(candidate.id), candidate));
    return map;
  }, [candidates]);

  const jobMap = useMemo(() => {
    const map = new Map();
    jobOrders.forEach((job) => map.set(String(job.id), job));
    return map;
  }, [jobOrders]);

  const eligibleExamCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          candidate.status === "FORM_MATCHED_WAITING_EXAM" ||
          candidate.status === "WAITING_FORM_MATCH"
      ),
    [candidates]
  );

  const passedCandidates = useMemo(
    () =>
      examRecords
        .filter((record) => record.resultStatus === "PASS")
        .map((record) => candidateMap.get(String(record.candidateId)))
        .filter(Boolean),
    [examRecords, candidateMap]
  );

  const kanbanByColumn = useMemo(
    () =>
      CANDIDATE_STATUSES.map((status) => {
        const matched = kanbanBoard.find((column) => column.status === status);
        return {
          key: status,
          title: CANDIDATE_STATUS_LABELS[status] || status,
          items: matched?.items || [],
        };
      }),
    [kanbanBoard]
  );

  const resultStatusLabels = useMemo(
    () => ({
      PENDING: t("module3.resultPending"),
      PASS: t("module3.resultPass"),
      RESERVE: t("module3.resultReserve"),
      FAIL: t("module3.resultFail"),
    }),
    [t]
  );

  const loadMasterData = async () => {
    setLoading(true);
    setNotice({ type: "", text: "" });
    try {
      const [candRes, jobRes, kanbanRes] = await Promise.all([
        recruitmentService.getCandidates({ page: 1, limit: 200 }),
        jobOrderService.getJobOrders({ page: 1, limit: 200 }),
        recruitmentService.getKanban({ limit_per_status: 50 }),
      ]);

      setCandidates(candRes.data || []);
      setJobOrders(jobRes.data || []);
      setKanbanBoard(kanbanRes.data || []);
    } catch (err) {
      setNotice({ type: "error", text: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const updateRecordStatus = (recordId, resultStatus) => {
    setExamRecords((prev) =>
      prev.map((item) =>
        item.id === recordId
          ? { ...item, resultStatus, updatedAt: new Date().toISOString() }
          : item
      )
    );

    setNotice({
      type: "ok",
      text:
        resultStatus === "FAIL"
          ? t("module3.noticeExamFailed")
          : t("module3.noticeExamUpdated"),
    });
  };

  const handleCreateExamRecord = (event) => {
    event.preventDefault();
    if (!examForm.candidateId || !examForm.jobOrderId || !examForm.examDate) {
      setNotice({ type: "error", text: t("module3.noticeExamRequired") });
      return;
    }

    const newRecord = {
      id: `EX-${Date.now()}`,
      candidateId: examForm.candidateId,
      jobOrderId: examForm.jobOrderId,
      examDate: examForm.examDate,
      note: examForm.note,
      resultStatus: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setExamRecords((prev) => [newRecord, ...prev]);
    setExamForm(initialExamForm);
    setNotice({ type: "ok", text: t("module3.noticeExamAdded") });
  };

  const handleCreateTrainingRecord = (event) => {
    event.preventDefault();
    if (!trainingForm.candidateId || !trainingForm.moduleName || !trainingForm.sessionDate) {
      setNotice({ type: "error", text: t("module3.noticeTrainingRequired") });
      return;
    }

    const scoreNum = Number(trainingForm.score);
    const newRecord = {
      id: `TR-${Date.now()}`,
      candidateId: trainingForm.candidateId,
      moduleName: trainingForm.moduleName,
      sessionDate: trainingForm.sessionDate,
      trainer: trainingForm.trainer,
      score: Number.isNaN(scoreNum) ? null : scoreNum,
      note: trainingForm.note,
      createdAt: new Date().toISOString(),
    };

    setTrainingRecords((prev) => [newRecord, ...prev]);
    setTrainingForm(initialTrainingForm);
    setNotice({ type: "ok", text: t("module3.noticeTrainingSaved") });
  };

  const tabs = [
    { key: "exam-list", label: t("module3.tabExamList") },
    { key: "exam-result", label: t("module3.tabExamResult") },
    { key: "training", label: t("module3.tabTraining") },
    { key: "kanban", label: t("module3.tabKanban") },
  ];

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader
          title={t("module3.title")}
          subtitle={t("module3.subtitle")}
          action={
            <button type="button" className="btn ghost" onClick={loadMasterData}>
              {t("common.refresh")}
            </button>
          }
        />

        {notice.text ? (
          <p className={notice.type === "error" ? "error-text" : "success-text"}>
            {notice.text}
          </p>
        ) : null}

        {loading ? <p className="muted">{t("module3.loading")}</p> : null}

        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "kanban" ? (
        <div className="kanban-shell">
          <SectionHeader
            title={t("module3.kanbanTitle")}
            subtitle={t("module3.kanbanSubtitle")}
            action={
              <button type="button" className="kanban-toolbar__button" onClick={loadMasterData}>
                {t("common.refresh")}
              </button>
            }
          />

          <div className="kanban-board-modern">
            {kanbanByColumn.map((column) => (
              <section key={column.key} className="kanban-column-modern">
                <div className="kanban-column-modern__head">
                  <h4>{column.title}</h4>
                  <span>{column.items.length}</span>
                </div>

                <div className="kanban-column-modern__list">
                  {column.items.map((candidate) => (
                    <article key={candidate.id} className="kanban-task">
                      <div className="kanban-task__tags">
                        <span className="kanban-task__tag kanban-task__tag--source">
                          {candidate.source_name || "Chưa có nguồn"}
                        </span>
                        <span
                          className={`kanban-task__tag ${
                            candidate.is_fee0_paid
                              ? "kanban-task__tag--paid"
                              : "kanban-task__tag--unpaid"
                          }`}
                        >
                          {candidate.is_fee0_paid ? "Đã đóng phí 0" : "Chưa đóng phí 0"}
                        </span>
                      </div>

                      <h5>{getCandidateLabel(candidate)}</h5>
                      <p>{candidate.phone || candidate.email || "Chưa có thông tin liên hệ"}</p>
                      <div className="kanban-task__details">
                        <span>{candidate.email || "Chưa có email"}</span>
                        <span>{candidate.phone || "Chưa có số điện thoại"}</span>
                        <span>{candidate.source_note || "Không có ghi chú nguồn"}</span>
                      </div>

                      <div className="kanban-task__meta">
                        <span
                          className={`kanban-task__priority ${
                            candidate.is_fee0_paid
                              ? "kanban-task__priority--medium"
                              : "kanban-task__priority--low"
                          }`}
                        >
                          {candidate.is_fee0_paid ? "Fee0 OK" : "Fee0 Pending"}
                        </span>
                        <span className="kanban-task__date">
                          {formatShortDate(candidate.updated_at, locale)}
                        </span>
                        <span className="kanban-task__avatar">
                          {getInitials(candidate.full_name)}
                        </span>
                      </div>
                    </article>
                  ))}
                  {!column.items.length ? (
                    <article className="kanban-task kanban-task--empty">
                      <p>{t("common.noDataYet")}</p>
                    </article>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "exam-list" ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title={t("module3.examAddTitle")} />

            <form className="grid-form" onSubmit={handleCreateExamRecord}>
              <label>
                {t("module3.candidate")}
                <select
                  value={examForm.candidateId}
                  onChange={(e) =>
                    setExamForm((prev) => ({ ...prev, candidateId: e.target.value }))
                  }
                >
                  <option value="">{t("common.chooseCandidate")}</option>
                  {eligibleExamCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {getCandidateLabel(candidate)} (
                      {CANDIDATE_STATUS_LABELS[candidate.status] || candidate.status})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {t("module3.jobOrder")}
                <select
                  value={examForm.jobOrderId}
                  onChange={(e) =>
                    setExamForm((prev) => ({ ...prev, jobOrderId: e.target.value }))
                  }
                >
                  <option value="">{t("common.chooseJobOrder")}</option>
                  {jobOrders.map((job) => (
                    <option key={job.id} value={job.id}>
                      #{job.id} {job.job_title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {t("module3.examDate")}
                <input
                  type="date"
                  value={examForm.examDate}
                  onChange={(e) =>
                    setExamForm((prev) => ({ ...prev, examDate: e.target.value }))
                  }
                />
              </label>

              <label className="field-span-2">
                {t("common.note")}
                <input
                  value={examForm.note}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </label>

              <button type="submit" className="btn field-span-2">
                {t("module3.addToExamList")}
              </button>
            </form>
          </div>

          <div>
            <SectionHeader title={t("module3.examScheduledTitle")} />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("module3.candidate")}</th>
                    <th>{t("module3.jobOrder")}</th>
                    <th>{t("module3.examDate")}</th>
                    <th>{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {examRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{candidateMap.get(String(record.candidateId))?.full_name || "-"}</td>
                      <td>{jobMap.get(String(record.jobOrderId))?.job_title || "-"}</td>
                      <td>{formatDate(record.examDate)}</td>
                      <td>
                        <span className="badge">
                          {resultStatusLabels[record.resultStatus] || record.resultStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!examRecords.length ? (
                    <tr>
                      <td colSpan={4} className="center muted">
                        {t("common.noDataYet")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "exam-result" ? (
        <div className="surface">
          <SectionHeader title={t("module3.examResultTitle")} />

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("module3.candidate")}</th>
                  <th>{t("module3.jobOrder")}</th>
                  <th>{t("module3.examDate")}</th>
                  <th>{t("module3.currentResult")}</th>
                  <th>{t("common.action")}</th>
                </tr>
              </thead>
              <tbody>
                {examRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{candidateMap.get(String(record.candidateId))?.full_name || "-"}</td>
                    <td>{jobMap.get(String(record.jobOrderId))?.job_title || "-"}</td>
                    <td>{formatDate(record.examDate)}</td>
                    <td>
                      <span className="badge">
                        {resultStatusLabels[record.resultStatus] || record.resultStatus}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => updateRecordStatus(record.id, "PASS")}
                        >
                          {t("module3.pass")}
                        </button>
                        <button
                          type="button"
                          className="btn small ghost"
                          onClick={() => updateRecordStatus(record.id, "RESERVE")}
                        >
                          {t("module3.reserve")}
                        </button>
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => updateRecordStatus(record.id, "FAIL")}
                        >
                          {t("module3.fail")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!examRecords.length ? (
                  <tr>
                    <td colSpan={5} className="center muted">
                      {t("common.noDataYet")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "training" ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title={t("module3.trainingScheduleTitle")} />

            <form className="grid-form" onSubmit={handleCreateTrainingRecord}>
              <label>
                {t("module3.candidate")}
                <select
                  value={trainingForm.candidateId}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, candidateId: e.target.value }))
                  }
                >
                  <option value="">{t("common.chooseCandidate")}</option>
                  {passedCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {getCandidateLabel(candidate)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {t("module3.moduleName")}
                <input
                  value={trainingForm.moduleName}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, moduleName: e.target.value }))
                  }
                />
              </label>

              <label>
                {t("module3.sessionDate")}
                <input
                  type="date"
                  value={trainingForm.sessionDate}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, sessionDate: e.target.value }))
                  }
                />
              </label>

              <label>
                {t("module3.trainer")}
                <input
                  value={trainingForm.trainer}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, trainer: e.target.value }))
                  }
                />
              </label>

              <label>
                {t("module3.score")}
                <input
                  type="number"
                  value={trainingForm.score}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, score: e.target.value }))
                  }
                />
              </label>

              <label className="field-span-2">
                {t("common.note")}
                <input
                  value={trainingForm.note}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, note: e.target.value }))
                  }
                />
              </label>

              <button type="submit" className="btn field-span-2">
                {t("module3.saveTrainingSchedule")}
              </button>
            </form>
          </div>

          <div>
            <SectionHeader title={t("module3.trainingProgressTitle")} />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("module3.candidate")}</th>
                    <th>{t("module3.moduleName")}</th>
                    <th>{t("module3.sessionDate")}</th>
                    <th>{t("module3.score")}</th>
                    <th>{t("module3.savedAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingRecords.map((row) => (
                    <tr key={row.id}>
                      <td>{candidateMap.get(String(row.candidateId))?.full_name || "-"}</td>
                      <td>{row.moduleName}</td>
                      <td>{formatDate(row.sessionDate)}</td>
                      <td>{row.score ?? "-"}</td>
                      <td>{new Date(row.createdAt).toLocaleString(locale)}</td>
                    </tr>
                  ))}
                  {!trainingRecords.length ? (
                    <tr>
                      <td colSpan={5} className="center muted">
                        {t("common.noDataYet")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Module3Page;
