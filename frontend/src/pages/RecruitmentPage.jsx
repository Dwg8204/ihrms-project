import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import SegmentTabs from '../components/SegmentTabs';
import { useToast } from '../components/ToastProvider';
import DetailModal from '../components/DetailModal';
import { recruitmentService } from '../services/recruitmentService';
import { educationLevelService } from '../services/educationLevelService';
import { jobOrderService } from '../services/jobOrderService';
import { examApplicationService } from '../services/examApplicationService';
import { documentService } from '../services/documentService';
import { emailService } from '../services/emailService';
import { financeService } from '../services/financeService';
import { 
  CANDIDATE_STATUSES, 
  CANDIDATE_STATUS_LABELS,
  PAYMENT_SCHEDULE_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  FEE_CATEGORY_LABELS
} from '../utils/constants';
import { formatDate, formatDateTime, formatCurrency } from '../utils/format';
import { getErrorMessage } from '../utils/toast';

const initialCandidateForm = {
  citizen_id: '',
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
  cv_file: null
};

const initialTransitionDraft = {
  status: '',
  jobOrderId: '',
  examDate: '',
  examApplicationId: '',
  withdrawal_reason: 'TH3' // Default to Bỏ ngang
};

const PAYMENT_SCHEDULE_LABELS = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã đóng đủ',
  PARTIALLY_PAID: 'Đóng một phần',
  OVERDUE: 'Quá hạn',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền'
};

const emptyReadiness = {
  can_submit_profile: false,
  can_proceed_verified: false,
  can_proceed: false,
  required_total: 0,
  submitted_total: 0,
  verified_total: 0,
  missing_submitted_documents: [],
  missing_verified_documents: [],
  missing_documents: []
};

function toCandidateForm(candidate) {
  return {
    citizen_id: candidate.citizen_id || '',
    full_name: candidate.full_name || '',
    dob: candidate.dob ? String(candidate.dob).slice(0, 10) : '',
    gender: candidate.gender || '',
    phone: candidate.phone || '',
    email: candidate.email || '',
    address: candidate.address || '',
    height: candidate.height ?? '',
    weight: candidate.weight ?? '',
    blood_type: candidate.blood_type || '',
    education_level:
      candidate.education_level !== null && candidate.education_level !== undefined
        ? String(candidate.education_level)
        : '',
    experience_summary: candidate.experience_summary || '',
    source_id: candidate.source_id ? String(candidate.source_id) : '',
    source_note: candidate.source_note || '',
    cv_file: null
  };
}

function canUseExamCreation(status) {
  return status === 'FORM_MATCHED_WAITING_EXAM';
}

function canUseExamResult(status) {
  return status === 'PASSED' || status === 'FAILED_POOL';
}

function getExamResultStatus(status) {
  if (status === 'PASSED') return 'Pass';
  if (status === 'FAILED_POOL') return 'Fail';
  return '';
}

function getBadgeClass(status) {
  if (status === 'PASSED') return 'badge ok';
  if (status === 'FAILED_POOL') return 'badge danger';
  return 'badge';
}

