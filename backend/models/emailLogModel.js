const db = require('../config/db');

const EMAIL_STATUSES = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED'
};

const EmailLog = {
  createPending: async ({ candidateId, templateId }) => {
    const [result] = await db.query(
      `
      INSERT INTO email_logs (candidate_id, template_id, sent_at, status, error_message)
      VALUES (?, ?, NULL, ?, NULL)
      `,
      [candidateId, templateId, EMAIL_STATUSES.PENDING]
    );

    return result.insertId;
  },

  markResult: async ({ logId, status, errorMessage = null }) => {
    await db.query(
      `
      UPDATE email_logs
      SET sent_at = NOW(), status = ?, error_message = ?
      WHERE id = ?
      `,
      [status, errorMessage, logId]
    );
  },

  getAll: async ({ page = 1, limit = 50, status = '', candidateId = null }) => {
    const offset = (page - 1) * limit;
    const where = [];
    const params = [];

    if (status) {
      where.push('el.status = ?');
      params.push(status);
    }

    if (candidateId !== null && candidateId !== undefined) {
      where.push('el.candidate_id = ?');
      params.push(candidateId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM email_logs el ${whereSql}`,
      params
    );

    const [rows] = await db.query(
      `
      SELECT
        el.id,
        el.candidate_id,
        el.template_id,
        el.sent_at,
        el.status,
        el.error_message,
        c.full_name,
        c.email,
        et.template_code,
        et.subject
      FROM email_logs el
      LEFT JOIN candidates c ON c.id = el.candidate_id
      LEFT JOIN email_templates et ON et.id = el.template_id
      ${whereSql}
      ORDER BY el.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(countRows[0]?.total || 0)
      }
    };
  }
};

module.exports = {
  EmailLog,
  EMAIL_STATUSES
};
