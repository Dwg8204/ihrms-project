import { useEffect, useMemo, useRef, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import { useToast } from '../components/ToastProvider';
import { emailService } from '../services/emailService';
import { recruitmentService } from '../services/recruitmentService';
import { formatDateTime } from '../utils/format';
import { getErrorMessage } from '../utils/toast';

const initialTemplateForm = {
  template_code: '',
  subject: '',
  body_html: ''
};

const sampleVariables = {
  full_name: 'Nguyễn Văn A',
  job_name: 'Gia công cơ khí',
  exam_date: '2026-05-20 08:30:00',
  phone: '0909000000',
  email: 'nguyenvana@example.com'
};

function formatCode(code) {
  if (!code) return '';
  return code.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/* ─── Template Editor Modal ─────────────────────────── */
function TemplateEditorModal({ templateId, form, setForm, onSave, onClose, saving, selecting }) {
  const editorRef = useRef(null);
  const toast = useToast();

  const variableSuggestions = useMemo(
    () => [
      { key: 'full_name', label: 'Họ tên ứng viên' },
      { key: 'job_name', label: 'Tên đơn hàng' },
      { key: 'exam_date', label: 'Ngày thi' },
      { key: 'phone', label: 'Số điện thoại' },
      { key: 'email', label: 'Email ứng viên' },
      { key: 'candidate_id', label: 'Mã ứng viên' },
      { key: 'candidate_status', label: 'Trạng thái ứng viên' }
    ],
    []
  );

  const applySample = (text) =>
    String(text || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
      const v = sampleVariables[key];
      return v ?? '';
    });

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== form.body_html) {
      editorRef.current.innerHTML = form.body_html || '';
    }
  }, [form.body_html]);

  const handleCommand = (command) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (command === 'createLink') {
      const link = window.prompt('Nhập URL liên kết');
      if (!link) return;
      document.execCommand(command, false, link);
    } else {
      document.execCommand(command, false, null);
    }
    setForm((prev) => ({ ...prev, body_html: editorRef.current.innerHTML }));
  };

  const insertVariable = (key) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertText', false, `{{${key}}}`);
    setForm((prev) => ({ ...prev, body_html: editorRef.current?.innerHTML || '' }));
  };

  return (
    <div className="detail-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="detail-modal-card email-modal-wide">
        <div className="detail-modal-head">
          <div>
            <h3>{templateId ? (form.template_code ? formatCode(form.template_code) : 'Chỉnh sửa mẫu email') : 'Tạo mẫu email mới'}</h3>
          </div>
          <button type="button" className="btn ghost small" onClick={onClose}>✕</button>
        </div>

        {selecting ? (
          <p className="muted center email-modal-loading">Đang tải dữ liệu...</p>
        ) : (
          <div className="email-modal-body">
            {/* Left: form + editor */}
            <div className="email-modal-left">
              <div className="email-modal-meta">
                <label>
                  Mã mẫu (template_code)
                  <input
                    value={form.template_code}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        template_code: String(e.target.value || '').toUpperCase().replace(/\s+/g, '_')
                      }))
                    }
                    placeholder="Ví dụ: EXAM_PASS_NOTIFY"
                  />
                  <span className="tiny muted email-modal-hint">
                    Chỉ dùng chữ, số và dấu gạch dưới.
                  </span>
                </label>

                <label>
                  Tiêu đề email
                  {/* Hiển thị tiêu đề với biến dạng chip đẹp */}
                  <div className="subject-preview-input">
                    {form.subject
                      ? String(form.subject).split(/({{[^}]+}})/g).map((part, i) =>
                          /^{{.+}}$/.test(part)
                            ? <span key={i} className="subject-var-chip">{variableSuggestions.find(v => `{{${v.key}}}` === part)?.label || part.slice(2, -2)}</span>
                            : <span key={i}>{part}</span>
                        )
                      : <span className="muted">Nhập tiêu đề email...</span>
                    }
                  </div>
                  <input
                    value={form.subject}
                    onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="Nhập tiêu đề email..."
                    className="subject-raw-input"
                  />
                  <span className="tiny muted email-modal-hint">
                    Xem trước khi gửi: <strong className="email-modal-preview-highlight">{applySample(form.subject) || '—'}</strong>
                  </span>
                </label>
              </div>

              <div className="email-editor-section">
                <p className="label-text">Nội dung email</p>

                <div className="email-toolbar-row">
                  <div className="email-editor-toolbar">
                    {[
                      { cmd: 'bold', label: 'B' },
                      { cmd: 'italic', label: 'I' },
                      { cmd: 'underline', label: 'U' },
                      { cmd: 'insertUnorderedList', label: '≡' },
                      { cmd: 'createLink', label: '🔗' }
                    ].map(({ cmd, label }) => (
                      <button key={cmd} type="button" className="btn small ghost toolbar-btn" onClick={() => handleCommand(cmd)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="tiny muted email-toolbar-hint">Chèn biến:</span>
                  <div className="email-variable-row">
                    {variableSuggestions.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className="btn small ghost var-chip"
                        title={`{{${item.key}}}`}
                        onClick={() => insertVariable(item.key)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  ref={editorRef}
                  className="email-rich-editor"
                  data-placeholder="Nhập nội dung email tại đây..."
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => setForm((p) => ({ ...p, body_html: editorRef.current?.innerHTML || '' }))}
                />
              </div>
            </div>

            {/* Right: preview */}
            <div className="email-modal-right">
              <p className="label-text">Xem trước</p>
              <div className="email-preview-panel">
                <div className="email-preview-subject">
                  <span className="tiny muted">Tiêu đề:</span>
                  <strong>{applySample(form.subject) || '(chưa có tiêu đề)'}</strong>
                </div>
                <div
                  className="email-preview"
                  dangerouslySetInnerHTML={{ __html: applySample(form.body_html) || '<span class="muted email-preview-placeholder">Nội dung sẽ hiện ở đây...</span>' }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="detail-modal-foot email-modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>Hủy</button>
          <button type="button" className="btn" onClick={onSave} disabled={saving || selecting}>
            {saving ? 'Đang lưu...' : templateId ? 'Cập nhật' : 'Tạo mẫu'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────── */
function EmailPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('templates');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logStatusFilter, setLogStatusFilter] = useState('');
  const [manualCandidates, setManualCandidates] = useState([]);
  const [manualTemplateId, setManualTemplateId] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [sendingManual, setSendingManual] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateForm, setTemplateForm] = useState(initialTemplateForm);

  const showError = (error) => toast.error(getErrorMessage(error));

  const loadTemplates = async () => {
    const res = await emailService.getTemplates({ page: 1, limit: 200 });
    const list = res.data || [];
    setTemplates(list);
    return list;
  };

  const loadLogs = async () => {
    const params = { page: 1, limit: 200 };
    if (logStatusFilter) params.status = logStatusFilter;
    const res = await emailService.getLogs(params);
    setLogs(res.data || []);
  };

  const loadManualCandidates = async () => {
    const res = await recruitmentService.getCandidates({ page: 1, limit: 500 });
    const list = res.data || [];
    setManualCandidates(list);
    setSelectedCandidateIds((prev) => {
      const available = new Set(list.map((item) => Number(item.id)));
      return prev.filter((id) => available.has(Number(id)));
    });
  };

  const filteredManualCandidates = useMemo(() => {
    const keyword = String(manualSearch || '').trim().toLowerCase();
    if (!keyword) return manualCandidates;

    return manualCandidates.filter((item) => {
      const haystack = `${item.full_name || ''} ${item.email || ''} ${item.phone || ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [manualCandidates, manualSearch]);

  const isAllFilteredSelected = useMemo(() => {
    if (!filteredManualCandidates.length) return false;
    return filteredManualCandidates.every((item) => selectedCandidateIds.includes(Number(item.id)));
  }, [filteredManualCandidates, selectedCandidateIds]);

  const toggleCandidate = (candidateId) => {
    const id = Number(candidateId);
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    const ids = filteredManualCandidates.map((item) => Number(item.id));
    if (!ids.length) return;

    setSelectedCandidateIds((prev) => {
      if (ids.every((id) => prev.includes(id))) {
        return prev.filter((id) => !ids.includes(id));
      }

      const merged = new Set([...prev, ...ids]);
      return Array.from(merged);
    });
  };

  const handleManualSend = async () => {
    if (!manualTemplateId) {
      toast.error('Vui lòng chọn mẫu email.');
      return;
    }

    if (!selectedCandidateIds.length) {
      toast.error('Vui lòng chọn ít nhất 1 ứng viên.');
      return;
    }

    try {
      setSendingManual(true);
      const res = await emailService.sendManual({
        template_id: Number(manualTemplateId),
        candidate_ids: selectedCandidateIds
      });

      const total = Number(res?.data?.total || selectedCandidateIds.length);
      const sent = Number(res?.data?.sent || 0);
      const failed = Number(res?.data?.failed || 0);
      toast.success(`Đã xử lý ${total} email: gửi thành công ${sent}, lỗi ${failed}.`);

      await loadLogs();
    } catch (error) {
      showError(error);
    } finally {
      setSendingManual(false);
    }
  };

  const reloadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadTemplates(), loadLogs(), loadManualCandidates()]);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setEditingTemplateId(null);
    setTemplateForm(initialTemplateForm);
    setModalOpen(true);
  };

  const openEdit = async (template) => {
    setEditingTemplateId(template.id);
    setTemplateForm({ template_code: template.template_code, subject: template.subject, body_html: template.body_html || '' });
    setModalOpen(true);
    try {
      setSelecting(true);
      const detail = await emailService.getTemplateById(template.id);
      const data = detail?.data || template;
      setTemplateForm({
        template_code: data.template_code || '',
        subject: data.subject || '',
        body_html: data.body_html || ''
      });
    } catch (error) {
      showError(error);
    } finally {
      setSelecting(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTemplateId(null);
    setTemplateForm(initialTemplateForm);
  };

  const handleSaveTemplate = async () => {
    try {
      const normalizedCode = String(templateForm.template_code || '').trim().toUpperCase();
      if (!normalizedCode) {
        toast.error('Vui lòng nhập template_code trước khi lưu.');
        return;
      }

      setSaving(true);
      const payload = {
        template_code: normalizedCode,
        subject: templateForm.subject,
        body_html: templateForm.body_html
      };

      if (editingTemplateId) {
        await emailService.updateTemplate(editingTemplateId, payload);
        toast.success('Đã cập nhật mẫu email.');
      } else {
        await emailService.createTemplate(payload);
        toast.success('Đã tạo mẫu email mới.');
      }

      closeModal();
      await loadTemplates();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Xác nhận xóa mẫu email này?')) return;
    try {
      await emailService.deleteTemplate(templateId);
      toast.success('Đã xóa mẫu email.');
      await loadTemplates();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <section className="page-grid mail-center-page">
      {/* Header */}
      <div className="surface">
        <SectionHeader
          title="Mail Center"
        
          action={
            <button className="btn ghost" type="button" onClick={reloadData}>
              Làm mới
            </button>
          }
        />
        <div className="tab-row">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            Mẫu Email
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            Lịch sử Gửi
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
            onClick={() => setActiveTab('manual')}
          >
            Gửi thủ công
          </button>
        </div>
        {loading && <p className="muted mail-center-loading">Đang tải...</p>}
      </div>

      {/* Templates tab */}
      {activeTab === 'templates' && (
        <div className="surface">
          <div className="mail-center-templates-head">
            <div>
              <p className="mail-center-templates-title">Danh sách mẫu email</p>
              <p className="muted mail-center-templates-count">{templates.length} mẫu</p>
            </div>
            <button type="button" className="btn" onClick={openNew}>
              + Tạo mẫu mới
            </button>
          </div>

          {!templates.length ? (
            <div className="email-empty-state">
              <div className="email-empty-icon">✉️</div>
              <p>Chưa có mẫu email nào.</p>
              <button type="button" className="btn" onClick={openNew}>Tạo mẫu đầu tiên</button>
            </div>
          ) : (
            <div className="email-card-grid">
              {templates.map((tpl) => (
                <div key={tpl.id} className="email-card">
                  <div className="email-card-icon">✉</div>
                  <div className="email-card-body">
                    <p className="email-card-name">{formatCode(tpl.template_code)}</p>
                    <p className="email-card-subject">{tpl.subject}</p>
                    <p className="email-card-code">{tpl.template_code}</p>
                  </div>
                  <div className="email-card-actions">
                    <button type="button" className="btn small ghost" onClick={() => openEdit(tpl)}>
                      Chỉnh sửa
                    </button>
                    <button type="button" className="btn small text danger" onClick={() => handleDeleteTemplate(tpl.id)}>
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logs tab */}
      {activeTab === 'logs' && (
        <div className="surface">
          <SectionHeader
            title="Lịch sử gửi email"
            action={
              <div className="row-actions">
                <select value={logStatusFilter} onChange={(e) => setLogStatusFilter(e.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  <option value="PENDING">Đang chờ</option>
                  <option value="SENT">Đã gửi</option>
                  <option value="FAILED">Lỗi</option>
                </select>
                <button type="button" className="btn ghost" onClick={async () => { try { await loadLogs(); toast.success('Đã tải lại.'); } catch (e) { showError(e); } }}>
                  Tải lại
                </button>
              </div>
            }
          />

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ứng viên</th>
                  <th>Email</th>
                  <th>Mẫu</th>
                  <th>Thời gian gửi</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú lỗi</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id}>
                    <td className="muted">{row.id}</td>
                    <td>{row.full_name || `#${row.candidate_id}`}</td>
                    <td>{row.email || '—'}</td>
                    <td>{row.template_code ? formatCode(row.template_code) : `#${row.template_id}`}</td>
                    <td>{formatDateTime(row.sent_at)}</td>
                    <td>
                      <span className={`badge ${row.status === 'FAILED' ? 'danger' : row.status === 'SENT' ? 'ok' : 'warn'}`}>
                        {row.status === 'SENT' ? 'Đã gửi' : row.status === 'FAILED' ? 'Lỗi' : 'Chờ'}
                      </span>
                    </td>
                    <td className="muted">{row.error_message || '—'}</td>
                  </tr>
                ))}
                {!logs.length && (
                  <tr>
                    <td colSpan={7} className="center muted mail-center-empty-row">
                      Chưa có lịch sử gửi email.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'manual' && (
        <div className="surface">
          <SectionHeader
            title="Gửi email thủ công"
            subtitle="Chọn mẫu email và danh sách ứng viên để gửi ngay"
            action={
              <button type="button" className="btn ghost" onClick={loadManualCandidates}>
                Tải lại ứng viên
              </button>
            }
          />

          <div className="grid-form mail-center-form-grid">
            <label className="field-span-2">
              Mẫu email
              <select value={manualTemplateId} onChange={(e) => setManualTemplateId(e.target.value)}>
                <option value="">Chọn mẫu email</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {formatCode(tpl.template_code)} - {tpl.subject}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-span-2">
              Tìm ứng viên
              <input
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
                placeholder="Nhập tên, email hoặc số điện thoại"
              />
            </label>
          </div>

          <div className="row-actions mail-center-row-actions">
            <label className="mail-center-select-all">
              <input type="checkbox" checked={isAllFilteredSelected} onChange={toggleSelectAllFiltered} />
              Chọn tất cả danh sách đang lọc
            </label>
            <span className="muted">Đã chọn {selectedCandidateIds.length} ứng viên</span>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="mail-center-select-col"></th>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Số điện thoại</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredManualCandidates.map((row) => {
                  const id = Number(row.id);
                  const checked = selectedCandidateIds.includes(id);
                  return (
                    <tr key={id}>
                      <td>
                        <input type="checkbox" checked={checked} onChange={() => toggleCandidate(id)} />
                      </td>
                      <td>{row.full_name || `#${id}`}</td>
                      <td>{row.email || '—'}</td>
                      <td>{row.phone || '—'}</td>
                      <td>{row.status || '—'}</td>
                    </tr>
                  );
                })}
                {!filteredManualCandidates.length && (
                  <tr>
                    <td colSpan={5} className="center muted" style={{ padding: '24px 0' }}>
                      Không có ứng viên phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="row-actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              disabled={sendingManual || !manualTemplateId || !selectedCandidateIds.length}
              onClick={handleManualSend}
            >
              {sendingManual ? 'Đang gửi...' : `Gửi thủ công (${selectedCandidateIds.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {modalOpen && (
        <TemplateEditorModal
          templateId={editingTemplateId}
          form={templateForm}
          setForm={setTemplateForm}
          onSave={handleSaveTemplate}
          onClose={closeModal}
          saving={saving}
          selecting={selecting}
        />
      )}
    </section>
  );
}

export default EmailPage;
