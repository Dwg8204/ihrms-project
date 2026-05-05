import React, { useEffect, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import SegmentTabs from "../components/SegmentTabs";
import DetailModal from "../components/DetailModal";
import { useToast } from "../components/ToastProvider";
import { financeService } from "../services/financeService";
import { jobOrderService } from "../services/jobOrderService";
import { FEE_CATEGORIES, FEE_CATEGORY_LABELS, TRANSACTION_TYPE_LABELS } from "../utils/constants";
import { formatDate, formatCurrency } from "../utils/format";
import { getErrorMessage } from "../utils/toast";

const initialFeeForm = {
  fee_name: "",
  amount: 0,
  fee_category: "INITIAL",
  due_event: "INITIAL_REGISTRATION",
  job_order_id: "",
  refund_pct_fail: 100,
  refund_pct_withdraw_notified: 80,
  refund_pct_withdraw_unnotified: 0,
  refund_pct_no_go: 50,
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

  // Global Transactions (Overview)
  const [transactions, setTransactions] = useState([]);

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

  useEffect(() => {
    loadJobOrders();
    if (activeTab === "standards") {
      loadStandards();
    }
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
      refund_pct_fail: fee.refund_pct_fail,
      refund_pct_withdraw_notified: fee.refund_pct_withdraw_notified,
      refund_pct_withdraw_unnotified: fee.refund_pct_withdraw_unnotified,
      refund_pct_no_go: fee.refund_pct_no_go,
      is_mandatory_for_exit: fee.is_mandatory_for_exit
    });
    setEditingFeeId(fee.id);
    setFeeModalOpen(true);
  };

  const handleFeeSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingFeeId) {
        await financeService.updateFeeStandard(editingFeeId, feeForm);
        toast.success("Đã cập nhật định mức phí.");
      } else {
        await financeService.createFeeStandard(feeForm);
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

  const tabs = [
    { key: "standards", label: "Định mức phí" },
    { key: "reports", label: "Tổng quan tài chính" }
  ];

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
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {standards.map((fee) => (
                  <tr key={fee.id}>
                    <td className="bold">{fee.fee_name}</td>
                    <td>{FEE_CATEGORY_LABELS[fee.fee_category]}</td>
                    <td className="bold color-primary">{formatCurrency(fee.amount)}</td>
                    <td>{fee.due_event}</td>
                    <td>{fee.job_title || "Dùng chung"}</td>
                    <td>{fee.is_mandatory_for_exit ? "Có" : "Không"}</td>
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
                    <td colSpan={7} className="center muted">
                      {loading ? "Đang tải..." : "Chưa có định mức phí nào."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="surface">
           <div className="roadmap-card" style={{ textAlign: "center", padding: "40px" }}>
              <h3>Báo cáo Tài chính</h3>
              <p className="muted">Tính năng tổng hợp báo cáo đang được phát triển.</p>
              <p>Vui lòng kiểm tra chi tiết tài chính trong từng Ứng viên để theo dõi dòng tiền cụ thể.</p>
           </div>
        </div>
      )}

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
              <option value="INITIAL_REGISTRATION">Ngay khi tiếp nhận</option>
              <option value="ON_REGISTRATION">Khi nộp phí đợt 0</option>
              <option value="BEFORE_INTERNAL_EXAM">Trước thi nội bộ</option>
              <option value="CONTRACT_SIGNED">Khi ký hợp đồng (Module 4)</option>
              <option value="VISA_RECEIVED">Khi có Visa</option>
              <option value="BEFORE_EXIT">Trước khi xuất cảnh</option>
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

          <div className="field-span-2">
            <h4 style={{ margin: "10px 0" }}>Chính sách hoàn tiền (%) khi:</h4>
            <div className="grid-form" style={{ gap: "10px" }}>
              <label>Thi trượt (TH1) <input type="number" value={feeForm.refund_pct_fail} onChange={e => setFeeForm({...feeForm, refund_pct_fail: e.target.value})} /></label>
              <label>Rút có báo (TH2) <input type="number" value={feeForm.refund_pct_withdraw_notified} onChange={e => setFeeForm({...feeForm, refund_pct_withdraw_notified: e.target.value})} /></label>
              <label>Bỏ ngang (TH3) <input type="number" value={feeForm.refund_pct_withdraw_unnotified} onChange={e => setFeeForm({...feeForm, refund_pct_withdraw_unnotified: e.target.value})} /></label>
              <label>Đạt ko đi (TH5) <input type="number" value={feeForm.refund_pct_no_go} onChange={e => setFeeForm({...feeForm, refund_pct_no_go: e.target.value})} /></label>
            </div>
          </div>

          <label className="field-span-1">
            Bắt buộc để xuất cảnh?
            <select value={feeForm.is_mandatory_for_exit} onChange={e => setFeeForm({...feeForm, is_mandatory_for_exit: Number(e.target.value)})}>
               <option value={1}>Có</option>
               <option value={0}>Không</option>
            </select>
          </label>

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
