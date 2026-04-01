const db = require('../config/db');
const { JOB_ORDER_STATUSES } = require('../utils/jobOrderStatus');
const DocumentModel = require('./documentModel');
const EducationLevel = require('./educationLevelModel');

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
    let query = 'SELECT jo.*, p.name AS partner_name FROM job_orders jo JOIN partners p ON jo.partner_id = p.id WHERE 1=1';
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
          requirements: JSON.parse(jo.requirements) // Parse requirements back to object
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
      const [rows] = await db.query('SELECT jo.*, p.name AS partner_name FROM job_orders jo JOIN partners p ON jo.partner_id = p.id WHERE jo.id = ?', [id]);
      if (rows[0]) {
        rows[0].requirements = JSON.parse(rows[0].requirements); // Parse requirements
      }
      return rows[0];
    } catch (error) {
      throw error;
    }
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
        let candidateQuery = `
            SELECT
                c.*,
                el.name AS education_level_name, -- Join to get education level name
                GROUP_CONCAT(dt.code ORDER BY dt.display_order ASC) AS verified_doc_codes,
                GROUP_CONCAT(dt.name ORDER BY dt.display_order ASC) AS verified_doc_names
            FROM candidates c
            LEFT JOIN education_levels el ON c.education_level = el.id -- Join education_levels
            LEFT JOIN candidate_documents cd ON c.id = cd.candidate_id
            LEFT JOIN document_types dt ON cd.document_type_id = dt.id
            WHERE c.status = ?
            AND c.is_fee0_paid = 1
            AND cd.status = 'VERIFIED'
            AND dt.phase = 'PRE_EXAM'
            AND dt.is_required_for_gate = 1
        `;
      let countQuery = `
            SELECT COUNT(DISTINCT c.id) AS total_candidates
            FROM candidates c
            LEFT JOIN education_levels el ON c.education_level = el.id
            LEFT JOIN candidate_documents cd ON c.id = cd.candidate_id
            LEFT JOIN document_types dt ON cd.document_type_id = dt.id
            WHERE c.status = ?
            AND c.is_fee0_paid = 1
            AND cd.status = 'VERIFIED'
            AND dt.phase = 'PRE_EXAM'
            AND dt.is_required_for_gate = 1
        `;
        
        const params = ['WAITING_FORM_MATCH']; // Chỉ ghép cặp các ứng viên đang chờ đơn.
        const countParams = ['WAITING_FORM_MATCH'];

        if (search) {
            candidateQuery += ' AND (c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
            countQuery += ' AND (c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        candidateQuery += `
            GROUP BY c.id
            HAVING COUNT(DISTINCT dt.id) = (SELECT COUNT(id) FROM document_types WHERE phase = 'PRE_EXAM' AND is_required_for_gate = 1)
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);

        const [eligibleCandidates] = await db.query(candidateQuery, params);
        const [totalResult] = await db.query(countQuery, countParams);
        const total = totalResult[0].total_candidates;

        // Hiện tại việc lọc các yêu cầu JSON được thực hiện trong bộ nhớ (sử dụng câu lệnh SQL phức tạp để lọc JSON).
        const matchedCandidates = eligibleCandidates.filter(candidate => {
            // Yêu cầu về độ tuổi
            if (requirements.age && candidate.dob) {
                const birthDate = new Date(candidate.dob);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                if ((requirements.age.min && age < requirements.age.min) ||
                    (requirements.age.max && age > requirements.age.max)) {
                    return false;
                }
            }

            // Yêu cầu về giới tính
            if (requirements.gender && requirements.gender !== 'any' && candidate.gender) {
                if (requirements.gender.toLowerCase() !== candidate.gender.toLowerCase()) {
                    return false;
                }
            }

            // Yêu cầu về trình độ học vấn
            if (requirements.education_level && requirements.education_level.length > 0 && candidate.education_level) {
          // requirements.education_level will be an array of IDs
              if (!requirements.education_level.includes(candidate.education_level)) {
                return false;
              }
            }

            // Yêu cầu về số năm kinh nghiệm (đơn giản hóa, dựa trên bảng tóm tắt kinh nghiệm)
            if (requirements.experience_years && requirements.experience_years.min && candidate.experience_summary) {
                if (requirements.experience_years.min > 0 && (!candidate.experience_summary || candidate.experience_summary.trim() === '')) {
                    return false;
                }
            }

            // Yêu cầu về chiều cao
            if (requirements.height && requirements.height.min && candidate.height) {
                if (candidate.height < requirements.height.min) {
                    return false;
                }
            }

            // Yêu cầu về cân nặng
            if (requirements.weight && requirements.weight.min && candidate.weight) {
                if (candidate.weight < requirements.weight.min) {
                    return false;
                }
            }
            
            // Bổ sung các yêu cầu khác nếu cần.

            return true;
        });

        return {
            data: matchedCandidates,
            pagination: {
                page,
                limit,
                total: total, // tổng số ứng viên đủ điều kiện trước khi lọc JSON
                filteredTotal: matchedCandidates.length, // tổng sau khi lọc JSON
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
          const candidate = await CandidateModel.getById(candidateId);
          if (!candidate) {
              throw new Error('Candidate not found.');
          }
          if (candidate.status !== 'WAITING_FORM_MATCH') {
              throw new Error(`Candidate must be in WAITING_FORM_MATCH status for manual matching. Current status: ${candidate.status}`);
          }

          // Kiểm tra trạng thái đã thanh toán phí 0
          if (!candidate.is_fee0_paid) {
            throw new Error('Candidate has not paid Fee 0 (is_fee0_paid = 0), cannot manually match.');
          }

          // Kiểm tra 7 tài liệu PRE_EXAM
          const readiness = await DocumentModel.getPreExamReadiness(candidateId);
          if (!readiness.can_proceed) {
            throw new Error(`Candidate is missing required PRE_EXAM documents for manual matching. Missing: ${readiness.missing_documents.map(d => d.name).join(', ')}`);
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