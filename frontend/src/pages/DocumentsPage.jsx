import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import SegmentTabs from '../components/SegmentTabs';
import { documentService } from '../services/documentService';
import { DOC_STATUSES, DOC_STATUS_LABELS } from '../utils/constants';
import { formatDate, formatDateTime } from '../utils/format';
import { getErrorMessage } from '../utils/toast';

const initialDocForm = {
  documentTypeCode: '',
  status: 'SUBMITTED',
  issue_date: '',
  expiration_date: '',
  expected_complete_date: '',
  file_url: '',
  rejected_reason: '',
  note: '',
  file: null
};

function DocumentsPage() {
  const [activeTab, setActiveTab] = useState('setup');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const [candidateId, setCandidateId] = useState('');
  const [phase, setPhase] = useState('PRE_EXAM');

  const [documentTypes, setDocumentTypes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [readiness, setReadiness] = useState(null);

  const [alertDays, setAlertDays] = useState(30);
  const [healthAlerts, setHealthAlerts] = useState([]);
  const [visaAlerts, setVisaAlerts] = useState([]);

  const [docForm, setDocForm] = useState(initialDocForm);

  const docCodes = useMemo(
    () => documentTypes.map((item) => item.code),
    [documentTypes]
  );

  const showError = (err) => {
    setNotice({ type: 'error', text: getErrorMessage(err) });
  };

  const showSuccess = (text) => {
    setNotice({ type: 'ok', text });
  };

  const loadDocumentTypes = async (targetPhase = phase) => {
    const res = await documentService.getDocumentTypes(targetPhase);
    const rows = res.data || [];
    setDocumentTypes(rows);
    if (!docForm.documentTypeCode && rows.length) {
      setDocForm((prev) => ({ ...prev, documentTypeCode: rows[0].code }));
    }
  };

  const loadCandidateDocs = async () => {
    if (!candidateId) {
      setDocuments([]);
      return;
    }
    const res = await documentService.getCandidateDocuments(candidateId, phase);
    setDocuments(res.data || []);
  };

  const loadPreExamReadiness = async () => {
    if (!candidateId) {
      setReadiness(null);
      return;
    }
    const res = await documentService.getPreExamReadiness(candidateId);
    setReadiness(res.data || null);
  };

  const loadAlerts = async () => {
    const [healthRes, visaRes] = await Promise.all([
      documentService.getHealthExpiryAlerts(alertDays),
      documentService.getVisaDelayAlerts()
    ]);
    setHealthAlerts(healthRes.data || []);
    setVisaAlerts(visaRes.data || []);
  };

  const reloadCurrent = async () => {
    setLoading(true);
    setNotice({ type: '', text: '' });
    try {
      await Promise.all([loadDocumentTypes(), loadCandidateDocs(), loadAlerts()]);
      if (candidateId) {
        await loadPreExamReadiness();
      }
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await loadDocumentTypes(phase);
        if (!active) return;
        await loadCandidateDocs();
      } catch (err) {
        if (active) showError(err);
      }
    }

    run();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleInitDocs = async () => {
    if (!candidateId) {
      setNotice({ type: 'error', text: 'Cần nhập mã ứng viên.' });
      return;
    }

    try {
      await documentService.initCandidateDocuments(candidateId, phase);
      await loadCandidateDocs();
      if (phase === 'PRE_EXAM') {
        await loadPreExamReadiness();
      }
      showSuccess('Đã khởi tạo danh mục hồ sơ.');
    } catch (err) {
      showError(err);
    }
  };

  const handleUpdateDocument = async (event) => {
    event.preventDefault();
    if (!candidateId) {
      setNotice({ type: 'error', text: 'Cần nhập mã ứng viên.' });
      return;
    }
    if (!docForm.documentTypeCode) {
      setNotice({ type: 'error', text: 'Cần chọn mã hồ sơ.' });
      return;
    }

    const payload = new FormData();
    Object.entries(docForm).forEach(([key, value]) => {
      if (key === 'documentTypeCode') return;
      if (value === '' || value === null || value === undefined) return;
      if (key === 'file') {
        if (value) payload.append('file', value);
        return;
      }
      payload.append(key, value);
    });

    try {
      await documentService.updateCandidateDocument(
        candidateId,
        docForm.documentTypeCode,
        payload
      );
      await loadCandidateDocs();
      if (phase === 'PRE_EXAM') {
        await loadPreExamReadiness();
      }
      showSuccess('Đã cập nhật hồ sơ.');
    } catch (err) {
      showError(err);
    }
  };

  const handleRefreshAlerts = async () => {
    try {
      await loadAlerts();
      showSuccess('Đã làm mới cảnh báo.');
    } catch (err) {
      showError(err);
    }
  };

  const tabs = [
    { key: 'setup', label: 'Thiết lập và cập nhật' },
    { key: 'checklist', label: 'Danh mục hồ sơ' },
    { key: 'readiness', label: 'Điều kiện sẵn sàng' },
    { key: 'alerts', label: 'Cảnh báo' }
  ];

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader
          title="Hồ sơ xuất cảnh"
          action={
            <button className="btn ghost" type="button" onClick={reloadCurrent}>
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

        <div className="filter-row">
          <label className="inline-label">
            Mã ứng viên
            <input
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              placeholder="Nhập mã ứng viên"
            />
          </label>
          <label className="inline-label">
            Giai đoạn
            <select value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="PRE_EXAM">PRE_EXAM</option>
              <option value="POST_EXAM">POST_EXAM</option>
            </select>
          </label>
          <button className="btn" type="button" onClick={handleInitDocs}>
            Khởi tạo
          </button>
          <button className="btn" type="button" onClick={loadCandidateDocs}>
            Tải hồ sơ
          </button>
        </div>

        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'setup' ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title="Danh mục giấy tờ" />
            <div className="pill-list">
              {documentTypes.map((item) => (
                <div key={item.code} className="pill-item">
                  <span>{item.code}</span>
                  <strong>{item.is_required_for_gate ? 'Bắt buộc' : 'Tùy chọn'}</strong>
                </div>
              ))}
              {!documentTypes.length ? (
                <p className="muted">Chưa có loại giấy tờ.</p>
              ) : null}
            </div>
          </div>

          <div>
            <SectionHeader title="Cập nhật hồ sơ ứng viên" />
            <form className="grid-form" onSubmit={handleUpdateDocument}>
              <label>
                Mã hồ sơ
                <select
                  value={docForm.documentTypeCode}
                  onChange={(e) =>
                    setDocForm((prev) => ({
                      ...prev,
                      documentTypeCode: e.target.value
                    }))
                  }
                >
                  <option value="">Chọn mã</option>
                  {docCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Trạng thái
                <select
                  value={docForm.status}
                  onChange={(e) =>
                    setDocForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                >
                  {DOC_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {DOC_STATUS_LABELS[status] || status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ngày cấp
                <input
                  type="date"
                  value={docForm.issue_date}
                  onChange={(e) =>
                    setDocForm((prev) => ({ ...prev, issue_date: e.target.value }))
                  }
                />
              </label>
              <label>
                Ngày hết hạn
                <input
                  type="date"
                  value={docForm.expiration_date}
                  onChange={(e) =>
                    setDocForm((prev) => ({
                      ...prev,
                      expiration_date: e.target.value
                    }))
                  }
                />
              </label>
              <label>
                Ngày dự kiến hoàn tất
                <input
                  type="date"
                  value={docForm.expected_complete_date}
                  onChange={(e) =>
                    setDocForm((prev) => ({
                      ...prev,
                      expected_complete_date: e.target.value
                    }))
                  }
                />
              </label>
              <label>
                Đường dẫn file
                <input
                  value={docForm.file_url}
                  onChange={(e) =>
                    setDocForm((prev) => ({ ...prev, file_url: e.target.value }))
                  }
                />
              </label>
              <label>
                Lý do từ chối
                <input
                  value={docForm.rejected_reason}
                  onChange={(e) =>
                    setDocForm((prev) => ({
                      ...prev,
                      rejected_reason: e.target.value
                    }))
                  }
                />
              </label>
              <label>
                Tải tệp
                <input
                  type="file"
                  onChange={(e) =>
                    setDocForm((prev) => ({
                      ...prev,
                      file: e.target.files?.[0] || null
                    }))
                  }
                />
              </label>
              <label className="field-span-2">
                Ghi chú
                <input
                  value={docForm.note}
                  onChange={(e) =>
                    setDocForm((prev) => ({ ...prev, note: e.target.value }))
                  }
                />
              </label>
              <button className="btn field-span-2" type="submit">
                Cập nhật hồ sơ
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {activeTab === 'checklist' ? (
        <div className="surface">
          <SectionHeader title="Danh mục hồ sơ ứng viên" />

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>Trạng thái</th>
                  <th>Dự kiến</th>
                  <th>Hết hạn</th>
                  <th>Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((row) => (
                  <tr key={`${row.document_type_id}-${row.code}`}>
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td>
                      <span className="badge">{DOC_STATUS_LABELS[row.status] || row.status}</span>
                    </td>
                    <td>{formatDate(row.expected_complete_date)}</td>
                    <td>{formatDate(row.expiration_date)}</td>
                    <td>{formatDateTime(row.verified_at || row.submitted_at)}</td>
                  </tr>
                ))}
                {!documents.length ? (
                  <tr>
                    <td colSpan={6} className="center muted">
                      Chưa có hồ sơ.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'readiness' ? (
        <div className="surface two-col">
          <div>
            <SectionHeader
              title="Điều kiện PRE_EXAM"
              action={
                <button
                  className="btn"
                  type="button"
                  onClick={loadPreExamReadiness}
                  disabled={!candidateId}
                >
                  Kiểm tra
                </button>
              }
            />

            {readiness ? (
              <>
                <div className="stats-inline">
                  <div className="mini-stat">
                    <span>Bắt buộc</span>
                    <strong>{readiness.required_total}</strong>
                  </div>
                  <div className="mini-stat">
                    <span>Đã xác minh</span>
                    <strong>{readiness.verified_total}</strong>
                  </div>
                  <div className="mini-stat">
                    <span>Được đi tiếp</span>
                    <strong>{readiness.can_proceed ? 'Có' : 'Không'}</strong>
                  </div>
                </div>

                <div className="table-wrap compact-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Mã thiếu</th>
                        <th>Tên</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(readiness.missing_documents || []).map((row) => (
                        <tr key={row.code}>
                          <td>{row.code}</td>
                          <td>{row.name}</td>
                          <td>
                            <span className="badge warn">{DOC_STATUS_LABELS[row.status] || row.status}</span>
                          </td>
                        </tr>
                      ))}
                      {!readiness.missing_documents?.length ? (
                        <tr>
                          <td colSpan={3} className="center success-text">
                            Đã đủ hồ sơ bắt buộc.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="muted">Chưa có kết quả kiểm tra.</p>
            )}
          </div>

          <div>
            <SectionHeader title="Ghi chú" />
            <div className="roadmap-card">
              <ul className="inline-list">
                <li>Cần nhập đúng mã ứng viên.</li>
                <li>Kiểm tra danh sách hồ sơ còn thiếu.</li>
                <li>Đủ điều kiện rồi mới chuyển bước.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'alerts' ? (
        <div className="surface two-col">
          <div>
            <SectionHeader
              title="Cảnh báo sức khỏe"
              action={
                <div className="inline-form">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={alertDays}
                    onChange={(e) => setAlertDays(Number(e.target.value) || 30)}
                  />
                  <button className="btn" type="button" onClick={handleRefreshAlerts}>
                    Làm mới
                  </button>
                </div>
              }
            />

            <div className="table-wrap compact-table">
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
                      <td colSpan={3} className="center muted">
                        Không có cảnh báo.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <SectionHeader title="Cảnh báo visa" />

            <div className="table-wrap compact-table">
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
                      <td colSpan={3} className="center muted">
                        Không có cảnh báo.
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

export default DocumentsPage;