function RecruitmentPage() {
  const [activeTab, setActiveTab] = useState('funnel');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const toast = useToast();

  const [sources, setSources] = useState([]);
  const [sourceName, setSourceName] = useState('');
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [editingSourceName, setEditingSourceName] = useState('');

  const [candidateForm, setCandidateForm] = useState(initialCandidateForm);
  const [editForm, setEditForm] = useState(initialCandidateForm);
  const [editingCandidateId, setEditingCandidateId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [filters, setFilters] = useState({ search: '', status: '', source_id: '' });
  const [transitionDrafts, setTransitionDrafts] = useState({});

  const [candidates, setCandidates] = useState([]);
  const [educationLevels, setEducationLevels] = useState([]);
  const [kanban, setKanban] = useState([]);
  const [summary, setSummary] = useState({ by_status: [], by_source: [] });
  const [jobOrders, setJobOrders] = useState([]);
  const [examApplications, setExamApplications] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [manualSendModalOpen, setManualSendModalOpen] = useState(false);
  const [manualTemplateId, setManualTemplateId] = useState('');
  const [manualSending, setManualSending] = useState(false);

  const [candidateDetail, setCandidateDetail] = useState(null);
  const [detailReadiness, setDetailReadiness] = useState(emptyReadiness);
  const [detailSubTab, setDetailSubTab] = useState('profile'); // profile, documents, finance

  // Finance state
  const [paymentSchedules, setPaymentSchedules] = useState([]);
  const [candidateTransactions, setCandidateTransactions] = useState([]);
  const [isReadyForExit, setIsReadyForExit] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNote, setPaymentNote] = useState("");
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundNote, setRefundNote] = useState("");

  // Add schedule manually
  const [addScheduleModalOpen, setAddScheduleModalOpen] = useState(false);
  const [addScheduleForm, setAddScheduleForm] = useState({
    description: '', amount_due: 0, due_date: '', is_mandatory_for_exit: 0,
    is_refundable: 0, refund_policy_pct: 0, triggered_by_event: 'MANUAL'
  });

  const tabs = [
    { key: 'intake', label: 'Thêm ứng viên' },
    { key: 'source', label: 'Nguồn tuyển dụng' },
    { key: 'candidate', label: 'Danh sách ứng viên' },
    { key: 'funnel', label: 'Phễu trạng thái' }
  ];

  const hiddenFunnelStatuses = new Set(['WAITING_FORM_MATCH']);

  const sourceMap = useMemo(() => {
    const map = new Map();
    sources.forEach((item) => map.set(String(item.id), item.source_name));
    return map;
  }, [sources]);

  const educationLevelMap = useMemo(() => {
    const map = new Map();
    educationLevels.forEach((item) => map.set(String(item.id), item.name));
    return map;
  }, [educationLevels]);

  const openJobOrders = useMemo(
    () => jobOrders.filter((job) => job.status === 'OPEN'),
    [jobOrders]
  );

  const pendingExamByCandidate = useMemo(() => {
    const map = new Map();
    examApplications.forEach((item) => {
      if (item.result_status !== 'Pending') return;
      const key = String(item.candidate_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [examApplications]);

  const selectableCandidateIds = useMemo(
    () => candidates.map((candidate) => Number(candidate.id)),
    [candidates]
  );

  const allOnPageSelected = useMemo(() => {
    if (!selectableCandidateIds.length) return false;
    return selectableCandidateIds.every((id) => selectedCandidateIds.includes(id));
  }, [selectableCandidateIds, selectedCandidateIds]);

  const showError = (err) => {
    toast.error(getErrorMessage(err));
  };

  const showSuccess = (text) => {
    toast.success(text);
  };

  const toPayload = (form) => {
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === 'cv_file') {
        if (value) payload.append('cv_file', value);
        return;
      }

      payload.append(key, value ?? '');
    });
    return payload;
  };

  const getAvailableTransitions = (currentStatus) => {
    switch (currentStatus) {
      case 'NEW_RECEIVED':
        return ['PAID0_DOCS_SUBMITTED', 'WITHDRAWN'];
      case 'PAID0_DOCS_SUBMITTED':
        return ['WAITING_FORM_MATCH', 'WITHDRAWN'];
      case 'WAITING_FORM_MATCH':
        return ['FORM_MATCHED_WAITING_EXAM', 'WITHDRAWN'];
      case 'FORM_MATCHED_WAITING_EXAM':
      case 'PASSED':
      case 'FAILED_POOL':
      case 'CONTRACT_SIGNED':
        return ['WITHDRAWN'];
      default:
        return ['WITHDRAWN'];
    }
  };

  const getTransitionDraft = (row) => {
    const existing = transitionDrafts[row.id];
    if (existing) return existing;
    
    return { 
      ...initialTransitionDraft, 
      status: row.status || '', 
      withdrawal_reason: row.withdrawal_reason || 'TH3'
    };
  };

  const setTransitionDraft = (row, key, value) => {
    setTransitionDrafts((prev) => {
      const current = prev[row.id] || { 
        ...initialTransitionDraft, 
        status: row.status || '', 
        withdrawal_reason: row.withdrawal_reason || 'TH3'
      };
      return {
        ...prev,
        [row.id]: { ...current, [key]: value }
      };
    });
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
    const nextCandidates = res.data || [];
    setCandidates(nextCandidates);
    setSelectedCandidateIds((prev) => {
      const availableIds = new Set(nextCandidates.map((item) => Number(item.id)));
      return prev.filter((id) => availableIds.has(Number(id)));
    });
  };

  const loadEducationLevels = async () => {
    const res = await educationLevelService.getEducationLevels({ page: 1, limit: 200 });
    setEducationLevels(res.data || []);
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

  const loadJobOrders = async () => {
    const res = await jobOrderService.getJobOrders({ page: 1, limit: 200 });
    setJobOrders(res.data || []);
  };

  const loadExamApplications = async () => {
    const res = await examApplicationService.getExamApplications({ page: 1, limit: 300 });
    setExamApplications(res.data || []);
  };

  const loadEmailTemplates = async () => {
    const res = await emailService.getTemplates({ page: 1, limit: 200 });
    setEmailTemplates(res.data || []);
  };

  const reloadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSources(),
        loadEducationLevels(),
        loadCandidates(),
        loadKanban(),
        loadSummary(),
        loadJobOrders(),
        loadExamApplications(),
        loadEmailTemplates()
      ]);
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
      await loadSummary();
      showSuccess('Đã thêm nguồn tuyển dụng.');
    } catch (err) {
      showError(err);
    }
  };

  const handleStartEditSource = (source) => {
    setEditingSourceId(source.id);
    setEditingSourceName(source.source_name);
  };

  const handleSaveSource = async () => {
    if (!editingSourceId || !editingSourceName.trim()) return;

    try {
      await recruitmentService.updateSource(editingSourceId, {
        source_name: editingSourceName.trim()
      });
      setEditingSourceId(null);
      setEditingSourceName('');
      await loadSources();
      await loadSummary();
      showSuccess('Đã cập nhật nguồn tuyển dụng.');
    } catch (err) {
      showError(err);
    }
  };

  const handleDeleteSource = async (id) => {
    try {
      await recruitmentService.deleteSource(id);
      await loadSources();
      await loadSummary();
      showSuccess('Đã xóa nguồn tuyển dụng.');
    } catch (err) {
      showError(err);
    }
  };

  const handleCreateCandidate = async (event) => {
    event.preventDefault();
    try {
      await recruitmentService.createCandidate(toPayload(candidateForm));
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
        setDetailReadiness(emptyReadiness);
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

  const handleViewCandidateDetail = async (id) => {
    try {
      setDetailLoading(true);
      const [candidateRes, readinessRes] = await Promise.all([
        recruitmentService.getCandidateById(id),
        documentService.getPreExamReadiness(id)
      ]);
      setCandidateDetail(candidateRes.data || null);
      setDetailReadiness(readinessRes.data || emptyReadiness);
      setDetailSubTab('profile');
      setDetailModalOpen(true);
      
      // Load finance data in background
      loadFinancialData(id);
    } catch (err) {
      setDetailReadiness(emptyReadiness);
      showError(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadFinancialData = async (candidateId) => {
    try {
      const [schedulesRes, transactionsRes, readinessRes] = await Promise.all([
        financeService.getPaymentSchedulesByCandidate(candidateId),
        financeService.getTransactionsByCandidate(candidateId),
        financeService.checkExitReadiness(candidateId)
      ]);
      setPaymentSchedules(schedulesRes.data || []);
      setCandidateTransactions(transactionsRes.data || []);
      setIsReadyForExit(readinessRes.isReady || false);
    } catch (err) {
      console.error('Error loading financial data:', err);
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

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false);
    setCandidateDetail(null);
    setDetailReadiness(emptyReadiness);
  };

  const handleCloseEditModal = () => {
    setEditingCandidateId(null);
    setEditForm(initialCandidateForm);
  };

  const handleUpdateCandidate = async (event) => {
    event.preventDefault();
    if (!editingCandidateId) return;

    try {
      setUpdating(true);
      await recruitmentService.updateCandidate(editingCandidateId, toPayload(editForm));
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

  const handleUpdateStatus = async (candidate) => {
    const draft = getTransitionDraft(candidate);
    const targetStatus = draft.status || candidate.status;
    
    // Check if anything actually changed
    const statusChanged = targetStatus !== candidate.status;
    const reasonChanged = targetStatus === 'WITHDRAWN' && draft.withdrawal_reason !== candidate.withdrawal_reason;
    
    if (!statusChanged && !reasonChanged) {
      toast.info('Trạng thái và lý do không thay đổi.');
      return;
    }

    try {
      if (canUseExamCreation(targetStatus)) {
        if (!draft.jobOrderId || !draft.examDate) {
          toast.error('Cần chọn đơn hàng và ngày thi trước khi ghép form.');
          return;
        }

        const pendingExam = (pendingExamByCandidate.get(String(candidate.id)) || [])[0] || null;

        if (pendingExam) {
          if (Number(pendingExam.job_order_id) !== Number(draft.jobOrderId)) {
            toast.error('Ứng viên đã được ghép với đơn hàng khác. Vui lòng kiểm tra lại đơn hàng.');
            return;
          }

          await examApplicationService.updateExamSchedule(pendingExam.id, {
            exam_date: draft.examDate
          });
        } else {
          await examApplicationService.createExamApplication({
            candidate_id: candidate.id,
            job_order_id: Number(draft.jobOrderId),
            exam_date: draft.examDate
          });
        }
      } else if (canUseExamResult(targetStatus)) {
        if (!draft.examApplicationId) {
          toast.error('Cần chọn phiếu thi đang chờ kết quả.');
          return;
        }

        await examApplicationService.updateExamResult(draft.examApplicationId, {
          result_status: getExamResultStatus(targetStatus)
        });
      } else if (targetStatus === 'WITHDRAWN') {
        await recruitmentService.updateCandidateStatus(candidate.id, targetStatus, { 
          withdrawal_reason: draft.withdrawal_reason 
        });
      } else {
        await recruitmentService.updateCandidateStatus(candidate.id, targetStatus);
      }

      setTransitionDrafts((prev) => {
        const next = { ...prev };
        delete next[candidate.id];
        return next;
      });
      await reloadAll();
      if (String(candidateDetail?.id || '') === String(candidate.id)) {
        await handleViewCandidateDetail(candidate.id);
      }
      showSuccess('Đã cập nhật trạng thái ứng viên.');
    } catch (err) {
      showError(err);
    }
  };

  const handleAddScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!candidateDetail) return;
    try {
      setUpdating(true);
      await financeService.createPaymentSchedule({
        ...addScheduleForm,
        candidate_id: candidateDetail.id,
        amount_due: Number(addScheduleForm.amount_due),
      });
      showSuccess('Đã thêm khoản phí mới.');
      setAddScheduleModalOpen(false);
      setAddScheduleForm({ description: '', amount_due: 0, due_date: '', is_mandatory_for_exit: 0, is_refundable: 0, refund_policy_pct: 0, triggered_by_event: 'MANUAL' });
      loadFinancialData(candidateDetail.id);
    } catch (err) {
      showError(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedSchedule || !paymentAmount) return;

    try {
      setUpdating(true);
      await financeService.recordPayment(selectedSchedule.id, {
        amount: paymentAmount,
        note: paymentNote,
        approved_by_user_id: 1 // Default to 1 for demo
      });
      showSuccess('Ghi nhận thanh toán thành công.');
      setPaymentModalOpen(false);
      loadFinancialData(candidateDetail.id);
      await reloadAll();
    } catch (err) {
      showError(err);
    } finally {
      setUpdating(false);
    }
  };

  const handlePayAll = async () => {
    const pendingSchedules = paymentSchedules.filter(s => (s.status === 'PENDING' || s.status === 'PARTIALLY_PAID') && s.balance > 0);
    if (!pendingSchedules.length) return;
    
    if (!window.confirm(`Xác nhận đóng tất cả ${pendingSchedules.length} khoản phí đang nợ?`)) return;

    try {
      setUpdating(true);
      await Promise.all(pendingSchedules.map(sch => 
        financeService.recordPayment(sch.id, {
          amount: sch.balance,
          note: 'Thanh toán tất cả công nợ',
          approved_by_user_id: 1
        })
      ));
      showSuccess('Đã thanh toán tất cả các khoản phí.');
      loadFinancialData(candidateDetail.id);
      await reloadAll();
    } catch (err) {
      showError(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleRefundAll = async () => {
    if (!candidateDetail) return;
    let reason = candidateDetail.withdrawal_reason || 'TH3';
    if (candidateDetail.status === 'FAILED_POOL') reason = 'TH1';

    if (!window.confirm(`Xác nhận thực hiện hoàn tiền cho tất cả các khoản phí đã đóng (Theo trường hợp ${reason})?`)) return;

    try {
      setUpdating(true);
      await financeService.processRefundsManually(candidateDetail.id, reason);
      showSuccess('Đã thực hiện hoàn tiền thành công.');
      loadFinancialData(candidateDetail.id);
      await reloadAll();
    } catch (err) {
      showError(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenRefundModal = (sch) => {
    setSelectedSchedule(sch);
    let pct = 0;
    const reason = candidateDetail.status === 'FAILED_POOL' ? 'TH1' : (candidateDetail.withdrawal_reason || 'TH3');
    
    if (reason === 'TH1') pct = sch.refund_pct_on_fail_exam || 0;
    else if (reason === 'TH2') pct = sch.refund_pct_on_withdrawal || 0;
    else if (reason === 'TH5') pct = sch.refund_pct_on_no_go || 0;

    const calculated = (parseFloat(sch.amount_paid) * parseFloat(pct)) / 100;
    setRefundAmount(calculated);
    setRefundNote(`Hoàn tiền cho ${sch.description} (Trường hợp ${reason}, tỷ lệ ${pct}%)`);
    setRefundModalOpen(true);
  };

  const handleRecordRefund = async (e) => {
    e.preventDefault();
    if (!selectedSchedule || refundAmount === undefined || refundAmount === null) return;

    try {
      setUpdating(true);
      await financeService.recordRefund(selectedSchedule.id, {
        amount: refundAmount,
        note: refundNote,
        approved_by_user_id: 1
      });
      showSuccess('Ghi nhận hoàn tiền thành công.');
      setRefundModalOpen(false);
      loadFinancialData(candidateDetail.id);
      await reloadAll();
    } catch (err) {
      showError(err);
    } finally {
      setUpdating(false);
    }
  };

  const toggleCandidateSelection = (candidateId) => {
    const normalizedId = Number(candidateId);
    setSelectedCandidateIds((prev) => {
      if (prev.includes(normalizedId)) {
        return prev.filter((id) => id !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  };

  const toggleSelectAllCandidates = () => {
    if (allOnPageSelected) {
      setSelectedCandidateIds((prev) =>
        prev.filter((id) => !selectableCandidateIds.includes(Number(id)))
      );
      return;
    }

    setSelectedCandidateIds((prev) => {
      const merged = new Set([...prev, ...selectableCandidateIds]);
      return Array.from(merged);
    });
  };

  const openManualSendModal = () => {
    if (!selectedCandidateIds.length) {
      toast.error('Vui lòng chọn ít nhất 1 ứng viên để gửi email.');
      return;
    }

    setManualSendModalOpen(true);
  };

  const closeManualSendModal = () => {
    setManualSendModalOpen(false);
    setManualTemplateId('');
  };

  const handleManualSend = async () => {
    if (!manualTemplateId) {
      toast.error('Vui lòng chọn mẫu email.');
      return;
    }

    if (!selectedCandidateIds.length) {
      toast.error('Danh sách ứng viên gửi đang trống.');
      return;
    }

    try {
      setManualSending(true);
      const res = await emailService.sendManual({
        template_id: Number(manualTemplateId),
        candidate_ids: selectedCandidateIds
      });

      const sent = res?.data?.sent ?? 0;
      const failed = res?.data?.failed ?? 0;
      showSuccess(`Đã xử lý gửi email: ${sent} thành công, ${failed} thất bại.`);
      closeManualSendModal();
    } catch (err) {
      showError(err);
    } finally {
      setManualSending(false);
    }
  };

  const renderCandidateForm = (form, onFieldChange, submitLabel, onSubmit, isEdit = false) => (
    <form className="grid-form" onSubmit={onSubmit}>
      <label>
        Căn cước công dân
        <input
          required
          value={form.citizen_id}
          onChange={(e) => onFieldChange('citizen_id', e.target.value)}
          placeholder="12 chữ số"
          inputMode="numeric"
          pattern="\d{12}"
          maxLength={12}
        />
      </label>
      <label>
        Họ và tên
        <input
          required
          value={form.full_name}
          onChange={(e) => onFieldChange('full_name', e.target.value)}
        />
      </label>
      <label>
        Nguồn tuyển dụng
        <select required value={form.source_id} onChange={(e) => onFieldChange('source_id', e.target.value)}>
          <option value="">Chọn nguồn</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.source_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Số điện thoại
        <input value={form.phone} onChange={(e) => onFieldChange('phone', e.target.value)} />
      </label>
      <label>
        Email
        <input
          type="email"
          value={form.email}
          onChange={(e) => onFieldChange('email', e.target.value)}
        />
      </label>
      <label>
        Ngày sinh
        <input type="date" value={form.dob} onChange={(e) => onFieldChange('dob', e.target.value)} />
      </label>
      <label>
        Giới tính
        <select value={form.gender} onChange={(e) => onFieldChange('gender', e.target.value)}>
          <option value="">Chọn giới tính</option>
          <option value="Nam">Nam</option>
          <option value="Nữ">Nữ</option>
        </select>
      </label>
      <label>
        Chiều cao
        <input type="number" value={form.height} onChange={(e) => onFieldChange('height', e.target.value)} />
      </label>
      <label>
        Cân nặng
        <input type="number" value={form.weight} onChange={(e) => onFieldChange('weight', e.target.value)} />
      </label>
      <label>
        Nhóm máu
        <input
          value={form.blood_type}
          onChange={(e) => onFieldChange('blood_type', e.target.value)}
        />
      </label>
      <label>
        Học vấn
        <select
          value={form.education_level}
          onChange={(e) => onFieldChange('education_level', e.target.value)}
        >
          <option value="">Chọn trình độ</option>
          {educationLevels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Kinh nghiệm
        <input
          value={form.experience_summary}
          onChange={(e) => onFieldChange('experience_summary', e.target.value)}
        />
      </label>
      <label className="field-span-2">
        Địa chỉ
        <input value={form.address} onChange={(e) => onFieldChange('address', e.target.value)} />
      </label>
      <label className="field-span-2">
        Ghi chú nguồn
        <input
          value={form.source_note}
          onChange={(e) => onFieldChange('source_note', e.target.value)}
        />
      </label>
      <label>
        Tệp CV
        <input
          type="file"
          onChange={(e) => onFieldChange('cv_file', e.target.files?.[0] || null)}
        />
      </label>
      <div className="field-span-2 row-actions">
        <button type="submit" className="btn" disabled={isEdit && updating}>
          {isEdit && updating ? 'Đang lưu...' : submitLabel}
        </button>
        {isEdit ? (
          <button type="button" className="btn ghost" onClick={handleCancelEdit}>
            Hủy
          </button>
        ) : null}
      </div>
    </form>
  );

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader
          title="Quản lý tuyển dụng và nguồn ứng viên"
          action={
            <button className="btn ghost" onClick={reloadAll} type="button">
              Làm mới
            </button>
          }
        />
        {loading ? <p className="muted">Đang tải dữ liệu...</p> : null}

        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'intake' ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title="Tiếp nhận và tạo hồ sơ" />
            {renderCandidateForm(candidateForm, onCandidateField, 'Thêm ứng viên', handleCreateCandidate)}
          </div>
          <div>
            <SectionHeader title="Thông tin đã tiếp nhận" />
            {detailLoading ? <p className="muted">Đang tải chi tiết...</p> : null}
            {candidateDetail ? (
              <div className="roadmap-card">
                <ul className="inline-list">
                  <li>CCCD: {candidateDetail.citizen_id || '-'}</li>
                  <li>Họ tên: {candidateDetail.full_name || '-'}</li>
                  <li>Điện thoại: {candidateDetail.phone || '-'}</li>
                  <li>Email: {candidateDetail.email || '-'}</li>
                  <li>Nguồn: {candidateDetail.source_name || '-'}</li>
                  <li>Trạng thái: {CANDIDATE_STATUS_LABELS[candidateDetail.status] || candidateDetail.status}</li>
                </ul>
                {candidateDetail.cv_file_url ? (
                  <p style={{ marginTop: 12 }}>
                    <a href={candidateDetail.cv_file_url} target="_blank" rel="noreferrer">
                      Mở CV đã upload
                    </a>
                  </p>
                ) : (
                  <p className="muted" style={{ marginTop: 12 }}>
                    Chưa có CV scan.
                  </p>
                )}
                <div className="pill-list" style={{ marginTop: 12 }}>
                  <div className="pill-item">
                    <span>Hồ sơ pre-exam</span>
                    <strong>
                      {detailReadiness.verified_total}/{detailReadiness.required_total}
                    </strong>
                  </div>
                  <div className="pill-item">
                    <span>Đủ điều kiện ghép form</span>
                    <strong>{detailReadiness.can_submit_profile ? 'Có' : 'Chưa'}</strong>
                  </div>
                </div>
                {detailReadiness.missing_submitted_documents?.length ? (
                  <div style={{ marginTop: 12 }}>
                    <p className="tiny">Giấy tờ chưa đạt trạng thái đã nộp:</p>
                    <ul className="inline-list">
                      {detailReadiness.missing_submitted_documents.map((item) => (
                        <li key={item.code || item.name}>{item.name || item.code}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="muted">Chọn một ứng viên để xem nhanh readiness và CV.</p>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'source' ? (
        <div className="surface">
          <SectionHeader title="Quản lý nguồn tuyển dụng" />

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
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>
                      {editingSourceId === row.id ? (
                        <input
                          value={editingSourceName}
                          onChange={(e) => setEditingSourceName(e.target.value)}
                        />
                      ) : (
                        row.source_name
                      )}
                    </td>
                    <td>{row.candidate_count || 0}</td>
                    <td>
                      <div className="row-actions">
                        {editingSourceId === row.id ? (
                          <>
                            <button type="button" className="btn small" onClick={handleSaveSource}>
                              Lưu
                            </button>
                            <button
                              type="button"
                              className="btn small ghost"
                              onClick={() => {
                                setEditingSourceId(null);
                                setEditingSourceName('');
                              }}
                            >
                              Hủy
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn small ghost"
                            onClick={() => handleStartEditSource(row)}
                          >
                            Sửa
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn text danger"
                          onClick={() => handleDeleteSource(row.id)}
                        >
                          Xóa
                        </button>
                      </div>
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
          <SectionHeader title="Danh sách ứng viên và source tracking" />

          <div className="row-actions" style={{ marginBottom: 12 }}>
            <button type="button" className="btn" onClick={openManualSendModal}>
              Gửi Email ({selectedCandidateIds.length})
            </button>
          </div>

          <div className="filter-row">
            <input
              placeholder="Tìm theo CCCD, tên, điện thoại, email"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="">Tất cả trạng thái</option>
              {CANDIDATE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CANDIDATE_STATUS_LABELS[status] || status}
                </option>
              ))}
            </select>
            <select
              value={filters.source_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, source_id: e.target.value }))}
            >
              <option value="">Tất cả nguồn</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.source_name}
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
                  <th>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllCandidates}
                    />
                  </th>
                  <th>CCCD</th>
                  <th>Ứng viên</th>
                  <th>Nguồn</th>
                  <th>Trạng thái</th>
                  <th>CV</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((row) => {
                  const pendingExam = pendingExamByCandidate.get(String(row.id)) || [];
                  const draft = getTransitionDraft(row.id, row.status);

                  return (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedCandidateIds.includes(Number(row.id))}
                          onChange={() => toggleCandidateSelection(row.id)}
                        />
                      </td>
                      <td>{row.citizen_id || '-'}</td>
                      <td>
                        <strong>{row.full_name}</strong>
                        <br />
                        <span className="tiny">{row.phone || row.email || '-'}</span>
                      </td>
                      <td>{row.source_name || sourceMap.get(String(row.source_id)) || '-'}</td>
                      <td>
                        <span className={getBadgeClass(row.status)}>
                          {CANDIDATE_STATUS_LABELS[row.status] || row.status}
                        </span>
                      </td>
                      <td>
                        {row.cv_file_url ? (
                          <a href={row.cv_file_url} target="_blank" rel="noreferrer">
                            Xem CV
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{formatDateTime(row.created_at)}</td>
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
                        <div className="status-inline" style={{ marginTop: 10 }}>
                          <select
                            value={transitionDrafts[row.id]?.status ?? row.status ?? ''}
                            onChange={(e) => setTransitionDraft(row, 'status', e.target.value)}
                          >
                            <option value={row.status}>
                              {CANDIDATE_STATUS_LABELS[row.status] || row.status} (Hiện tại)
                            </option>
                            {getAvailableTransitions(row.status).map((status) => (
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
                            Lưu trạng thái
                          </button>
                        </div>
                        {canUseExamCreation(draft.status || row.status) ? (
                          <div className="grid-form" style={{ marginTop: 10 }}>
                            <label>
                              Đơn hàng
                              <select
                                value={draft.jobOrderId}
                                onChange={(e) =>
                                  setTransitionDraft(row, 'jobOrderId', e.target.value)
                                }
                              >
                                <option value="">Chọn đơn hàng OPEN</option>
                                {openJobOrders.map((job) => (
                                  <option key={job.id} value={job.id}>
                                    {job.job_title} #{job.id}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Ngày thi
                              <input
                                type="datetime-local"
                                value={draft.examDate}
                                onChange={(e) =>
                                  setTransitionDraft(row, 'examDate', e.target.value)
                                }
                              />
                            </label>
                          </div>
                        ) : null}
                        {canUseExamResult(draft.status || row.status) ? (
                          <div className="grid-form" style={{ marginTop: 10 }}>
                            <label>
                              Phiếu thi pending
                              <select
                                value={draft.examApplicationId}
                                onChange={(e) =>
                                  setTransitionDraft(row, 'examApplicationId', e.target.value)
                                }
                              >
                                <option value="">Chọn phiếu thi</option>
                                {pendingExam.map((app) => (
                                  <option key={app.id} value={app.id}>
                                    #{app.id} - {app.job_title} - {formatDateTime(app.exam_date)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : null}
                        {(draft.status === 'WITHDRAWN' || row.status === 'WITHDRAWN') ? (
                          <div className="grid-form" style={{ marginTop: 10 }}>
                             <label>
                                Lý do rút hồ sơ
                                <select 
                                   value={transitionDrafts[row.id]?.withdrawal_reason ?? row.withdrawal_reason ?? 'TH3'} 
                                   onChange={e => setTransitionDraft(row, 'withdrawal_reason', e.target.value)}
                                >
                                   <option value="TH2">Rút hồ sơ (Có báo trước)</option>
                                   <option value="TH3">Bỏ ngang (Không báo trước)</option>
                                   <option value="TH5">Trúng tuyển nhưng không đi</option>
                                </select>
                             </label>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
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

        </div>
      ) : null}

      {activeTab === 'funnel' ? (
        <>
          <div className="surface">
            <SectionHeader title="Quản lý phễu và luồng thi tuyển" />
            <div className="kanban-board">
              {kanban.filter((column) => !hiddenFunnelStatuses.has(column.status)).map((column) => (
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
                        <div className="status-inline" style={{ marginTop: 10 }}>
                          <select
                            value={getTransitionDraft(item.id, item.status).status || item.status}
                            onChange={(e) =>
                              setTransitionDraft(item.id, 'status', e.target.value, item.status)
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
                            onClick={() => handleUpdateStatus(item)}
                          >
                            Cập nhật
                          </button>
                        </div>
                        {canUseExamCreation(getTransitionDraft(item.id, item.status).status || item.status) ? (
                          <div className="grid-form" style={{ marginTop: 10 }}>
                            <label>
                              Đơn hàng OPEN
                              <select
                                value={getTransitionDraft(item.id, item.status).jobOrderId}
                                onChange={(e) =>
                                  setTransitionDraft(item.id, 'jobOrderId', e.target.value, item.status)
                                }
                              >
                                <option value="">Chọn đơn hàng</option>
                                {openJobOrders.map((job) => (
                                  <option key={job.id} value={job.id}>
                                    {job.job_title} #{job.id}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Ngày thi
                              <input
                                type="datetime-local"
                                value={getTransitionDraft(item.id, item.status).examDate}
                                onChange={(e) =>
                                  setTransitionDraft(item.id, 'examDate', e.target.value, item.status)
                                }
                              />
                            </label>
                          </div>
                        ) : null}
                        {canUseExamResult(getTransitionDraft(item.id, item.status).status || item.status) ? (
                          <div className="grid-form" style={{ marginTop: 10 }}>
                            <label>
                              Phiếu thi pending
                              <select
                                value={getTransitionDraft(item.id, item.status).examApplicationId}
                                onChange={(e) =>
                                  setTransitionDraft(
                                    item.id,
                                    'examApplicationId',
                                    e.target.value,
                                    item.status
                                  )
                                }
                              >
                                <option value="">Chọn phiếu thi</option>
                                {(pendingExamByCandidate.get(String(item.id)) || []).map((app) => (
                                  <option key={app.id} value={app.id}>
                                    #{app.id} - {app.job_title}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : null}
                        {getTransitionDraft(item.id, item.status).status === 'WITHDRAWN' ? (
                          <div className="grid-form" style={{ marginTop: 10 }}>
                             <label>
                                Lý do rút hồ sơ
                                <select 
                                   value={getTransitionDraft(item.id, item.status).withdrawalReason} 
                                   onChange={e => setTransitionDraft(item.id, 'withdrawalReason', e.target.value, item.status)}
                                >
                                   <option value="TH2">Rút hồ sơ (Có báo trước)</option>
                                   <option value="TH3">Bỏ ngang (Không báo trước)</option>
                                   <option value="TH5">Trúng tuyển nhưng không đi</option>
                                </select>
                             </label>
                          </div>
                        ) : null}
                      </article>
                    ))}
                    {!column.items?.length ? <p className="tiny muted">Chưa có ứng viên.</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface two-col">
            <div>
              <SectionHeader title="Tổng hợp theo trạng thái" />
              <div className="pill-list">
                {(summary.by_status || []).filter((item) => !hiddenFunnelStatuses.has(item.status)).map((item) => (
                  <div key={item.status} className="pill-item">
                    <span>{CANDIDATE_STATUS_LABELS[item.status] || item.status}</span>
                    <strong>{item.total}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <SectionHeader title="Hiệu quả theo nguồn" />
              <div className="table-wrap compact-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nguồn</th>
                      <th>Tổng</th>
                      <th>Dat</th>
                      <th>Tỷ lệ %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.by_source || []).map((row) => (
                      <tr key={row.id || row.source_name}>
                        <td>{row.source_name}</td>
                        <td>{row.total_candidates}</td>
                        <td>{row.passed_candidates}</td>
                        <td>{row.pass_rate ?? 0}</td>
                      </tr>
                    ))}
                    {!summary.by_source?.length ? (
                      <tr>
                        <td colSpan={4} className="center muted">
                          Chưa có dữ liệu tổng hợp.
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

      <DetailModal
        open={manualSendModalOpen}
        title={`Gửi email thủ công (${selectedCandidateIds.length} ứng viên)`}
        onClose={closeManualSendModal}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={closeManualSendModal}>
              Hủy
            </button>
            <button type="button" className="btn" onClick={handleManualSend} disabled={manualSending}>
              {manualSending ? 'Đang gửi...' : 'Xác nhận gửi'}
            </button>
          </div>
        }
      >
        <div className="grid-form">
          <label className="field-span-2">
            Chọn mẫu email
            <select value={manualTemplateId} onChange={(e) => setManualTemplateId(e.target.value)}>
              <option value="">Chọn mẫu</option>
              {emailTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.template_code} - {template.subject}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Hệ thống sẽ gửi theo email hiện có của từng ứng viên và tự lưu lịch sử SENT/FAILED.
        </p>
      </DetailModal>

      <DetailModal
        open={detailModalOpen && Boolean(candidateDetail)}
        title={`Chi tiết ứng viên CCCD ${candidateDetail?.citizen_id || '-'}`}
        onClose={handleCloseDetailModal}
      >
        {candidateDetail ? (
          <>
            <div className="surface" style={{ padding: "0 0 15px 0", marginBottom: "20px", background: "transparent", boxShadow: "none" }}>
               <SegmentTabs 
                  tabs={[
                    { key: 'profile', label: 'Thông tin chung' },
                    { key: 'finance', label: 'Tài chính & Phí' }
                  ]} 
                  activeKey={detailSubTab} 
                  onChange={setDetailSubTab} 
               />
            </div>

            {detailSubTab === 'profile' ? (
              <>
                <div className="stats-inline">
                  <div className="mini-stat">
                    <span>CCCD</span>
                    <strong>{candidateDetail.citizen_id || '-'}</strong>
                  </div>
                  <div className="mini-stat">
                    <span>Ứng viên</span>
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
                        <th>CCCD</th>
                        <td>{candidateDetail.citizen_id || '-'}</td>
                        <th>Điện thoại</th>
                        <td>{candidateDetail.phone || '-'}</td>
                      </tr>
                      <tr>
                        <th>Email</th>
                        <td>{candidateDetail.email || '-'}</td>
                        <th>Ngày sinh</th>
                        <td>{formatDate(candidateDetail.dob)}</td>
                      </tr>
                      <tr>
                        <th>Giới tính</th>
                        <td>{candidateDetail.gender || '-'}</td>
                        <th>Chiều cao</th>
                        <td>{candidateDetail.height ?? '-'}</td>
                      </tr>
                      <tr>
                        <th>Cân nặng</th>
                        <td>{candidateDetail.weight ?? '-'}</td>
                        <th>Nhóm máu</th>
                        <td>{candidateDetail.blood_type || '-'}</td>
                      </tr>
                      <tr>
                        <th>Học vấn</th>
                        <td colSpan={3}>
                          {educationLevelMap.get(String(candidateDetail.education_level)) ||
                            candidateDetail.education_level ||
                            '-'}
                        </td>
                      </tr>
                      <tr>
                        <th>Kinh nghiệm</th>
                        <td colSpan={3}>{candidateDetail.experience_summary || '-'}</td>
                      </tr>
                      <tr>
                        <th>Địa chỉ</th>
                        <td colSpan={3}>{candidateDetail.address || '-'}</td>
                      </tr>
                      <tr>
                        <th>CV</th>
                        <td colSpan={3}>
                          {candidateDetail.cv_file_url ? (
                            <a href={candidateDetail.cv_file_url} target="_blank" rel="noreferrer">
                              Mở CV đã upload
                            </a>
                          ) : (
                            'Chưa có CV'
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="finance-tab">
                 <div className="stats-inline" style={{ marginBottom: "20px" }}>
                    <div className="mini-stat">
                        <span>Tổng tiền đã đóng</span>
                        <strong className="color-primary">{formatCurrency(candidateTransactions.reduce((acc, t) => t.transaction_type === 'INCOME' ? acc + t.amount_paid : acc - t.amount_paid, 0))}</strong>
                    </div>
                    <div className="mini-stat">
                        <span>Trạng thái tài chính</span>
                        <strong className={candidateDetail?.status === 'WITHDRAWN' ? 'muted' : (isReadyForExit ? "color-primary" : "color-danger")}>
                           {candidateDetail?.status === 'WITHDRAWN' ? "ĐÃ RÚT HỒ SƠ" : (isReadyForExit ? "ĐỦ ĐIỀU KIỆN" : "CÒN NỢ PHÍ")}
                        </strong>
                    </div>
                 </div>

                 <div className="row-actions" style={{ marginBottom: "10px", justifyContent: "flex-end" }}>
                    <button className="btn small ghost" onClick={() => setAddScheduleModalOpen(true)}>+ Thêm khoản phí</button>
                    {candidateDetail?.status !== 'WITHDRAWN' && candidateDetail?.status !== 'FAILED_POOL' ? (
                       <button className="btn small" onClick={handlePayAll} disabled={!paymentSchedules.some(s => s.balance > 0 && s.status !== 'CANCELLED')}>Đóng tất cả phí nợ</button>
                    ) : (
                       <button className="btn small danger" onClick={handleRefundAll} disabled={!paymentSchedules.some(s => s.amount_paid > 0 && s.status !== 'REFUNDED')}>Xác nhận hoàn tất cả tiền</button>
                    )}
                 </div>

                 <SectionHeader title="Lịch thanh toán & Công nợ" />
                 <div className="table-wrap compact-table">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nội dung</th>
                                <th>Phân loại</th>
                                <th>Số tiền</th>
                                <th>Đã đóng</th>
                                <th>Còn lại</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paymentSchedules.map(sch => (
                                <tr key={sch.id}>
                                    <td>{sch.description}</td>
                                    <td>{FEE_CATEGORY_LABELS[sch.fee_category] || sch.fee_category}</td>
                                    <td className="bold">{formatCurrency(sch.amount_due)}</td>
                                    <td className="color-primary">{formatCurrency(sch.amount_paid)}</td>
                                    <td className="color-danger">{formatCurrency(sch.balance)}</td>
                                    <td>
                                        <span className={`tiny bold ${sch.status === 'PAID' ? 'color-primary' : (sch.status === 'REFUNDED' ? 'muted' : '')}`}>
                                            {PAYMENT_SCHEDULE_LABELS[sch.status] || sch.status || 'Chờ thanh toán'}
                                        </span>
                                    </td>
                                    <td>
                                        {sch.status !== 'CANCELLED' && sch.status !== 'REFUNDED' && (
                                            candidateDetail?.status === 'WITHDRAWN' || candidateDetail?.status === 'FAILED_POOL' ? (
                                              sch.amount_paid > 0 && (
                                                <button className="btn small danger" onClick={() => handleOpenRefundModal(sch)}>Hoàn tiền</button>
                                              )
                                            ) : (
                                              sch.status !== 'PAID' && sch.balance > 0 && (
                                                <button className="btn small" onClick={() => {
                                                    setSelectedSchedule(sch);
                                                    setPaymentAmount(sch.balance);
                                                    setPaymentNote(`Đóng tiền cho ${sch.description}`);
                                                    setPaymentModalOpen(true);
                                                }}>Đóng phí</button>
                                              )
                                            )
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot style={{ background: "rgba(0,0,0,0.05)", fontWeight: "bold" }}>
                            <tr>
                                <td colSpan={2}>TỔNG CỘNG</td>
                                <td>{formatCurrency(paymentSchedules.reduce((acc, s) => acc + Number(s.amount_due), 0))}</td>
                                <td className="color-primary">{formatCurrency(paymentSchedules.reduce((acc, s) => acc + Number(s.amount_paid), 0))}</td>
                                <td className="color-danger">{formatCurrency(paymentSchedules.reduce((acc, s) => acc + Number(s.balance), 0))}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                 </div>

                 <SectionHeader title="Lịch sử giao dịch" style={{ marginTop: "30px" }} />
                 <div className="table-wrap compact-table">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Ngày</th>
                                <th>Loại</th>
                                <th>Số tiền</th>
                                <th>Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            {candidateTransactions.map(t => (
                                <tr key={t.id}>
                                    <td>{formatDate(t.transaction_at)}</td>
                                    <td>
                                        <span className={t.transaction_type === 'REFUND' ? 'color-danger' : 'color-primary'}>
                                            {TRANSACTION_TYPE_LABELS[t.transaction_type]}
                                        </span>
                                    </td>
                                    <td className="bold">{formatCurrency(t.amount_paid)}</td>
                                    <td>{t.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
              </div>
            )}
          </>
        ) : null}
      </DetailModal>

      <DetailModal
        open={Boolean(editingCandidateId)}
        title={`Sửa ứng viên CCCD ${candidateDetail?.citizen_id || editForm.citizen_id || '-'}`}
        onClose={handleCloseEditModal}
      >
        {renderCandidateForm(
          editForm,
          (key, value) => setEditForm((prev) => ({ ...prev, [key]: value })),
          'Lưu thay đổi',
          handleUpdateCandidate,
          true
        )}
      </DetailModal>
      <DetailModal
        open={paymentModalOpen}
        title={`Ghi nhận thanh toán: ${selectedSchedule?.description}`}
        onClose={() => setPaymentModalOpen(false)}
      >
        <form className="grid-form" onSubmit={handleRecordPayment}>
           <label className="field-span-2">
             Số tiền đóng (VND)
             <input 
                type="number" 
                required 
                value={paymentAmount} 
                onChange={e => setPaymentAmount(Number(e.target.value))} 
             />
           </label>
           <label className="field-span-2">
             Ghi chú
             <textarea 
                value={paymentNote} 
                onChange={e => setPaymentNote(e.target.value)} 
             />
           </label>
           <div className="field-span-2 row-actions" style={{ marginTop: "15px" }}>
              <button type="submit" className="btn">Xác nhận thu tiền</button>
              <button type="button" className="btn ghost" onClick={() => setPaymentModalOpen(false)}>Đóng</button>
           </div>
        </form>
      </DetailModal>
      <DetailModal
        open={refundModalOpen}
        title="Xác nhận Hoàn tiền"
        onClose={() => setRefundModalOpen(false)}
      >
        <form className="grid-form" onSubmit={handleRecordRefund}>
          <div className="field-span-2">
            <p><strong>Nội dung:</strong> {selectedSchedule?.description}</p>
            <p><strong>Số tiền đã đóng:</strong> {formatCurrency(selectedSchedule?.amount_paid)}</p>
          </div>
          <label className="field-span-1">
            Số tiền hoàn lại *
            <input
              type="number"
              required
              value={refundAmount}
              onChange={(e) => setRefundAmount(Number(e.target.value))}
            />
          </label>
          <label className="field-span-2">
            Ghi chú
            <textarea
              value={refundNote}
              onChange={(e) => setRefundNote(e.target.value)}
            />
          </label>
          <div className="field-span-2 row-actions" style={{ marginTop: "10px" }}>
            <button type="submit" className="btn danger">Xác nhận hoàn tiền</button>
            <button type="button" className="btn ghost" onClick={() => setRefundModalOpen(false)}>Hủy</button>
          </div>
        </form>
      </DetailModal>

      <DetailModal
        open={addScheduleModalOpen}
        title="Thêm khoản phí thủ công"
        onClose={() => setAddScheduleModalOpen(false)}
      >
        <form className="grid-form" onSubmit={handleAddScheduleSubmit}>
          <label className="field-span-2">
            Nội dung khoản phí *
            <input
              required
              placeholder="VD: Phí đặt cọc cam kết, Học phí đợt 2..."
              value={addScheduleForm.description}
              onChange={e => setAddScheduleForm({ ...addScheduleForm, description: e.target.value })}
            />
          </label>
          <label className="field-span-1">
            Số tiền (VND) *
            <input
              type="number"
              required
              min={1}
              value={addScheduleForm.amount_due}
              onChange={e => setAddScheduleForm({ ...addScheduleForm, amount_due: e.target.value })}
            />
          </label>
          <label className="field-span-1">
            Hạn đóng
            <input
              type="date"
              value={addScheduleForm.due_date}
              onChange={e => setAddScheduleForm({ ...addScheduleForm, due_date: e.target.value })}
            />
          </label>
          <label className="field-span-1">
            Bắt buộc để xuất cảnh?
            <select
              value={addScheduleForm.is_mandatory_for_exit}
              onChange={e => setAddScheduleForm({ ...addScheduleForm, is_mandatory_for_exit: Number(e.target.value) })}
            >
              <option value={0}>Không</option>
              <option value={1}>Có</option>
            </select>
          </label>
          <label className="field-span-1">
            Có thể hoàn tiền?
            <select
              value={addScheduleForm.is_refundable}
              onChange={e => setAddScheduleForm({ ...addScheduleForm, is_refundable: Number(e.target.value) })}
            >
              <option value={0}>Không</option>
              <option value={1}>Có</option>
            </select>
          </label>
          {Number(addScheduleForm.is_refundable) === 1 && (
            <label className="field-span-2">
              % Hoàn tiền khi rút hồ sơ
              <input
                type="number"
                min={0}
                max={100}
                value={addScheduleForm.refund_policy_pct}
                onChange={e => setAddScheduleForm({ ...addScheduleForm, refund_policy_pct: e.target.value })}
              />
            </label>
          )}
          <div className="field-span-2 row-actions" style={{ marginTop: "15px" }}>
            <button type="submit" className="btn">Thêm khoản phí</button>
            <button type="button" className="btn ghost" onClick={() => setAddScheduleModalOpen(false)}>Hủy</button>
          </div>
        </form>
      </DetailModal>
    </section>
  );
}

export default RecruitmentPage;
