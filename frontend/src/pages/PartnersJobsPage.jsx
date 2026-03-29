import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import SegmentTabs from '../components/SegmentTabs';
import { partnerService } from '../services/partnerService';
import { jobOrderService } from '../services/jobOrderService';
import {
  JOB_ORDER_STATUSES,
  JOB_ORDER_STATUS_LABELS,
  PARTNER_STATUSES,
  PARTNER_STATUS_LABELS,
  CANDIDATE_STATUS_LABELS
} from '../utils/constants';
import { formatDate, safeJsonParse } from '../utils/format';
import { getErrorMessage } from '../utils/toast';

const initialPartnerForm = {
  name: '',
  country: '',
  address: '',
  contact_person: '',
  phone: '',
  email: '',
  reputation_score: 7,
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
  req_age_min: '',
  req_age_max: '',
  req_gender: 'any',
  req_education: '',
  req_experience_min: '',
  req_height_min: '',
  req_weight_min: ''
};

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

  const education = form.req_education
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (education.length) requirements.education_level = education;

  const expMin = Number(form.req_experience_min);
  if (!Number.isNaN(expMin)) requirements.experience_years = { min: expMin };

  const heightMin = Number(form.req_height_min);
  if (!Number.isNaN(heightMin)) requirements.height = { min: heightMin };

  const weightMin = Number(form.req_weight_min);
  if (!Number.isNaN(weightMin)) requirements.weight = { min: weightMin };

  return requirements;
}

function PartnersJobsPage() {
  const [activeTab, setActiveTab] = useState('partners');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const [partners, setPartners] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [jobOrders, setJobOrders] = useState([]);
  const [matchingResult, setMatchingResult] = useState([]);

  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedJobOrderId, setSelectedJobOrderId] = useState('');

  const [partnerForm, setPartnerForm] = useState(initialPartnerForm);
  const [contactForm, setContactForm] = useState(initialContactForm);
  const [jobForm, setJobForm] = useState(initialJobForm);

  const tabs = [
    { key: 'partners', label: 'Danh mục đối tác' },
    { key: 'contacts', label: 'Liên hệ đối tác' },
    { key: 'jobs', label: 'Kho đơn hàng' },
    { key: 'matching', label: 'Đối khớp có điều kiện' }
  ];

  const selectedJob = useMemo(
    () => jobOrders.find((item) => String(item.id) === String(selectedJobOrderId)),
    [jobOrders, selectedJobOrderId]
  );

  const showError = (err) => {
    setNotice({ type: 'error', text: getErrorMessage(err) });
  };

  const showSuccess = (text) => {
    setNotice({ type: 'ok', text });
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

  const reloadAll = async () => {
    setLoading(true);
    setNotice({ type: '', text: '' });
    try {
      await Promise.all([loadPartners(), loadJobOrders()]);
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

  const handleCreateContact = async (event) => {
    event.preventDefault();

    if (!selectedPartnerId) {
      setNotice({ type: 'error', text: 'Vui lòng chọn đối tác.' });
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

  const handleCreateJob = async (event) => {
    event.preventDefault();

    if (!jobForm.partner_id) {
      setNotice({ type: 'error', text: 'Cần chọn đối tác.' });
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

  const runMatching = async () => {
    if (!selectedJobOrderId) {
      setNotice({ type: 'error', text: 'Vui lòng chọn đơn hàng.' });
      return;
    }

    try {
      const res = await jobOrderService.getMatchingCandidates(selectedJobOrderId, {
        page: 1,
        limit: 80
      });
      setMatchingResult(res.data || []);
      setActiveTab('matching');
      showSuccess('Đã tải danh sách đối khớp.');
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

        {notice.text ? (
          <p className={notice.type === 'error' ? 'error-text' : 'success-text'}>
            {notice.text}
          </p>
        ) : null}
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
              <label>
                Người liên hệ
                <input
                  value={partnerForm.contact_person}
                  onChange={(e) =>
                    setPartnerForm((prev) => ({ ...prev, contact_person: e.target.value }))
                  }
                />
              </label>
              <label>
                Điện thoại
                <input
                  value={partnerForm.phone}
                  onChange={(e) => setPartnerForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={partnerForm.email}
                  onChange={(e) => setPartnerForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>
              <label>
                Điểm uy tín
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={partnerForm.reputation_score}
                  onChange={(e) =>
                    setPartnerForm((prev) => ({ ...prev, reputation_score: e.target.value }))
                  }
                />
              </label>
              <label>
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
                    <th>Tên</th>
                    <th>Trạng thái</th>
                    <th>Điểm</th>
                    <th>Số liên hệ</th>
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
                      <td>{partner.reputation_score ?? '-'}</td>
                      <td>{partner.total_contacts || 0}</td>
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
                    setContactForm((prev) => ({ ...prev, contact_phone: e.target.value }))
                  }
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
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((row) => (
                    <tr key={row.id}>
                      <td>{row.contact_name}</td>
                      <td>{row.contact_role || '-'}</td>
                      <td>{row.contact_phone || '-'}</td>
                      <td>{row.is_primary ? 'Có' : 'Không'}</td>
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
                  value={jobForm.salary_info}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, salary_info: e.target.value }))}
                />
              </label>
              <label>
                Hạn chót
                <input
                  required
                  type="date"
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
                  value={jobForm.req_age_min}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, req_age_min: e.target.value }))}
                />
              </label>
              <label>
                Tuổi tối đa
                <input
                  type="number"
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
                Học vấn (phân tách dấu phẩy)
                <input
                  value={jobForm.req_education}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, req_education: e.target.value }))}
                />
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
                      <td>
                        <span className="badge">{JOB_ORDER_STATUS_LABELS[job.status] || job.status}</span>
                      </td>
                      <td>{formatDate(job.deadline)}</td>
                      <td>
                        <div className="row-actions">
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
                      <td colSpan={6} className="center muted">
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
                <button className="btn" type="button" onClick={runMatching}>
                  Chạy đối khớp
                </button>
              </div>
            }
          />

          {selectedJob ? (
            <div className="code-block">
              <p className="tiny strong">Yêu cầu đơn hàng</p>
              <pre>{JSON.stringify(safeJsonParse(selectedJob.requirements, {}), null, 2)}</pre>
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ứng viên</th>
                  <th>Trạng thái</th>
                  <th>Phí 0</th>
                  <th>Hồ sơ đã xác minh</th>
                </tr>
              </thead>
              <tbody>
                {matchingResult.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>
                      <strong>{row.full_name}</strong>
                      <br />
                      <span className="tiny">{row.phone || row.email || '-'}</span>
                    </td>
                    <td>{CANDIDATE_STATUS_LABELS[row.status] || row.status}</td>
                    <td>{row.is_fee0_paid ? 'Đã đóng' : 'Chưa đóng'}</td>
                    <td className="tiny">{row.verified_doc_codes || '-'}</td>
                  </tr>
                ))}
                {!matchingResult.length ? (
                  <tr>
                    <td colSpan={5} className="center muted">
                      Chưa có ứng viên phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default PartnersJobsPage;
