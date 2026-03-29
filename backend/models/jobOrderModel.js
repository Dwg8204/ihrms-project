const db = require('../config/db');
const { JOB_ORDER_STATUSES } = require('../utils/jobOrderStatus');

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

        const requirements = jobOrder.requirements;
        let candidateQuery = `
            SELECT 
                c.*, 
                GROUP_CONCAT(dt.code ORDER BY dt.display_order ASC) AS verified_doc_codes,
                GROUP_CONCAT(dt.name ORDER BY dt.display_order ASC) AS verified_doc_names
            FROM candidates c
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
                if (!requirements.education_level.some(level => candidate.education_level.includes(level))) {
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