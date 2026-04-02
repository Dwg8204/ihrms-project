const db = require('../config/db');
const { JOB_ORDER_STATUSES } = require('../utils/jobOrderStatus');
const DocumentModel = require('./documentModel');

function toValidPositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeEducationRequirement(requirements) {
  const rawLevels = Array.isArray(requirements.education_level)
    ? requirements.education_level
    : [];

  const requiredEducationIds = new Set();
  const requiredEducationNames = new Set();

  rawLevels.forEach((item) => {
    const asId = toValidPositiveInt(item);
    if (asId) {
      requiredEducationIds.add(asId);
      return;
    }

    if (typeof item === 'string' && item.trim()) {
      requiredEducationNames.add(item.trim().toLowerCase());
    }
  });

  return {
    requiredEducationIds,
    requiredEducationNames
  };
}

class JobOrder {
  static async create(jobOrderData) {
    let { partner_id, job_title, quantity_needed, salary_info, requirements, deadline, status = JOB_ORDER_STATUSES.OPEN } = jobOrderData;
    try {
      // Validate partner_id
      const [partner] = await db.query('SELECT id, status FROM partners WHERE id = ?', [partner_id]);
      if (partner.length === 0) {
        throw new Error('Partner not found.');
      }
      if (partner[0].status === 'INACTIVE' || partner[0].status === 'BLACKLISTED') {
        throw new Error(`Cannot create job order for an ${partner[0].status} partner.`);
      }

      // Validate quantity_needed
      if (quantity_needed <= 0) {
        throw new Error('Quantity needed must be a positive number.');
      }

      // Validate deadline
      const currentDate = new Date().toISOString().split('T')[0];
      if (new Date(deadline) < new Date(currentDate)) {
        throw new Error('Deadline cannot be in the past.');
      }

      // Đảm bảo rằng các yêu cầu được lưu trữ dưới dạng chuỗi JSON nếu đó là một đối tượng.
      if (typeof requirements === 'object') {
        requirements = JSON.stringify(requirements);
      }

      const [result] = await db.query(
        'INSERT INTO job_orders (partner_id, job_title, quantity_needed, salary_info, requirements, deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [partner_id, job_title, quantity_needed, salary_info, requirements, deadline, status]
      );
      return { id: result.insertId, ...jobOrderData };
    } catch (error) {
      throw error;
    }
  }

