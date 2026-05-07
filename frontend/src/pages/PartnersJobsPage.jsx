import { useEffect, useMemo, useState } from 'react';
import DetailModal from '../components/DetailModal';
import SectionHeader from '../components/SectionHeader';
import SegmentTabs from '../components/SegmentTabs';
import { useToast } from '../components/ToastProvider';
import { partnerService } from '../services/partnerService';
import { jobOrderService } from '../services/jobOrderService';
import { recruitmentService } from '../services/recruitmentService';
import { educationLevelService } from '../services/educationLevelService';
import {
  CANDIDATE_STATUSES,
  JOB_ORDER_STATUSES,
  JOB_ORDER_STATUS_LABELS,
  PARTNER_STATUSES,
  PARTNER_STATUS_LABELS,
  CANDIDATE_STATUS_LABELS
} from '../utils/constants';
import { formatDate, safeJsonParse } from '../utils/format';
import { getErrorMessage } from '../utils/toast';
import {
  digitsOnly,
  getTodayDateInput,
  isNonNegativeNumber,
  isOptionalEmail,
  isOptionalVietnamesePhoneNumber
} from '../utils/validation';

const initialPartnerForm = {
  name: '',
  country: '',
  address: '',
  status: 'ACTIVE'
};

const initialContactForm = {
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  contact_role: '',
  is_primary: false
};

const initialJobForm = {
  partner_id: '',
  job_title: '',
  quantity_needed: '',
  salary_info: '',
  deadline: '',
  status: 'OPEN',
  req_age_min: 18,
  req_age_max: '',
  req_gender: 'any',
  req_education: [],
  req_experience_min: '',
  req_height_min: '',
  req_weight_min: ''
};

function normalizeGenderValue(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'any';

  const compact = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');

  if (compact === 'male' || compact === 'nam' || compact === 'm') return 'male';
  if (compact === 'female' || compact === 'nu' || compact === 'f') return 'female';
  if (compact === 'any' || compact === 'all' || compact === 'tatca') return 'any';

  return 'any';
}

function buildRequirements(form) {
  const requirements = {};

  const ageMin = Number(form.req_age_min);
  const ageMax = Number(form.req_age_max);
  if (!Number.isNaN(ageMin) || !Number.isNaN(ageMax)) {
    requirements.age = {};
    if (!Number.isNaN(ageMin)) requirements.age.min = ageMin;
    if (!Number.isNaN(ageMax)) requirements.age.max = ageMax;
  }

  if (form.req_gender) requirements.gender = form.req_gender;

  const educationIds = (Array.isArray(form.req_education) ? form.req_education : [])
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isInteger(item) && item > 0);
  if (educationIds.length) requirements.education_level = educationIds;

  const expMin = Number(form.req_experience_min);
  if (!Number.isNaN(expMin)) requirements.experience_years = { min: expMin };

  const heightMin = Number(form.req_height_min);
  if (!Number.isNaN(heightMin)) requirements.height = { min: heightMin };

  const weightMin = Number(form.req_weight_min);
  if (!Number.isNaN(weightMin)) requirements.weight = { min: weightMin };

  return requirements;
}

function buildJobFormFromOrder(order) {
  const requirements = safeJsonParse(order?.requirements, {});
  const educationLevels = Array.isArray(requirements.education_level)
    ? requirements.education_level.map((item) => String(item))
    : [];

  const deadlineDate = order?.deadline ? new Date(order.deadline) : null;
  const deadline = deadlineDate && !Number.isNaN(deadlineDate.getTime())
    ? deadlineDate.toISOString().split('T')[0]
    : '';

  return {
    partner_id: order?.partner_id ? String(order.partner_id) : '',
    job_title: order?.job_title || '',
    quantity_needed: order?.quantity_needed !== undefined && order?.quantity_needed !== null
      ? String(order.quantity_needed)
      : '',
    salary_info: order?.salary_info || '',
    deadline,
    status: order?.status || 'OPEN',
    req_age_min: requirements?.age?.min !== undefined ? String(requirements.age.min) : '',
    req_age_max: requirements?.age?.max !== undefined ? String(requirements.age.max) : '',
    req_gender: normalizeGenderValue(requirements?.gender),
    req_education: educationLevels,
    req_experience_min: requirements?.experience_years?.min !== undefined
      ? String(requirements.experience_years.min)
      : '',
    req_height_min: requirements?.height?.min !== undefined ? String(requirements.height.min) : '',
    req_weight_min: requirements?.weight?.min !== undefined ? String(requirements.weight.min) : ''
  };
}

function formatRequirementText(requirementsRaw, educationNameMap) {
  const requirements = safeJsonParse(requirementsRaw, {});
  const lines = [];

  const ageMin = requirements?.age?.min || 18;
  const ageMax = requirements?.age?.max;
  if (ageMax) {
    lines.push(`Độ tuổi: từ ${ageMin} đến ${ageMax}`);
  } else {
    lines.push(`Độ tuổi: từ ${ageMin} trở lên`);
  }

  if (requirements?.gender && requirements.gender !== 'any') {
    const gender = normalizeGenderValue(requirements.gender);
    if (gender === 'male') {
      lines.push('Giới tính: Nam');
    } else if (gender === 'female') {
      lines.push('Giới tính: Nữ');
    } else {
      lines.push('Giới tính: không yêu cầu');
    }
  } else {
    lines.push('Giới tính: không yêu cầu');
  }

  if (Array.isArray(requirements?.education_level) && requirements.education_level.length > 0) {
    const educationText = requirements.education_level
      .map((id) => educationNameMap[String(id)] || `Mức #${id}`)
      .join(', ');
    lines.push(`Học vấn: ${educationText}`);
  } else {
    lines.push('Học vấn: không yêu cầu');
  }

  if (requirements?.experience_years?.min !== undefined) {
    lines.push(`Kinh nghiệm tối thiểu: ${requirements.experience_years.min} năm`);
  }

  if (requirements?.height?.min !== undefined) {
    lines.push(`Chiều cao tối thiểu: ${requirements.height.min} cm`);
  }

  if (requirements?.weight?.min !== undefined) {
    lines.push(`Cân nặng tối thiểu: ${requirements.weight.min} kg`);
  }

  return lines.length ? lines : ['Không có yêu cầu cụ thể.'];
}

