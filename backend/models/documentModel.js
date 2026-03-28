const db = require('../config/db');

const DOCUMENT_PHASES = Object.freeze({
  PRE_EXAM: 'PRE_EXAM',
  POST_EXAM: 'POST_EXAM'
});

const DOCUMENT_STATUSES = Object.freeze({
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  SUBMITTED: 'SUBMITTED',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED'
});

const DocumentModel = {
  getDocumentTypes: async ({ phase = null }) => {
    const where = [];
    const params = [];

    if (phase) {
      where.push('phase = ?');
      params.push(phase);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await db.query(
      `
      SELECT
        id,
        code,
        name,
        phase,
        is_mandatory,
        is_required_for_gate,
        warning_before_days,
        display_order
      FROM document_types
      ${whereSql}
      ORDER BY display_order ASC, id ASC
      `,
      params
    );

    return rows;
  },

  initCandidateDocuments: async ({ candidateId, phase = DOCUMENT_PHASES.PRE_EXAM }) => {
    const [result] = await db.query(
      `
      INSERT INTO candidate_documents (candidate_id, document_type_id, status)
      SELECT ?, dt.id, ?
      FROM document_types dt
      LEFT JOIN candidate_documents cd
        ON cd.candidate_id = ?
       AND cd.document_type_id = dt.id
      WHERE dt.phase = ?
        AND cd.id IS NULL
      `,
      [candidateId, DOCUMENT_STATUSES.NOT_SUBMITTED, candidateId, phase]
    );

    return result.affectedRows || 0;
  },

  getCandidateDocuments: async ({ candidateId, phase = null }) => {
    const where = ['1=1'];
    const params = [candidateId];

    if (phase) {
      where.push('dt.phase = ?');
      params.push(phase);
    }

    const [rows] = await db.query(
      `
      SELECT
        dt.id AS document_type_id,
        dt.code,
        dt.name,
        dt.phase,
        dt.is_mandatory,
        dt.is_required_for_gate,
        dt.warning_before_days,
        dt.display_order,
        cd.id AS candidate_document_id,
        COALESCE(cd.status, 'NOT_SUBMITTED') AS status,
        cd.issue_date,
        cd.expiration_date,
        cd.expected_complete_date,
        cd.submitted_at,
        cd.verified_at,
        cd.file_url,
        cd.rejected_reason,
        cd.note
      FROM document_types dt
      LEFT JOIN candidate_documents cd
        ON cd.document_type_id = dt.id
       AND cd.candidate_id = ?
      WHERE ${where.join(' AND ')}
      ORDER BY dt.display_order ASC, dt.id ASC
      `,
      params
    );

    return rows;
  },

  getDocumentTypeByCode: async (code) => {
    const [rows] = await db.query(
      `
      SELECT id, code, name, phase, is_required_for_gate
      FROM document_types
      WHERE code = ?
      LIMIT 1
      `,
      [code]
    );
    return rows[0] || null;
  },

  getCandidateDocumentByCode: async ({ candidateId, code }) => {
    const [rows] = await db.query(
      `
      SELECT
        dt.code,
        dt.name,
        dt.phase,
        dt.is_required_for_gate,
        cd.id AS candidate_document_id,
        cd.status,
        cd.issue_date,
        cd.expiration_date,
        cd.expected_complete_date,
        cd.submitted_at,
        cd.verified_at,
        cd.file_url,
        cd.rejected_reason,
        cd.note
      FROM document_types dt
      LEFT JOIN candidate_documents cd
        ON cd.document_type_id = dt.id
       AND cd.candidate_id = ?
      WHERE dt.code = ?
      LIMIT 1
      `,
      [candidateId, code]
    );

    return rows[0] || null;
  },

  updateCandidateDocumentByCode: async ({ candidateId, code, data }) => {
    const type = await DocumentModel.getDocumentTypeByCode(code);
    if (!type) return null;

    await db.query(
      `
      INSERT INTO candidate_documents (candidate_id, document_type_id, status)
      VALUES (?, ?, 'NOT_SUBMITTED')
      ON DUPLICATE KEY UPDATE candidate_id = candidate_id
      `,
      [candidateId, type.id]
    );

    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(data, 'status')) {
      updates.push('status = ?');
      values.push(data.status);

      if (data.status === DOCUMENT_STATUSES.SUBMITTED) {
        updates.push('submitted_at = COALESCE(submitted_at, NOW())');
      }

      if (data.status === DOCUMENT_STATUSES.VERIFIED) {
        updates.push('verified_at = NOW()');
      }
    }

    if (Object.prototype.hasOwnProperty.call(data, 'issue_date')) {
      updates.push('issue_date = ?');
      values.push(data.issue_date || null);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'expiration_date')) {
      updates.push('expiration_date = ?');
      values.push(data.expiration_date || null);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'expected_complete_date')) {
      updates.push('expected_complete_date = ?');
      values.push(data.expected_complete_date || null);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'file_url')) {
      updates.push('file_url = ?');
      values.push(data.file_url || null);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'rejected_reason')) {
      updates.push('rejected_reason = ?');
      values.push(data.rejected_reason || null);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'note')) {
      updates.push('note = ?');
      values.push(data.note || null);
    }

    if (updates.length) {
      values.push(candidateId, type.id);
      await db.query(
        `
        UPDATE candidate_documents
        SET ${updates.join(', ')}
        WHERE candidate_id = ? AND document_type_id = ?
        `,
        values
      );
    }

    return DocumentModel.getCandidateDocumentByCode({ candidateId, code });
  },

  getPreExamReadiness: async (candidateId) => {
    const [rows] = await db.query(
      `
      SELECT
        dt.code,
        dt.name,
        COALESCE(cd.status, 'NOT_SUBMITTED') AS status
      FROM document_types dt
      LEFT JOIN candidate_documents cd
        ON cd.document_type_id = dt.id
       AND cd.candidate_id = ?
      WHERE dt.phase = 'PRE_EXAM'
        AND dt.is_required_for_gate = 1
      ORDER BY dt.display_order ASC, dt.id ASC
      `,
      [candidateId]
    );

    const required_total = rows.length;
    const verified_total = rows.filter((r) => r.status === DOCUMENT_STATUSES.VERIFIED).length;
    const missing_documents = rows.filter((r) => r.status !== DOCUMENT_STATUSES.VERIFIED);

    return {
      required_total,
      verified_total,
      can_proceed: required_total > 0 && required_total === verified_total,
      missing_documents
    };
  },

  getHealthExpiryAlerts: async (days = 30) => {
    const [rows] = await db.query(
      `
      SELECT
        c.id AS candidate_id,
        c.full_name,
        dt.code AS document_code,
        dt.name AS document_name,
        cd.expiration_date,
        DATEDIFF(cd.expiration_date, CURDATE()) AS days_left
      FROM candidate_documents cd
      JOIN document_types dt ON dt.id = cd.document_type_id
      JOIN candidates c ON c.id = cd.candidate_id
      WHERE dt.code = 'PRE_HEALTH_CERT'
        AND cd.status = 'VERIFIED'
        AND cd.expiration_date IS NOT NULL
        AND cd.expiration_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY cd.expiration_date ASC
      `,
      [days]
    );

    return rows.map((row) => ({
      ...row,
      alert_level: row.days_left < 0 ? 'EXPIRED' : 'EXPIRING_SOON'
    }));
  },

  getVisaDelayAlerts: async () => {
    const [rows] = await db.query(
      `
      SELECT
        c.id AS candidate_id,
        c.full_name,
        dt.code AS document_code,
        dt.name AS document_name,
        cd.status,
        cd.expected_complete_date,
        DATEDIFF(CURDATE(), cd.expected_complete_date) AS overdue_days
      FROM candidate_documents cd
      JOIN document_types dt ON dt.id = cd.document_type_id
      JOIN candidates c ON c.id = cd.candidate_id
      WHERE dt.code = 'POST_VISA'
        AND cd.status <> 'VERIFIED'
        AND cd.expected_complete_date IS NOT NULL
        AND cd.expected_complete_date < CURDATE()
      ORDER BY overdue_days DESC
      `
    );

    return rows;
  },

  DOCUMENT_PHASES,
  DOCUMENT_STATUSES
};

module.exports = DocumentModel;