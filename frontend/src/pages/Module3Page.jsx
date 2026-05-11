import { useEffect, useMemo, useState } from "react";
import DetailModal from "../components/DetailModal";
import SectionHeader from "../components/SectionHeader";
import SegmentTabs from "../components/SegmentTabs";
import { useToast } from "../components/ToastProvider";
import { recruitmentService } from "../services/recruitmentService";
import { jobOrderService } from "../services/jobOrderService";
import { examApplicationService } from "../services/examApplicationService";
import { CANDIDATE_STATUSES, CANDIDATE_STATUS_LABELS } from "../utils/constants";
import { formatDate, formatDateTime } from "../utils/format";
import { getErrorMessage } from "../utils/toast";
import { useI18n } from "../i18n/I18nProvider";
import { getCurrentDateTimeLocal, isFutureDateTimeInput } from "../utils/validation";

const STORAGE_TRAINING_KEY = "ihrms_m3_training_records";

const initialExamForm = {
  jobOrderId: "",
  examDate: "",
  selectedExamAppIds: []
};

const initialTrainingForm = {
  candidateId: "",
  moduleName: "",
  sessionDate: "",
  trainer: "",
  score: "",
  note: ""
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

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
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
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("exam-list");
  const [loading, setLoading] = useState(false);

  const [candidates, setCandidates] = useState([]);
  const [jobOrders, setJobOrders] = useState([]);
  const [examRecords, setExamRecords] = useState([]);
  const [scheduleSessions, setScheduleSessions] = useState([]);
  const [resultSessions, setResultSessions] = useState([]);
  const [trainingRecords, setTrainingRecords] = useState(() =>
    safeLoadArray(STORAGE_TRAINING_KEY)
  );


  const [pendingCandidatesForJob, setPendingCandidatesForJob] = useState([]);
  const [pendingCandidatesLoading, setPendingCandidatesLoading] = useState(false);
  const [pendingSearch, setPendingSearch] = useState("");
  const [unscheduledOnly, setUnscheduledOnly] = useState(true);

  const [examForm, setExamForm] = useState(initialExamForm);
  const [trainingForm, setTrainingForm] = useState(initialTrainingForm);

  const [scheduleDetailOpen, setScheduleDetailOpen] = useState(false);
  const [resultDetailOpen, setResultDetailOpen] = useState(false);
  const [sessionDetailMode, setSessionDetailMode] = useState("view");
  const [selectedScheduleSessionKey, setSelectedScheduleSessionKey] = useState(null);
  const [selectedResultSessionKey, setSelectedResultSessionKey] = useState(null);
  const [scheduleSessionDetail, setScheduleSessionDetail] = useState(null);
  const [resultSessionDetail, setResultSessionDetail] = useState(null);
  const [sessionDateDraft, setSessionDateDraft] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionUpdating, setSessionUpdating] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState(null);
  const [bulkResultIds, setBulkResultIds] = useState([]);
  const [bulkResultUpdating, setBulkResultUpdating] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_TRAINING_KEY, JSON.stringify(trainingRecords));
  }, [trainingRecords]);

  const loadMasterData = async () => {
    setLoading(true);
    try {
      const [candRes, jobRes, examRes, scheduleRes, resultRes] = await Promise.all([
        recruitmentService.getCandidates({ page: 1, limit: 200 }),
        jobOrderService.getJobOrders({ page: 1, limit: 200 }),
        examApplicationService.getExamApplications({ page: 1, limit: 1200 }),
        examApplicationService.getExamSessions({ view: "schedule" }),
        examApplicationService.getExamSessions({ view: "result" })
      ]);

      setCandidates(candRes.data || []);
      setJobOrders(jobRes.data || []);
      setExamRecords(examRes.data || []);
      setScheduleSessions(scheduleRes.data || []);
      setResultSessions(resultRes.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCandidatesByJobOrder = async (jobOrderId) => {
    if (!jobOrderId) {
      setPendingCandidatesForJob([]);
      return;
    }

    setPendingCandidatesLoading(true);
    try {
      const res = await examApplicationService.getPendingCandidatesByJobOrder(jobOrderId);
      setPendingCandidatesForJob(res.data?.candidates || []);
    } catch (err) {
      setPendingCandidatesForJob([]);
      toast.error(getErrorMessage(err));
    } finally {
      setPendingCandidatesLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const candidateMap = useMemo(() => {
    const map = new Map();
    candidates.forEach((candidate) => map.set(String(candidate.id), candidate));
    return map;
  }, [candidates]);

  const passedCandidates = useMemo(
    () =>
      examRecords
        .filter((record) => record.result_status === "Pass")
        .map((record) => candidateMap.get(String(record.candidate_id)))
        .filter(Boolean),
    [examRecords, candidateMap]
  );

  const resultStatusLabels = useMemo(
    () => ({
      Pending: t("module3.resultPending"),
      Pass: t("module3.resultPass"),
      Reserve: t("module3.resultReserve"),
      Fail: t("module3.resultFail")
    }),
    [t]
  );

  const pendingCountByJobOrder = useMemo(() => {
    const map = new Map();
    examRecords.forEach((record) => {
      if (record.result_status !== "Pending") return;
      const key = String(record.job_order_id);
      map.set(key, Number(map.get(key) || 0) + 1);
    });
    return map;
  }, [examRecords]);

  const schedulableJobOrders = useMemo(
    () =>
      jobOrders
        .filter((job) => pendingCountByJobOrder.has(String(job.id)))
        .map((job) => ({
          ...job,
          pending_count: pendingCountByJobOrder.get(String(job.id)) || 0
        })),
    [jobOrders, pendingCountByJobOrder]
  );

  const scheduleSummaryRows = useMemo(
    () =>
      scheduleSessions.map((session) => ({
        ...session,
        can_edit: Number(session.pending_candidates || 0) === Number(session.total_candidates || 0)
      })),
    [scheduleSessions]
  );

  const filteredPendingCandidates = useMemo(() => {
    const keyword = String(pendingSearch || "").trim().toLowerCase();
    return pendingCandidatesForJob.filter((row) => {
      if (unscheduledOnly && row.exam_date) return false;
      if (!keyword) return true;

      const haystack = [
        row.candidate_name,
        row.candidate_citizen_id,
        row.candidate_phone,
        row.candidate_email
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [pendingCandidatesForJob, pendingSearch, unscheduledOnly]);

  const selectablePendingCandidates = useMemo(
    () => filteredPendingCandidates.filter((row) => !row.exam_date),
    [filteredPendingCandidates]
  );

  const allSelectedOnCurrentJob =
    selectablePendingCandidates.length > 0 &&
    selectablePendingCandidates.every((row) => examForm.selectedExamAppIds.includes(row.id));

  const pendingResultCandidateIds = useMemo(
    () =>
      (resultSessionDetail?.candidates || [])
        .filter((row) => row.result_status === "Pending")
        .map((row) => row.id),
    [resultSessionDetail]
  );

  const allResultCandidateIds = useMemo(
    () => (resultSessionDetail?.candidates || []).map((row) => row.id),
    [resultSessionDetail]
  );

  const allPendingResultsSelected =
    allResultCandidateIds.length > 0 &&
    allResultCandidateIds.every((id) => bulkResultIds.includes(id));

  useEffect(() => {
    const unscheduledIds = new Set(
      pendingCandidatesForJob.filter((row) => !row.exam_date).map((row) => row.id)
    );
    setExamForm((prev) => ({
      ...prev,
      selectedExamAppIds: prev.selectedExamAppIds.filter((id) => unscheduledIds.has(id))
    }));
  }, [pendingCandidatesForJob]);

  const handleExamJobOrderChange = async (jobOrderId) => {
    setExamForm((prev) => ({
      ...prev,
      jobOrderId,
      selectedExamAppIds: []
    }));
    setPendingSearch("");
    await loadPendingCandidatesByJobOrder(jobOrderId);
  };

  const toggleExamAppSelection = (examAppId, checked) => {
    setExamForm((prev) => {
      const current = Array.isArray(prev.selectedExamAppIds) ? prev.selectedExamAppIds : [];
      const next = checked ? [...new Set([...current, examAppId])] : current.filter((id) => id !== examAppId);
      return { ...prev, selectedExamAppIds: next };
    });
  };

  const toggleSelectAllExamApps = (checked) => {
    setExamForm((prev) => ({
      ...prev,
      selectedExamAppIds: checked ? selectablePendingCandidates.map((row) => row.id) : []
    }));
  };

  const handleCreateExamRecord = async (event) => {
    event.preventDefault();

    const allowedIds = new Set(
      pendingCandidatesForJob.filter((row) => !row.exam_date).map((row) => row.id)
    );
    const validSelectedIds = examForm.selectedExamAppIds.filter((id) => allowedIds.has(id));

    if (!examForm.jobOrderId || !examForm.examDate || !validSelectedIds.length) {
      toast.error("Vui lòng chọn đơn hàng, ngày thi và ít nhất 1 ứng viên.");
      return;
    }

    if (!isFutureDateTimeInput(examForm.examDate)) {
      toast.error("Ngày thi phải sau thời điểm hiện tại.");
      return;
    }

    try {
      await examApplicationService.bulkScheduleSession({
        job_order_id: Number(examForm.jobOrderId),
        exam_application_ids: validSelectedIds,
        exam_date: examForm.examDate
      });

      setExamForm((prev) => ({ ...prev, selectedExamAppIds: [] }));
      await Promise.all([loadMasterData(), loadPendingCandidatesByJobOrder(examForm.jobOrderId)]);
      toast.success("Đã tạo/gộp ca thi cho danh sách ứng viên đã chọn.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const loadSessionDetail = async (sessionKey, target = "schedule") => {
    setSessionLoading(true);
    try {
      const res = await examApplicationService.getExamSessionDetail(sessionKey);
      if (target === "schedule") {
        setScheduleSessionDetail(res.data || null);
      } else {
        setResultSessionDetail(res.data || null);
      }
      return res.data || null;
    } finally {
      setSessionLoading(false);
    }
  };

  const handleOpenScheduleDetail = async (session, mode = "view") => {
    setSessionDetailMode(mode);
    setSelectedScheduleSessionKey(session.session_key);
    try {
      const detail = await loadSessionDetail(session.session_key, "schedule");
      setSessionDateDraft(toDateTimeLocal(detail?.exam_date));
      setScheduleDetailOpen(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleOpenResultDetail = async (session) => {
    setSelectedResultSessionKey(session.session_key);
    setBulkResultIds([]);
    try {
      await loadSessionDetail(session.session_key, "result");
      setResultDetailOpen(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleUpdateSessionDate = async () => {
    if (!selectedScheduleSessionKey) return;
    if (!sessionDateDraft) {
      toast.error("Vui lòng chọn ngày giờ ca thi.");
      return;
    }

    if (!isFutureDateTimeInput(sessionDateDraft)) {
      toast.error("Ngày giờ ca thi phải sau thời điểm hiện tại.");
      return;
    }

    setSessionUpdating(true);
    try {
      await examApplicationService.updateExamSession(selectedScheduleSessionKey, {
        exam_date: sessionDateDraft
      });
      await loadMasterData();
      setScheduleDetailOpen(false);
      setScheduleSessionDetail(null);
      setSelectedScheduleSessionKey(null);
      toast.success("Đã cập nhật thông tin ca thi.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSessionUpdating(false);
    }
  };

  const handleRemoveCandidateFromSession = async (examApplicationId) => {
    if (!selectedScheduleSessionKey) return;

    setRowLoadingId(examApplicationId);
    try {
      await examApplicationService.deleteExamApplication(examApplicationId);
      await loadMasterData();

      const refreshed = await examApplicationService.getExamSessionDetail(selectedScheduleSessionKey);
      setScheduleSessionDetail(refreshed.data || null);
      toast.success("Đã xóa ứng viên khỏi ca thi.");
    } catch (err) {
      if (String(err?.response?.status || "") === "404") {
        setScheduleDetailOpen(false);
        setScheduleSessionDetail(null);
        setSelectedScheduleSessionKey(null);
        toast.success("Ca thi không còn ứng viên, đã được đóng.");
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setRowLoadingId(null);
    }
  };

  const handleUpdateResultInSession = async (examApplicationId, resultStatus) => {
    if (!selectedResultSessionKey) return;

    setRowLoadingId(examApplicationId);
    try {
      await examApplicationService.updateExamResult(examApplicationId, {
        result_status: resultStatus
      });
      await loadMasterData();
      const refreshed = await examApplicationService.getExamSessionDetail(selectedResultSessionKey);
      setResultSessionDetail(refreshed.data || null);
      setBulkResultIds((prev) => prev.filter((id) => id !== examApplicationId));
      toast.success(
        resultStatus === "Fail" ? t("module3.noticeExamFailed") : t("module3.noticeExamUpdated")
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRowLoadingId(null);
    }
  };

  const toggleBulkResultSelection = (examApplicationId, checked) => {
    setBulkResultIds((prev) => {
      if (checked) {
        return [...new Set([...prev, examApplicationId])];
      }
      return prev.filter((id) => id !== examApplicationId);
    });
  };

  const toggleSelectAllPendingResults = (checked) => {
    setBulkResultIds(checked ? [...allResultCandidateIds] : []);
  };

  const handleBulkUpdateResults = async (resultStatus) => {
    if (!bulkResultIds.length) {
      toast.error("Vui lòng chọn ít nhất 1 ứng viên chờ kết quả.");
      return;
    }

    setBulkResultUpdating(true);
    try {
      await Promise.all(
        bulkResultIds.map((examApplicationId) =>
          examApplicationService.updateExamResult(examApplicationId, {
            result_status: resultStatus
          })
        )
      );

      await loadMasterData();
      const refreshed = await examApplicationService.getExamSessionDetail(selectedResultSessionKey);
      setResultSessionDetail(refreshed.data || null);
      setBulkResultIds([]);
      toast.success(
        resultStatus === "Fail"
          ? "Đã cập nhật hàng loạt: Kho trượt."
          : "Đã cập nhật hàng loạt: Đạt."
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBulkResultUpdating(false);
    }
  };

  const handleCreateTrainingRecord = (event) => {
    event.preventDefault();
    if (!trainingForm.candidateId || !trainingForm.moduleName || !trainingForm.sessionDate) {
      toast.error(t("module3.noticeTrainingRequired"));
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
      createdAt: new Date().toISOString()
    };

    setTrainingRecords((prev) => [newRecord, ...prev]);
    setTrainingForm(initialTrainingForm);
    toast.success(t("module3.noticeTrainingSaved"));
  };

  const tabs = [
    { key: "exam-list", label: t("module3.tabExamList") },
    { key: "exam-result", label: t("module3.tabExamResult") },

  ];

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader
          title={t("module3.title")}
    
          action={
            <button type="button" className="btn ghost" onClick={loadMasterData}>
              {t("common.refresh")}
            </button>
          }
        />

        {loading ? <p className="muted">{t("module3.loading")}</p> : null}

        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "exam-list" ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title="Tạo ca thi hàng loạt" />

            <form className="grid-form" onSubmit={handleCreateExamRecord}>
              <label className="field-span-2">
                {t("module3.jobOrder")}
                <select
                  value={examForm.jobOrderId}
                  onChange={(e) => handleExamJobOrderChange(e.target.value)}
                >
                  <option value="">Chọn đơn hàng</option>
                  {schedulableJobOrders.map((job) => (
                    <option key={job.id} value={job.id}>
                      #{job.id} {job.job_title} ({job.pending_count} ứng viên chờ)
                    </option>
                  ))}
                </select>
              </label>

              <div className="field-span-2">
                <div className="inline-form" style={{ marginBottom: 8 }}>
                  <input
                    placeholder="Tìm nhanh theo tên / CCCD / SĐT / email"
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    className={`btn small ${unscheduledOnly ? "" : "ghost"}`}
                    onClick={() => setUnscheduledOnly((prev) => !prev)}
                  >
                    {unscheduledOnly ? "Đang lọc: Chưa có ngày thi" : "Hiện cả đã có ngày thi"}
                  </button>
                </div>

                <div className="inline-form" style={{ marginBottom: 8 }}>
                  <label className="inline-label">
                    <input
                      type="checkbox"
                      checked={allSelectedOnCurrentJob}
                      disabled={!selectablePendingCandidates.length}
                      onChange={(e) => toggleSelectAllExamApps(e.target.checked)}
                    />
                    <span>Chọn tất cả ứng viên chưa có ngày thi</span>
                  </label>
                  <span className="tiny muted">
                    Đã chọn {examForm.selectedExamAppIds.length}/{selectablePendingCandidates.length}
                  </span>
                </div>

                <div className="table-wrap compact-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Ứng viên</th>
                        <th>CCCD</th>
                        <th>Liên hệ</th>
                        <th>Trạng thái lịch thi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPendingCandidates.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="checkbox"
                              disabled={Boolean(row.exam_date)}
                              checked={examForm.selectedExamAppIds.includes(row.id)}
                              onChange={(e) => toggleExamAppSelection(row.id, e.target.checked)}
                            />
                          </td>
                          <td>{row.candidate_name || "-"}</td>
                          <td>{row.candidate_citizen_id || "-"}</td>
                          <td>{row.candidate_phone || row.candidate_email || "-"}</td>
                          <td>
                            {row.exam_date ? (
                              <span className="tiny muted">Đã có ca: {formatDateTime(row.exam_date)}</span>
                            ) : (
                              <span className="tiny">Chưa có ngày thi</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!filteredPendingCandidates.length ? (
                        <tr>
                          <td colSpan={5} className="center muted">
                            {pendingCandidatesLoading
                              ? "Đang tải ứng viên chờ..."
                              : "Không có ứng viên theo bộ lọc hiện tại."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <label className="field-span-2">
                {t("module3.examDate")}
                <input
                  type="datetime-local"
                  value={examForm.examDate}
                  min={getCurrentDateTimeLocal()}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, examDate: e.target.value }))}
                />
              </label>

              <button type="submit" className="btn field-span-2">
                Tạo ca thi cho danh sách đã chọn
              </button>
            </form>
          </div>

          <div>
            <SectionHeader title="Danh sách ca thi" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ngày giờ ca thi</th>
                    <th>Đơn hàng</th>
                    <th>Đối tác</th>
                    <th>Số ứng viên</th>
                    <th>Đang chờ kết quả</th>
                    <th>Đã có kết quả</th>
                    <th>{t("common.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleSummaryRows.map((session) => (
                    <tr key={session.session_key}>
                      <td>{formatDateTime(session.exam_date)}</td>
                      <td>{session.job_title || `#${session.job_order_id}`}</td>
                      <td>{session.partner_name || "-"}</td>
                      <td>{session.total_candidates}</td>
                      <td>{session.pending_candidates}</td>
                      <td>
                        {Number(session.total_candidates || 0) - Number(session.pending_candidates || 0)}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn small ghost"
                            onClick={() => handleOpenScheduleDetail(session, "view")}
                          >
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            className="btn small"
                            disabled={!session.can_edit}
                            onClick={() => handleOpenScheduleDetail(session, "edit")}
                            title={
                              session.can_edit
                                ? "Sửa thông tin ca thi"
                                : "Ca đã có kết quả, không thể sửa toàn ca"
                            }
                          >
                            Sửa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!scheduleSummaryRows.length ? (
                    <tr>
                      <td colSpan={7} className="center muted">
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
          <SectionHeader title="Kết quả thi theo ca" />

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày giờ ca thi</th>
                  <th>Đơn hàng</th>
                  <th>Đối tác</th>
                  <th>Tổng ứng viên</th>
                  <th>Đạt</th>
                  <th>Kho trượt</th>
                  <th>Chờ xử lý</th>
                  <th>{t("common.action")}</th>
                </tr>
              </thead>
              <tbody>
                {resultSessions.map((session) => (
                  <tr key={session.session_key}>
                    <td>{formatDateTime(session.exam_date)}</td>
                    <td>{session.job_title || `#${session.job_order_id}`}</td>
                    <td>{session.partner_name || "-"}</td>
                    <td>{session.total_candidates}</td>
                    <td>{session.passed_candidates}</td>
                    <td>{session.failed_candidates}</td>
                    <td>{session.pending_candidates}</td>
                    <td>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => handleOpenResultDetail(session)}
                      >
                        Xem ứng viên
                      </button>
                    </td>
                  </tr>
                ))}
                {!resultSessions.length ? (
                  <tr>
                    <td colSpan={8} className="center muted">
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

      <DetailModal
        open={scheduleDetailOpen}
        title={
          scheduleSessionDetail
            ? `Chi tiết ca thi ${formatDateTime(scheduleSessionDetail.exam_date)}`
            : "Chi tiết ca thi"
        }
        onClose={() => {
          setScheduleDetailOpen(false);
          setScheduleSessionDetail(null);
          setSelectedScheduleSessionKey(null);
          setSessionDateDraft("");
        }}
      >
        {sessionLoading ? <p className="muted">Đang tải chi tiết ca thi...</p> : null}

        {scheduleSessionDetail ? (
          <>
            <div className="stats-inline">
              <div className="mini-stat">
                <span>Đơn hàng</span>
                <strong>{scheduleSessionDetail.job_title || `#${scheduleSessionDetail.job_order_id}`}</strong>
              </div>
              <div className="mini-stat">
                <span>Đối tác</span>
                <strong>{scheduleSessionDetail.partner_name || "-"}</strong>
              </div>
              <div className="mini-stat">
                <span>Tổng ứng viên</span>
                <strong>{scheduleSessionDetail.total_candidates}</strong>
              </div>
            </div>

            {sessionDetailMode === "edit" ? (
              <div className="grid-form" style={{ marginTop: 8 }}>
                <label className="field-span-2">
                  Ngày giờ ca thi
                  <input
                    type="datetime-local"
                    value={sessionDateDraft}
                    min={getCurrentDateTimeLocal()}
                    onChange={(e) => setSessionDateDraft(e.target.value)}
                  />
                </label>
                <div className="field-span-2 row-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={handleUpdateSessionDate}
                    disabled={sessionUpdating}
                  >
                    {sessionUpdating ? "Đang cập nhật..." : "Lưu ca thi"}
                  </button>
                </div>
              </div>
            ) : null}

            <SectionHeader title="Danh sách ứng viên trong ca" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ứng viên</th>
                    <th>CCCD</th>
                    <th>Kết quả</th>
                    {sessionDetailMode === "edit" ? <th>Thao tác</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {scheduleSessionDetail.candidates.map((row) => (
                    <tr key={row.id}>
                      <td>{row.candidate_name || "-"}</td>
                      <td>{row.candidate_citizen_id || "-"}</td>
                      <td>
                        <span className="badge">
                          {resultStatusLabels[row.result_status] || row.result_status}
                        </span>
                      </td>
                      {sessionDetailMode === "edit" ? (
                        <td>
                          <button
                            type="button"
                            className="btn text danger"
                            disabled={row.result_status !== "Pending" || rowLoadingId === row.id}
                            onClick={() => handleRemoveCandidateFromSession(row.id)}
                            title={
                              row.result_status === "Pending"
                                ? "Xóa ứng viên khỏi ca thi"
                                : "Ứng viên đã có kết quả, không thể xóa"
                            }
                          >
                            {rowLoadingId === row.id ? "Đang xóa..." : "Xóa ứng viên"}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {!scheduleSessionDetail.candidates.length ? (
                    <tr>
                      <td
                        colSpan={sessionDetailMode === "edit" ? 4 : 3}
                        className="center muted"
                      >
                        Không có ứng viên trong ca thi.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </DetailModal>

      <DetailModal
        open={resultDetailOpen}
        title={
          resultSessionDetail
            ? `Kết quả ca thi ${formatDateTime(resultSessionDetail.exam_date)}`
            : "Kết quả ca thi"
        }
        onClose={() => {
          setResultDetailOpen(false);
          setResultSessionDetail(null);
          setSelectedResultSessionKey(null);
          setBulkResultIds([]);
        }}
      >
        {sessionLoading ? <p className="muted">Đang tải danh sách ứng viên...</p> : null}

        {resultSessionDetail ? (
          <>
            <div className="stats-inline">
              <div className="mini-stat">
                <span>Đơn hàng</span>
                <strong>{resultSessionDetail.job_title || `#${resultSessionDetail.job_order_id}`}</strong>
              </div>
              <div className="mini-stat">
                <span>Đạt</span>
                <strong>{resultSessionDetail.passed_candidates}</strong>
              </div>
              <div className="mini-stat">
                <span>Kho trượt</span>
                <strong>{resultSessionDetail.failed_candidates}</strong>
              </div>
            </div>

            <div className="inline-form" style={{ marginBottom: 8 }}>
              <label className="inline-label">
                <input
                  type="checkbox"
                  checked={allPendingResultsSelected}
                  disabled={!allResultCandidateIds.length || bulkResultUpdating}
                  onChange={(e) => toggleSelectAllPendingResults(e.target.checked)}
                />
                <span>Chọn tất cả ứng viên</span>
              </label>
              <button
                type="button"
                className="btn small"
                disabled={!bulkResultIds.length || bulkResultUpdating}
                onClick={() => handleBulkUpdateResults("Pass")}
              >
                Đỗ hàng loạt
              </button>
              <button
                type="button"
                className="btn small"
                disabled={!bulkResultIds.length || bulkResultUpdating}
                onClick={() => handleBulkUpdateResults("Fail")}
              >
                Trượt hàng loạt
              </button>
              <span className="tiny muted">Đã chọn {bulkResultIds.length}</span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Ứng viên</th>
                    <th>CCCD</th>
                    <th>Kết quả hiện tại</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {resultSessionDetail.candidates.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={bulkResultUpdating}
                          checked={bulkResultIds.includes(row.id)}
                          onChange={(e) => toggleBulkResultSelection(row.id, e.target.checked)}
                        />
                      </td>
                      <td>{row.candidate_name || "-"}</td>
                      <td>{row.candidate_citizen_id || "-"}</td>
                      <td>
                        <span className="badge">
                          {resultStatusLabels[row.result_status] || row.result_status}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn small"
                            disabled={rowLoadingId === row.id || row.result_status === "Pass"}
                            onClick={() => handleUpdateResultInSession(row.id, "Pass")}
                          >
                            {t("module3.pass")}
                          </button>
                          <button
                            type="button"
                            className="btn small"
                            disabled={rowLoadingId === row.id || row.result_status === "Fail"}
                            onClick={() => handleUpdateResultInSession(row.id, "Fail")}
                          >
                            {t("module3.fail")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!resultSessionDetail.candidates.length ? (
                    <tr>
                      <td colSpan={5} className="center muted">
                        Không có ứng viên trong ca thi.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </DetailModal>
    </section>
  );
}

export default Module3Page;