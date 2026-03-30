import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import SegmentTabs from '../components/SegmentTabs';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import { recruitmentService } from '../services/recruitmentService';
import { documentService } from '../services/documentService';
import { formatDate } from '../utils/format';
import { getErrorMessage } from '../utils/toast';

function getDebtAgingBuckets(candidates) {
  const buckets = {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0
  };

  const now = new Date();

  candidates.forEach((candidate) => {
    if (candidate.is_fee0_paid) return;
    if (!candidate.created_at) return;

    const created = new Date(candidate.created_at);
    if (Number.isNaN(created.getTime())) return;

    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    if (days <= 30) buckets['0-30'] += 1;
    else if (days <= 60) buckets['31-60'] += 1;
    else if (days <= 90) buckets['61-90'] += 1;
    else buckets['90+'] += 1;
  });

  return Object.entries(buckets).map(([bucket, total]) => ({ bucket, total }));
}

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('recruitment');

  const [summary, setSummary] = useState({ by_status: [], by_source: [] });
  const [healthAlerts, setHealthAlerts] = useState([]);
  const [visaAlerts, setVisaAlerts] = useState([]);
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError('');
      try {
        const [funnelRes, healthRes, visaRes, candidateRes] = await Promise.all([
          recruitmentService.getFunnelSummary(),
          documentService.getHealthExpiryAlerts(30),
          documentService.getVisaDelayAlerts(),
          recruitmentService.getCandidates({ page: 1, limit: 300 })
        ]);

        if (!alive) return;
        setSummary(funnelRes?.data || { by_status: [], by_source: [] });
        setHealthAlerts(healthRes?.data || []);
        setVisaAlerts(visaRes?.data || []);
        setCandidates(candidateRes?.data || []);
      } catch (err) {
        if (!alive) return;
        setError(getErrorMessage(err));
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

  const recruitmentBars = useMemo(
    () =>
      (summary.by_source || []).slice(0, 8).map((item) => ({
        source: item.source_name,
        conversion: Number(item.conversion_pct || 0)
      })),
    [summary.by_source]
  );

  const debtAgingBars = useMemo(
    () => getDebtAgingBuckets(candidates),
    [candidates]
  );

  const funnelStatusMap = useMemo(() => {
    const map = new Map();
    (summary.by_status || []).forEach((row) => {
      map.set(row.status, Number(row.total || 0));
    });
    return map;
  }, [summary.by_status]);

  const operationBottleneckBars = useMemo(
    () => [
      {
        stage: 'Chờ ghép form',
        total: funnelStatusMap.get('WAITING_FORM_MATCH') || 0
      },
      {
        stage: 'Chờ thi',
        total: funnelStatusMap.get('FORM_MATCHED_WAITING_EXAM') || 0
      },
      {
        stage: 'Sắp hết hạn sức khỏe',
        total: healthAlerts.length
      },
      {
        stage: 'Chậm visa',
        total: visaAlerts.length
      }
    ],
    [funnelStatusMap, healthAlerts.length, visaAlerts.length]
  );

  const tabs = [
    { key: 'recruitment', label: 'Chuyển đổi tuyển dụng' },
    { key: 'finance', label: 'Tuổi nợ' },
    { key: 'operation', label: 'Nút thắt vận hành' }
  ];

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader title="dashboard" />

        {loading ? <p className="muted">Đang tải dashboard...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <div className="stats-grid stagger">
          <StatCard
            label="Tổng ứng viên"
            value={totalCandidates}
            hint=""
            tone="ocean"
          />
          <StatCard
            label="Nguồn chuyển đổi cao nhất"
            value={topSource?.source_name || '-'}
            hint={
              topSource
                ? `${topSource.conversion_pct || 0}%`
                : ''
            }
            tone="sun"
          />
          <StatCard
            label="Cảnh báo giấy khám sức khỏe"
            value={healthAlerts.length}
            hint=""
            tone={healthAlerts.length > 0 ? 'alert' : 'mint'}
          />
          <StatCard
            label="Cảnh báo chậm visa"
            value={visaAlerts.length}
            hint=""
            tone={visaAlerts.length > 0 ? 'alert' : 'mint'}
          />
        </div>
      </div>

      <div className="surface">
        <SectionHeader title="Biểu đồ M8" />
        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

        {activeTab === 'recruitment' ? (
          <div className="chart-surface">
            <h4>Tỷ lệ chuyển đổi theo nguồn (%)</h4>
            <BarChart
              rows={recruitmentBars}
              valueKey="conversion"
              labelKey="source"
              suffix="%"
              color="teal"
            />
          </div>
        ) : null}

        {activeTab === 'finance' ? (
          <div className="chart-surface">
            <h4>Tuổi nợ phí 0</h4>
            <BarChart
              rows={debtAgingBars}
              valueKey="total"
              labelKey="bucket"
              color="sun"
            />
          </div>
        ) : null}

        {activeTab === 'operation' ? (
          <div className="chart-surface">
            <h4>Mức độ nút thắt vận hành</h4>
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
          <SectionHeader title="Cảnh báo giấy khám sức khỏe" />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ứng viên</th>
                  <th>Ngày hết hạn</th>
                  <th>Số ngày còn lại</th>
                </tr>
              </thead>
              <tbody>
                {healthAlerts.map((row) => (
                  <tr key={`${row.candidate_id}-${row.expiration_date}`}>
                    <td>{row.full_name}</td>
                    <td>{formatDate(row.expiration_date)}</td>
                    <td>
                      <span
                        className={`badge ${
                          Number(row.days_left) < 0 ? 'danger' : 'warn'
                        }`}
                      >
                        {row.days_left}
                      </span>
                    </td>
                  </tr>
                ))}
                {!healthAlerts.length ? (
                  <tr>
                    <td colSpan={3} className="muted center">
                      Không có cảnh báo.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionHeader title="Cảnh báo chậm visa" />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ứng viên</th>
                  <th>Ngày dự kiến</th>
                  <th>Quá hạn</th>
                </tr>
              </thead>
              <tbody>
                {visaAlerts.map((row) => (
                  <tr key={`${row.candidate_id}-${row.expected_complete_date}`}>
                    <td>{row.full_name}</td>
                    <td>{formatDate(row.expected_complete_date)}</td>
                    <td>
                      <span className="badge danger">{row.overdue_days} ngày</span>
                    </td>
                  </tr>
                ))}
                {!visaAlerts.length ? (
                  <tr>
                    <td colSpan={3} className="muted center">
                      Không có cảnh báo.
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
