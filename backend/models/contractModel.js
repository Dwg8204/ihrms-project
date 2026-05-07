const db = require('../config/db');
const { CONTRACT_STATUSES, canTransitionContractStatus } = require('../utils/contractStatus');
const PaymentSchedule = require('./paymentScheduleModel');

class Contract {
  static async _generateContractNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2); // YY
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // MM

    // Tìm số hợp đồng cuối cùng của tháng/năm hiện tại.
    const [rows] = await db.query(
      `
      SELECT contract_number
      FROM contracts
      WHERE contract_number LIKE ?
      ORDER BY contract_number DESC
      LIMIT 1
      `,
      [`HD-${year}${month}-%`]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
      const lastNumber = parseInt(rows[0].contract_number.slice(-4), 10);
      nextNumber = lastNumber + 1;
    }

    return `HD-${year}${month}-${nextNumber.toString().padStart(4, '0')}`;
  }

  static async create(contractData) {
    let {
      candidate_id, job_order_id, contract_number, contract_type,
      signed_date, effective_date, expiry_date, status = CONTRACT_STATUSES.DRAFT,
      document_url, contract_details_json
    } = contractData;

    try {
      // Xác nhận ứng viên tồn tại và đang ở trạng thái PASSED (hoặc FORM_MATCHED_WAITING_EXAM đối với các thỏa thuận trước hợp đồng).
      const [candidate] = await db.query('SELECT id, status FROM candidates WHERE id = ?', [candidate_id]);
      if (candidate.length === 0) {
        throw new Error('Candidate not found.');
      }
      if (candidate[0].status !== 'PASSED' && candidate[0].status !== 'FORM_MATCHED_WAITING_EXAM') {
        throw new Error(`Candidate must be in PASSED or FORM_MATCHED_WAITING_EXAM status to create a contract. Current status: ${candidate[0].status}`);
      }

      // Tạo số hợp đồng nếu chưa được cung cấp.
      if (!contract_number) {
        contract_number = await this._generateContractNumber();
      } else {
        // Check for unique contract_number if provided manually
        const [existing] = await db.query('SELECT id FROM contracts WHERE contract_number = ?', [contract_number]);
        if (existing.length > 0) {
          throw new Error('Contract number already exists.');
        }
      }

      // Đảm bảo các ngày bắt buộc được cung cấp
      if (!signed_date || !effective_date || !expiry_date) {
        throw new Error('Ngày ký, ngày hiệu lực và ngày hết hạn là bắt buộc.');
      }

      // Kiểm tra logic thứ tự ngày
      const signed = new Date(signed_date);
      const effective = new Date(effective_date);
      const expiry = new Date(expiry_date);

      if (effective < signed) {
        throw new Error('Ngày hiệu lực phải sau hoặc bằng ngày ký.');
      }
      if (expiry <= effective) {
        throw new Error('Ngày hết hạn phải sau ngày hiệu lực.');
      }

      // Kiểm tra ngày ký phải sau ngày thi đạt (nếu có job_order_id)
      if (job_order_id) {
        const [examApp] = await db.query(
          'SELECT exam_date FROM exam_applications WHERE candidate_id = ? AND job_order_id = ? AND result_status = "Pass" LIMIT 1',
          [candidate_id, job_order_id]
        );
        if (examApp.length > 0 && examApp[0].exam_date) {
          const examDate = new Date(examApp[0].exam_date);
          if (signed <= examDate) {
            const formattedExamDate = examDate.toLocaleDateString('vi-VN');
            throw new Error(`Ngày ký hợp đồng phải sau ngày thi đạt (${formattedExamDate}).`);
          }
        }
      }

      // Hãy đảm bảo rằng contract_details_json được lưu trữ dưới dạng chuỗi JSON nếu nó là một đối tượng.
      if (contract_details_json && typeof contract_details_json === 'object') {
        contract_details_json = JSON.stringify(contract_details_json);
      }

      const [result] = await db.query(
        `INSERT INTO contracts (
          candidate_id, job_order_id, contract_number, contract_type,
          signed_date, effective_date, expiry_date, status,
          document_url, contract_details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          candidate_id, job_order_id, contract_number, contract_type,
          signed_date, effective_date, expiry_date, status,
          document_url, contract_details_json
        ]
      );
      const newContractId = result.insertId;

      // --- LOGIC TÀI CHÍNH & TRẠNG THÁI ---
      if (status === 'SIGNED') {
        const Candidate = require('./candidateModel');
        const { CANDIDATE_STATUSES } = require('../utils/candidateStatus');
        const PaymentSchedule = require('./paymentScheduleModel');

        await Candidate.transitionStatus(candidate_id, CANDIDATE_STATUSES.CONTRACT_SIGNED);
        await PaymentSchedule.generatePaymentSchedulesForContract(newContractId);
      }

      return { id: newContractId, ...contractData, contract_number, status };
    } catch (error) {
      throw error;
    }
  }

  static async findAll({ page = 1, limit = 20, search = '', candidate_id = null, job_order_id = null, status = '' }) {
    const offset = (page - 1) * limit;
    const where = [];
    const params = [];

    let query = `
      SELECT
        c.*,
        ca.full_name AS candidate_name,
        jo.job_title,
        p.name AS partner_name
      FROM contracts c
      JOIN candidates ca ON c.candidate_id = ca.id
      LEFT JOIN job_orders jo ON c.job_order_id = jo.id
      LEFT JOIN partners p ON jo.partner_id = p.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(c.id) AS total
      FROM contracts c
      JOIN candidates ca ON c.candidate_id = ca.id
      LEFT JOIN job_orders jo ON c.job_order_id = jo.id
      LEFT JOIN partners p ON jo.partner_id = p.id
      WHERE 1=1
    `;

    if (search) {
      where.push('(c.contract_number LIKE ? OR ca.full_name LIKE ? OR jo.job_title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (candidate_id) {
      where.push('c.candidate_id = ?');
      params.push(candidate_id);
    }
    if (job_order_id) {
      where.push('c.job_order_id = ?');
      params.push(job_order_id);
    }
    if (status) {
      where.push('c.status = ?');
      params.push(status);
    }

    const whereSql = where.length ? ` AND ${where.join(' AND ')}` : '';
    query += whereSql + ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    countQuery += whereSql;

    const [countRows] = await db.query(countQuery, params);
    const total = Number(countRows[0].total || 0);

    const [rows] = await db.query(query, [...params, limit, offset]);

    return {
      data: rows.map(row => ({
        ...row,
        contract_details_json: row.contract_details_json ? JSON.parse(row.contract_details_json) : null
      })),
      pagination: {
        page,
        limit,
        total
      }
    };
  }

  static async findById(id) {
    const [rows] = await db.query(
      `
      SELECT
        c.*,
        ca.full_name AS candidate_name,
        ca.phone AS candidate_phone,
        ca.email AS candidate_email,
        jo.job_title,
        jo.salary_info,
        p.name AS partner_name
      FROM contracts c
      JOIN candidates ca ON c.candidate_id = ca.id
      LEFT JOIN job_orders jo ON c.job_order_id = jo.id
      LEFT JOIN partners p ON jo.partner_id = p.id
      WHERE c.id = ?
      LIMIT 1
      `,
      [id]
    );
    if (rows[0]) {
      rows[0].contract_details_json = rows[0].contract_details_json ? JSON.parse(rows[0].contract_details_json) : null;
    }
    return rows[0] || null;
  }

  static async update(id, contractData) {
    let {
      candidate_id, job_order_id, contract_number, contract_type,
      signed_date, effective_date, expiry_date, status,
      document_url, contract_details_json
    } = contractData;

    try {
      const currentContract = await this.findById(id);
      if (!currentContract) {
        return null;
      }

      // Kiểm tra xem số hợp đồng có duy nhất hay không nếu nó đang được cập nhật.
      if (contract_number && contract_number !== currentContract.contract_number) {
        const [existing] = await db.query('SELECT id FROM contracts WHERE contract_number = ? AND id != ?', [contract_number, id]);
        if (existing.length > 0) {
          throw new Error('Contract number already exists.');
        }
      }

      // Xác thực logic ngày tháng nếu có cập nhật
      const newSignedDate = signed_date || currentContract.signed_date;
      const newEffectiveDate = effective_date || currentContract.effective_date;
      const newExpiryDate = expiry_date || currentContract.expiry_date;

      if (newSignedDate && newEffectiveDate && newExpiryDate) {
        const signed = new Date(newSignedDate);
        const effective = new Date(newEffectiveDate);
        const expiry = new Date(newExpiryDate);

        if (effective < signed) {
          throw new Error('Ngày hiệu lực phải sau hoặc bằng ngày ký.');
        }
        if (expiry <= effective) {
          throw new Error('Ngày hết hạn phải sau ngày hiệu lực.');
        }

        // Kiểm tra ngày ký so với ngày thi đạt
        const targetCandidateId = candidate_id || currentContract.candidate_id;
        const targetJobOrderId = job_order_id || currentContract.job_order_id;

        if (targetJobOrderId) {
          const [examApp] = await db.query(
            'SELECT exam_date FROM exam_applications WHERE candidate_id = ? AND job_order_id = ? AND result_status = "Pass" LIMIT 1',
            [targetCandidateId, targetJobOrderId]
          );
          if (examApp.length > 0 && examApp[0].exam_date) {
            const examDate = new Date(examApp[0].exam_date);
            if (signed <= examDate) {
              const formattedExamDate = examDate.toLocaleDateString('vi-VN');
              throw new Error(`Ngày ký hợp đồng phải sau ngày thi đạt (${formattedExamDate}).`);
            }
          }
        }
      }

      // Xử lý các chuyển đổi trạng thái
      if (status && !canTransitionContractStatus(currentContract.status, status)) {
        throw new Error(`Invalid contract status transition from ${currentContract.status} to ${status}.`);
      }

      // Hãy đảm bảo rằng contract_details_json được lưu trữ dưới dạng chuỗi JSON nếu nó là một đối tượng.
      if (contract_details_json && typeof contract_details_json === 'object') {
        contract_details_json = JSON.stringify(contract_details_json);
      } else if (contract_details_json === null) {
        // Cho phép đặt thành NULL
      } else if (contract_details_json !== undefined) {
          throw new Error('contract_details_json must be a valid JSON object or null.');
      }


      const [result] = await db.query(
        `UPDATE contracts SET
          candidate_id = COALESCE(?, candidate_id),
          job_order_id = COALESCE(?, job_order_id),
          contract_number = COALESCE(?, contract_number),
          contract_type = COALESCE(?, contract_type),
          signed_date = COALESCE(?, signed_date),
          effective_date = COALESCE(?, effective_date),
          expiry_date = COALESCE(?, expiry_date),
          status = COALESCE(?, status),
          document_url = COALESCE(?, document_url),
          contract_details_json = COALESCE(?, contract_details_json)
        WHERE id = ?`,
        [
          candidate_id, job_order_id, contract_number, contract_type,
          signed_date, effective_date, expiry_date, status,
          document_url, contract_details_json, id
        ]
      );
      if (result.affectedRows === 0) {
        return null; // Không tìm thấy hợp đồng
      }

      // --- LOGIC TÀI CHÍNH & TRẠNG THÁI (Module 1 & 5) ---
      // Nếu trạng thái chuyển thành SIGNED, tự động sinh lịch thanh toán và cập nhật trạng thái ứng viên
      if (status === CONTRACT_STATUSES.SIGNED && currentContract.status !== CONTRACT_STATUSES.SIGNED) {
        // Cập nhật trạng thái ứng viên trước
        const Candidate = require('./candidateModel');
        const { CANDIDATE_STATUSES } = require('../utils/candidateStatus');
        await Candidate.transitionStatus(currentContract.candidate_id, CANDIDATE_STATUSES.CONTRACT_SIGNED);

        // Sau đó sinh lịch thanh toán
        await PaymentSchedule.generatePaymentSchedulesForContract(id);
      }

      return { id, ...contractData };
    } catch (error) {
      throw error;
    }
  }

  static async softDelete(id, cancelled_reason) {
    try {
      const currentContract = await this.findById(id);
      if (!currentContract) {
        return null;
      }

      // Kiểm tra các giao dịch tài chính liên quan (Module 5) hoặc hồ sơ ở nước ngoài (Module 7)
      const [transactions] = await db.query('SELECT id FROM transactions WHERE contract_id = ?', [id]); // Giả sử contract_id trong giao dịch
      if (transactions.length > 0) {
        throw new Error('Cannot cancel contract with linked financial transactions.');
      }
      const [overseasRecords] = await db.query('SELECT id FROM overseas_records WHERE contract_id = ?', [id]); // Giả sử contract_id có trong overseas_records
      if (overseasRecords.length > 0) {
        throw new Error('Cannot cancel contract with linked overseas records.');
      }

      // Thực hiện xóa mềm bằng cách cập nhật trạng thái thành CANCELLED
      const [result] = await db.query(
        'UPDATE contracts SET status = ?, cancelled_at = NOW(), cancelled_reason = ? WHERE id = ?',
        [CONTRACT_STATUSES.CANCELLED, cancelled_reason, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  static async hardDelete(id) {
    try {
      const currentContract = await this.findById(id);
      if (!currentContract) {
        return null;
      }

      // Chỉ cho phép xóa vĩnh viễn nếu ở trạng thái NHÁP và không có phụ thuộc.
      if (currentContract.status !== CONTRACT_STATUSES.DRAFT) {
        throw new Error('Only DRAFT contracts can be hard deleted. Use soft delete for other statuses.');
      }

      // Cũng kiểm tra các phần phụ thuộc ngay cả khi ở dạng BẢN NHÁP, theo yêu cầu của người dùng (M5, M7)
      const [transactions] = await db.query('SELECT id FROM transactions WHERE contract_id = ?', [id]);
      if (transactions.length > 0) {
        throw new Error('Cannot hard delete contract with linked financial transactions.');
      }
      const [overseasRecords] = await db.query('SELECT id FROM overseas_records WHERE contract_id = ?', [id]);
      if (overseasRecords.length > 0) {
        throw new Error('Cannot hard delete contract with linked overseas records.');
      }

      const [result] = await db.query('DELETE FROM contracts WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // --- Mẫu hợp đồng CRUD (dành cho Giai đoạn 2) ---
  static async createTemplate(templateData) {
    const { name, template_type, template_file_url, description } = templateData;
    try {
      const [existing] = await db.query('SELECT id FROM contract_templates WHERE name = ?', [name]);
      if (existing.length > 0) {
        throw new Error('Template name already exists.');
      }
      const [result] = await db.query(
        'INSERT INTO contract_templates (name, template_type, template_file_url, description) VALUES (?, ?, ?, ?)',
        [name, template_type, template_file_url, description]
      );
      return { id: result.insertId, ...templateData };
    } catch (error) {
      throw error;
    }
  }

  static async getTemplates({ page = 1, limit = 20, search = '' }) {
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM contract_templates WHERE 1=1';
    let countQuery = 'SELECT COUNT(id) AS total FROM contract_templates WHERE 1=1';
    const params = [];
    const countParams = [];

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      countQuery += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [templates] = await db.query(query, params);
    const [totalResult] = await db.query(countQuery, countParams);
    const total = totalResult[0].total;

    return {
      data: templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getTemplateById(id) {
    const [rows] = await db.query('SELECT * FROM contract_templates WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async updateTemplate(id, templateData) {
    const { name, template_type, template_file_url, description } = templateData;
    try {
        if (name) {
            const [existing] = await db.query('SELECT id FROM contract_templates WHERE name = ? AND id != ?', [name, id]);
            if (existing.length > 0) {
                throw new Error('Template name already exists.');
            }
        }
        const [result] = await db.query(
            'UPDATE contract_templates SET name = COALESCE(?, name), template_type = COALESCE(?, template_type), template_file_url = COALESCE(?, template_file_url), description = COALESCE(?, description) WHERE id = ?',
            [name, template_type, template_file_url, description, id]
        );
        return result.affectedRows > 0;
    } catch (error) {
        throw error;
    }
  }

  static async deleteTemplate(id) {
    const [result] = await db.query('DELETE FROM contract_templates WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Contract;