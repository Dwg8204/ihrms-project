const db = require('../config/db');
const { extractTemplateVariables } = require('../utils/templateRenderer');

const EmailTemplate = {
  getAll: async ({ search = '', page = 1, limit = 50 }) => {
    const offset = (page - 1) * limit;
    const where = [];
    const params = [];

    if (search) {
      where.push('(template_code LIKE ? OR subject LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM email_templates ${whereSql}`,
      params
    );

    const [rows] = await db.query(
      `
      SELECT id, template_code, subject, body_html, created_at, updated_at
      FROM email_templates
      ${whereSql}
      ORDER BY updated_at DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const data = rows.map((row) => ({
      ...row,
      variables: extractTemplateVariables(`${row.subject || ''}\n${row.body_html || ''}`)
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total: Number(countRows[0]?.total || 0)
      }
    };
  },

  getById: async (id) => {
    const [rows] = await db.query(
      `
      SELECT id, template_code, subject, body_html, created_at, updated_at
      FROM email_templates
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    const row = rows[0] || null;
    if (!row) return null;

    return {
      ...row,
      variables: extractTemplateVariables(`${row.subject || ''}\n${row.body_html || ''}`)
    };
  },

  getByCode: async (templateCode, excludeId = null) => {
    let query = `
      SELECT id, template_code, subject, body_html, created_at, updated_at
      FROM email_templates
      WHERE template_code = ?
    `;
    const params = [templateCode];

    if (excludeId !== null) {
      query += ' AND id <> ?';
      params.push(excludeId);
    }

    query += ' LIMIT 1';

    const [rows] = await db.query(query, params);
    return rows[0] || null;
  },

  create: async ({ template_code, subject, body_html }) => {
    const [result] = await db.query(
      `
      INSERT INTO email_templates (template_code, subject, body_html)
      VALUES (?, ?, ?)
      `,
      [template_code, subject, body_html]
    );

    return result.insertId;
  },

  update: async (id, { template_code, subject, body_html }) => {
    const [result] = await db.query(
      `
      UPDATE email_templates
      SET template_code = ?, subject = ?, body_html = ?
      WHERE id = ?
      `,
      [template_code, subject, body_html, id]
    );

    return result.affectedRows > 0;
  },

  deleteById: async (id) => {
    const [result] = await db.query('DELETE FROM email_templates WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
};

module.exports = EmailTemplate;