function validateJobForm(form) {
  if (!form.partner_id) {
    return 'Vui lòng chọn đối tác.';
  }
  if (!String(form.job_title || '').trim()) {
    return 'Tên đơn hàng là bắt buộc.';
  }
  if (!Number.isInteger(Number(form.quantity_needed)) || Number(form.quantity_needed) <= 0) {
    return 'Số lượng tuyển phải là số nguyên dương.';
  }
  if (!form.deadline) {
    return 'Hạn chót là bắt buộc.';
  }
  if (form.deadline < getTodayDateInput()) {
    return 'Hạn chót không được ở quá khứ.';
  }

  const ageMin = String(form.req_age_min || '').trim();
  const ageMax = String(form.req_age_max || '').trim();
  if (ageMin && !isNonNegativeNumber(ageMin)) return 'Tuổi tối thiểu phải là số không âm.';
  if (ageMax && !isNonNegativeNumber(ageMax)) return 'Tuổi tối đa phải là số không âm.';
  if (String(form.req_age_min || '').trim() && Number(form.req_age_min) < 18) {
    return 'Độ tuổi tối thiểu phải từ 18 trở lên.';
  }
  if (String(form.req_age_max || '').trim() && Number(form.req_age_max) < Number(form.req_age_min || 18)) {
    return 'Độ tuổi tối đa không được nhỏ hơn độ tuổi tối thiểu.';
  }

  if (String(form.req_experience_min || '').trim() && !isNonNegativeNumber(form.req_experience_min)) {
    return 'Kinh nghiệm tối thiểu phải là số không âm.';
  }
  if (String(form.req_height_min || '').trim() && !isNonNegativeNumber(form.req_height_min)) {
    return 'Chiều cao tối thiểu phải là số không âm.';
  }
  if (String(form.req_weight_min || '').trim() && !isNonNegativeNumber(form.req_weight_min)) {
    return 'Cân nặng tối thiểu phải là số không âm.';
  }
  if (String(form.salary_info || '').trim() && !isNonNegativeNumber(form.salary_info)) {
    return 'Mức lương phải là số không âm.';
  }

  return '';
}

function validatePartnerForm(form) {
  if (!String(form.name || '').trim()) {
    return 'Tên đối tác là bắt buộc.';
  }
  if (!isOptionalVietnamesePhoneNumber(form.phone)) {
    return 'Số điện thoại đối tác phải gồm đúng 10 số và bắt đầu bằng 0.';
  }
  if (!isOptionalEmail(form.email)) {
    return 'Email đối tác không đúng định dạng.';
  }
  return '';
}

function validateContactForm(form) {
  if (!String(form.contact_name || '').trim()) {
    return 'Tên liên hệ là bắt buộc.';
  }
  if (!isOptionalVietnamesePhoneNumber(form.contact_phone)) {
    return 'Số điện thoại liên hệ phải gồm đúng 10 số và bắt đầu bằng 0.';
  }
  if (!isOptionalEmail(form.contact_email)) {
    return 'Email liên hệ không đúng định dạng.';
  }
  return '';
}

