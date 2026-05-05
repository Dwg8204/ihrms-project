const db = require('../config/db');

const Transaction = {
  create: async (data) => {
    const {
      candidate_id, contract_id, fee_standard_id, payment_schedule_id,
      amount_paid, transaction_type, note, receipt_image_url,
      approved_by_user_id, is_reconciled
    } = data;

    const query = `
      INSERT INTO transactions (
        candidate_id, contract_id, fee_standard_id, payment_schedule_id,
        amount_paid, transaction_type, note, receipt_image_url,
        approved_by_user_id, is_reconciled, transaction_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const [result] = await db.query(query, [
      candidate_id, contract_id, fee_standard_id, payment_schedule_id,
      amount_paid, transaction_type, note, receipt_image_url,
      approved_by_user_id, is_reconciled || false
    ]);
    return { id: result.insertId, ...data };
  },

  findAll: async ({ page = 1, limit = 50, candidate_id = null, contract_id = null, transaction_type = null }) => {
    const offset = (page - 1) * limit;
    let query = 'SELECT t.*, c.full_name as candidate_name FROM transactions t JOIN candidates c ON t.candidate_id = c.id WHERE 1=1';
    const params = [];

    if (candidate_id) {
      query += ' AND t.candidate_id = ?';
      params.push(candidate_id);
    }
    if (contract_id) {
      query += ' AND t.contract_id = ?';
      params.push(contract_id);
    }
    if (transaction_type) {
      query += ' AND t.transaction_type = ?';
      params.push(transaction_type);
    }

    query += ' ORDER BY t.transaction_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(query, params);
    return rows;
  },

  getSummaryByCandidate: async (candidateId) => {
    const query = `
      SELECT 
        SUM(CASE WHEN transaction_type = 'INCOME' THEN amount_paid ELSE 0 END) as total_income,
        SUM(CASE WHEN transaction_type = 'REFUND' THEN amount_paid ELSE 0 END) as total_refund
      FROM transactions 
      WHERE candidate_id = ?
    `;
    const [rows] = await db.query(query, [candidateId]);
    return rows[0];
  }
};

module.exports = Transaction;
