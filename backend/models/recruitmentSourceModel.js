const db = require('../config/db');

const RecruitmentSource = {
  getAll: async ({ search = '', page = 1, limit = 20 }) => {
    const offset = (page - 1) * limit;
    const where = [];
    const params = [];

    if (search) {
      where.push('rs.source_name LIKE ?');
      params.push(`%${search}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM recruitment_sources rs
      ${whereSql}
    `;
    const [countRows] = await db.query(countQuery, params);
    const total = Number(countRows[0].total || 0);

    const dataQuery = `
      SELECT
        rs.id,
        rs.source_name,
        COUNT(c.id) AS candidate_count
      FROM recruitment_sources rs
      LEFT JOIN candidates c ON c.source_id = rs.id
      ${whereSql}
      GROUP BY rs.id, rs.source_name
      ORDER BY rs.id DESC
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
      SELECT id, source_name
      FROM recruitment_sources
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );
    return rows[0] || null;
  },

  existsByName: async (sourceName, excludeId = null) => {
    let query = `
      SELECT id
      FROM recruitment_sources
      WHERE source_name = ?
    `;
    const params = [sourceName];

    if (excludeId !== null) {
      query += ' AND id <> ?';
      params.push(excludeId);
    }

    query += ' LIMIT 1';

    const [rows] = await db.query(query, params);
    return rows.length > 0;
  },

  create: async ({ source_name }) => {
    const [result] = await db.query(
      `
      INSERT INTO recruitment_sources (source_name)
      VALUES (?)
      `,
      [source_name]
    );
    return result.insertId;
  },

  update: async (id, { source_name }) => {
    const [result] = await db.query(
      `
      UPDATE recruitment_sources
      SET source_name = ?
      WHERE id = ?
      `,
      [source_name, id]
    );
    return result.affectedRows > 0;
  },

  isInUse: async (id) => {
    const [rows] = await db.query(
      `
      SELECT 1
      FROM candidates
      WHERE source_id = ?
      LIMIT 1
      `,
      [id]
    );
    return rows.length > 0;
  },

  deleteById: async (id) => {
    const [result] = await db.query(
      `
      DELETE FROM recruitment_sources
      WHERE id = ?
      `,
      [id]
    );
    return result.affectedRows > 0;
  }
};

module.exports = RecruitmentSource;