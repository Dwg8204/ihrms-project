import React, { useEffect, useMemo, useState } from "react";
import DetailModal from "../components/DetailModal";
import SectionHeader from "../components/SectionHeader";
import SegmentTabs from "../components/SegmentTabs";
import { useToast } from "../components/ToastProvider";
import { contractService } from "../services/contractService";
import { recruitmentService } from "../services/recruitmentService";
import { jobOrderService } from "../services/jobOrderService";
import { examApplicationService } from "../services/examApplicationService";
import { CONTRACT_STATUSES, CONTRACT_STATUS_LABELS } from "../utils/constants";
import { formatDate } from "../utils/format";
import { getErrorMessage } from "../utils/toast";
import { useI18n } from "../i18n/I18nProvider";

const initialContractForm = {
  candidate_id: "",
  job_order_id: "",
  contract_number: "",
  contract_type: "",
  signed_date: "",
  effective_date: "",
  expiry_date: "",
  status: "DRAFT",
  contract_details_json: ""
};

const initialTemplateForm = {
  name: "",
  template_type: "docx",
  description: ""
};

const formatToInputDate = (value) => {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

function Module4Page() {
  const { t } = useI18n();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("contracts");
  const [loading, setLoading] = useState(false);

  // Data arrays
  const [contracts, setContracts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobOrders, setJobOrders] = useState([]);
  const [examApplications, setExamApplications] = useState([]);

  // Pagination & Search for contracts
  const [contractSearch, setContractSearch] = useState("");
  const [contractStatusFilter, setContractStatusFilter] = useState("");
  const [contractPagination, setContractPagination] = useState({ page: 1, limit: 100, total: 0 });

  // Pagination & Search for templates
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePagination, setTemplatePagination] = useState({ page: 1, limit: 100, total: 0 });

  // Modal control - Contracts
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractForm, setContractForm] = useState(initialContractForm);
  const [contractFile, setContractFile] = useState(null);
  const [editingContractId, setEditingContractId] = useState(null);

  // Soft Delete reason modal control
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelingContractId, setCancelingContractId] = useState(null);

  // Modal control - Templates
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState(initialTemplateForm);
  const [templateFile, setTemplateFile] = useState(null);
  const [editingTemplateId, setEditingTemplateId] = useState(null);

  // Fetch Master Data: Candidates & Job Orders
  const loadMasterData = async () => {
    try {
      const [candRes, jobRes, tmplRes, examRes] = await Promise.all([
        recruitmentService.getCandidates({ page: 1, limit: 500 }),
        jobOrderService.getJobOrders({ page: 1, limit: 500 }),
        contractService.getContractTemplates({ page: 1, limit: 200 }),
        examApplicationService.getExamApplications({ page: 1, limit: 2000 })
      ]);
      setCandidates(candRes.data || []);
      setJobOrders(jobRes.data || []);
      setTemplates(tmplRes.data || []);
      setExamApplications(examRes.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Fetch Contracts
  const loadContracts = async (page = 1) => {
    setLoading(true);
    try {
      const res = await contractService.getContracts({
        page,
        limit: contractPagination.limit,
        search: contractSearch,
        status: contractStatusFilter
      });
      setContracts(res.data || []);
      if (res.pagination) {
        setContractPagination({
          page: res.pagination.page || 1,
          limit: res.pagination.limit || 100,
          total: res.pagination.total || 0
        });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Fetch Templates
  const loadTemplates = async (page = 1) => {
    setLoading(true);
    try {
      const res = await contractService.getContractTemplates({
        page,
        limit: templatePagination.limit,
        search: templateSearch
      });
      setTemplates(res.data || []);
      if (res.pagination) {
        setTemplatePagination({
          page: res.pagination.page || 1,
          limit: res.pagination.limit || 100,
          total: res.pagination.total || 0
        });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "contracts") {
      loadContracts(1);
    } else {
      loadTemplates(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, contractStatusFilter]);

  // Valid candidates filter: status === "PASSED" or "FORM_MATCHED_WAITING_EXAM"
  const filteredCandidates = useMemo(() => {
    return candidates.filter(
      (cand) => cand.status === "PASSED" || cand.status === "FORM_MATCHED_WAITING_EXAM"
    );
  }, [candidates]);

  const candidateDefaultJobOrderMap = useMemo(() => {
    const map = new Map();
    const sorted = [...examApplications].sort((a, b) => {
      const ta = new Date(a.exam_date || a.created_at || 0).getTime();
      const tb = new Date(b.exam_date || b.created_at || 0).getTime();
      return tb - ta;
    });

    sorted.forEach((row) => {
      const candidateId = String(row.candidate_id || "");
      if (!candidateId || map.has(candidateId)) return;
      if (!row.job_order_id) return;
      map.set(candidateId, String(row.job_order_id));
    });

    return map;
  }, [examApplications]);

  // --- Contracts Event Handlers ---
  const handleOpenCreateContract = () => {
    setContractForm({ ...initialContractForm, status: "DRAFT" });
    setContractFile(null);
    setEditingContractId(null);
    setContractModalOpen(true);
  };

  const handleOpenEditContract = (contract) => {
    setContractForm({
      candidate_id: contract.candidate_id || "",
      job_order_id: contract.job_order_id || "",
      contract_number: contract.contract_number || "",
      contract_type: contract.contract_type || "",
      signed_date: contract.signed_date ? formatToInputDate(contract.signed_date) : "",
      effective_date: contract.effective_date ? formatToInputDate(contract.effective_date) : "",
      expiry_date: contract.expiry_date ? formatToInputDate(contract.expiry_date) : "",
      status: contract.status || "DRAFT",
      contract_details_json: contract.contract_details_json ? JSON.stringify(contract.contract_details_json, null, 2) : ""
    });
    setContractFile(null);
    setEditingContractId(contract.id);
    setContractModalOpen(true);
  };

  const handleContractSubmit = async (e) => {
    e.preventDefault();
    if (!contractForm.candidate_id || !contractForm.contract_type) {
      toast.error("Vui lòng chọn ứng viên và loại hợp đồng.");
      return;
    }

    let parsedJson = null;
    if (contractForm.contract_details_json) {
      try {
        parsedJson = JSON.parse(contractForm.contract_details_json);
      } catch (parseErr) {
        toast.error("Chuỗi JSON của thông tin chi tiết hợp đồng không hợp lệ.");
        return;
      }
    }

    const formData = new FormData();
    formData.append("candidate_id", contractForm.candidate_id);
    if (contractForm.job_order_id) {
      formData.append("job_order_id", contractForm.job_order_id);
    }
    if (contractForm.contract_number) {
      formData.append("contract_number", contractForm.contract_number);
    }
    formData.append("contract_type", contractForm.contract_type);
    if (contractForm.signed_date) formData.append("signed_date", contractForm.signed_date);
    if (contractForm.effective_date) formData.append("effective_date", contractForm.effective_date);
    if (contractForm.expiry_date) formData.append("expiry_date", contractForm.expiry_date);
    formData.append("status", contractForm.status);
    if (parsedJson) {
      formData.append("contract_details_json", JSON.stringify(parsedJson));
    }
    if (contractFile) {
      formData.append("contract_file", contractFile);
    }

    try {
      if (editingContractId) {
        await contractService.updateContract(editingContractId, formData);
        toast.success("Đã cập nhật hợp đồng thành công.");
      } else {
        await contractService.createContract(formData);
        toast.success("Đã tạo hợp đồng mới thành công.");
      }
      setContractModalOpen(false);
      loadContracts(contractPagination.page);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleOpenCancelContract = (contract) => {
    setCancelingContractId(contract.id);
    setCancelReason("");
    setCancelModalOpen(true);
  };

  const handleSoftDelete = async () => {
    if (!cancelReason) {
      toast.error("Vui lòng nhập lý do hủy hợp đồng.");
      return;
    }
    try {
      await contractService.deleteContract(cancelingContractId, { reason: cancelReason });
      toast.success("Đã hủy hợp đồng thành công.");
      setCancelModalOpen(false);
      loadContracts(contractPagination.page);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleHardDelete = async (contractId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa vĩnh viễn hợp đồng này không?")) return;
    try {
      await contractService.deleteContract(contractId, { force_hard_delete: true });
      toast.success("Đã xóa vĩnh viễn hợp đồng thành công.");
      loadContracts(contractPagination.page);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // --- Templates Event Handlers ---
  const handleOpenCreateTemplate = () => {
    setTemplateForm({ ...initialTemplateForm });
    setTemplateFile(null);
    setEditingTemplateId(null);
    setTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tmpl) => {
    setTemplateForm({
      name: tmpl.name || "",
      template_type: tmpl.template_type || "docx",
      description: tmpl.description || ""
    });
    setTemplateFile(null);
    setEditingTemplateId(tmpl.id);
    setTemplateModalOpen(true);
  };

  const handleTemplateSubmit = async (e) => {
    e.preventDefault();
    if (!templateForm.name || !templateForm.template_type) {
      toast.error("Vui lòng nhập tên và loại mẫu hợp đồng.");
      return;
    }
    if (!editingTemplateId && !templateFile) {
      toast.error("Vui lòng đính kèm file mẫu hợp đồng.");
      return;
    }

    const formData = new FormData();
    formData.append("name", templateForm.name);
    formData.append("template_type", templateForm.template_type);
    formData.append("description", templateForm.description);
    if (templateFile) {
      formData.append("template_file", templateFile);
    }

    try {
      if (editingTemplateId) {
        await contractService.updateContractTemplate(editingTemplateId, formData);
        toast.success("Đã cập nhật mẫu hợp đồng thành công.");
      } else {
        await contractService.createContractTemplate(formData);
        toast.success("Đã tạo mẫu hợp đồng mới thành công.");
      }
      setTemplateModalOpen(false);
      loadTemplates(templatePagination.page);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa mẫu hợp đồng này không?")) return;
    try {
      await contractService.deleteContractTemplate(id);
      toast.success("Đã xóa mẫu hợp đồng thành công.");
      loadTemplates(templatePagination.page);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const tabs = [
    { key: "contracts", label: "Quản lý hợp đồng" },
    { key: "templates", label: "Mẫu hợp đồng" }
  ];

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader
          title="Quản lý Hợp đồng & Mẫu hợp đồng"
          action={
            <div className="inline-form">
              <button
                type="button"
                className="btn"
                onClick={activeTab === "contracts" ? handleOpenCreateContract : handleOpenCreateTemplate}
              >
                {activeTab === "contracts" ? "+ Thêm hợp đồng" : "+ Thêm mẫu hợp đồng"}
              </button>
              <button type="button" className="btn ghost" onClick={activeTab === "contracts" ? () => loadContracts(1) : () => loadTemplates(1)}>
                Làm mới
              </button>
            </div>
          }
        />
        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "contracts" ? (
        <div className="surface">
          <div className="inline-form" style={{ marginBottom: 18, marginTop: 12 }}>
            <input
              placeholder="Tìm kiếm theo số HD, ứng viên, đơn hàng..."
              style={{ minWidth: 320 }}
              value={contractSearch}
              onChange={(e) => setContractSearch(e.target.value)}
            />
            <select
              value={contractStatusFilter}
              onChange={(e) => setContractStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.keys(CONTRACT_STATUSES).map((statusKey) => (
                <option key={statusKey} value={statusKey}>
                  {CONTRACT_STATUS_LABELS[statusKey]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setContractSearch("");
                setContractStatusFilter("");
                loadContracts(1);
              }}
            >
              Xóa bộ lọc
            </button>
            <button type="button" className="btn" onClick={() => loadContracts(1)}>
              Tìm kiếm
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Số hợp đồng</th>
                  <th>Trạng thái</th>
                  <th>Ứng viên</th>
                  <th>Đơn hàng</th>
                  <th>Loại hợp đồng</th>
                  <th>Ngày ký</th>
                  <th>Ngày hiệu lực</th>
                  <th>Ngày hết hạn</th>
                  <th>File</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td>
                      <span className="bold">{contract.contract_number}</span>
                    </td>
                    <td>
                      <span className={`tiny ${contract.status === "SIGNED" ? "bold" : ""}`}>
                        {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
                      </span>
                    </td>
                    <td>{contract.candidate_name || `#${contract.candidate_id}`}</td>
                    <td>{contract.job_title || (contract.job_order_id ? `#${contract.job_order_id}` : "-")}</td>
                    <td>{contract.contract_type}</td>
                    <td>{contract.signed_date ? formatDate(contract.signed_date) : "-"}</td>
                    <td>{contract.effective_date ? formatDate(contract.effective_date) : "-"}</td>
                    <td>{contract.expiry_date ? formatDate(contract.expiry_date) : "-"}</td>
                    <td>
                      {contract.document_url ? (
                        <a
                          href={contract.document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn text small"
                        >
                          Tải/Xem
                        </a>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => handleOpenEditContract(contract)}
                        >
                          Sửa
                        </button>
                        {contract.status !== CONTRACT_STATUSES.CANCELLED ? (
                          <button
                            type="button"
                            className="btn ghost small"
                            onClick={() => handleOpenCancelContract(contract)}
                          >
                            Hủy
                          </button>
                        ) : null}
                        {contract.status === CONTRACT_STATUSES.DRAFT ? (
                          <button
                            type="button"
                            className="btn small danger"
                            onClick={() => handleHardDelete(contract.id)}
                            style={{ backgroundColor: "#ef4444", color: "#ffffff" }}
                          >
                            Xóa vĩnh viễn
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!contracts.length ? (
                  <tr>
                    <td colSpan={10} className="center muted">
                      {loading ? "Đang tải dữ liệu..." : "Không có hợp đồng nào được tìm thấy."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TEMPLATES TAB */
        <div className="surface">
          <div className="inline-form" style={{ marginBottom: 18, marginTop: 12 }}>
            <input
              placeholder="Tìm kiếm tên mẫu..."
              style={{ minWidth: 320 }}
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
            />
            <button
              type="button"
              className="btn"
              onClick={() => {
                loadTemplates(1);
              }}
            >
              Tìm kiếm
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên mẫu hợp đồng</th>
                  <th>Loại mẫu</th>
                  <th>Mô tả</th>
                  <th>File mẫu</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tmpl) => (
                  <tr key={tmpl.id}>
                    <td>
                      <span className="bold">{tmpl.name}</span>
                    </td>
                    <td>{tmpl.template_type}</td>
                    <td>{tmpl.description || "-"}</td>
                    <td>
                      {tmpl.template_file_url ? (
                        <a
                          href={tmpl.template_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn text small"
                        >
                          Xem File Mẫu
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => handleOpenEditTemplate(tmpl)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="btn small danger"
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          style={{ backgroundColor: "#ef4444", color: "#ffffff" }}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!templates.length ? (
                  <tr>
                    <td colSpan={5} className="center muted">
                      {loading ? "Đang tải dữ liệu..." : "Không có mẫu hợp đồng nào được tìm thấy."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODAL CREATE / EDIT CONTRACT --- */}
      <DetailModal
        open={contractModalOpen}
        title={editingContractId ? "Cập nhật hợp đồng" : "Thêm mới hợp đồng"}
        onClose={() => setContractModalOpen(false)}
      >
        <form className="grid-form" onSubmit={handleContractSubmit}>
          <label className="field-span-1">
            Ứng viên *
            <select
              value={contractForm.candidate_id}
              onChange={(e) => {
                const candidateId = e.target.value;
                const inferredJobOrderId = candidateDefaultJobOrderMap.get(String(candidateId)) || "";
                setContractForm((prev) => ({
                  ...prev,
                  candidate_id: candidateId,
                  job_order_id: inferredJobOrderId
                }));
              }}
            >
              <option value="">Chọn ứng viên</option>
              {/* Show selected candidate if editing, even if they aren't PASSED/FORM_MATCHED */}
              {candidates.map((cand) => {
                const isValid =
                  cand.status === "PASSED" || cand.status === "FORM_MATCHED_WAITING_EXAM" || cand.id === contractForm.candidate_id;
                if (!isValid && cand.id !== contractForm.candidate_id) return null;
                return (
                  <option key={cand.id} value={cand.id}>
                    {cand.full_name} ({cand.citizen_id})
                  </option>
                );
              })}
            </select>
          </label>

          <label className="field-span-1">
            Đơn hàng (Không bắt buộc)
            <select
              value={contractForm.job_order_id}
              onChange={(e) => setContractForm((prev) => ({ ...prev, job_order_id: e.target.value }))}
            >
              <option value="">Chọn đơn hàng</option>
              {jobOrders.map((job) => (
                <option key={job.id} value={job.id}>
                  #{job.id} {job.job_title} ({job.partner_name})
                </option>
              ))}
            </select>
          </label>

          <label className="field-span-1">
            Số hợp đồng (Tự động nếu để trống)
            <input
              placeholder="Ví dụ: HD-2605-0001"
              value={contractForm.contract_number}
              onChange={(e) => setContractForm((prev) => ({ ...prev, contract_number: e.target.value }))}
            />
          </label>

          <label className="field-span-1">
            Loại hợp đồng *
            <select
              value={contractForm.contract_type}
              onChange={(e) => setContractForm((prev) => ({ ...prev, contract_type: e.target.value }))}
            >
              <option value="">Chọn loại/mẫu hợp đồng</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.name}>
                  {tmpl.name}
                </option>
              ))}
              {/* Fallback if templates are empty or the current type isn't in templates */}
              {contractForm.contract_type && !templates.some(t => t.name === contractForm.contract_type) && (
                <option value={contractForm.contract_type}>{contractForm.contract_type}</option>
              )}
            </select>
          </label>

          <label className="field-span-1">
            Ngày ký
            <input
              type="date"
              value={contractForm.signed_date}
              onChange={(e) => setContractForm((prev) => ({ ...prev, signed_date: e.target.value }))}
            />
          </label>

          <label className="field-span-1">
            Ngày hiệu lực
            <input
              type="date"
              value={contractForm.effective_date}
              onChange={(e) => setContractForm((prev) => ({ ...prev, effective_date: e.target.value }))}
            />
          </label>

          <label className="field-span-1">
            Ngày hết hạn
            <input
              type="date"
              value={contractForm.expiry_date}
              onChange={(e) => setContractForm((prev) => ({ ...prev, expiry_date: e.target.value }))}
            />
          </label>

          <label className="field-span-1">
            Trạng thái hợp đồng
            <select
              value={contractForm.status}
              onChange={(e) => setContractForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {Object.keys(CONTRACT_STATUSES).map((statusKey) => (
                <option key={statusKey} value={statusKey}>
                  {CONTRACT_STATUS_LABELS[statusKey]}
                </option>
              ))}
            </select>
          </label>

          <label className="field-span-2">
            File đính kèm (Word / PDF / Hình ảnh)
            <input
              type="file"
              onChange={(e) => setContractFile(e.target.files ? e.target.files[0] : null)}
            />
          </label>

          <label className="field-span-2">
            Thông tin bổ sung chi tiết hợp đồng (JSON)
            <textarea
              placeholder='Ví dụ: { "salary": 20000000, "commission": "3%" }'
              style={{ minHeight: 100 }}
              value={contractForm.contract_details_json}
              onChange={(e) => setContractForm((prev) => ({ ...prev, contract_details_json: e.target.value }))}
            />
          </label>

          <div className="field-span-2" style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button type="submit" className="btn">
              {editingContractId ? "Lưu thay đổi" : "Tạo mới"}
            </button>
            <button type="button" className="btn ghost" onClick={() => setContractModalOpen(false)}>
              Hủy
            </button>
          </div>
        </form>
      </DetailModal>

      {/* --- MODAL SOFT DELETE REASON --- */}
      <DetailModal
        open={cancelModalOpen}
        title="Hủy hợp đồng (Xóa mềm)"
        onClose={() => setCancelModalOpen(false)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p>Trạng thái hợp đồng sẽ được chuyển sang <strong>CANCELLED (Đã hủy)</strong>. Hãy nhập lý do hủy:</p>
          <textarea
            placeholder="Ví dụ: Ứng viên xin rút hồ sơ / Hủy do vi phạm điều khoản..."
            style={{ minHeight: 110 }}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="button" className="btn" onClick={handleSoftDelete}>
              Xác nhận hủy
            </button>
            <button type="button" className="btn ghost" onClick={() => setCancelModalOpen(false)}>
              Đóng
            </button>
          </div>
        </div>
      </DetailModal>

      {/* --- MODAL CREATE / EDIT TEMPLATE --- */}
      <DetailModal
        open={templateModalOpen}
        title={editingTemplateId ? "Cập nhật mẫu hợp đồng" : "Thêm mới mẫu hợp đồng"}
        onClose={() => setTemplateModalOpen(false)}
      >
        <form className="grid-form" onSubmit={handleTemplateSubmit}>
          <label className="field-span-2">
            Tên mẫu hợp đồng *
            <input
              placeholder="Ví dụ: Thỏa thuận lao động Nhật Bản"
              value={templateForm.name}
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <label className="field-span-2">
            Loại mẫu *
            <input
              placeholder="Ví dụ: docx"
              value={templateForm.template_type}
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, template_type: e.target.value }))}
            />
          </label>

          <label className="field-span-2">
            Mô tả mẫu hợp đồng
            <textarea
              placeholder="Mô tả công dụng hoặc ghi chú về mẫu hợp đồng này..."
              style={{ minHeight: 80 }}
              value={templateForm.description}
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>

          <label className="field-span-2">
            File mẫu hợp đồng (docx) *
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setTemplateFile(e.target.files ? e.target.files[0] : null)}
            />
          </label>

          <div className="field-span-2" style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button type="submit" className="btn">
              {editingTemplateId ? "Lưu thay đổi" : "Tạo mẫu"}
            </button>
            <button type="button" className="btn ghost" onClick={() => setTemplateModalOpen(false)}>
              Hủy
            </button>
          </div>
        </form>
      </DetailModal>
    </section>
  );
}

export default Module4Page;
