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

  findAll: async ({ page = 1, limit = 50, candidate_id = null, contract_id = null, transaction_type = null, date_from = null, date_to = null, candidate_name = null }) => {
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
    if (date_from) {
      query += ' AND DATE(t.transaction_date) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      query += ' AND DATE(t.transaction_date) <= ?';
      params.push(date_to);
    }
    if (candidate_name) {
      query += ' AND (c.full_name LIKE ? OR t.note LIKE ?)';
      params.push(`%${candidate_name}%`, `%${candidate_name}%`);
    }

    query += ' ORDER BY t.transaction_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(query, params);
    return rows;
  },

  getGlobalSummary: async ({ date_from = null, date_to = null } = {}) => {
    let where = 'WHERE 1=1';
    const params = [];
    if (date_from) { where += ' AND DATE(transaction_date) >= ?'; params.push(date_from); }
    if (date_to)   { where += ' AND DATE(transaction_date) <= ?'; params.push(date_to); }
    const [rows] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN transaction_type = 'INCOME' THEN amount_paid ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN transaction_type = 'REFUND' THEN amount_paid ELSE 0 END), 0) AS total_refund,
        COUNT(*) AS total_transactions,
        COUNT(DISTINCT candidate_id) AS total_candidates
      FROM transactions ${where}
    `, params);
    return rows[0];
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