function PartnersJobsPage() {
  const [activeTab, setActiveTab] = useState('partners');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const [partners, setPartners] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [jobOrders, setJobOrders] = useState([]);
  const [educationLevels, setEducationLevels] = useState([]);
  const [manualCandidates, setManualCandidates] = useState([]);
  const [matchingResult, setMatchingResult] = useState([]);
  const [jobOrderCandidates, setJobOrderCandidates] = useState([]);

  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedJobOrderId, setSelectedJobOrderId] = useState('');
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [matchingSearch, setMatchingSearch] = useState('');

  const [manualSearch, setManualSearch] = useState('');
  const [manualStatusFilter, setManualStatusFilter] = useState('');
  const [manualEducationFilter, setManualEducationFilter] = useState('');

  const [partnerForm, setPartnerForm] = useState(initialPartnerForm);
  const [partnerEditForm, setPartnerEditForm] = useState(initialPartnerForm);
  const [contactForm, setContactForm] = useState(initialContactForm);
  const [contactEditForm, setContactEditForm] = useState(initialContactForm);
  const [jobForm, setJobForm] = useState(initialJobForm);
  const [jobEditForm, setJobEditForm] = useState(initialJobForm);
  
  const [partnerEditOpen, setPartnerEditOpen] = useState(false);
  const [contactEditOpen, setContactEditOpen] = useState(false);
  const [jobDetailOpen, setJobDetailOpen] = useState(false);
  const [jobEditOpen, setJobEditOpen] = useState(false);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);

  const tabs = [
    { key: 'partners', label: 'Danh mục đối tác' },
    { key: 'contacts', label: 'Liên hệ đối tác' },
    { key: 'jobs', label: 'Kho đơn hàng' },
    { key: 'matching', label: 'Đối khớp có điều kiện' },
    { key: 'manual', label: 'Ghép thủ công ứng viên' }
  ];

  const selectedJob = useMemo(
    () => jobOrders.find((item) => String(item.id) === String(selectedJobOrderId)),
    [jobOrders, selectedJobOrderId]
  );

  const educationNameMap = useMemo(() => {
    const map = {};
    educationLevels.forEach((item) => {
      map[String(item.id)] = item.name;
    });
    return map;
  }, [educationLevels]);

  const filteredManualCandidates = useMemo(() => {
    return manualCandidates.filter((candidate) => {
      if (manualEducationFilter && String(candidate.education_level || '') !== manualEducationFilter) {
        return false;
      }
      return true;
    });
  }, [manualCandidates, manualEducationFilter]);

  const showError = (err) => {
    toast.error(getErrorMessage(err));
  };

  const showSuccess = (text) => {
    toast.success(text);
  };

  const loadPartners = async () => {
    const res = await partnerService.getPartners({ page: 1, limit: 120 });
    setPartners(res.data || []);
  };

  const loadContacts = async (partnerId) => {
    if (!partnerId) {
      setContacts([]);
      return;
    }
    const res = await partnerService.getContacts(partnerId);
    setContacts(res.data || []);
  };

  const loadJobOrders = async () => {
    const res = await jobOrderService.getJobOrders({ page: 1, limit: 120 });
    setJobOrders(res.data || []);
  };

  const loadJobOrderDetail = async (jobOrderId) => {
    const [jobDetailRes, jobCandidatesRes] = await Promise.all([
      jobOrderService.getJobOrderById(jobOrderId),
      jobOrderService.getJobOrderCandidates(jobOrderId)
    ]);

    const detail = jobDetailRes.data || null;
    setSelectedJobDetail(detail);
    setJobOrderCandidates(jobCandidatesRes.data || []);

    if (detail) {
      setJobEditForm(buildJobFormFromOrder(detail));
    }
  };

  const loadEducationLevels = async () => {
    const res = await educationLevelService.getEducationLevels({ page: 1, limit: 120 });
    setEducationLevels(res.data || []);
  };

  const loadManualCandidates = async ({ search = manualSearch, status = manualStatusFilter } = {}) => {
    const params = { page: 1, limit: 300 };
    if (search) params.search = search;
    if (status) params.status = status;

    const res = await recruitmentService.getCandidates(params);
    setManualCandidates(res.data || []);
  };

  const reloadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPartners(), loadJobOrders(), loadEducationLevels(), loadManualCandidates()]);
      if (selectedPartnerId) {
        await loadContacts(selectedPartnerId);
      }
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

  const handleCreatePartner = async (event) => {
    event.preventDefault();

    const validationMessage = validatePartnerForm(partnerForm);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    try {
      await partnerService.createPartner({
        ...partnerForm,
        reputation_score: Number(partnerForm.reputation_score)
      });
      setPartnerForm(initialPartnerForm);
      await loadPartners();
      showSuccess('Đã thêm đối tác.');
    } catch (err) {
      showError(err);
    }
  };

  const handleDeletePartner = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đối tác này?')) return;
    try {
      await partnerService.deletePartner(id);
      if (String(selectedPartnerId) === String(id)) {
        setSelectedPartnerId('');
        setContacts([]);
      }
      await loadPartners();
      showSuccess('Đã xóa đối tác.');
    } catch (err) {
      showError(err);
    }
  };

  const openPartnerEditModal = (partner) => {
    setPartnerEditForm({
      name: partner.name || '',
      country: partner.country || '',
      address: partner.address || '',
      status: partner.status || 'ACTIVE'
    });
    setSelectedPartnerId(partner.id);
    setPartnerEditOpen(true);
  };

  const handleUpdatePartner = async (event) => {
    event.preventDefault();
    const validationMessage = validatePartnerForm(partnerEditForm);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    try {
      await partnerService.updatePartner(selectedPartnerId, partnerEditForm);
      setPartnerEditOpen(false);
      await loadPartners();
      showSuccess('Đã cập nhật đối tác.');
    } catch (err) {
      showError(err);
    }
  };

  const handleCreateContact = async (event) => {
    event.preventDefault();

    if (!selectedPartnerId) {
      toast.error('Vui lòng chọn đối tác.');
      return;
    }

    const validationMessage = validateContactForm(contactForm);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    try {
      await partnerService.createContact(selectedPartnerId, {
        ...contactForm,
        is_primary: Boolean(contactForm.is_primary)
      });
      setContactForm(initialContactForm);
      await loadContacts(selectedPartnerId);
      showSuccess('Đã thêm liên hệ.');
    } catch (err) {
      showError(err);
    }
  };

  const openContactEditModal = (contact) => {
    setContactEditForm({
      contact_name: contact.contact_name || '',
      contact_phone: contact.contact_phone || '',
      contact_email: contact.contact_email || '',
      contact_role: contact.contact_role || '',
      is_primary: Boolean(contact.is_primary)
    });
    setContactEditOpen(true);
    // Lưu ID liên hệ đang sửa vào một state tạm nếu cần, ở đây ta có thể dùng contact.id trực tiếp
    setContactEditForm(prev => ({ ...prev, id: contact.id }));
  };

  const handleUpdateContact = async (event) => {
    event.preventDefault();
    const validationMessage = validateContactForm(contactEditForm);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    try {
      await partnerService.updateContact(selectedPartnerId, contactEditForm.id, contactEditForm);
      setContactEditOpen(false);
      await loadContacts(selectedPartnerId);
      showSuccess('Đã cập nhật liên hệ.');
    } catch (err) {
      showError(err);
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa liên hệ này?')) return;
    try {
      await partnerService.deleteContact(selectedPartnerId, contactId);
      await loadContacts(selectedPartnerId);
      showSuccess('Đã xóa liên hệ.');
    } catch (err) {
      showError(err);
    }
  };

  const handleCreateJob = async (event) => {
    event.preventDefault();

    const validationMessage = validateJobForm(jobForm);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    try {
      await jobOrderService.createJobOrder({
        partner_id: Number(jobForm.partner_id),
        job_title: jobForm.job_title,
        quantity_needed: Number(jobForm.quantity_needed),
        salary_info: jobForm.salary_info,
        deadline: jobForm.deadline,
        status: jobForm.status,
        requirements: buildRequirements(jobForm)
      });
      setJobForm(initialJobForm);
      await loadJobOrders();
      showSuccess('Đã tạo đơn hàng.');
    } catch (err) {
      showError(err);
    }
  };

  const handleCancelJob = async (id) => {
    try {
      await jobOrderService.cancelJobOrder(id);
      await loadJobOrders();
      showSuccess('Đã hủy đơn hàng.');
    } catch (err) {
      showError(err);
    }
  };

  const openJobDetailModal = async (jobOrderId) => {
    setJobDetailLoading(true);
    try {
      await loadJobOrderDetail(jobOrderId);
      setJobDetailOpen(true);
    } catch (err) {
      showError(err);
    } finally {
      setJobDetailLoading(false);
    }
  };

  const openJobEditModal = async (jobOrderId) => {
    setJobDetailLoading(true);
    try {
      await loadJobOrderDetail(jobOrderId);
      setJobEditOpen(true);
    } catch (err) {
      showError(err);
    } finally {
      setJobDetailLoading(false);
    }
  };

  const handleUpdateJobOrder = async (event) => {
    event.preventDefault();

    if (!selectedJobDetail?.id) {
      toast.error('Không tìm thấy đơn hàng cần cập nhật.');
      return;
    }

    const validationMessage = validateJobForm(jobEditForm);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    try {
      await jobOrderService.updateJobOrder(selectedJobDetail.id, {
        partner_id: Number(jobEditForm.partner_id),
        job_title: jobEditForm.job_title,
        quantity_needed: Number(jobEditForm.quantity_needed),
        salary_info: jobEditForm.salary_info,
        deadline: jobEditForm.deadline,
        status: jobEditForm.status,
        requirements: buildRequirements(jobEditForm)
      });

      showSuccess('Đã cập nhật đơn hàng.');
      await Promise.all([
        loadJobOrders(),
        loadJobOrderDetail(selectedJobDetail.id),
        refreshMatchingForJob(selectedJobDetail.id)
      ]);
      setJobEditOpen(false);
    } catch (err) {
      showError(err);
    }
  };

  const handleRemoveCandidateFromJobOrder = async (candidateId) => {
    if (!selectedJobDetail?.id) {
      toast.error('Không tìm thấy đơn hàng đang thao tác.');
      return;
    }

    try {
      await jobOrderService.removeCandidateFromJobOrder(selectedJobDetail.id, candidateId);
      showSuccess('Đã xóa ứng viên khỏi đơn hàng.');
      await Promise.all([
        loadJobOrders(),
        loadJobOrderDetail(selectedJobDetail.id),
        refreshMatchingForJob(selectedJobDetail.id)
      ]);
    } catch (err) {
      showError(err);
    }
  };

  const runMatching = async ({ switchToMatchingTab = true, showToastOnSuccess = true } = {}) => {
    if (!selectedJobOrderId) {
      toast.error('Vui lòng chọn đơn hàng.');
      return;
    }

    try {
      const res = await jobOrderService.getMatchingCandidates(selectedJobOrderId, {
        page: 1,
        limit: 200,
        search: matchingSearch || undefined
      });
      setMatchingResult(res.data || []);
      if (switchToMatchingTab) {
        setActiveTab('matching');
      }
      if (showToastOnSuccess) {
        showSuccess('Đã tải danh sách đối khớp.');
      }
    } catch (err) {
      showError(err);
    }
  };

  const runManualCandidateSearch = async () => {
    try {
      await loadManualCandidates();
      showSuccess('Đã tải danh sách ứng viên.');
    } catch (err) {
      showError(err);
    }
  };

  const refreshMatchingForJob = async (jobOrderId) => {
    if (!selectedJobOrderId || String(selectedJobOrderId) !== String(jobOrderId)) {
      return;
    }

    await runMatching({ switchToMatchingTab: false, showToastOnSuccess: false });
  };

  const handleManualMatch = async (candidateId) => {
    if (!selectedJobOrderId) {
      toast.error('Vui lòng chọn đơn hàng trước khi thêm ứng viên.');
      return;
    }

    try {
      await jobOrderService.manualMatchCandidate(selectedJobOrderId, candidateId);
      showSuccess('Đã thêm ứng viên vào đơn hàng.');
      await Promise.all([
        loadJobOrders(),
        loadManualCandidates(),
        runMatching({ switchToMatchingTab: false, showToastOnSuccess: false })
      ]);
    } catch (err) {
      showError(err);
    }
  };

  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader
          title="Quản lý đối tác và đơn hàng"
          action={
            <button className="btn ghost" type="button" onClick={reloadAll}>
              Làm mới
            </button>
          }
        />
        {loading ? <p className="muted">Đang tải dữ liệu...</p> : null}

        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'partners' ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title="Thêm đối tác" />
            <form className="grid-form" onSubmit={handleCreatePartner}>
              <label>
                Tên đối tác
                <input
                  required
                  value={partnerForm.name}
                  onChange={(e) => setPartnerForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label>
                Quốc gia
                <input
                  value={partnerForm.country}
                  onChange={(e) =>
                    setPartnerForm((prev) => ({ ...prev, country: e.target.value }))
                  }
                />
              </label>
              <label className="field-span-2">
                Địa chỉ
                <input
                  value={partnerForm.address}
                  onChange={(e) =>
                    setPartnerForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                />
              </label>
              <label className="field-span-2">
                Trạng thái
                <select
                  value={partnerForm.status}
                  onChange={(e) => setPartnerForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {PARTNER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PARTNER_STATUS_LABELS[status] || status}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn field-span-2" type="submit">
                Thêm đối tác
              </button>
            </form>
          </div>

          <div>
            <SectionHeader title="Danh sách đối tác" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Đối tác</th>
                    <th>Trạng thái</th>
                    <th>Liên hệ chính</th>
                    <th>Số điện thoại</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((partner) => (
                    <tr key={partner.id}>
                      <td>
                        <strong>{partner.name}</strong>
                        <br />
                        <span className="tiny">{partner.country || '-'}</span>
                      </td>
                      <td>{PARTNER_STATUS_LABELS[partner.status] || partner.status}</td>
                      <td>{partner.contact_person || '-'}</td>
                      <td>{partner.phone || '-'}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn small"
                            type="button"
                            onClick={() => {
                              setSelectedPartnerId(partner.id);
                              loadContacts(partner.id);
                              setActiveTab('contacts');
                            }}
                          >
                            Liên hệ
                          </button>
                          <button
                            className="btn small ghost"
                            type="button"
                            onClick={() => openPartnerEditModal(partner)}
                          >
                            Sửa
                          </button>
                          <button
                            className="btn text danger"
                            type="button"
                            onClick={() => handleDeletePartner(partner.id)}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!partners.length ? (
                    <tr>
                      <td colSpan={5} className="center muted">
                        Chưa có đối tác.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'contacts' ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title="Liên hệ đối tác" />
            <div className="inline-form">
              <select
                value={selectedPartnerId}
                onChange={(e) => {
                  setSelectedPartnerId(e.target.value);
                  loadContacts(e.target.value);
                }}
              >
                <option value="">Chọn đối tác</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </div>

            <form className="grid-form" onSubmit={handleCreateContact}>
              <label>
                Tên liên hệ
                <input
                  required
                  value={contactForm.contact_name}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, contact_name: e.target.value }))
                  }
                />
              </label>
              <label>
                Chức vụ
                <input
                  value={contactForm.contact_role}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, contact_role: e.target.value }))
                  }
                />
              </label>
              <label>
                Điện thoại
                <input
                  value={contactForm.contact_phone}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, contact_phone: digitsOnly(e.target.value, 10) }))
                  }
                  inputMode="numeric"
                  pattern="0\d{9}"
                  maxLength={10}
                  placeholder="0901234567"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={contactForm.contact_email}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, contact_email: e.target.value }))
                  }
                />
              </label>
              <label>
                Liên hệ chính
                <input
                  type="checkbox"
                  checked={contactForm.is_primary}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, is_primary: e.target.checked }))
                  }
                />
              </label>
              <button className="btn field-span-2" type="submit">
                Thêm liên hệ
              </button>
            </form>
          </div>

          <div>
            <SectionHeader title="Danh sách liên hệ" />
            <div className="table-wrap compact-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Chức vụ</th>
                    <th>Điện thoại</th>
                    <th>Chính</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((row) => (
                    <tr key={row.id}>
                      <td>{row.contact_name}</td>
                      <td>{row.contact_role || '-'}</td>
                      <td>{row.contact_phone || '-'}</td>
                      <td>{row.is_primary ? 'Có' : 'Không'}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn small ghost"
                            type="button"
                            onClick={() => openContactEditModal(row)}
                          >
                            Sửa
                          </button>
                          <button
                            className="btn text danger"
                            type="button"
                            onClick={() => handleDeleteContact(row.id)}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!contacts.length ? (
                    <tr>
                      <td colSpan={4} className="center muted">
                        Chưa có liên hệ.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'jobs' ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title="Thêm đơn hàng" />
            <form className="grid-form" onSubmit={handleCreateJob}>
              <label>
                Đối tác
                <select
                  required
                  value={jobForm.partner_id}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, partner_id: e.target.value }))}
                >
                  <option value="">Chọn đối tác</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tên đơn hàng
                <input
                  required
                  value={jobForm.job_title}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, job_title: e.target.value }))}
                />
              </label>
              <label>
                Số lượng
                <input
                  required
                  type="number"
                  min="1"
                  value={jobForm.quantity_needed}
                  onChange={(e) =>
                    setJobForm((prev) => ({ ...prev, quantity_needed: e.target.value }))
                  }
                />
              </label>
              <label>
                Mức lương
                <input
                  type="number"
                  min="0"
                  value={jobForm.salary_info}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, salary_info: e.target.value }))}
                />
              </label>
              <label>
                Hạn chót
                <input
                  required
                  type="date"
                  min={getTodayDateInput()}
                  value={jobForm.deadline}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, deadline: e.target.value }))}
                />
              </label>
              <label>
                Trạng thái
                <select
                  value={jobForm.status}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {JOB_ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {JOB_ORDER_STATUS_LABELS[status] || status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tuổi tối thiểu
                <input
                  type="number"
                  min="0"
                  value={jobForm.req_age_min}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, req_age_min: e.target.value }))}
                />
              </label>
              <label>
                Tuổi tối đa
                <input
                  type="number"
                  min="0"
                  value={jobForm.req_age_max}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, req_age_max: e.target.value }))}
                />
              </label>
              <label>
                Giới tính
                <select
                  value={jobForm.req_gender}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, req_gender: e.target.value }))}
                >
                  <option value="any">Tất cả</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </label>
              <label>
                Học vấn yêu cầu (chọn nhiều)
                <div className="education-checkbox-list">
                  {educationLevels.length ? (
                    educationLevels.map((level) => {
                      const levelValue = String(level.id);
                      const checked = jobForm.req_education.includes(levelValue);

                      return (
                        <label key={level.id} className="inline-label education-checkbox-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setJobForm((prev) => {
                                const current = Array.isArray(prev.req_education)
                                  ? prev.req_education
                                  : [];
                                const next = e.target.checked
                                  ? [...current, levelValue]
                                  : current.filter((item) => item !== levelValue);

                                return {
                                  ...prev,
                                  req_education: next
                                };
                              })
                            }
                          />
                          <span>{level.name}</span>
                        </label>
                      );
                    })
                  ) : (
                    <span className="tiny muted">Chưa có danh mục học vấn.</span>
                  )}
                </div>
                <span className="tiny muted">Bạn có thể tích chọn nhiều học vấn.</span>
              </label>
              <label>
                Kinh nghiệm tối thiểu (năm)
                <input
                  type="number"
                  value={jobForm.req_experience_min}
                  onChange={(e) =>
                    setJobForm((prev) => ({ ...prev, req_experience_min: e.target.value }))
                  }
                />
              </label>
              <label>
                Chiều cao tối thiểu
                <input
                  type="number"
                  value={jobForm.req_height_min}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, req_height_min: e.target.value }))}
                />
              </label>
              <label>
                Cân nặng tối thiểu
                <input
                  type="number"
                  value={jobForm.req_weight_min}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, req_weight_min: e.target.value }))}
                />
              </label>
              <button className="btn field-span-2" type="submit">
                Thêm đơn hàng
              </button>
            </form>
          </div>

          <div>
            <SectionHeader title="Danh sách đơn hàng" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Đơn hàng</th>
                    <th>Đối tác</th>
                    <th>Ứng viên</th>
                    <th>Trạng thái</th>
                    <th>Hạn chót</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {jobOrders.map((job) => (
                    <tr key={job.id}>
                      <td>{job.id}</td>
                      <td>
                        <strong>{job.job_title}</strong>
                        <br />
                        <span className="tiny">SL {job.quantity_needed}</span>
                      </td>
                      <td>{job.partner_name}</td>
                      <td>{Number(job.matched_candidates_count || 0)}</td>
                      <td>
                        <span className="badge">{JOB_ORDER_STATUS_LABELS[job.status] || job.status}</span>
                      </td>
                      <td>{formatDate(job.deadline)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn small ghost"
                            type="button"
                            onClick={() => openJobDetailModal(job.id)}
                          >
                            Chi tiết
                          </button>
                          <button
                            className="btn small"
                            type="button"
                            onClick={() => openJobEditModal(job.id)}
                          >
                            Sửa
                          </button>
                          <button
                            className="btn small"
                            type="button"
                            onClick={() => {
                              setSelectedJobOrderId(job.id);
                              setActiveTab('matching');
                            }}
                          >
                            Ghép
                          </button>
                          <button
                            className="btn text danger"
                            type="button"
                            onClick={() => handleCancelJob(job.id)}
                          >
                            Hủy
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!jobOrders.length ? (
                    <tr>
                      <td colSpan={7} className="center muted">
                        Chưa có đơn hàng.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'matching' ? (
        <div className="surface">
          <SectionHeader
            title="Đối khớp có điều kiện"
            action={
              <div className="inline-form">
                <select
                  value={selectedJobOrderId}
                  onChange={(e) => setSelectedJobOrderId(e.target.value)}
                >
                  <option value="">Chọn đơn hàng</option>
                  {jobOrders.map((job) => (
                    <option key={job.id} value={job.id}>
                      #{job.id} {job.job_title}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Tìm theo CCCD / tên / liên hệ"
                  value={matchingSearch}
                  onChange={(e) => setMatchingSearch(e.target.value)}
                />
                <button className="btn" type="button" onClick={runMatching}>
                  Chạy đối khớp
                </button>
              </div>
            }
          />

          {selectedJob ? (
            <div className="code-block">
              <p className="tiny strong">Yêu cầu đơn hàng</p>
              <ul className="inline-list">
                {formatRequirementText(selectedJob.requirements, educationNameMap).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ứng viên</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {matchingResult.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>
                      <strong>{row.full_name}</strong>
                      <br />
                      <span className="tiny">{row.citizen_id} - {row.phone || row.email || '-'}</span>
                    </td>
                    <td>{CANDIDATE_STATUS_LABELS[row.status] || row.status}</td>
                    <td>
                      <button
                        className="btn small"
                        type="button"
                        disabled={!selectedJobOrderId}
                        onClick={() => handleManualMatch(row.id)}
                      >
                        Ghép vào đơn
                      </button>
                    </td>
                  </tr>
                ))}
                {!matchingResult.length ? (
                  <tr>
                    <td colSpan={4} className="center muted">
                      Chưa có ứng viên phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'manual' ? (
        <div className="surface">
          <SectionHeader
            title="Ghép ứng viên thủ công vào đơn hàng"
            action={
              <div className="inline-form">
                <select
                  value={selectedJobOrderId}
                  onChange={(e) => setSelectedJobOrderId(e.target.value)}
                >
                  <option value="">Chọn đơn hàng để thêm ứng viên</option>
                  {jobOrders.map((job) => (
                    <option key={job.id} value={job.id}>
                      #{job.id} {job.job_title}
                    </option>
                  ))}
                </select>
                <button className="btn" type="button" onClick={runManualCandidateSearch}>
                  Tải danh sách
                </button>
              </div>
            }
          />

          <div className="filter-row">
            <input
              placeholder="Tìm theo CCCD / tên / SĐT / email"
              value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
            />
            <select
              value={manualStatusFilter}
              onChange={(e) => setManualStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {CANDIDATE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CANDIDATE_STATUS_LABELS[status] || status}
                </option>
              ))}
            </select>
            <button className="btn" type="button" onClick={runManualCandidateSearch}>
              Tìm kiếm
            </button>
          </div>

          <div className="inline-form" style={{ marginBottom: 12 }}>
            <label className="inline-label">
              Học vấn
              <select
                value={manualEducationFilter}
                onChange={(e) => setManualEducationFilter(e.target.value)}
              >
                <option value="">Tất cả học vấn</option>
                {educationLevels.map((level) => (
                  <option key={level.id} value={String(level.id)}>
                    {level.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="tiny muted">
              {selectedJobOrderId
                ? `Đơn hàng đang chọn: #${selectedJobOrderId}`
                : 'Chưa chọn đơn hàng. Hãy chọn trước khi thêm ứng viên.'}
            </span>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>CCCD</th>
                  <th>Ứng viên</th>
                  <th>Trạng thái</th>
                  <th>Học vấn</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredManualCandidates.map((row) => {
                  const canManualMatch =
                    ['PAID0_DOCS_SUBMITTED', 'WAITING_FORM_MATCH'].includes(row.status);
                  return (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.citizen_id || '-'}</td>
                      <td>
                        <strong>{row.full_name}</strong>
                        <br />
                        <span className="tiny">{row.phone || row.email || '-'}</span>
                      </td>
                      <td>{CANDIDATE_STATUS_LABELS[row.status] || row.status}</td>
                      <td>{educationNameMap[String(row.education_level)] || '-'}</td>
                      <td>
                        <button
                          className="btn small"
                          type="button"
                          disabled={!selectedJobOrderId || !canManualMatch}
                          onClick={() => handleManualMatch(row.id)}
                          title={
                            !selectedJobOrderId
                              ? 'Chọn đơn hàng trước khi thêm ứng viên.'
                              : !canManualMatch
                                ? 'Ứng viên cần ở trạng thái Đã nộp hồ sơ hoặc Chờ ghép form.'
                                : 'Thêm ứng viên vào đơn hàng'
                          }
                        >
                          Thêm vào đơn
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!filteredManualCandidates.length ? (
                  <tr>
                    <td colSpan={6} className="center muted">
                      Không có ứng viên theo bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <DetailModal
        open={jobDetailOpen}
        title={selectedJobDetail ? `Chi tiết đơn hàng #${selectedJobDetail.id}` : 'Chi tiết đơn hàng'}
        onClose={() => setJobDetailOpen(false)}
        footer={
          selectedJobDetail ? (
            <button
              className="btn"
              type="button"
              onClick={() => {
                setJobDetailOpen(false);
                setJobEditOpen(true);
              }}
            >
              Sửa đơn hàng
            </button>
          ) : null
        }
      >
        {jobDetailLoading ? <p className="muted">Đang tải chi tiết...</p> : null}

        {selectedJobDetail ? (
          <>
            <div className="stats-inline">
              <div className="mini-stat">
                <span>Đơn hàng</span>
                <strong>{selectedJobDetail.job_title}</strong>
              </div>
              <div className="mini-stat">
                <span>Đối tác</span>
                <strong>{selectedJobDetail.partner_name || '-'}</strong>
              </div>
              <div className="mini-stat">
                <span>Số ứng viên trong đơn</span>
                <strong>{jobOrderCandidates.length}</strong>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <tbody>
                  <tr>
                    <th>Trạng thái</th>
                    <td>{JOB_ORDER_STATUS_LABELS[selectedJobDetail.status] || selectedJobDetail.status}</td>
                    <th>Số lượng cần</th>
                    <td>{selectedJobDetail.quantity_needed}</td>
                  </tr>
                  <tr>
                    <th>Hạn chót</th>
                    <td>{formatDate(selectedJobDetail.deadline)}</td>
                    <th>Mức lương</th>
                    <td>{selectedJobDetail.salary_info || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="code-block">
              <p className="tiny strong">Điều kiện đơn hàng</p>
              <ul className="inline-list">
                {formatRequirementText(selectedJobDetail.requirements, educationNameMap).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <SectionHeader title="Danh sách ứng viên trong đơn hàng" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>CCCD</th>
                    <th>Ứng viên</th>
                    <th>Trạng thái ứng viên</th>
                    <th>KQ thi</th>
                    <th>Ngày thi</th>
                  </tr>
                </thead>
                <tbody>
                  {jobOrderCandidates.map((candidate) => (
                    <tr key={candidate.exam_application_id}>
                      <td>{candidate.citizen_id || '-'}</td>
                      <td>
                        <strong>{candidate.full_name}</strong>
                        <br />
                        <span className="tiny">{candidate.phone || candidate.email || '-'}</span>
                      </td>
                      <td>{CANDIDATE_STATUS_LABELS[candidate.candidate_status] || candidate.candidate_status}</td>
                      <td>{candidate.result_status || '-'}</td>
                      <td>{formatDate(candidate.exam_date)}</td>
                    </tr>
                  ))}
                  {!jobOrderCandidates.length ? (
                    <tr>
                      <td colSpan={5} className="center muted">
                        Đơn hàng chưa có ứng viên nào.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </DetailModal>

      <DetailModal
        open={jobEditOpen}
        title={selectedJobDetail ? `Sửa đơn hàng #${selectedJobDetail.id}` : 'Sửa đơn hàng'}
        onClose={() => setJobEditOpen(false)}
      >
        {selectedJobDetail ? (
          <form className="grid-form" onSubmit={handleUpdateJobOrder}>
            <label>
              Đối tác
              <select
                required
                value={jobEditForm.partner_id}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, partner_id: e.target.value }))}
              >
                <option value="">Chọn đối tác</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tên đơn hàng
              <input
                required
                value={jobEditForm.job_title}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, job_title: e.target.value }))}
              />
            </label>
            <label>
              Số lượng
              <input
                required
                type="number"
                min="1"
                value={jobEditForm.quantity_needed}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, quantity_needed: e.target.value }))}
              />
            </label>
            <label>
              Mức lương
              <input
                type="number"
                min="0"
                value={jobEditForm.salary_info}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, salary_info: e.target.value }))}
              />
            </label>
            <label>
              Hạn chót
              <input
                required
                type="date"
                min={getTodayDateInput()}
                value={jobEditForm.deadline}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, deadline: e.target.value }))}
              />
            </label>
            <label>
              Trạng thái
              <select
                value={jobEditForm.status}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                {JOB_ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {JOB_ORDER_STATUS_LABELS[status] || status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tuổi tối thiểu
              <input
                type="number"
                min="0"
                value={jobEditForm.req_age_min}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, req_age_min: e.target.value }))}
              />
            </label>
            <label>
              Tuổi tối đa
              <input
                type="number"
                min="0"
                value={jobEditForm.req_age_max}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, req_age_max: e.target.value }))}
              />
            </label>
            <label>
              Giới tính
              <select
                value={jobEditForm.req_gender}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, req_gender: e.target.value }))}
              >
                <option value="any">Tất cả</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
              </select>
            </label>
            <label>
              Học vấn yêu cầu (chọn nhiều)
              <div className="education-checkbox-list">
                {educationLevels.length ? (
                  educationLevels.map((level) => {
                    const levelValue = String(level.id);
                    const checked = jobEditForm.req_education.includes(levelValue);

                    return (
                      <label key={level.id} className="inline-label education-checkbox-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setJobEditForm((prev) => {
                              const current = Array.isArray(prev.req_education)
                                ? prev.req_education
                                : [];
                              const next = e.target.checked
                                ? [...current, levelValue]
                                : current.filter((item) => item !== levelValue);

                              return {
                                ...prev,
                                req_education: next
                              };
                            })
                          }
                        />
                        <span>{level.name}</span>
                      </label>
                    );
                  })
                ) : (
                  <span className="tiny muted">Chưa có danh mục học vấn.</span>
                )}
              </div>
            </label>
            <label>
              Kinh nghiệm tối thiểu (năm)
              <input
                type="number"
                value={jobEditForm.req_experience_min}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, req_experience_min: e.target.value }))}
              />
            </label>
            <label>
              Chiều cao tối thiểu
              <input
                type="number"
                value={jobEditForm.req_height_min}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, req_height_min: e.target.value }))}
              />
            </label>
            <label>
              Cân nặng tối thiểu
              <input
                type="number"
                value={jobEditForm.req_weight_min}
                onChange={(e) => setJobEditForm((prev) => ({ ...prev, req_weight_min: e.target.value }))}
              />
            </label>

            <div className="field-span-2">
              <SectionHeader title="Danh sách ứng viên trong đơn hàng" />
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>CCCD</th>
                      <th>Ứng viên</th>
                      <th>KQ thi</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobOrderCandidates.map((candidate) => (
                      <tr key={candidate.exam_application_id}>
                        <td>{candidate.citizen_id || '-'}</td>
                        <td>
                          <strong>{candidate.full_name}</strong>
                          <br />
                          <span className="tiny">{candidate.phone || candidate.email || '-'}</span>
                        </td>
                        <td>{candidate.result_status || '-'}</td>
                        <td>
                          <button
                            className="btn text danger"
                            type="button"
                            onClick={() => handleRemoveCandidateFromJobOrder(candidate.candidate_id)}
                            disabled={candidate.result_status !== 'Pending'}
                            title={
                              candidate.result_status === 'Pending'
                                ? 'Xóa ứng viên khỏi đơn hàng'
                                : 'Chỉ xóa được ứng viên chưa có kết quả thi'
                            }
                          >
                            Xóa khỏi đơn
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!jobOrderCandidates.length ? (
                      <tr>
                        <td colSpan={4} className="center muted">
                          Đơn hàng chưa có ứng viên nào.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="field-span-2 row-actions">
              <button className="btn" type="submit">
                Lưu chỉnh sửa
              </button>
              <button className="btn ghost" type="button" onClick={() => setJobEditOpen(false)}>
                Đóng
              </button>
            </div>
          </form>
        ) : null}
      </DetailModal>

      <DetailModal
        open={partnerEditOpen}
        title="Sửa thông tin đối tác"
        onClose={() => setPartnerEditOpen(false)}
      >
        <form className="grid-form" onSubmit={handleUpdatePartner}>
          <label>
            Tên đối tác
            <input
              required
              value={partnerEditForm.name}
              onChange={(e) => setPartnerEditForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <label>
            Quốc gia
            <input
              value={partnerEditForm.country}
              onChange={(e) => setPartnerEditForm((prev) => ({ ...prev, country: e.target.value }))}
            />
          </label>
          <label className="field-span-2">
            Địa chỉ
            <input
              value={partnerEditForm.address}
              onChange={(e) => setPartnerEditForm((prev) => ({ ...prev, address: e.target.value }))}
            />
          </label>
          <label className="field-span-2">
            Trạng thái
            <select
              value={partnerEditForm.status}
              onChange={(e) => setPartnerEditForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {PARTNER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PARTNER_STATUS_LABELS[status] || status}
                </option>
              ))}
            </select>
          </label>
          <button className="btn field-span-2" type="submit">
            Cập nhật đối tác
          </button>
        </form>
      </DetailModal>

      <DetailModal
        open={contactEditOpen}
        title="Sửa liên hệ đối tác"
        onClose={() => setContactEditOpen(false)}
      >
        <form className="grid-form" onSubmit={handleUpdateContact}>
          <label>
            Tên liên hệ
            <input
              required
              value={contactEditForm.contact_name}
              onChange={(e) => setContactEditForm((prev) => ({ ...prev, contact_name: e.target.value }))}
            />
          </label>
          <label>
            Chức vụ
            <input
              value={contactEditForm.contact_role}
              onChange={(e) => setContactEditForm((prev) => ({ ...prev, contact_role: e.target.value }))}
            />
          </label>
          <label>
            Điện thoại
            <input
              value={contactEditForm.contact_phone}
              onChange={(e) =>
                setContactEditForm((prev) => ({ ...prev, contact_phone: digitsOnly(e.target.value, 10) }))
              }
              inputMode="numeric"
              pattern="0\d{9}"
              maxLength={10}
              placeholder="0901234567"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={contactEditForm.contact_email}
              onChange={(e) => setContactEditForm((prev) => ({ ...prev, contact_email: e.target.value }))}
            />
          </label>
          <label>
            Liên hệ chính
            <input
              type="checkbox"
              checked={contactEditForm.is_primary}
              onChange={(e) => setContactEditForm((prev) => ({ ...prev, is_primary: e.target.checked }))}
            />
          </label>
          <button className="btn field-span-2" type="submit">
            Cập nhật liên hệ
          </button>
        </form>
      </DetailModal>
    </section>
  );
}

export default PartnersJobsPage;
