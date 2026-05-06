import React, { useEffect, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import SegmentTabs from "../components/SegmentTabs";
import DetailModal from "../components/DetailModal";
import { useToast } from "../components/ToastProvider";
import { financeService } from "../services/financeService";
import { jobOrderService } from "../services/jobOrderService";
import { FEE_CATEGORIES, FEE_CATEGORY_LABELS, DUE_EVENT_LABELS, TRANSACTION_TYPE_LABELS } from "../utils/constants";
import { formatDate, formatCurrency } from "../utils/format";
import { getErrorMessage } from "../utils/toast";

const initialFeeForm = {
  fee_name: "",
  amount: 0,
  fee_category: "INITIAL",
  due_event: "ON_REGISTRATION",
  job_order_id: "",
  is_refundable_on_fail_exam: 0,
  refund_pct_on_fail_exam: 0,
  is_refundable_on_withdrawal: 0,
  refund_pct_on_withdrawal: 0,
  is_refundable_on_no_go: 0,
  refund_pct_on_no_go: 0,
  is_mandatory_for_exit: 1
};

function FinancePage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("standards");
  const [loading, setLoading] = useState(false);

  // Fee Standards
  const [standards, setStandards] = useState([]);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [feeForm, setFeeForm] = useState(initialFeeForm);
  const [editingFeeId, setEditingFeeId] = useState(null);
  const [jobOrders, setJobOrders] = useState([]);

  // Transactions Overview
  const [transactions, setTransactions] = useState([]);
  const [txSummary, setTxSummary] = useState(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txFilter, setTxFilter] = useState({ type: "", date_from: "", date_to: "", candidate_name: "" });

  const loadStandards = async () => {
    setLoading(true);
    try {
      const res = await financeService.getFeeStandards({ limit: 100 });
      setStandards(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadJobOrders = async () => {
    try {
      const res = await jobOrderService.getJobOrders({ limit: 500 });
      setJobOrders(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadTransactions = async (filter = txFilter) => {
    setTxLoading(true);
    try {
      const params = { limit: 100 };
      if (filter.type) params.transaction_type = filter.type;
      if (filter.date_from) params.date_from = filter.date_from;
      if (filter.date_to) params.date_to = filter.date_to;
      if (filter.candidate_name) params.candidate_name = filter.candidate_name;
      const res = await financeService.getAllTransactions(params);
      setTransactions(res.data || []);
      setTxSummary(res.summary || null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    loadJobOrders();
    if (activeTab === "standards") loadStandards();
    if (activeTab === "reports") loadTransactions();
  }, [activeTab]);

  const handleOpenCreateFee = () => {
    setFeeForm(initialFeeForm);
    setEditingFeeId(null);
    setFeeModalOpen(true);
  };

  const handleOpenEditFee = (fee) => {
    setFeeForm({
      fee_name: fee.fee_name,
      amount: fee.amount,
      fee_category: fee.fee_category,
      due_event: fee.due_event,
      job_order_id: fee.job_order_id || "",
      is_refundable_on_fail_exam: fee.is_refundable_on_fail_exam ? 1 : 0,
      refund_pct_on_fail_exam: fee.refund_pct_on_fail_exam ?? 0,
      is_refundable_on_withdrawal: fee.is_refundable_on_withdrawal ? 1 : 0,
      refund_pct_on_withdrawal: fee.refund_pct_on_withdrawal ?? 0,
      is_refundable_on_no_go: fee.is_refundable_on_no_go ? 1 : 0,
      refund_pct_on_no_go: fee.refund_pct_on_no_go ?? 0,
      is_mandatory_for_exit: fee.is_mandatory_for_exit ? 1 : 0
    });
    setEditingFeeId(fee.id);
    setFeeModalOpen(true);
  };

  const handleFeeSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...feeForm,
        job_order_id: feeForm.job_order_id || null,
      };
      if (editingFeeId) {
        await financeService.updateFeeStandard(editingFeeId, payload);
        toast.success("Đã cập nhật định mức phí.");
      } else {
        await financeService.createFeeStandard(payload);
        toast.success("Đã tạo định mức phí mới.");
      }
      setFeeModalOpen(false);
      loadStandards();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteFee = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa định mức phí này?")) return;
    try {
      await financeService.deleteFeeStandard(id);
      toast.success("Đã xóa định mức phí.");
      loadStandards();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleTxFilterChange = (key, value) => {
    const next = { ...txFilter, [key]: value };
    setTxFilter(next);
  };

  const handleTxSearch = () => loadTransactions(txFilter);

  const tabs = [
    { key: "standards", label: "Định mức phí" },
    { key: "reports", label: "Tổng quan tài chính" }
  ];

  const netRevenue = txSummary ? (Number(txSummary.total_income) - Number(txSummary.total_refund)) : 0;

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader
          title="Quản lý Tài chính & Phí dịch vụ"
          subtitle="Thiết lập các loại phí, định mức bồi hoàn và theo dõi dòng tiền"
          action={
            activeTab === "standards" && (
              <button className="btn" onClick={handleOpenCreateFee}>
                + Thêm định mức
              </button>
            )
          }
        />
        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "standards" ? (
        <div className="surface">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên phí</th>
                  <th>Phân loại</th>
                  <th>Số tiền</th>
                  <th>Sự kiện thu</th>
                  <th>Đơn hàng</th>
                  <th>Bắt buộc?</th>
                  <th>Hoàn thi trượt</th>
                  <th>Hoàn rút HĐ</th>
                  <th>Hoàn ko đi</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {standards.map((fee) => (
                  <tr key={fee.id}>
                    <td className="bold">{fee.fee_name}</td>
                    <td>{FEE_CATEGORY_LABELS[fee.fee_category] || fee.fee_category}</td>
                    <td className="bold color-primary">{formatCurrency(fee.amount)}</td>
                    <td>{DUE_EVENT_LABELS[fee.due_event] || fee.due_event}</td>
                    <td>{fee.job_title || "Dùng chung"}</td>
                    <td>{fee.is_mandatory_for_exit ? "Có" : "Không"}</td>
                    <td className="center">{fee.is_refundable_on_fail_exam ? `${fee.refund_pct_on_fail_exam}%` : "—"}</td>
                    <td className="center">{fee.is_refundable_on_withdrawal ? `${fee.refund_pct_on_withdrawal}%` : "—"}</td>
                    <td className="center">{fee.is_refundable_on_no_go ? `${fee.refund_pct_on_no_go}%` : "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn ghost small" onClick={() => handleOpenEditFee(fee)}>Sửa</button>
                        <button className="btn ghost small danger" onClick={() => handleDeleteFee(fee.id)}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!standards.length && (
                  <tr>
                    <td colSpan={10} className="center muted">
                      {loading ? "Đang tải..." : "Chưa có định mức phí nào."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="surface">
            <div className="stats-grid">
              <div className="stat-card tone-ocean">
                <div className="stat-label">Tổng thu</div>
                <div className="stat-value">{formatCurrency(txSummary?.total_income || 0)}</div>
                <div className="stat-hint">{txSummary?.total_transactions || 0} giao dịch</div>
              </div>
              <div className="stat-card tone-alert">
                <div className="stat-label">Tổng hoàn trả</div>
                <div className="stat-value">{formatCurrency(txSummary?.total_refund || 0)}</div>
                <div className="stat-hint">cho {txSummary?.total_candidates || 0} ứng viên</div>
              </div>
              <div className="stat-card tone-mint">
                <div className="stat-label">Doanh thu thuần</div>
                <div className="stat-value" style={{ color: netRevenue >= 0 ? undefined : "var(--danger-500)" }}>
                  {formatCurrency(netRevenue)}
                </div>
                <div className="stat-hint">Thu — Hoàn</div>
              </div>
              <div className="stat-card tone-sun">
                <div className="stat-label">Ứng viên phát sinh phí</div>
                <div className="stat-value">{txSummary?.total_candidates || 0}</div>
                <div className="stat-hint">trong kỳ lọc</div>
              </div>
            </div>
          </div>

          {/* Filter + Table */}
          <div className="surface">
            <div className="inline-form" style={{ marginBottom: 14 }}>
              <label style={{ minWidth: 160 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Loại giao dịch</span>
                <select value={txFilter.type} onChange={e => handleTxFilterChange("type", e.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="INCOME">Thu tiền</option>
                  <option value="REFUND">Hoàn tiền</option>
                </select>
              </label>
              <label style={{ minWidth: 180 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Tìm kiếm (tên hoặc nội dung)</span>
                <input
                  type="text"
                  placeholder="Ứng viên, Học phí, Visa..."
                  value={txFilter.candidate_name}
                  onChange={e => handleTxFilterChange("candidate_name", e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTxSearch()}
                />
              </label>
              <label style={{ minWidth: 160 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Từ ngày</span>
                <input type="date" value={txFilter.date_from} onChange={e => handleTxFilterChange("date_from", e.target.value)} />
              </label>
              <label style={{ minWidth: 160 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Đến ngày</span>
                <input type="date" value={txFilter.date_to} onChange={e => handleTxFilterChange("date_to", e.target.value)} />
              </label>
              <button className="btn" style={{ alignSelf: "flex-end" }} onClick={handleTxSearch}>
                Lọc
              </button>
              <button className="btn ghost" style={{ alignSelf: "flex-end" }} onClick={() => {
                const reset = { type: "", date_from: "", date_to: "", candidate_name: "" };
                setTxFilter(reset);
                loadTransactions(reset);
              }}>
                Xóa lọc
              </button>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Ứng viên</th>
                    <th>Loại</th>
                    <th>Số tiền</th>
                    <th>Ghi chú</th>
                    <th>Ngày giao dịch</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="muted">{tx.id}</td>
                      <td className="bold">{tx.candidate_name}</td>
                      <td>
                        <span className={`badge ${tx.transaction_type === "INCOME" ? "ok" : "danger"}`}>
                          {tx.transaction_type === "INCOME" ? "Thu tiền" : "Hoàn tiền"}
                        </span>
                      </td>
                      <td className={`bold ${tx.transaction_type === "INCOME" ? "color-primary" : "color-danger"}`}>
                        {tx.transaction_type === "REFUND" ? "−" : "+"}{formatCurrency(tx.amount_paid)}
                      </td>
                      <td className="muted">{tx.note || "—"}</td>
                      <td>{formatDate(tx.transaction_date)}</td>
                    </tr>
                  ))}
                  {!transactions.length && (
                    <tr>
                      <td colSpan={6} className="center muted">
                        {txLoading ? "Đang tải..." : "Chưa có giao dịch nào trong kỳ này."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Thêm/Sửa Định mức phí */}
      <DetailModal
        open={feeModalOpen}
        title={editingFeeId ? "Cập nhật định mức phí" : "Thêm định mức phí mới"}
        onClose={() => setFeeModalOpen(false)}
      >
        <form className="grid-form" onSubmit={handleFeeSubmit}>
          <label className="field-span-2">
            Tên khoản phí *
            <input
              required
              placeholder="VD: Phí đặt cọc cam kết đợt 2"
              value={feeForm.fee_name}
              onChange={(e) => setFeeForm({ ...feeForm, fee_name: e.target.value })}
            />
          </label>

          <label className="field-span-1">
            Số tiền (VND) *
            <input
              type="number"
              required
              min={0}
              value={feeForm.amount}
              onChange={(e) => setFeeForm({ ...feeForm, amount: Number(e.target.value) })}
            />
          </label>

          <label className="field-span-1">
            Phân loại phí
            <select
              value={feeForm.fee_category}
              onChange={(e) => setFeeForm({ ...feeForm, fee_category: e.target.value })}
            >
              {Object.entries(FEE_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          <label className="field-span-1">
            Sự kiện kích hoạt thu
            <select
              value={feeForm.due_event}
              onChange={(e) => setFeeForm({ ...feeForm, due_event: e.target.value })}
            >
              {Object.entries(DUE_EVENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          <label className="field-span-1">
            Áp dụng cho Đơn hàng
            <select
              value={feeForm.job_order_id}
              onChange={(e) => setFeeForm({ ...feeForm, job_order_id: e.target.value })}
            >
              <option value="">-- Dùng chung toàn hệ thống --</option>
              {jobOrders.map(job => (
                <option key={job.id} value={job.id}>#{job.id} - {job.job_title}</option>
              ))}
            </select>
          </label>

          <label className="field-span-1">
            Bắt buộc để xuất cảnh?
            <select value={feeForm.is_mandatory_for_exit} onChange={e => setFeeForm({ ...feeForm, is_mandatory_for_exit: Number(e.target.value) })}>
              <option value={1}>Có</option>
              <option value={0}>Không</option>
            </select>
          </label>

          <div className="field-span-2">
            <h4 style={{ margin: "10px 0 8px" }}>Chính sách hoàn tiền theo trường hợp</h4>
            <div className="grid-form" style={{ gap: "10px" }}>
              <label>
                Thi trượt (TH1) — Hoàn?
                <select value={feeForm.is_refundable_on_fail_exam} onChange={e => setFeeForm({ ...feeForm, is_refundable_on_fail_exam: Number(e.target.value) })}>
                  <option value={1}>Có</option>
                  <option value={0}>Không</option>
                </select>
              </label>
              <label>
                % Hoàn khi thi trượt
                <input type="number" min={0} max={100} value={feeForm.refund_pct_on_fail_exam}
                  onChange={e => setFeeForm({ ...feeForm, refund_pct_on_fail_exam: Number(e.target.value) })} />
              </label>
              <label>
                Rút hồ sơ (TH2/TH3) — Hoàn?
                <select value={feeForm.is_refundable_on_withdrawal} onChange={e => setFeeForm({ ...feeForm, is_refundable_on_withdrawal: Number(e.target.value) })}>
                  <option value={1}>Có</option>
                  <option value={0}>Không</option>
                </select>
              </label>
              <label>
                % Hoàn khi rút hồ sơ
                <input type="number" min={0} max={100} value={feeForm.refund_pct_on_withdrawal}
                  onChange={e => setFeeForm({ ...feeForm, refund_pct_on_withdrawal: Number(e.target.value) })} />
              </label>
              <label>
                Đạt nhưng không đi (TH5) — Hoàn?
                <select value={feeForm.is_refundable_on_no_go} onChange={e => setFeeForm({ ...feeForm, is_refundable_on_no_go: Number(e.target.value) })}>
                  <option value={1}>Có</option>
                  <option value={0}>Không</option>
                </select>
              </label>
              <label>
                % Hoàn khi không đi
                <input type="number" min={0} max={100} value={feeForm.refund_pct_on_no_go}
                  onChange={e => setFeeForm({ ...feeForm, refund_pct_on_no_go: Number(e.target.value) })} />
              </label>
            </div>
          </div>

          <div className="field-span-2 row-actions" style={{ marginTop: "20px" }}>
            <button type="submit" className="btn">Lưu thông tin</button>
            <button type="button" className="btn ghost" onClick={() => setFeeModalOpen(false)}>Hủy</button>
          </div>
        </form>
      </DetailModal>
    </section>
  );
}

export default FinancePage;
