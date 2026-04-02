import { useEffect, useMemo, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import SegmentTabs from "../components/SegmentTabs";
import { useToast } from "../components/ToastProvider";
import StatCard from "../components/StatCard";
import BarChart from "../components/BarChart";
import { recruitmentService } from "../services/recruitmentService";
import { documentService } from "../services/documentService";
import { examApplicationService } from "../services/examApplicationService";
import { CANDIDATE_STATUS_LABELS } from "../utils/constants";
import { formatDate, formatDateTime } from "../utils/format";
import { getErrorMessage } from "../utils/toast";
import { useI18n } from "../i18n/I18nProvider";

function countNewCandidatesThisMonth(candidates) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  return candidates.filter((candidate) => {
    const createdAt = new Date(candidate.created_at);
    if (Number.isNaN(createdAt.getTime())) return false;
    return createdAt >= start;
  }).length;
}

function DashboardPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("recruitment");

  const [summary, setSummary] = useState({ by_status: [], by_source: [] });
  const [healthAlerts, setHealthAlerts] = useState([]);
  const [visaAlerts, setVisaAlerts] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [examApplications, setExamApplications] = useState([]);
  const [examSessions, setExamSessions] = useState([]);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      try {
        const [funnelRes, healthRes, visaRes, candidateRes, examAppRes, examSessionRes] = await Promise.all([
          recruitmentService.getFunnelSummary(),
          documentService.getHealthExpiryAlerts(30),
          documentService.getVisaDelayAlerts(),
          recruitmentService.getCandidates({ page: 1, limit: 300 }),
          examApplicationService.getExamApplications({ page: 1, limit: 1200 }),
          examApplicationService.getExamSessions({ view: "schedule" })
        ]);

        if (!alive) return;
        setSummary(funnelRes?.data || { by_status: [], by_source: [] });
        setHealthAlerts(healthRes?.data || []);
        setVisaAlerts(visaRes?.data || []);
        setCandidates(candidateRes?.data || []);
        setExamApplications(examAppRes?.data || []);
        setExamSessions(examSessionRes?.data || []);
      } catch (err) {
        if (!alive) return;
        toast.error(getErrorMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  const totalCandidates = useMemo(
    () =>
      (summary.by_status || []).reduce(
        (acc, item) => acc + Number(item.total || 0),
        0
      ),
    [summary.by_status]
  );

  const topSource = useMemo(() => {
    const rows = summary.by_source || [];
    if (!rows.length) return null;
    return rows[0];
  }, [summary.by_source]);

  const newCandidatesThisMonth = useMemo(
    () => countNewCandidatesThisMonth(candidates),
    [candidates]
  );

  const statusMap = useMemo(() => {
    const map = new Map();
    (summary.by_status || []).forEach((row) => {
      map.set(row.status, Number(row.total || 0));
    });
    return map;
  }, [summary.by_status]);

  const waitingFormCount = statusMap.get("WAITING_FORM_MATCH") || 0;
  const waitingExamCount = statusMap.get("FORM_MATCHED_WAITING_EXAM") || 0;
  const passedCount = statusMap.get("PASSED") || 0;

  const pendingExamCount = useMemo(
    () => examApplications.filter((row) => row.result_status === "Pending").length,
    [examApplications]
  );

  const unscheduledExamCount = useMemo(
    () =>
      examApplications.filter((row) => row.result_status === "Pending" && !row.exam_date).length,
    [examApplications]
  );

  const examResultBars = useMemo(() => {
    const counters = {
      Pending: 0,
      Pass: 0,
      Reserve: 0,
      Fail: 0,
    };

    examApplications.forEach((row) => {
      if (counters[row.result_status] !== undefined) {
        counters[row.result_status] += 1;
      }
    });

    return [
      { status: t("module3.resultPending"), total: counters.Pending },
      { status: t("module3.resultPass"), total: counters.Pass },
      { status: t("module3.resultReserve"), total: counters.Reserve },
      { status: t("module3.resultFail"), total: counters.Fail },
    ];
  }, [examApplications, t]);

  const candidateStatusBars = useMemo(
    () =>
      (summary.by_status || []).map((row) => ({
        stage: CANDIDATE_STATUS_LABELS[row.status] || row.status,
        total: Number(row.total || 0),
      })),
    [summary.by_status]
  );

  const upcomingSessionRows = useMemo(() => {
    const now = new Date();
    return [...examSessions]
      .filter((row) => {
        const examDate = new Date(row.exam_date);
        if (Number.isNaN(examDate.getTime())) return false;
        return examDate >= now;
      })
      .sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date))
      .slice(0, 8);
  }, [examSessions]);

  const operationBottleneckBars = useMemo(
    () => [
      {
        stage: t("dashboard.stageWaitingForm"),
        total: waitingFormCount,
      },
      {
        stage: t("dashboard.stageWaitingExam"),
        total: waitingExamCount,
      },
      {
        stage: "Chưa xếp lịch thi",
        total: unscheduledExamCount,
      },
      {
        stage: t("dashboard.stageHealthExpiry"),
        total: healthAlerts.length,
      },
      {
        stage: t("dashboard.stageVisaDelay"),
        total: visaAlerts.length,
      },
    ],
    [healthAlerts.length, t, visaAlerts.length, waitingExamCount, waitingFormCount, unscheduledExamCount]
  );

  const tabs = [
    { key: "recruitment", label: t("dashboard.tabsRecruitment") },
    { key: "finance", label: t("dashboard.tabsFinance") },
    { key: "operation", label: t("dashboard.tabsOperation") },
  ];

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader title={t("dashboard.title")} />

        {loading ? <p className="muted">{t("dashboard.loading")}</p> : null}

        <div className="stats-grid stagger">
          <StatCard
            label={t("dashboard.statsCandidates")}
            value={totalCandidates}
            hint=""
            tone="ocean"
          />
          <StatCard
            label={t("dashboard.statsTopSource")}
            value={newCandidatesThisMonth}
            hint="Tháng hiện tại"
            tone="sun"
          />
          <StatCard
            label={t("dashboard.statsHealthAlerts")}
            value={waitingExamCount}
            hint={`${pendingExamCount} phiếu thi đang chờ`}
            tone={waitingExamCount > 0 ? "alert" : "mint"}
          />
          <StatCard
            label={t("dashboard.statsVisaAlerts")}
            value={healthAlerts.length + visaAlerts.length}
            hint={`${healthAlerts.length} sức khỏe, ${visaAlerts.length} visa`}
            tone={healthAlerts.length + visaAlerts.length > 0 ? "alert" : "mint"}
          />
          <StatCard
            label="Ứng viên đã đạt"
            value={passedCount}
            hint={topSource ? `Nguồn tốt nhất: ${topSource.source_name}` : ""}
            tone="ocean"
          />
        </div>
      </div>

      <div className="surface">
        <SectionHeader title={t("dashboard.chartSection")} />
        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

        {activeTab === "recruitment" ? (
          <div className="chart-surface">
            <h4>{t("dashboard.chartRecruitment")}</h4>
            <BarChart
              rows={candidateStatusBars}
              valueKey="total"
              labelKey="stage"
              color="teal"
            />
          </div>
        ) : null}

        {activeTab === "finance" ? (
          <div className="chart-surface">
            <h4>{t("dashboard.chartFinance")}</h4>
            <BarChart rows={examResultBars} valueKey="total" labelKey="status" color="sun" />
          </div>
        ) : null}

        {activeTab === "operation" ? (
          <div className="chart-surface">
            <h4>{t("dashboard.chartOperation")}</h4>
            <BarChart
              rows={operationBottleneckBars}
              valueKey="total"
              labelKey="stage"
              color="danger"
            />
          </div>
        ) : null}
      </div>

      <div className="surface two-col">
        <div>
          <SectionHeader title={t("dashboard.healthSection")} />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("dashboard.colCandidate")}</th>
                  <th>{t("dashboard.colExpireDate")}</th>
                  <th>{t("dashboard.colDaysLeft")}</th>
                </tr>
              </thead>
              <tbody>
                {healthAlerts.map((row) => (
                  <tr key={`${row.candidate_id}-${row.expiration_date}`}>
                    <td>{`${row.citizen_id || "-"} - ${row.full_name}`}</td>
                    <td>{formatDate(row.expiration_date)}</td>
                    <td>
                      <span
                        className={`badge ${Number(row.days_left) < 0 ? "danger" : "warn"}`}
                      >
                        {row.days_left}
                      </span>
                    </td>
                  </tr>
                ))}
                {!healthAlerts.length ? (
                  <tr>
                    <td colSpan={3} className="muted center">
                      {t("dashboard.noAlerts")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionHeader title={t("dashboard.visaSection")} />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("dashboard.colExpectedDate")}</th>
                  <th>{t("common.jobOrder")}</th>
                  <th>{t("dashboard.colOverdue")}</th>
                </tr>
              </thead>
              <tbody>
                {upcomingSessionRows.map((row) => (
                  <tr key={row.session_key}>
                    <td>{formatDateTime(row.exam_date)}</td>
                    <td>{row.job_title || `#${row.job_order_id}`}</td>
                    <td>
                      <span className="badge warn">
                        {row.pending_candidates} chờ xử lý
                      </span>
                    </td>
                  </tr>
                ))}
                {!upcomingSessionRows.length ? (
                  <tr>
                    <td colSpan={3} className="muted center">
                      {t("dashboard.noAlerts")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DashboardPage;
