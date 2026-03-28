const db = require('../config/db');
const { CANDIDATE_STATUSES, STATUS_ORDER } = require('../utils/candidateStatus');

const ALLOWED_UPDATE_FIELDS = [
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
  'status',
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
      where.push('(c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
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

  create: async (candidateData) => {
    const query = `
      INSERT INTO candidates
      (
        full_name, dob, gender, phone, email, address, height, weight,
        blood_type, education_level, experience_summary, source_id, source_note,
        status, is_fee0_paid, fee0_paid_amount, fee0_paid_at, cv_file_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
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

    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(candidateData, field)) {
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

  updateStatus: async (id, status) => {
    const [result] = await db.query(
      `
      UPDATE candidates
      SET status = ?
      WHERE id = ?
      `,
      [status, id]
    );
    return result.affectedRows > 0;
  },

  deleteById: async (id) => {
    const [result] = await db.query(
      `
      DELETE FROM candidates
      WHERE id = ?
      `,
      [id]
    );
    return result.affectedRows > 0;
  },

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