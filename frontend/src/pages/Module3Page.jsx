import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import SegmentTabs from '../components/SegmentTabs';
import { recruitmentService } from '../services/recruitmentService';
import { jobOrderService } from '../services/jobOrderService';
import { CANDIDATE_STATUS_LABELS } from '../utils/constants';
import { formatDate, formatDateTime } from '../utils/format';
import { getErrorMessage } from '../utils/toast';

const STORAGE_EXAM_KEY = 'ihrms_m3_exam_records';
const STORAGE_TRAINING_KEY = 'ihrms_m3_training_records';

const RESULT_STATUS_LABELS = {
  PENDING: 'Chờ chấm',
  PASS: 'Đạt',
  RESERVE: 'Dự bị',
  FAIL: 'Trượt'
};

const initialExamForm = {
  candidateId: '',
  jobOrderId: '',
  examDate: '',
  note: ''
};

const initialTrainingForm = {
  candidateId: '',
  moduleName: '',
  sessionDate: '',
  trainer: '',
  score: '',
  note: ''
};

function safeLoadArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function Module3Page() {
  const [activeTab, setActiveTab] = useState('exam-list');
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const [candidates, setCandidates] = useState([]);
  const [jobOrders, setJobOrders] = useState([]);

  const [examForm, setExamForm] = useState(initialExamForm);
  const [trainingForm, setTrainingForm] = useState(initialTrainingForm);

  const [examRecords, setExamRecords] = useState(() => safeLoadArray(STORAGE_EXAM_KEY));
  const [trainingRecords, setTrainingRecords] = useState(() =>
    safeLoadArray(STORAGE_TRAINING_KEY)
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_EXAM_KEY, JSON.stringify(examRecords));
  }, [examRecords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_TRAINING_KEY, JSON.stringify(trainingRecords));
  }, [trainingRecords]);

  const loadMasterData = async () => {
    setLoading(true);
    setNotice({ type: '', text: '' });
    try {
      const [candRes, jobRes] = await Promise.all([
        recruitmentService.getCandidates({ page: 1, limit: 200 }),
        jobOrderService.getJobOrders({ page: 1, limit: 200 })
      ]);

      setCandidates(candRes.data || []);
      setJobOrders(jobRes.data || []);
    } catch (err) {
      setNotice({ type: 'error', text: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  const candidateMap = useMemo(() => {
    const map = new Map();
    candidates.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [candidates]);

  const jobMap = useMemo(() => {
    const map = new Map();
    jobOrders.forEach((j) => map.set(String(j.id), j));
    return map;
  }, [jobOrders]);

  const eligibleExamCandidates = useMemo(
    () =>
      candidates.filter(
        (c) => c.status === 'FORM_MATCHED_WAITING_EXAM' || c.status === 'WAITING_FORM_MATCH'
      ),
    [candidates]
  );

  const passedCandidates = useMemo(
    () =>
      examRecords
        .filter((r) => r.resultStatus === 'PASS')
        .map((r) => candidateMap.get(String(r.candidateId)))
        .filter(Boolean),
    [examRecords, candidateMap]
  );

  const updateRecordStatus = (recordId, resultStatus) => {
    setExamRecords((prev) =>
      prev.map((item) =>
        item.id === recordId
          ? {
              ...item,
              resultStatus,
              updatedAt: new Date().toISOString()
            }
          : item
      )
    );

    if (resultStatus === 'FAIL') {
      setNotice({
        type: 'ok',
        text: 'Đã cập nhật kết quả trượt.'
      });
    } else {
      setNotice({ type: 'ok', text: 'Đã cập nhật kết quả thi.' });
    }
  };

  const handleCreateExamRecord = (event) => {
    event.preventDefault();
    if (!examForm.candidateId || !examForm.jobOrderId || !examForm.examDate) {
      setNotice({ type: 'error', text: 'Cần chọn ứng viên, đơn hàng và ngày thi.' });
      return;
    }

    const newRecord = {
      id: `EX-${Date.now()}`,
      candidateId: examForm.candidateId,
      jobOrderId: examForm.jobOrderId,
      examDate: examForm.examDate,
      note: examForm.note,
      resultStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setExamRecords((prev) => [newRecord, ...prev]);
    setExamForm(initialExamForm);
    setNotice({ type: 'ok', text: 'Đã thêm ứng viên vào danh sách thi.' });
  };

  const handleCreateTrainingRecord = (event) => {
    event.preventDefault();
    if (!trainingForm.candidateId || !trainingForm.moduleName || !trainingForm.sessionDate) {
      setNotice({ type: 'error', text: 'Cần chọn ứng viên, học phần và ngày học.' });
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
    setNotice({ type: 'ok', text: 'Đã lưu lịch đào tạo.' });
  };

  const tabs = [
    { key: 'exam-list', label: 'Danh sách thi tuyển' },
    { key: 'exam-result', label: 'Kết quả thi' },
    { key: 'training', label: 'Đào tạo định hướng' }
  ];

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader
          title="Thi tuyển và đào tạo"
          action={
            <button type="button" className="btn ghost" onClick={loadMasterData}>
              Làm mới
            </button>
          }
        />

        {notice.text ? (
          <p className={notice.type === 'error' ? 'error-text' : 'success-text'}>
            {notice.text}
          </p>
        ) : null}

        {loading ? <p className="muted">Đang tải dữ liệu...</p> : null}

        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'exam-list' ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title="Thêm danh sách thi" />

            <form className="grid-form" onSubmit={handleCreateExamRecord}>
              <label>
                Ứng viên
                <select
                  value={examForm.candidateId}
                  onChange={(e) =>
                    setExamForm((prev) => ({ ...prev, candidateId: e.target.value }))
                  }
                >
                  <option value="">Chọn ứng viên</option>
                  {eligibleExamCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id} {c.full_name} ({CANDIDATE_STATUS_LABELS[c.status] || c.status})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Đơn hàng
                <select
                  value={examForm.jobOrderId}
                  onChange={(e) =>
                    setExamForm((prev) => ({ ...prev, jobOrderId: e.target.value }))
                  }
                >
                  <option value="">Chọn đơn hàng</option>
                  {jobOrders.map((job) => (
                    <option key={job.id} value={job.id}>
                      #{job.id} {job.job_title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Ngày thi
                <input
                  type="date"
                  value={examForm.examDate}
                  onChange={(e) =>
                    setExamForm((prev) => ({ ...prev, examDate: e.target.value }))
                  }
                />
              </label>

              <label className="field-span-2">
                Ghi chú
                <input
                  value={examForm.note}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </label>

              <button type="submit" className="btn field-span-2">
                Thêm vào danh sách thi
              </button>
            </form>
          </div>

          <div>
            <SectionHeader title="Danh sách đã chốt" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ứng viên</th>
                    <th>Đơn hàng</th>
                    <th>Ngày thi</th>
                    <th>Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {examRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{candidateMap.get(String(record.candidateId))?.full_name || '-'}</td>
                      <td>{jobMap.get(String(record.jobOrderId))?.job_title || '-'}</td>
                      <td>{formatDate(record.examDate)}</td>
                      <td>
                        <span className="badge">{RESULT_STATUS_LABELS[record.resultStatus] || record.resultStatus}</span>
                      </td>
                    </tr>
                  ))}
                  {!examRecords.length ? (
                    <tr>
                      <td colSpan={4} className="center muted">
                        Chưa có dữ liệu.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'exam-result' ? (
        <div className="surface">
          <SectionHeader title="Cập nhật kết quả thi" />

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ứng viên</th>
                  <th>Đơn hàng</th>
                  <th>Ngày thi</th>
                  <th>Kết quả hiện tại</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {examRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{candidateMap.get(String(record.candidateId))?.full_name || '-'}</td>
                    <td>{jobMap.get(String(record.jobOrderId))?.job_title || '-'}</td>
                    <td>{formatDate(record.examDate)}</td>
                    <td>
                      <span className="badge">{RESULT_STATUS_LABELS[record.resultStatus] || record.resultStatus}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => updateRecordStatus(record.id, 'PASS')}
                        >
                          Đạt
                        </button>
                        <button
                          type="button"
                          className="btn small ghost"
                          onClick={() => updateRecordStatus(record.id, 'RESERVE')}
                        >
                          Dự bị
                        </button>
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => updateRecordStatus(record.id, 'FAIL')}
                        >
                          Trượt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!examRecords.length ? (
                  <tr>
                    <td colSpan={5} className="center muted">
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'training' ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title="Lịch đào tạo" />

            <form className="grid-form" onSubmit={handleCreateTrainingRecord}>
              <label>
                Ứng viên
                <select
                  value={trainingForm.candidateId}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, candidateId: e.target.value }))
                  }
                >
                  <option value="">Chọn ứng viên</option>
                  {passedCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      #{candidate.id} {candidate.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Học phần
                <input
                  value={trainingForm.moduleName}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, moduleName: e.target.value }))
                  }
                />
              </label>

              <label>
                Ngày học
                <input
                  type="date"
                  value={trainingForm.sessionDate}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, sessionDate: e.target.value }))
                  }
                />
              </label>

              <label>
                Giảng viên
                <input
                  value={trainingForm.trainer}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, trainer: e.target.value }))
                  }
                />
              </label>

              <label>
                Điểm
                <input
                  type="number"
                  value={trainingForm.score}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, score: e.target.value }))
                  }
                />
              </label>

              <label className="field-span-2">
                Ghi chú
                <input
                  value={trainingForm.note}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({ ...prev, note: e.target.value }))
                  }
                />
              </label>

              <button type="submit" className="btn field-span-2">
                Lưu lịch đào tạo
              </button>
            </form>
          </div>

          <div>
            <SectionHeader title="Tiến độ học viên" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ứng viên</th>
                    <th>Học phần</th>
                    <th>Ngày</th>
                    <th>Điểm</th>
                    <th>Thời gian lưu</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingRecords.map((row) => (
                    <tr key={row.id}>
                      <td>{candidateMap.get(String(row.candidateId))?.full_name || '-'}</td>
                      <td>{row.moduleName}</td>
                      <td>{formatDate(row.sessionDate)}</td>
                      <td>{row.score ?? '-'}</td>
                      <td>{formatDateTime(row.createdAt)}</td>
                    </tr>
                  ))}
                  {!trainingRecords.length ? (
                    <tr>
                      <td colSpan={5} className="center muted">
                        Chưa có dữ liệu.
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
