import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import SegmentTabs from '../components/SegmentTabs';
import { recruitmentService } from '../services/recruitmentService';
import { CANDIDATE_STATUSES, CANDIDATE_STATUS_LABELS } from '../utils/constants';
import { formatDateTime, formatCurrency, formatDate } from '../utils/format';
import { getErrorMessage } from '../utils/toast';

const initialCandidateForm = {
  full_name: '',
  dob: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  height: '',
  weight: '',
  blood_type: '',
  education_level: '',
  experience_summary: '',
  source_id: '',
  source_note: '',
  is_fee0_paid: false,
  fee0_paid_amount: '',
  fee0_paid_at: '',
  cv_file: null
};

function toDateTimeLocal(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';

  const pad = (num) => String(num).padStart(2, '0');
  const year = dt.getFullYear();
  const month = pad(dt.getMonth() + 1);
  const day = pad(dt.getDate());
  const hour = pad(dt.getHours());
  const minute = pad(dt.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toCandidateForm(candidate) {
  return {
    full_name: candidate.full_name || '',
    dob: candidate.dob ? String(candidate.dob).slice(0, 10) : '',
    gender: candidate.gender || '',
    phone: candidate.phone || '',
    email: candidate.email || '',
    address: candidate.address || '',
    height: candidate.height ?? '',
    weight: candidate.weight ?? '',
    blood_type: candidate.blood_type || '',
    education_level: candidate.education_level || '',
    experience_summary: candidate.experience_summary || '',
    source_id: candidate.source_id ? String(candidate.source_id) : '',
    source_note: candidate.source_note || '',
    is_fee0_paid: Boolean(candidate.is_fee0_paid),
    fee0_paid_amount: candidate.fee0_paid_amount ?? '',
    fee0_paid_at: toDateTimeLocal(candidate.fee0_paid_at),
    cv_file: null
  };
}

function RecruitmentPage() {
  const [activeTab, setActiveTab] = useState('intake');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const [sources, setSources] = useState([]);
  const [sourceName, setSourceName] = useState('');

  const [candidateForm, setCandidateForm] = useState(initialCandidateForm);
  const [candidates, setCandidates] = useState([]);
  const [kanban, setKanban] = useState([]);
  const [summary, setSummary] = useState({ by_status: [], by_source: [] });

  const [filters, setFilters] = useState({ search: '', status: '', source_id: '' });
  const [statusDraft, setStatusDraft] = useState({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [candidateDetail, setCandidateDetail] = useState(null);
  const [editingCandidateId, setEditingCandidateId] = useState(null);
  const [editForm, setEditForm] = useState(initialCandidateForm);
  const [updating, setUpdating] = useState(false);

  const tabs = [
    { key: 'intake', label: 'Thêm ứng viên' },
    { key: 'source', label: 'Nguồn tuyển dụng' },
    { key: 'candidate', label: 'Danh sách ứng viên' },
    { key: 'funnel', label: 'Bảng trạng thái' }
  ];

  const sourceMap = useMemo(() => {
    const map = new Map();
    sources.forEach((s) => map.set(String(s.id), s.source_name));
    return map;
  }, [sources]);

  const showError = (err) => {
    setNotice({ type: 'error', text: getErrorMessage(err) });
  };

  const showSuccess = (text) => {
    setNotice({ type: 'ok', text });
  };

  const toPayload = (form) => {
    const payload = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      if (key === 'cv_file') {
        if (value) payload.append('cv_file', value);
        return;
      }

      if (key === 'is_fee0_paid') {
        payload.append('is_fee0_paid', value ? '1' : '0');
        return;
      }

      payload.append(key, value ?? '');
    });

    return payload;
  };

  const loadSources = async () => {
    const res = await recruitmentService.getSources({ page: 1, limit: 200 });
    setSources(res.data || []);
  };

  const loadCandidates = async () => {
    const params = { page: 1, limit: 120 };
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.source_id) params.source_id = filters.source_id;

    const res = await recruitmentService.getCandidates(params);
    setCandidates(res.data || []);
  };

  const loadKanban = async () => {
    const params = { limit_per_status: 30 };
    if (filters.source_id) params.source_id = filters.source_id;
    const res = await recruitmentService.getKanban(params);
    setKanban(res.data || []);
  };

  const loadSummary = async () => {
    const res = await recruitmentService.getFunnelSummary();
    setSummary(res.data || { by_status: [], by_source: [] });
  };

  const reloadAll = async () => {
    setLoading(true);
    setNotice({ type: '', text: '' });
    try {
      await Promise.all([loadSources(), loadCandidates(), loadKanban(), loadSummary()]);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCandidateField = (key, value) => {
    setCandidateForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateSource = async (event) => {
    event.preventDefault();
    if (!sourceName.trim()) return;

    try {
      await recruitmentService.createSource({ source_name: sourceName.trim() });
      setSourceName('');
      await loadSources();
      showSuccess('Đã thêm nguồn tuyển dụng.');
    } catch (err) {
      showError(err);
    }
  };

  const handleDeleteSource = async (id) => {
    try {
      await recruitmentService.deleteSource(id);
      await loadSources();
      showSuccess('Đã xóa nguồn tuyển dụng.');
    } catch (err) {
      showError(err);
    }
  };

  const handleCreateCandidate = async (event) => {
    event.preventDefault();

    const payload = toPayload(candidateForm);

    try {
      await recruitmentService.createCandidate(payload);
      setCandidateForm(initialCandidateForm);
      await reloadAll();
      showSuccess('Đã thêm ứng viên.');
      setActiveTab('candidate');
    } catch (err) {
      showError(err);
    }
  };

  const handleDeleteCandidate = async (id) => {
    try {
      await recruitmentService.deleteCandidate(id);
      if (String(candidateDetail?.id || '') === String(id)) {
        setCandidateDetail(null);
      }
      if (String(editingCandidateId || '') === String(id)) {
        setEditingCandidateId(null);
        setEditForm(initialCandidateForm);
      }
      await reloadAll();
      showSuccess('Đã xóa ứng viên.');
    } catch (err) {
      showError(err);
    }
  };

  const handleUpdateStatus = async (candidate) => {
    const targetStatus = statusDraft[candidate.id] || candidate.status;
    if (!targetStatus) return;

    try {
      await recruitmentService.updateCandidateStatus(candidate.id, targetStatus);
      await reloadAll();
      showSuccess('Đã cập nhật trạng thái ứng viên.');
    } catch (err) {
      showError(err);
    }
  };

  const handleViewCandidateDetail = async (id) => {
    try {
      setDetailLoading(true);
      const res = await recruitmentService.getCandidateById(id);
      setCandidateDetail(res.data || null);
    } catch (err) {
      showError(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStartEditCandidate = async (id) => {
    try {
      setDetailLoading(true);
      const res = await recruitmentService.getCandidateById(id);
      const candidate = res.data || null;
      if (!candidate) return;

      setCandidateDetail(candidate);
      setEditingCandidateId(candidate.id);
      setEditForm(toCandidateForm(candidate));
    } catch (err) {
      showError(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCandidateId(null);
    setEditForm(initialCandidateForm);
  };

  const handleUpdateCandidate = async (event) => {
    event.preventDefault();
    if (!editingCandidateId) return;

    try {
      setUpdating(true);
      const payload = toPayload(editForm);
      await recruitmentService.updateCandidate(editingCandidateId, payload);
      const detailRes = await recruitmentService.getCandidateById(editingCandidateId);

      setCandidateDetail(detailRes.data || null);
      setEditingCandidateId(null);
      setEditForm(initialCandidateForm);
      await reloadAll();
      showSuccess('Đã cập nhật thông tin ứng viên.');
    } catch (err) {
      showError(err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader
          title="Quản lý ứng viên"
          action={
            <button className="btn ghost" onClick={reloadAll} type="button">
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

      {activeTab === 'intake' ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title="Thêm ứng viên" />
            <form className="grid-form" onSubmit={handleCreateCandidate}>
              <label>
                Họ và tên
                <input
                  required
                  value={candidateForm.full_name}
                  onChange={(e) => onCandidateField('full_name', e.target.value)}
                />
              </label>
              <label>
                Nguồn tuyển dụng
                <select
                  required
                  value={candidateForm.source_id}
                  onChange={(e) => onCandidateField('source_id', e.target.value)}
                >
                  <option value="">Chọn nguồn</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.source_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Số điện thoại
                <input
                  value={candidateForm.phone}
                  onChange={(e) => onCandidateField('phone', e.target.value)}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={candidateForm.email}
                  onChange={(e) => onCandidateField('email', e.target.value)}
                />
              </label>
              <label>
                Ngày sinh
                <input
                  type="date"
                  value={candidateForm.dob}
                  onChange={(e) => onCandidateField('dob', e.target.value)}
                />
              </label>
              <label>
                Giới tính
                <input
                  value={candidateForm.gender}
                  onChange={(e) => onCandidateField('gender', e.target.value)}
                />
              </label>
              <label>
                Chiều cao (cm)
                <input
                  type="number"
                  value={candidateForm.height}
                  onChange={(e) => onCandidateField('height', e.target.value)}
                />
              </label>
              <label>
                Cân nặng (kg)
                <input
                  type="number"
                  value={candidateForm.weight}
                  onChange={(e) => onCandidateField('weight', e.target.value)}
                />
              </label>
              <label>
                Nhóm máu
                <input
                  value={candidateForm.blood_type}
                  onChange={(e) => onCandidateField('blood_type', e.target.value)}
                />
              </label>
              <label>
                Trình độ học vấn
                <input
                  value={candidateForm.education_level}
                  onChange={(e) => onCandidateField('education_level', e.target.value)}
                />
              </label>
              <label>
                Kinh nghiệm
                <input
                  value={candidateForm.experience_summary}
                  onChange={(e) => onCandidateField('experience_summary', e.target.value)}
                />
              </label>
              <label className="field-span-2">
                Địa chỉ
                <input
                  value={candidateForm.address}
                  onChange={(e) => onCandidateField('address', e.target.value)}
                />
              </label>
              <label className="field-span-2">
                Ghi chú nguồn
                <input
                  value={candidateForm.source_note}
                  onChange={(e) => onCandidateField('source_note', e.target.value)}
                />
              </label>
              <label>
                Đã đóng phí 0
                <input
                  type="checkbox"
                  checked={candidateForm.is_fee0_paid}
                  onChange={(e) => onCandidateField('is_fee0_paid', e.target.checked)}
                />
              </label>
              <label>
                Số tiền phí 0
                <input
                  type="number"
                  value={candidateForm.fee0_paid_amount}
                  onChange={(e) => onCandidateField('fee0_paid_amount', e.target.value)}
                />
              </label>
              <label>
                Thời điểm đóng phí 0
                <input
                  type="datetime-local"
                  value={candidateForm.fee0_paid_at}
                  onChange={(e) => onCandidateField('fee0_paid_at', e.target.value)}
                />
              </label>
              <label>
                Tệp CV
                <input
                  type="file"
                  onChange={(e) => onCandidateField('cv_file', e.target.files?.[0] || null)}
                />
              </label>
              <button type="submit" className="btn field-span-2">
                Thêm ứng viên
              </button>
            </form>
          </div>
          <div>
            <SectionHeader title="Chi tiết ứng viên" />
            {detailLoading ? <p className="muted">Đang tải chi tiết...</p> : null}
            {candidateDetail ? (
              <div className="roadmap-card">
                <ul className="inline-list">
                  <li>Họ tên: {candidateDetail.full_name || '-'}</li>
                  <li>Điện thoại: {candidateDetail.phone || '-'}</li>
                  <li>Email: {candidateDetail.email || '-'}</li>
                  <li>Nguồn: {candidateDetail.source_name || '-'}</li>
                  <li>Chiều cao: {candidateDetail.height ?? '-'}</li>
                  <li>Cân nặng: {candidateDetail.weight ?? '-'}</li>
                  <li>Nhóm máu: {candidateDetail.blood_type || '-'}</li>
                </ul>
              </div>
            ) : (
              <p className="muted">Chưa chọn ứng viên.</p>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'source' ? (
        <div className="surface">
          <SectionHeader title="Nguồn tuyển dụng" />

          <form className="inline-form" onSubmit={handleCreateSource}>
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Nhập tên nguồn"
            />
            <button className="btn" type="submit">
              Thêm nguồn
            </button>
          </form>

          <div className="table-wrap compact-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên nguồn</th>
                  <th>Số ứng viên</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.source_name}</td>
                    <td>{row.candidate_count || 0}</td>
                    <td>
                      <button
                        type="button"
                        className="btn text danger"
                        onClick={() => handleDeleteSource(row.id)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
                {!sources.length ? (
                  <tr>
                    <td colSpan={4} className="center muted">
                      Chưa có nguồn tuyển dụng.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'candidate' ? (
        <div className="surface">
          <SectionHeader title="Danh sách ứng viên" />

          <div className="filter-row">
            <input
              placeholder="Tìm theo tên, điện thoại, email"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="">Tất cả trạng thái</option>
              {CANDIDATE_STATUSES.map((status) => (
                <option value={status} key={status}>
                  {CANDIDATE_STATUS_LABELS[status] || status}
                </option>
              ))}
            </select>
            <select
              value={filters.source_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, source_id: e.target.value }))}
            >
              <option value="">Tất cả nguồn</option>
              {sources.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.source_name}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={reloadAll}>
              Áp dụng
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ứng viên</th>
                  <th>Nguồn</th>
                  <th>Trạng thái</th>
                  <th>Phí 0</th>
                  <th>Ngày tạo</th>
                  <th>Đổi trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>
                      <strong>{row.full_name}</strong>
                      <br />
                      <span className="tiny">{row.phone || row.email || '-'}</span>
                    </td>
                    <td>{row.source_name || sourceMap.get(String(row.source_id)) || '-'}</td>
                    <td>
                      <span className="badge">{CANDIDATE_STATUS_LABELS[row.status] || row.status}</span>
                    </td>
                    <td>{row.is_fee0_paid ? formatCurrency(row.fee0_paid_amount) : 'Chưa đóng'}</td>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td>
                      <div className="status-inline">
                        <select
                          value={statusDraft[row.id] || row.status}
                          onChange={(e) =>
                            setStatusDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                        >
                          {CANDIDATE_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {CANDIDATE_STATUS_LABELS[status] || status}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => handleUpdateStatus(row)}
                        >
                          Lưu
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => handleViewCandidateDetail(row.id)}
                        >
                          Chi tiết
                        </button>
                        <button
                          type="button"
                          className="btn small ghost"
                          onClick={() => handleStartEditCandidate(row.id)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="btn text danger"
                          onClick={() => handleDeleteCandidate(row.id)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!candidates.length ? (
                  <tr>
                    <td colSpan={8} className="muted center">
                      Không có ứng viên.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {candidateDetail ? (
            <div className="surface" style={{ marginTop: 14 }}>
              <SectionHeader
                title={`Chi tiết ứng viên #${candidateDetail.id}`}
                action={
                  <button
                    className="btn text"
                    type="button"
                    onClick={() => setCandidateDetail(null)}
                  >
                    Đóng
                  </button>
                }
              />
              <div className="stats-inline">
                <div className="mini-stat">
                  <span>Họ tên</span>
                  <strong>{candidateDetail.full_name || '-'}</strong>
                </div>
                <div className="mini-stat">
                  <span>Nguồn</span>
                  <strong>{candidateDetail.source_name || '-'}</strong>
                </div>
                <div className="mini-stat">
                  <span>Trạng thái</span>
                  <strong>{CANDIDATE_STATUS_LABELS[candidateDetail.status] || candidateDetail.status}</strong>
                </div>
              </div>
              <div className="table-wrap compact-table">
                <table className="data-table">
                  <tbody>
                    <tr>
                      <th>Điện thoại</th>
                      <td>{candidateDetail.phone || '-'}</td>
                      <th>Email</th>
                      <td>{candidateDetail.email || '-'}</td>
                    </tr>
                    <tr>
                      <th>Ngày sinh</th>
                      <td>{formatDate(candidateDetail.dob)}</td>
                      <th>Giới tính</th>
                      <td>{candidateDetail.gender || '-'}</td>
                    </tr>
                    <tr>
                      <th>Chiều cao</th>
                      <td>{candidateDetail.height ?? '-'}</td>
                      <th>Cân nặng</th>
                      <td>{candidateDetail.weight ?? '-'}</td>
                    </tr>
                    <tr>
                      <th>Nhóm máu</th>
                      <td>{candidateDetail.blood_type || '-'}</td>
                      <th>Phí 0</th>
                      <td>
                        {candidateDetail.is_fee0_paid
                          ? formatCurrency(candidateDetail.fee0_paid_amount)
                          : 'Chưa đóng'}
                      </td>
                    </tr>
                    <tr>
                      <th>Học vấn</th>
                      <td>{candidateDetail.education_level || '-'}</td>
                      <th>Kinh nghiệm</th>
                      <td>{candidateDetail.experience_summary || '-'}</td>
                    </tr>
                    <tr>
                      <th>Địa chỉ</th>
                      <td colSpan={3}>{candidateDetail.address || '-'}</td>
                    </tr>
                    <tr>
                      <th>Ghi chú nguồn</th>
                      <td colSpan={3}>{candidateDetail.source_note || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {editingCandidateId ? (
            <div className="surface" style={{ marginTop: 14 }}>
              <SectionHeader title={`Sửa ứng viên #${editingCandidateId}`} />
              <form className="grid-form" onSubmit={handleUpdateCandidate}>
                <label>
                  Họ và tên
                  <input
                    required
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  />
                </label>
                <label>
                  Nguồn tuyển dụng
                  <select
                    required
                    value={editForm.source_id}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, source_id: e.target.value }))}
                  >
                    <option value="">Chọn nguồn</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.source_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Số điện thoại
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </label>
                <label>
                  Ngày sinh
                  <input
                    type="date"
                    value={editForm.dob}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, dob: e.target.value }))}
                  />
                </label>
                <label>
                  Giới tính
                  <input
                    value={editForm.gender}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, gender: e.target.value }))}
                  />
                </label>
                <label>
                  Chiều cao (cm)
                  <input
                    type="number"
                    value={editForm.height}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, height: e.target.value }))}
                  />
                </label>
                <label>
                  Cân nặng (kg)
                  <input
                    type="number"
                    value={editForm.weight}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, weight: e.target.value }))}
                  />
                </label>
                <label>
                  Nhóm máu
                  <input
                    value={editForm.blood_type}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, blood_type: e.target.value }))}
                  />
                </label>
                <label>
                  Trình độ học vấn
                  <input
                    value={editForm.education_level}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, education_level: e.target.value }))}
                  />
                </label>
                <label>
                  Kinh nghiệm
                  <input
                    value={editForm.experience_summary}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, experience_summary: e.target.value }))
                    }
                  />
                </label>
                <label className="field-span-2">
                  Địa chỉ
                  <input
                    value={editForm.address}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </label>
                <label className="field-span-2">
                  Ghi chú nguồn
                  <input
                    value={editForm.source_note}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, source_note: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Đã đóng phí 0
                  <input
                    type="checkbox"
                    checked={editForm.is_fee0_paid}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, is_fee0_paid: e.target.checked }))
                    }
                  />
                </label>
                <label>
                  Số tiền phí 0
                  <input
                    type="number"
                    value={editForm.fee0_paid_amount}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, fee0_paid_amount: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Thời điểm đóng phí 0
                  <input
                    type="datetime-local"
                    value={editForm.fee0_paid_at}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, fee0_paid_at: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Cập nhật tệp CV
                  <input
                    type="file"
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, cv_file: e.target.files?.[0] || null }))
                    }
                  />
                </label>
                <div className="field-span-2 row-actions">
                  <button type="submit" className="btn" disabled={updating}>
                    {updating ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                  <button type="button" className="btn ghost" onClick={handleCancelEdit}>
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'funnel' ? (
        <>
          <div className="surface">
            <SectionHeader title="Bảng trạng thái" />
            <div className="kanban-board">
              {kanban.map((column) => (
                <div className="kanban-col" key={column.status}>
                  <div className="kanban-head">
                    <h4>{CANDIDATE_STATUS_LABELS[column.status] || column.status}</h4>
                    <span>{column.items?.length || 0}</span>
                  </div>
                  <div className="kanban-list">
                    {(column.items || []).map((item) => (
                      <article key={item.id} className="kanban-card">
                        <p className="kanban-title">{item.full_name}</p>
                        <p className="tiny">{item.phone || item.email || '-'}</p>
                        <p className="tiny">{item.source_name || '-'}</p>
                        <p className="tiny">Cập nhật: {formatDate(item.updated_at)}</p>
                      </article>
                    ))}
                    {!column.items?.length ? (
                      <p className="tiny muted">Chưa có ứng viên.</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface two-col">
            <div>
              <SectionHeader title="Tổng hợp trạng thái" />
              <div className="pill-list">
                {(summary.by_status || []).map((item) => (
                  <div key={item.status} className="pill-item">
                    <span>{CANDIDATE_STATUS_LABELS[item.status] || item.status}</span>
                    <strong>{item.total}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <SectionHeader title="Tỷ lệ chuyển đổi theo nguồn" />
              <div className="table-wrap compact-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nguồn</th>
                      <th>Tổng</th>
                      <th>Đạt</th>
                      <th>Tỷ lệ %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.by_source || []).map((row) => (
                      <tr key={row.id || row.source_name}>
                        <td>{row.source_name}</td>
                        <td>{row.total_candidates}</td>
                        <td>{row.passed_candidates}</td>
                        <td>{row.conversion_pct || 0}%</td>
                      </tr>
                    ))}
                    {!summary.by_source?.length ? (
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
        </>
      ) : null}
    </section>
  );
}

export default RecruitmentPage;