  static async findAll(page = 1, limit = 20, search = '', partner_id = null, status = '') {
    const offset = (page - 1) * limit;
    let query = `
      SELECT
        jo.*,
        p.name AS partner_name,
        (
          SELECT COUNT(*)
          FROM exam_applications ea
          WHERE ea.job_order_id = jo.id
        ) AS matched_candidates_count
      FROM job_orders jo
      JOIN partners p ON jo.partner_id = p.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(jo.id) AS total FROM job_orders jo JOIN partners p ON jo.partner_id = p.id WHERE 1=1';
    const params = [];
    const countParams = [];

    if (search) {
      query += ' AND (jo.job_title LIKE ? OR p.name LIKE ?)';
      countQuery += ' AND (jo.job_title LIKE ? OR p.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }
    if (partner_id) {
      query += ' AND jo.partner_id = ?';
      countQuery += ' AND jo.partner_id = ?';
      params.push(partner_id);
      countParams.push(partner_id);
    }
    if (status) {
      query += ' AND jo.status = ?';
      countQuery += ' AND jo.status = ?';
      params.push(status);
      countParams.push(status);
    }

    query += ' ORDER BY jo.deadline ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
      const [jobOrders] = await db.query(query, params);
      const [totalResult] = await db.query(countQuery, countParams);
      const total = totalResult[0].total;

      return {
        data: jobOrders.map(jo => ({
          ...jo,
          requirements: (() => {
            try {
              return JSON.parse(jo.requirements);
            } catch (error) {
              return {};
            }
          })()
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await db.query(
        `
        SELECT
          jo.*,
          p.name AS partner_name,
          (
            SELECT COUNT(*)
            FROM exam_applications ea
            WHERE ea.job_order_id = jo.id
          ) AS matched_candidates_count
        FROM job_orders jo
        JOIN partners p ON jo.partner_id = p.id
        WHERE jo.id = ?
        `,
        [id]
      );
      if (rows[0]) {
        try {
          rows[0].requirements = JSON.parse(rows[0].requirements);
        } catch (error) {
          rows[0].requirements = {};
        }
      }
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async getJobOrderCandidates(jobOrderId, search = '') {
    const jobOrder = await this.findById(jobOrderId);
    if (!jobOrder) {
      throw new Error('Job Order not found.');
    }

    let query = `
      SELECT
        ea.id AS exam_application_id,
        ea.job_order_id,
        ea.candidate_id,
        ea.exam_date,
        ea.result_status,
        ea.note,
        c.citizen_id,
        c.full_name,
        c.phone,
        c.email,
        c.status AS candidate_status,
        c.education_level,
        el.name AS education_level_name,
        c.created_at AS candidate_created_at
      FROM exam_applications ea
      JOIN candidates c ON c.id = ea.candidate_id
      LEFT JOIN education_levels el ON el.id = c.education_level
      WHERE ea.job_order_id = ?
    `;
    const params = [jobOrderId];

    if (search) {
      query += ' AND (c.citizen_id LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY ea.created_at DESC, ea.id DESC';

    const [rows] = await db.query(query, params);
    return rows;
  }

  static async removeCandidateFromJobOrder(jobOrderId, candidateId) {
    const jobOrder = await this.findById(jobOrderId);
    if (!jobOrder) {
      throw new Error('Job Order not found.');
    }

    const [apps] = await db.query(
      `
      SELECT id, result_status
      FROM exam_applications
      WHERE job_order_id = ? AND candidate_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `,
      [jobOrderId, candidateId]
    );

    if (!apps.length) {
      throw new Error('Candidate is not linked to this job order.');
    }

    const app = apps[0];
    if (app.result_status !== 'Pending') {
      throw new Error('Cannot remove candidate from job order when exam result is already recorded.');
    }

    await db.query('DELETE FROM exam_applications WHERE id = ?', [app.id]);

    const CandidateModel = require('./candidateModel');
    const candidate = await CandidateModel.getById(candidateId);

    if (candidate && candidate.status === 'FORM_MATCHED_WAITING_EXAM') {
      const [remainingPendingApps] = await db.query(
        'SELECT COUNT(*) AS total FROM exam_applications WHERE candidate_id = ? AND result_status = ?',
        [candidateId, 'Pending']
      );

      if (Number(remainingPendingApps[0]?.total || 0) === 0) {
        await CandidateModel.transitionStatus(candidateId, 'WAITING_FORM_MATCH');
      }
    }

    return { exam_application_id: app.id };
  }

  static async update(id, jobOrderData) {
    let { partner_id, job_title, quantity_needed, salary_info, requirements, deadline, status } = jobOrderData;
    try {
      const currentJobOrder = await this.findById(id);
      if (!currentJobOrder) {
        return null;
      }

      // Nếu requirements là một đối tượng, chuyển đổi nó thành chuỗi để lưu trữ trong cơ sở dữ liệu.
      if (requirements && typeof requirements === 'object') {
        requirements = JSON.stringify(requirements);
      }

      // Xác thực partner_id nếu được cung cấp.
      if (partner_id) {
        const [partner] = await db.query('SELECT id FROM partners WHERE id = ?', [partner_id]);
        if (partner.length === 0) {
          throw new Error('Partner not found.');
        }
      }

      // Xác thực số lượng cần thiết nếu có.
      if (quantity_needed !== undefined && quantity_needed <= 0) {
        throw new Error('Quantity needed must be a positive number.');
      }
      // Kiểm tra xem số lượng mới có ít hơn số lượng ứng viên đã được khớp/đạt yêu cầu hay không.
      if (quantity_needed !== undefined && quantity_needed < currentJobOrder.quantity_needed) {
          const [matchedCandidates] = await db.query('SELECT COUNT(id) AS matched_count FROM exam_applications WHERE job_order_id = ? AND result_status = "Pass"', [id]);
          if (matchedCandidates[0].matched_count > quantity_needed) {
              throw new Error(`Cannot set quantity less than the number of passed candidates (${matchedCandidates[0].matched_count}).`);
          }
      }

      // Xác nhận deadline nếu có.
      if (deadline) {
        const currentDate = new Date().toISOString().split('T')[0];
        if (new Date(deadline) < new Date(currentDate)) {
          throw new Error('Deadline cannot be in the past.');
        }
      }

      // Xử lý các chuyển đổi trạng thái
      if (status && !require('../utils/jobOrderStatus').canTransitionJobOrderStatus(currentJobOrder.status, status)) {
        throw new Error(`Invalid status transition from ${currentJobOrder.status} to ${status}.`);
      }
      
      const [result] = await db.query(
        'UPDATE job_orders SET partner_id = COALESCE(?, partner_id), job_title = COALESCE(?, job_title), quantity_needed = COALESCE(?, quantity_needed), salary_info = COALESCE(?, salary_info), requirements = COALESCE(?, requirements), deadline = COALESCE(?, deadline), status = COALESCE(?, status) WHERE id = ?',
        [partner_id, job_title, quantity_needed, salary_info, requirements, deadline, status, id]
      );
      if (result.affectedRows === 0) {
        return null; // Không tìm thấy đơn đặt hàng
      }
      return { id, ...jobOrderData };
    } catch (error) {
      throw error;
    }
  }

  static async softDelete(id) {
    try {
      // Kiểm tra xem có bất kỳ đơn đăng ký thi hoặc hợp đồng nào liên quan không.
      const [examApps] = await db.query('SELECT id FROM exam_applications WHERE job_order_id = ?', [id]);
      if (examApps.length > 0) {
        throw new Error('Cannot cancel job order with linked exam applications. Please update candidate statuses first.');
      }
      const [contracts] = await db.query('SELECT id FROM contracts WHERE job_order_id = ?', [id]);
      if (contracts.length > 0) {
        throw new Error('Cannot cancel job order with linked contracts. Please update contract statuses first.');
      }

      const [result] = await db.query('UPDATE job_orders SET status = ? WHERE id = ?', [JOB_ORDER_STATUSES.CANCELLED, id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  static async hardDelete(id) {
    try {
      const [result] = await db.query('DELETE FROM job_orders WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  static async findMatchingCandidates(jobOrderId, search = '', page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    try {
        const jobOrder = await this.findById(jobOrderId);
        if (!jobOrder) {
            throw new Error('Job Order not found.');
        }
        if (jobOrder.status !== JOB_ORDER_STATUSES.OPEN) {
            throw new Error(`Job Order is not open for matching. Current status: ${jobOrder.status}`);
        }

        const requirements = jobOrder.requirements || {};
        const { requiredEducationIds, requiredEducationNames } = normalizeEducationRequirement(requirements);
        let candidateQuery = `
            SELECT
                c.*,
            el.name AS education_level_name,
            GROUP_CONCAT(
              DISTINCT CASE
              WHEN dt.phase = 'PRE_EXAM'
               AND dt.is_required_for_gate = 1
               AND cd.status IN ('SUBMITTED', 'VERIFIED')
              THEN dt.code
              END
              ORDER BY dt.display_order ASC
            ) AS submitted_doc_codes,
            GROUP_CONCAT(
              DISTINCT CASE
              WHEN dt.phase = 'PRE_EXAM'
               AND dt.is_required_for_gate = 1
               AND cd.status IN ('SUBMITTED', 'VERIFIED')
              THEN dt.name
              END
              ORDER BY dt.display_order ASC
            ) AS submitted_doc_names
            FROM candidates c
          LEFT JOIN education_levels el ON c.education_level = el.id
            LEFT JOIN candidate_documents cd ON c.id = cd.candidate_id
            LEFT JOIN document_types dt ON cd.document_type_id = dt.id
            WHERE c.status IN (?, ?)
        `;
        
        const params = ['PAID0_DOCS_SUBMITTED', 'WAITING_FORM_MATCH'];

        if (search) {
          candidateQuery += ' AND (c.citizen_id LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
          params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        candidateQuery += `
            GROUP BY c.id
          HAVING COUNT(
            DISTINCT CASE
            WHEN dt.phase = 'PRE_EXAM'
             AND dt.is_required_for_gate = 1
             AND cd.status IN ('SUBMITTED', 'VERIFIED')
            THEN dt.id
            END
          ) = (SELECT COUNT(id) FROM document_types WHERE phase = 'PRE_EXAM' AND is_required_for_gate = 1)
            ORDER BY c.created_at DESC
        `;

        const [eligibleCandidates] = await db.query(candidateQuery, params);

        const matchedCandidates = eligibleCandidates.filter(candidate => {
          if (requirements.age) {
            if (!candidate.dob) {
              return false;
            }

                const birthDate = new Date(candidate.dob);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }

            const minAge = Number.parseInt(requirements.age.min, 10);
            const maxAge = Number.parseInt(requirements.age.max, 10);
            if ((!Number.isNaN(minAge) && age < minAge) ||
              (!Number.isNaN(maxAge) && age > maxAge)) {
                    return false;
                }
            }

            if (requirements.gender && requirements.gender !== 'any' && candidate.gender) {
                if (requirements.gender.toLowerCase() !== candidate.gender.toLowerCase()) {
                    return false;
                }
            }

          if (requiredEducationIds.size > 0 || requiredEducationNames.size > 0) {
            const candidateEducationId = toValidPositiveInt(candidate.education_level);
            const candidateEducationName = String(candidate.education_level_name || '').trim().toLowerCase();
            const matchedById = candidateEducationId ? requiredEducationIds.has(candidateEducationId) : false;
            const matchedByName = candidateEducationName
            ? requiredEducationNames.has(candidateEducationName)
            : false;

            if (!matchedById && !matchedByName) {
                return false;
              }
            }

          if (requirements.experience_years && requirements.experience_years.min) {
            const minExperience = Number.parseInt(requirements.experience_years.min, 10);
            if (!Number.isNaN(minExperience) && minExperience > 0 && (!candidate.experience_summary || candidate.experience_summary.trim() === '')) {
                    return false;
                }
            }

          if (requirements.height && requirements.height.min) {
            const minHeight = Number.parseFloat(requirements.height.min);
            if (!Number.isNaN(minHeight) && (candidate.height === null || candidate.height === undefined || Number(candidate.height) < minHeight)) {
                    return false;
                }
            }

          if (requirements.weight && requirements.weight.min) {
            const minWeight = Number.parseFloat(requirements.weight.min);
            if (!Number.isNaN(minWeight) && (candidate.weight === null || candidate.weight === undefined || Number(candidate.weight) < minWeight)) {
                    return false;
                }
            }

            return true;
        });

        const total = matchedCandidates.length;
        const paginatedCandidates = matchedCandidates.slice(offset, offset + limit);

        return {
          data: paginatedCandidates,
            pagination: {
                page,
                limit,
            total,
            filteredTotal: total,
                totalPages: Math.ceil(total / limit),
            },
        };

    } catch (error) {
        throw error;
    }
  }

  // --- Phương pháp mới để ghép nối thủ công ---
  static async manualMatchCandidate(jobOrderId, candidateId) {
      try {
          const jobOrder = await this.findById(jobOrderId);
          if (!jobOrder) {
              throw new Error('Job Order not found.');
          }
          if (jobOrder.status !== JOB_ORDER_STATUSES.OPEN) {
              throw new Error(`Job Order is not open for matching. Current status: ${jobOrder.status}`);
          }

          const CandidateModel = require('./candidateModel'); // Import here to avoid circular dependency
            let candidate = await CandidateModel.getById(candidateId);
          if (!candidate) {
              throw new Error('Candidate not found.');
          }

            if (candidate.status === 'PAID0_DOCS_SUBMITTED') {
            await CandidateModel.transitionStatus(candidateId, 'WAITING_FORM_MATCH');
            candidate = await CandidateModel.getById(candidateId);
            }

            if (candidate.status !== 'WAITING_FORM_MATCH') {
              throw new Error(`Candidate must be in WAITING_FORM_MATCH status (or PAID0_DOCS_SUBMITTED) for manual matching. Current status: ${candidate.status}`);
          }

          // Kiểm tra tài liệu PRE_EXAM ở mức đã nộp (SUBMITTED/VERIFIED)
          const readiness = await DocumentModel.getPreExamReadiness(candidateId);
          if (!readiness.can_submit_profile) {
            throw new Error(`Candidate is missing required PRE_EXAM documents for manual matching. Missing: ${readiness.missing_submitted_documents.map(d => d.name).join(', ')}`);
          }

          // Kiểm tra xem ứng viên đã tham gia kỳ thi cho vị trí tuyển dụng này chưa (để tránh đăng ký trùng lặp).
          const [existingApp] = await db.query('SELECT id FROM exam_applications WHERE candidate_id = ? AND job_order_id = ?', [candidateId, jobOrderId]);
          if (existingApp.length > 0) {
              throw new Error('Candidate is already registered for an exam with this job order.');
          }

          // Đến bước này, các điều kiện cơ bản để tạo đơn đăng ký thi đã được đáp ứng..
          // Các yêu cầu của JSON (tuổi, giới tính, trình độ học vấn, v.v.) được cố ý bỏ qua để thực hiện đối sánh thủ công.

          // Tạo một đơn đăng ký thi để thể hiện sự phù hợp.
          // Cần nhập mô hình ExamApplication ở đây, hoặc trừu tượng hóa điều này thành một lớp dịch vụ.
          const ExamApplication = require('./examApplicationModel'); // Nhập khẩu tại đây để tránh phụ thuộc vòng lặp
          const examAppData = {
              candidate_id: candidateId,
              job_order_id: jobOrderId,
              exam_date: null, // Hiện chưa có ngày thi cụ thể cho hình thức thi đối sánh thủ công, sẽ được cập nhật sau.
              note: 'Manual match',
              result_status: 'Pending'
          };
          const newExamApp = await ExamApplication.create(examAppData); // Điều này cũng sẽ xử lý việc chuyển đổi trạng thái ứng viên.

          // Tự động chuyển đổi trạng thái ứng viên (nếu chưa được xử lý bởi ExamApplication.create)
          await CandidateModel.transitionStatus(candidateId, 'FORM_MATCHED_WAITING_EXAM', { jobOrderId: jobOrderId });

          return newExamApp; // Trả lại đơn đăng ký thi đã tạo
      } catch (error) {
          throw error;
      }
  }

  // --- Cron job related methods ---
  static async updateExpiredJobOrders() {
    try {
        const [result] = await db.query(
            'UPDATE job_orders SET status = ? WHERE deadline < CURDATE() AND status = ?',
            [JOB_ORDER_STATUSES.EXPIRED, JOB_ORDER_STATUSES.OPEN]
        );
        console.log(`Cron Job: Updated ${result.affectedRows} job orders to EXPIRED status.`);
        return result.affectedRows;
    } catch (error) {
        console.error('Error updating expired job orders:', error);
        throw error;
    }
  }

  static async hardDeleteCancelledJobOrders(days = 7) {
    try {
        const [result] = await db.query(
            'DELETE FROM job_orders WHERE status = ? AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [JOB_ORDER_STATUSES.CANCELLED, days]
        );
        console.log(`Cron Job: Hard deleted ${result.affectedRows} cancelled job orders older than ${days} days.`);
        return result.affectedRows;
    } catch (error) {
        console.error('Error hard deleting cancelled job orders:', error);
        throw error;
    }
  }
}

module.exports = JobOrder;