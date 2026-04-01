import { useEffect, useMemo, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import SegmentTabs from "../components/SegmentTabs";
import { useToast } from "../components/ToastProvider";
import { documentService } from "../services/documentService";
import { recruitmentService } from "../services/recruitmentService";
import { DOC_STATUSES, DOC_STATUS_LABELS } from "../utils/constants";
import { formatDate, formatDateTime } from "../utils/format";
import { getErrorMessage } from "../utils/toast";

const initialDocForm = {
  documentTypeCode: "",
  status: "SUBMITTED",
  issue_date: "",
  expiration_date: "",
  expected_complete_date: "",
  file_url: "",
  rejected_reason: "",
  note: "",
  file: null,
};

const phaseOptions = [
  { value: "PRE_EXAM", label: "Tiền thi tuyển - 7 giấy tờ cứng" },
  { value: "POST_EXAM", label: "Hậu thi tuyển - thủ tục xuất cảnh" },
];

const DOCUMENT_LABELS = {
  PRE_RESUME: "Sơ yếu lý lịch (Hồ sơ xin việc)",
  PRE_HEALTH_CERT: "Giấy khám sức khỏe đạt chuẩn",
  PRE_POLICE_CONFIRM: "Giấy xác nhận dân sự của công an xã",
  PRE_MARITAL_CONFIRM: "Giấy xác nhận tình trạng hôn nhân",
  PRE_HIGHEST_DEGREE: "Bằng tốt nghiệp cấp cao nhất",
  PRE_BIRTH_RESIDENCE_ID: "Giấy khai sinh, Xác nhận cư trú và CCCD",
  PRE_PROFILE_PHOTO: "Ảnh hồ sơ đi Nhật",
  POST_PASSPORT: "Hộ chiếu",
  POST_VISA: "Visa",
  POST_COE: "Tư cách lưu trú (COE)",
};

function getDocumentLabel(item) {
  return DOCUMENT_LABELS[item?.code] || item?.name || item?.code || "-";
}

function getPhaseLabel(phase) {
  if (phase === "PRE_EXAM") return "Tiền thi tuyển";
  if (phase === "POST_EXAM") return "Hậu thi tuyển";
  return "-";
}

function getWarningText(item) {
  if (!item?.warning_before_days) return "-";
  return `${item.warning_before_days} ngày`;
}

function getStatusTone(status) {
  if (status === "VERIFIED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "SUBMITTED") return "warn";
  return "";
}

function includesKeyword(value, keyword) {
  if (!keyword) return true;
  return String(value || "").toLowerCase().includes(keyword);
}

function DocumentsPage() {
  const [activeTab, setActiveTab] = useState("setup");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const [candidateId, setCandidateId] = useState("");
  const [phase, setPhase] = useState("PRE_EXAM");
  const [alertDays, setAlertDays] = useState(30);
  const [searchKeyword, setSearchKeyword] = useState("");

  const [candidates, setCandidates] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [healthAlerts, setHealthAlerts] = useState([]);
  const [visaAlerts, setVisaAlerts] = useState([]);
  const [docForm, setDocForm] = useState(initialDocForm);

  const tabs = [
    { key: "setup", label: "Thiết lập" },
    { key: "checklist", label: "Checklist ứng viên" },
    { key: "readiness", label: "Điều kiện trước thi" },
    { key: "alerts", label: "Cảnh báo" },
  ];

  const candidateOptions = useMemo(
    () =>
      candidates.map((candidate) => ({
        value: String(candidate.id),
        label: `CCCD ${candidate.citizen_id || "-"} - ${candidate.full_name}`,
      })),
    [candidates]
  );

  const normalizedSearchKeyword = useMemo(
    () => searchKeyword.trim().toLowerCase(),
    [searchKeyword]
  );

  const selectedCandidate = useMemo(
    () => candidates.find((item) => String(item.id) === String(candidateId)) || null,
    [candidateId, candidates]
  );

  const filteredCandidateOptions = useMemo(
    () =>
      candidateOptions.filter((option) =>
        includesKeyword(option.label, normalizedSearchKeyword)
      ),
    [candidateOptions, normalizedSearchKeyword]
  );

  const documentTypeMap = useMemo(() => {
    const map = new Map();
    documentTypes.forEach((item) => map.set(item.code, item));
    return map;
  }, [documentTypes]);

  const selectedDocumentType = useMemo(
    () => documentTypeMap.get(docForm.documentTypeCode) || null,
    [docForm.documentTypeCode, documentTypeMap]
  );

  const filteredDocumentTypes = useMemo(
    () =>
      documentTypes.filter((item) => {
        if (!normalizedSearchKeyword) return true;
        return [
          getDocumentLabel(item),
          getPhaseLabel(item.phase),
          Number(item.is_required_for_gate) ? "bắt buộc" : "không bắt buộc",
        ].some((value) => includesKeyword(value, normalizedSearchKeyword));
      }),
    [documentTypes, normalizedSearchKeyword]
  );

  const filteredDocuments = useMemo(
    () =>
      documents.filter((row) => {
        if (!normalizedSearchKeyword) return true;
        return [
          getDocumentLabel(row),
          DOC_STATUS_LABELS[row.status] || row.status,
          row.code,
        ].some((value) => includesKeyword(value, normalizedSearchKeyword));
      }),
    [documents, normalizedSearchKeyword]
  );

  const filteredMissingDocuments = useMemo(
    () =>
      (readiness?.missing_documents || []).filter((row) => {
        if (!normalizedSearchKeyword) return true;
        return [
          getDocumentLabel(row),
          DOC_STATUS_LABELS[row.status] || row.status,
          row.code,
        ].some((value) => includesKeyword(value, normalizedSearchKeyword));
      }),
    [readiness, normalizedSearchKeyword]
  );

  const filteredHealthAlerts = useMemo(
    () =>
      healthAlerts.filter((row) => {
        if (!normalizedSearchKeyword) return true;
        return [
          row.citizen_id,
          row.full_name,
          row.document_name,
          row.alert_level,
        ].some((value) => includesKeyword(value, normalizedSearchKeyword));
      }),
    [healthAlerts, normalizedSearchKeyword]
  );

  const filteredVisaAlerts = useMemo(
    () =>
      visaAlerts.filter((row) => {
        if (!normalizedSearchKeyword) return true;
        return [row.citizen_id, row.full_name, row.document_name].some((value) =>
          includesKeyword(value, normalizedSearchKeyword)
        );
      }),
    [visaAlerts, normalizedSearchKeyword]
  );

  const isEvidenceFileRequired = useMemo(
    () => docForm.status === "SUBMITTED" || docForm.status === "VERIFIED",
    [docForm.status]
  );

  const phaseSummary = useMemo(() => {
    const requiredCount = documentTypes.filter((item) => Number(item.is_required_for_gate) === 1).length;
    return { total: documentTypes.length, requiredCount };
  }, [documentTypes]);

  const showError = (err) => {
    toast.error(getErrorMessage(err));
  };

  const showSuccess = (text) => {
    toast.success(text);
  };

  const loadCandidates = async () => {
    const res = await recruitmentService.getCandidates({ page: 1, limit: 200 });
    setCandidates(res.data || []);
  };

  const loadDocumentTypes = async (targetPhase = phase) => {
    const res = await documentService.getDocumentTypes(targetPhase);
    const rows = res.data || [];
    setDocumentTypes(rows);
    setDocForm((prev) => ({
      ...prev,
      documentTypeCode: rows.some((item) => item.code === prev.documentTypeCode)
        ? prev.documentTypeCode
        : rows[0]?.code || "",
    }));
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
    if (!candidateId || phase !== "PRE_EXAM") {
      setReadiness(null);
      return;
    }
    const res = await documentService.getPreExamReadiness(candidateId);
    setReadiness(res.data || null);
  };

  const loadAlerts = async () => {
    const [healthRes, visaRes] = await Promise.all([
      documentService.getHealthExpiryAlerts(alertDays),
      documentService.getVisaDelayAlerts(),
    ]);
    setHealthAlerts(healthRes.data || []);
    setVisaAlerts(visaRes.data || []);
  };

  const reloadCurrent = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCandidates(), loadDocumentTypes(), loadAlerts()]);
      await loadCandidateDocs();
      await loadPreExamReadiness();
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
        if (!active) return;
        await loadPreExamReadiness();
      } catch (err) {
        if (active) showError(err);
      }
    }
    run();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, candidateId]);

  const handleInitDocs = async () => {
    if (!candidateId) {
      toast.error("Cần chọn ứng viên trước khi khởi tạo checklist.");
      return;
    }
    try {
      const res = await documentService.initCandidateDocuments(candidateId, phase);
      setDocuments(res.data || []);
      if (phase === "PRE_EXAM") await loadPreExamReadiness();
      showSuccess(`Đã khởi tạo checklist (${res.inserted_count || 0} giấy tờ mới).`);
    } catch (err) {
      showError(err);
    }
  };

  const handleUpdateDocument = async (event) => {
    event.preventDefault();
    if (!candidateId) {
      toast.error("Cần chọn ứng viên.");
      return;
    }
    if (!docForm.documentTypeCode) {
      toast.error("Cần chọn loại giấy tờ.");
      return;
    }
    if (isEvidenceFileRequired && !docForm.file) {
      toast.error("Bắt buộc tải file minh chứng khi cập nhật trạng thái Đã nộp hoặc Đã xác minh.");
      return;
    }

    const payload = new FormData();
    Object.entries(docForm).forEach(([key, value]) => {
      if (key === "documentTypeCode") return;
      if (value === "" || value === null || value === undefined) return;
      if (key === "file") {
        if (value) payload.append("file", value);
        return;
      }
      payload.append(key, value);
    });

    try {
      const res = await documentService.updateCandidateDocument(
        candidateId,
        docForm.documentTypeCode,
        payload
      );
      await loadCandidateDocs();
      await loadPreExamReadiness();
      showSuccess(`Đã cập nhật giấy tờ ${getDocumentLabel(res.data || selectedDocumentType || {})}.`);
      if (res.auto_transition?.applied) {
        toast.success("Ứng viên đã tự động chuyển sang trạng thái Đã nộp hồ sơ.");
      }
    } catch (err) {
      showError(err);
    }
  };

  const handleResetDocForm = () => {
    setDocForm((prev) => ({
      ...initialDocForm,
      documentTypeCode: prev.documentTypeCode,
    }));
  };

  const handleRefreshAlerts = async () => {
    try {
      await loadAlerts();
      showSuccess("Đã làm mới cảnh báo.");
    } catch (err) {
      showError(err);
    }
  };

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader
          title="M6. Quản lý hồ sơ và thủ tục xuất cảnh"
          subtitle="Quản lý checklist giấy tờ, điều kiện trước thi và cảnh báo tiến độ."
          action={
            <button className="btn ghost" type="button" onClick={reloadCurrent}>
              Làm mới
            </button>
          }
        />
        {loading ? <p className="muted">Đang tải dữ liệu M6...</p> : null}

        <div className="m6-toolbar">
          <div className="m6-toolbar__filters">
            <label className="inline-label m6-control">
              Ứng viên
              <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
                <option value="">Chọn ứng viên</option>
                {filteredCandidateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-label m6-control">
              Giai đoạn
              <select value={phase} onChange={(e) => setPhase(e.target.value)}>
                {phaseOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-label m6-control">
              Tìm kiếm
              <input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo CCCD, tên ứng viên, tên giấy tờ"
              />
            </label>
          </div>

          <div className="m6-toolbar__actions">
            <button className="btn" type="button" onClick={handleInitDocs}>
              Khởi tạo checklist
            </button>
            <button className="btn ghost" type="button" onClick={loadCandidateDocs} disabled={!candidateId}>
              Tải checklist
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setSearchKeyword("")}
              disabled={!searchKeyword.trim()}
            >
              Xóa tìm kiếm
            </button>
          </div>
        </div>

        {selectedCandidate ? (
          <p className="tiny muted m6-selected-candidate">
            Đang thao tác: {selectedCandidate.citizen_id || "-"} - {selectedCandidate.full_name}
          </p>
        ) : null}

        <div className="stats-inline">
          <div className="mini-stat">
            <span>Loại giấy tờ</span>
            <strong>{phaseSummary.total}</strong>
          </div>
          <div className="mini-stat">
            <span>Bắt buộc để ghép đơn</span>
            <strong>{phaseSummary.requiredCount}</strong>
          </div>
          <div className="mini-stat">
            <span>Checklist hiện có</span>
            <strong>{documents.length}</strong>
          </div>
        </div>

        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "setup" ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title="Danh sách loại giấy tờ" />
            <div className="table-wrap compact-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên giấy tờ</th>
                    <th>Giai đoạn</th>
                    <th>Bắt buộc</th>
                    <th>Cảnh báo trước hạn</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocumentTypes.map((item) => (
                    <tr key={item.code}>
                      <td>{getDocumentLabel(item)}</td>
                      <td>{getPhaseLabel(item.phase)}</td>
                      <td>
                        <span className={`badge ${Number(item.is_required_for_gate) ? "warn" : ""}`}>
                          {Number(item.is_required_for_gate) ? "Có" : "Không"}
                        </span>
                      </td>
                      <td>{getWarningText(item)}</td>
                    </tr>
                  ))}
                  {!filteredDocumentTypes.length ? (
                    <tr>
                      <td colSpan={4} className="center muted">
                        Không có giấy tờ nào khớp tìm kiếm.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <SectionHeader
              title="Cập nhật giấy tờ"
              subtitle={selectedDocumentType ? getDocumentLabel(selectedDocumentType) : "Chọn loại giấy tờ để cập nhật"}
            />

            <form className="grid-form" onSubmit={handleUpdateDocument}>
              <label>
                Loại giấy tờ
                <select
                  value={docForm.documentTypeCode}
                  onChange={(e) => setDocForm((prev) => ({ ...prev, documentTypeCode: e.target.value }))}
                >
                  <option value="">Chọn loại giấy tờ</option>
                  {documentTypes.map((item) => (
                    <option key={item.code} value={item.code}>
                      {getDocumentLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Trạng thái
                <select value={docForm.status} onChange={(e) => setDocForm((prev) => ({ ...prev, status: e.target.value }))}>
                  {DOC_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {DOC_STATUS_LABELS[status] || status}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Ngày cấp
                <input type="date" value={docForm.issue_date} onChange={(e) => setDocForm((prev) => ({ ...prev, issue_date: e.target.value }))} />
              </label>

              <label>
                Ngày hết hạn
                <input type="date" value={docForm.expiration_date} onChange={(e) => setDocForm((prev) => ({ ...prev, expiration_date: e.target.value }))} />
              </label>

              <label>
                Ngày dự kiến hoàn tất
                <input type="date" value={docForm.expected_complete_date} onChange={(e) => setDocForm((prev) => ({ ...prev, expected_complete_date: e.target.value }))} />
              </label>

              <label>
                URL file scan
                <input value={docForm.file_url} onChange={(e) => setDocForm((prev) => ({ ...prev, file_url: e.target.value }))} />
              </label>

              <label>
                Lý do từ chối
                <input value={docForm.rejected_reason} onChange={(e) => setDocForm((prev) => ({ ...prev, rejected_reason: e.target.value }))} />
              </label>

              <label>
                Tải file
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  required={isEvidenceFileRequired}
                  onChange={(e) => setDocForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
                />
                {isEvidenceFileRequired ? (
                  <span className="tiny">Bắt buộc tải file minh chứng cho trạng thái hiện tại.</span>
                ) : (
                  <span className="tiny muted">Khuyến nghị tải file để dễ kiểm tra hồ sơ.</span>
                )}
              </label>

              <label className="field-span-2">
                Ghi chú
                <input value={docForm.note} onChange={(e) => setDocForm((prev) => ({ ...prev, note: e.target.value }))} />
              </label>

              <div className="field-span-2 row-actions">
                <button className="btn" type="submit">
                  Cập nhật giấy tờ
                </button>
                <button className="btn ghost" type="button" onClick={handleResetDocForm}>
                  Đặt lại form
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeTab === "checklist" ? (
        <div className="surface">
          <SectionHeader
            title="Checklist giấy tờ của ứng viên"
            subtitle="Danh sách giấy tờ hiện có theo giai đoạn đã chọn."
          />

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên giấy tờ</th>
                  <th>Trạng thái</th>
                  <th>Bắt buộc</th>
                  <th>Dự kiến xong</th>
                  <th>Hết hạn</th>
                  <th>Cập nhật gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((row) => (
                  <tr key={`${row.document_type_id}-${row.code}`}>
                    <td>{getDocumentLabel(row)}</td>
                    <td>
                      <span className={`badge ${getStatusTone(row.status)}`}>
                        {DOC_STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                    <td>{Number(row.is_required_for_gate) ? "Có" : "-"}</td>
                    <td>{formatDate(row.expected_complete_date)}</td>
                    <td>{formatDate(row.expiration_date)}</td>
                    <td>{formatDateTime(row.verified_at || row.submitted_at)}</td>
                  </tr>
                ))}
                {!filteredDocuments.length ? (
                  <tr>
                    <td colSpan={6} className="center muted">
                      Không có checklist khớp điều kiện tìm kiếm.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "readiness" ? (
        <div className="surface two-col">
          <div>
            <SectionHeader
              title="Kiểm tra đủ điều kiện trước thi"
              subtitle="Áp dụng cho 7 giấy tờ cứng bắt buộc trước khi ghép đơn."
              action={
                <button className="btn" type="button" onClick={loadPreExamReadiness} disabled={!candidateId}>
                  Kiểm tra
                </button>
              }
            />

            {phase !== "PRE_EXAM" ? (
              <p className="muted">Tab này chỉ áp dụng cho giai đoạn tiền thi tuyển.</p>
            ) : readiness ? (
              <>
                <div className="stats-inline">
                  <div className="mini-stat">
                    <span>Tổng bắt buộc</span>
                    <strong>{readiness.required_total}</strong>
                  </div>
                  <div className="mini-stat">
                    <span>Đã xác minh</span>
                    <strong>{readiness.verified_total}</strong>
                  </div>
                  <div className="mini-stat">
                    <span>Đủ điều kiện ghép đơn</span>
                    <strong>{readiness.can_proceed ? "Có" : "Chưa"}</strong>
                  </div>
                </div>

                <div className="table-wrap compact-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Giấy tờ còn thiếu</th>
                        <th>Trạng thái hiện tại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMissingDocuments.map((row) => (
                        <tr key={row.code}>
                          <td>{getDocumentLabel(row)}</td>
                          <td>
                            <span className="badge warn">
                              {DOC_STATUS_LABELS[row.status] || row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!filteredMissingDocuments.length ? (
                        <tr>
                          <td colSpan={2} className="center success-text">
                            {readiness.missing_documents?.length
                              ? "Không có giấy tờ thiếu nào khớp tìm kiếm."
                              : "Ứng viên đã đủ điều kiện trước thi."}
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
            <SectionHeader title="Gợi ý thao tác" />
            <div className="roadmap-card">
              <ul className="inline-list">
                <li>Khởi tạo checklist đúng giai đoạn trước khi cập nhật từng giấy tờ.</li>
                <li>Những giấy tờ bắt buộc phải đạt trạng thái Đã xác minh trước khi ghép đơn.</li>
                <li>Sau khi ứng viên đỗ, chuyển sang giai đoạn hậu thi để theo dõi visa, hộ chiếu và COE.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "alerts" ? (
        <div className="surface two-col">
          <div>
            <SectionHeader
              title="Cảnh báo giấy khám sức khỏe sắp hết hạn"
              action={
                <div className="row-actions">
                  <input
                    type="number"
                    min="1"
                    value={alertDays}
                    onChange={(e) => setAlertDays(Number(e.target.value) || 30)}
                    style={{ width: 96 }}
                  />
                  <button className="btn small" type="button" onClick={handleRefreshAlerts}>
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
                    <th>Hết hạn</th>
                    <th>Còn lại</th>
                    <th>Mức cảnh báo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHealthAlerts.map((row) => (
                    <tr key={`${row.candidate_id}-${row.expiration_date}`}>
                      <td>{`${row.citizen_id || "-"} - ${row.full_name}`}</td>
                      <td>{formatDate(row.expiration_date)}</td>
                      <td>{row.days_left} ngày</td>
                      <td>{row.alert_level || "-"}</td>
                    </tr>
                  ))}
                  {!filteredHealthAlerts.length ? (
                    <tr>
                      <td colSpan={4} className="center muted">
                        Không có cảnh báo sức khỏe khớp tìm kiếm.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <SectionHeader title="Cảnh báo visa chậm tiến độ" />
            <div className="table-wrap compact-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ứng viên</th>
                    <th>Dự kiến hoàn tất</th>
                    <th>Trễ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisaAlerts.map((row) => (
                    <tr key={`${row.candidate_id}-${row.expected_complete_date}`}>
                      <td>{`${row.citizen_id || "-"} - ${row.full_name}`}</td>
                      <td>{formatDate(row.expected_complete_date)}</td>
                      <td>{row.overdue_days} ngày</td>
                    </tr>
                  ))}
                  {!filteredVisaAlerts.length ? (
                    <tr>
                      <td colSpan={3} className="center muted">
                        Không có cảnh báo visa khớp tìm kiếm.
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
