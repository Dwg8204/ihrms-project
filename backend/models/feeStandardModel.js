const db = require('../config/db');

const FeeStandard = {
  create: async (data) => {
    const {
      job_order_id, fee_name, amount, fee_category,
      is_refundable_on_fail_exam, refund_pct_on_fail_exam,
      is_refundable_on_withdrawal, refund_pct_on_withdrawal,
      is_refundable_on_no_go, refund_pct_on_no_go,
      is_mandatory_for_exit, due_event
    } = data;
    
    const query = `
      INSERT INTO fee_standards (
        job_order_id, fee_name, amount, fee_category,
        is_refundable_on_fail_exam, refund_pct_on_fail_exam,
        is_refundable_on_withdrawal, refund_pct_on_withdrawal,
        is_refundable_on_no_go, refund_pct_on_no_go,
        is_mandatory_for_exit, due_event
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      job_order_id, fee_name, amount, fee_category,
      is_refundable_on_fail_exam, refund_pct_on_fail_exam,
      is_refundable_on_withdrawal, refund_pct_on_withdrawal,
      is_refundable_on_no_go, refund_pct_on_no_go,
      is_mandatory_for_exit, due_event
    ]);
    return { id: result.insertId, ...data };
  },

  findAll: async ({ page = 1, limit = 100, search = '', job_order_id = null, fee_category = null }) => {
    const validPage = Math.max(1, parseInt(page) || 1);
    const validLimit = Math.max(1, parseInt(limit) || 100);
    const offset = (validPage - 1) * validLimit;
    let query = `
      SELECT fs.*, jo.job_title 
      FROM fee_standards fs
      LEFT JOIN job_orders jo ON fs.job_order_id = jo.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND fs.fee_name LIKE ?';
      params.push(`%${search}%`);
    }
    if (job_order_id !== null) {
      query += ' AND (fs.job_order_id = ? OR fs.job_order_id IS NULL)';
      params.push(job_order_id);
    }
    if (fee_category) {
      query += ' AND fs.fee_category = ?';
      params.push(fee_category);
    }

    query += ' ORDER BY fs.id DESC LIMIT ? OFFSET ?';
    params.push(validLimit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  },

  findById: async (id) => {
    const [rows] = await db.query('SELECT * FROM fee_standards WHERE id = ?', [id]);
    return rows[0];
  },

  update: async (id, data) => {
    const query = 'UPDATE fee_standards SET ? WHERE id = ?';
    await db.query(query, [data, id]);
    return { id, ...data };
  },

  delete: async (id) => {
    // Check if used in payment_schedules
    const [usage] = await db.query('SELECT id FROM payment_schedules WHERE original_fee_standard_id = ? LIMIT 1', [id]);
    if (usage.length > 0) {
      throw new Error('Cannot delete fee standard as it is referenced in payment schedules.');
    }
    await db.query('DELETE FROM fee_standards WHERE id = ?', [id]);
    return true;
  },

  getFeeStandardsByEvent: async (jobOrderId = null, contractType = null, event) => {
    let query = 'SELECT * FROM fee_standards WHERE due_event = ?';
    const params = [event];
    
    if (jobOrderId) {
      query += ' AND (job_order_id = ? OR job_order_id IS NULL)';
      params.push(jobOrderId);
    } else {
      query += ' AND job_order_id IS NULL';
    }

    if (contractType) {
      query += ' AND (contract_type = ? OR contract_type IS NULL)';
      params.push(contractType);
    }

    const [rows] = await db.query(query, params);
    return rows;
  }
};

module.exports = FeeStandard;
