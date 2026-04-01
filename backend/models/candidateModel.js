const db = require('../config/db');
const { CANDIDATE_STATUSES, STATUS_ORDER, canTransition } = require('../utils/candidateStatus');
const DocumentModel = require('./documentModel');
const JobOrder = require('./jobOrderModel');
const EducationLevel = require('./educationLevelModel'); 

const ALLOWED_UPDATE_FIELDS = [
  'citizen_id',
  'full_name',
  'dob',
  'gender',
  'phone',
  'email',
  'address',
  'height',
  'weight',
  'blood_type',
  'education_level',
  'experience_summary',
  'source_id',
  'source_note',
  //'status', //Xóa 'status' khỏi ALLOWED_UPDATE_FIELDS để bắt buộc sử dụng transitionStatus cho các thay đổi trạng thái.
  'is_fee0_paid',
  'fee0_paid_amount',
  'fee0_paid_at',
  'cv_file_url'
];

const Candidate = {
  getAll: async ({ page = 1, limit = 20, search = '', status = '', source_id = null }) => {
    const offset = (page - 1) * limit;
    const where = [];
    const params = [];

    if (search) {
      where.push('(c.citizen_id LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      where.push('c.status = ?');
      params.push(status);
    }

    if (source_id !== null && source_id !== undefined) {
      where.push('c.source_id = ?');
      params.push(source_id);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM candidates c
      ${whereSql}
    `;
    const [countRows] = await db.query(countQuery, params);
    const total = Number(countRows[0].total || 0);

    const dataQuery = `
      SELECT
        c.id,
        c.citizen_id,
        c.full_name,
        c.dob,
        c.gender,
        c.phone,
        c.email,
        c.address,
        c.height,
        c.weight,
        c.blood_type,
        c.education_level,
        c.experience_summary,
        c.source_id,
        c.source_note,
        c.status,
        c.is_fee0_paid,
        c.fee0_paid_amount,
        c.fee0_paid_at,
        c.cv_file_url,
        c.created_at,
        c.updated_at,
        s.source_name
      FROM candidates c
      LEFT JOIN recruitment_sources s ON c.source_id = s.id
      ${whereSql}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataQuery, [...params, limit, offset]);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total
      }
    };
  },

  getById: async (id) => {
    const [rows] = await db.query(
      `
      SELECT
        c.id,
        c.citizen_id,
        c.full_name,
        c.dob,
        c.gender,
        c.phone,
        c.email,
        c.address,
        c.height,
        c.weight,
        c.blood_type,
        c.education_level,
        c.experience_summary,
        c.source_id,
        c.source_note,
        c.status,
        c.is_fee0_paid,
        c.fee0_paid_amount,
        c.fee0_paid_at,
        c.cv_file_url,
        c.created_at,
        c.updated_at,
        s.source_name
      FROM candidates c
      LEFT JOIN recruitment_sources s ON c.source_id = s.id
      WHERE c.id = ?
      LIMIT 1
      `,
      [id]
    );
    return rows[0] || null;
  },

  getByCitizenId: async (citizenId) => {
    const [rows] = await db.query(
      `
      SELECT
        c.id,
        c.citizen_id,
        c.full_name,
        c.dob,
        c.gender,
        c.phone,
        c.email,
        c.address,
        c.height,
        c.weight,
        c.blood_type,
        c.education_level,
        c.experience_summary,
        c.source_id,
        c.source_note,
        c.status,
        c.is_fee0_paid,
        c.fee0_paid_amount,
        c.fee0_paid_at,
        c.cv_file_url,
        c.created_at,
        c.updated_at,
        s.source_name
      FROM candidates c
      LEFT JOIN recruitment_sources s ON c.source_id = s.id
      WHERE c.citizen_id = ?
      LIMIT 1
      `,
      [citizenId]
    );
    return rows[0] || null;
  },

  create: async (candidateData) => {
    // Xác thực trường education_level nếu có
    if (candidateData.education_level !== null && candidateData.education_level !== undefined) {
        const level = await EducationLevel.findById(candidateData.education_level);
        if (!level) {
            throw new Error(`Invalid education_level ID: ${candidateData.education_level}.`);
        }
    }
    const query = `
      INSERT INTO candidates
      (
        citizen_id, full_name, dob, gender, phone, email, address, height, weight,
        blood_type, education_level, experience_summary, source_id, source_note,
        status, is_fee0_paid, fee0_paid_amount, fee0_paid_at, cv_file_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      candidateData.citizen_id,
      candidateData.full_name,
      candidateData.dob || null,
      candidateData.gender || null,
      candidateData.phone || null,
      candidateData.email || null,
      candidateData.address || null,
      candidateData.height || null,
      candidateData.weight || null,
      candidateData.blood_type || null,
      candidateData.education_level || null,
      candidateData.experience_summary || null,
      candidateData.source_id,
      candidateData.source_note || null,
      candidateData.status || CANDIDATE_STATUSES.NEW_RECEIVED,
      candidateData.is_fee0_paid || 0,
      candidateData.fee0_paid_amount || null,
      candidateData.fee0_paid_at || null,
      candidateData.cv_file_url || null
    ];

    const [result] = await db.query(query, values);
    return result.insertId;
  },

  update: async (id, candidateData) => {
    const updates = [];
    const values = [];

    // Xác thực trường education_level nếu có
    if (candidateData.education_level !== undefined) {
        if (candidateData.education_level !== null) {
            const level = await EducationLevel.findById(candidateData.education_level);
            if (!level) {
                throw new Error(`Invalid education_level ID: ${candidateData.education_level}.`);
            }
        }
    }

    // // Lọc bỏ 'status' khỏi các bản cập nhật trực tiếp
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(candidateData, field)) {
        if (field === 'status') {
            console.warn('Attempted to update status directly. Use transitionStatus method for status changes.');
            continue; // Bỏ qua cập nhật trạng thái trực tiếp
        }
        updates.push(`${field} = ?`);
        values.push(candidateData[field]);
      }
    }

    if (!updates.length) {
      return false;
    }

    values.push(id);

    const [result] = await db.query(
      `
      UPDATE candidates
      SET ${updates.join(', ')}
      WHERE id = ?
      `,
      values
    );

    return result.affectedRows > 0;
  },

  // Phương thức transitionStatus được sửa đổi với các Gate Conditions
  transitionStatus: async (candidateId, newStatus, { jobOrderId = null } = {}) => {
    const candidate = await Candidate.getById(candidateId);
    if (!candidate) {
      throw new Error('Candidate not found.');
    }

    const currentStatus = candidate.status;

    if (currentStatus === newStatus) {
      return { success: true, message: 'Status already up-to-date.' };
    }

    if (!canTransition(currentStatus, newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}.`);
    }

    // --- Gate Conditions ---
    switch (newStatus) {
      case CANDIDATE_STATUSES.PAID0_DOCS_SUBMITTED:
        if (!candidate.is_fee0_paid) {
          throw new Error('Candidate has not paid Fee 0 (is_fee0_paid = 0).');
        }
        const readiness = await DocumentModel.getPreExamReadiness(candidateId);
        if (!readiness.can_submit_profile) {
          throw new Error(
            `Candidate is missing submitted PRE_EXAM documents. Missing: ${
              readiness.missing_submitted_documents.map((d) => d.name).join(', ') || 'N/A'
            }`
          );
        }
        break;

      case CANDIDATE_STATUSES.FORM_MATCHED_WAITING_EXAM:
        if (currentStatus !== CANDIDATE_STATUSES.WAITING_FORM_MATCH) {
          throw new Error(`Candidate must be in ${CANDIDATE_STATUSES.WAITING_FORM_MATCH} status to be matched to a form.`);
        }
        if (!jobOrderId) {
          throw new Error('jobOrderId is required to transition to FORM_MATCHED_WAITING_EXAM.');
        }
        const jobOrder = await JobOrder.findById(jobOrderId);
        if (!jobOrder || jobOrder.status !== require('../utils/jobOrderStatus').JOB_ORDER_STATUSES.OPEN) {
          throw new Error('Job Order not found or not in OPEN status for matching.');
        }
        // Kiểm tra xem ứng viên đã được ghép nối với đơn đặt hàng công việc nào khác chưa
        const [specificExamApp] = await db.query(
            'SELECT id FROM exam_applications WHERE candidate_id = ? AND job_order_id = ? AND result_status = "Pending"',
            [candidateId, jobOrderId]
        );
        if (specificExamApp.length === 0) {
            // Trường hợp này cho thấy ExamApplication.create có thể đã thất bại hoặc ứng dụng thi chưa được xử lý.
            throw new Error('No pending exam application found for this candidate and job order to transition status.');
        }
        break;

      case CANDIDATE_STATUSES.PASSED:
      case CANDIDATE_STATUSES.FAILED_POOL:
        if (currentStatus !== CANDIDATE_STATUSES.FORM_MATCHED_WAITING_EXAM) {
          throw new Error(`Candidate must be in ${CANDIDATE_STATUSES.FORM_MATCHED_WAITING_EXAM} status to update exam result.`);
        }
        // Kiểm tra bổ sung: Đảm bảo có đơn đăng ký thi (exam_application) và mã đơn đặt hàng công việc (job_order_id) cho ứng viên này
        if (!jobOrderId) {
            throw new Error('jobOrderId is required for exam result transitions.');
        }
        const [examRecord] = await db.query('SELECT id FROM exam_applications WHERE candidate_id = ? AND job_order_id = ?', [candidateId, jobOrderId]);
        if (examRecord.length === 0) {
            throw new Error('No exam application found for this candidate and job order to update result status.');
        }
        break;

      // Thêm các điều kiện cổng khác cho các trạng thái khác nếu cần.
      case CANDIDATE_STATUSES.CONTRACT_SIGNED:
        if (currentStatus !== CANDIDATE_STATUSES.PASSED) {
          throw new Error(`Candidate must be in ${CANDIDATE_STATUSES.PASSED} status to sign a contract.`);
        }
        // Thêm logic tại đây để kiểm tra xem hợp đồng thực sự có tồn tại và đã được 'SIGNED' hay chưa.
        // Hiện tại, dựa vào contractController để thực hiện cuộc gọi này sau khi hợp đồng được ký kết.
        // Ví dụ (nếu mẫu Hợp đồng có sẵn ở đây):
        // const signedContractCount = await Contract.countSignedContractsForCandidate(candidateId);
        // if (signedContractCount === 0) {
        //   throw new Error('No signed contract found for this candidate.');
        // }
        break;
    }

    // Thực hiện cập nhật trạng thái
    const [result] = await db.query(
      `
      UPDATE candidates
      SET status = ?
      WHERE id = ?
      `,
      [newStatus, candidateId]
    );

    return { success: result.affectedRows > 0, message: `Candidate status updated to ${newStatus}.` };
  },

  // updateStatus: async (id, status) => {
  //   const [result] = await db.query(
  //     `
  //     UPDATE candidates
  //     SET status = ?
  //     WHERE id = ?
  //     `,
  //     [status, id]
  //   );
  //   return result.affectedRows > 0;
  // },

  deleteById: async (id) => {
    // Kiểm tra xem ứng viên có bất kỳ hồ sơ liên quan nào không (đơn đăng ký thi, hợp đồng, giao dịch, ...)
    const [examApps] = await db.query('SELECT id FROM exam_applications WHERE candidate_id = ?', [id]);
    if (examApps.length > 0) {
        throw new Error('Cannot delete candidate with linked exam applications.');
    }
    const [contracts] = await db.query('SELECT id FROM contracts WHERE candidate_id = ?', [id]);
    if (contracts.length > 0) {
        throw new Error('Cannot delete candidate with linked contracts.');
    }
    const [transactions] = await db.query('SELECT id FROM transactions WHERE candidate_id = ?', [id]);
    if (transactions.length > 0) {
        throw new Error('Cannot delete candidate with linked financial transactions.');
    }
    const [overseasRecords] = await db.query('SELECT id FROM overseas_records WHERE candidate_id = ?', [id]);
    if (overseasRecords.length > 0) {
        throw new Error('Cannot delete candidate with linked overseas records.');
    }

    const [result] = await db.query(
      `
      DELETE FROM candidates
      WHERE id = ?
      `,
      [id]
    );
    return result.affectedRows > 0;
  },

  // deleteById: async (id) => {
  //   const [result] = await db.query(
  //     `
  //     DELETE FROM candidates
  //     WHERE id = ?
  //     `,
  //     [id]
  //   );
  //   return result.affectedRows > 0;
  // },

  getKanbanBoard: async ({ source_id = null, limitPerStatus = 30 }) => {
    const statusPlaceholders = STATUS_ORDER.map(() => '?').join(', ');
    const params = [...STATUS_ORDER];

    let sourceClause = '';
    if (source_id !== null && source_id !== undefined) {
      sourceClause = 'AND c.source_id = ?';
      params.push(source_id);
    }

    params.push(limitPerStatus);

    const query = `
      SELECT *
      FROM (
        SELECT
          c.id,
          c.citizen_id,
          c.full_name,
          c.phone,
          c.email,
          c.status,
          c.source_id,
          c.source_note,
          c.is_fee0_paid,
          c.updated_at,
          s.source_name,
          ROW_NUMBER() OVER (PARTITION BY c.status ORDER BY c.updated_at DESC, c.id DESC) AS rn
        FROM candidates c
        LEFT JOIN recruitment_sources s ON c.source_id = s.id
        WHERE c.status IN (${statusPlaceholders})
        ${sourceClause}
      ) t
      WHERE t.rn <= ?
      ORDER BY t.updated_at DESC, t.id DESC
    `;

    const [rows] = await db.query(query, params);
    return rows;
  },

  getFunnelSummary: async ({ from_date, to_date }) => {
    const fromDate = from_date || '1970-01-01';
    const toDate = to_date || '2099-12-31';

    const [statusRows] = await db.query(
      `
      SELECT status, COUNT(*) AS total
      FROM candidates
      WHERE created_at BETWEEN ? AND ?
      GROUP BY status
      `,
      [fromDate, toDate]
    );

    const [sourceRows] = await db.query(
      `
      SELECT
        s.id,
        s.source_name,
        COUNT(c.id) AS total_candidates,
        SUM(CASE WHEN c.status = ? THEN 1 ELSE 0 END) AS passed_candidates,
        ROUND(
          SUM(CASE WHEN c.status = ? THEN 1 ELSE 0 END) / NULLIF(COUNT(c.id), 0) * 100,
          2
        ) AS conversion_pct
      FROM recruitment_sources s
      LEFT JOIN candidates c
        ON c.source_id = s.id
        AND c.created_at BETWEEN ? AND ?
      GROUP BY s.id, s.source_name
      ORDER BY conversion_pct DESC, total_candidates DESC, s.id DESC
      `,
      [
        CANDIDATE_STATUSES.PASSED,
        CANDIDATE_STATUSES.PASSED,
        fromDate,
        toDate
      ]
    );

    return {
      by_status: statusRows,
      by_source: sourceRows
    };
  }
};

module.exports = Candidate;