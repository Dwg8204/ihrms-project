const db = require('../config/db');

const TEACHER_TYPES = Object.freeze({
  LANGUAGE: 'LANGUAGE',
  SKILL: 'SKILL'
});

const EMPLOYMENT_TYPES = Object.freeze({
  FULL_TIME: 'FULL_TIME',
  VISITING: 'VISITING'
});

const TEACHER_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
});

class Teacher {
  static async create(data) {
    const {
      full_name,
      phone = null,
      email = null,
      teacher_type,
      employment_type,
      status = TEACHER_STATUSES.ACTIVE
    } = data;

    const [result] = await db.query(
      `
      INSERT INTO teachers (full_name, phone, email, teacher_type, employment_type, status)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [full_name, phone, email, teacher_type, employment_type, status]
    );

    return { id: result.insertId, ...data, status };
  }

  static async findAll({ page = 1, limit = 20, search = '', status = '', teacher_type = '' }) {
    const offset = (page - 1) * limit;
    const where = ['1=1'];
    const params = [];

    if (search) {
      where.push('(full_name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      where.push('status = ?');
      params.push(status);
    }

    if (teacher_type) {
      where.push('teacher_type = ?');
      params.push(teacher_type);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM teachers ${whereSql}`,
      params
    );

    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.query(
      `
      SELECT *
      FROM teachers
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total
      }
    };
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM teachers WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  static async update(id, data) {
    const updates = [];
    const values = [];

    const fields = [
      'full_name',
      'phone',
      'email',
      'teacher_type',
      'employment_type',
      'status'
    ];

    fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    });

    if (!updates.length) {
      return false;
    }

    values.push(id);

    const [result] = await db.query(
      `UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [classRows] = await db.query(
      'SELECT id FROM classes WHERE teacher_id = ? LIMIT 1',
      [id]
    );
    if (classRows.length > 0) {
      throw new Error('Cannot delete teacher with assigned classes.');
    }

    const [result] = await db.query('DELETE FROM teachers WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = {
  Teacher,
  TEACHER_TYPES,
  EMPLOYMENT_TYPES,
  TEACHER_STATUSES
};
