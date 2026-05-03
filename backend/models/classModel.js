const db = require('../config/db');

const CLASS_TYPES = Object.freeze({
  LANGUAGE: 'LANGUAGE',
  SKILL: 'SKILL'
});

const CLASS_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED'
});

class ClassModel {
  static async create(data) {
    const {
      class_name,
      class_type,
      teacher_id,
      room = null,
      start_date = null,
      end_date = null,
      status = CLASS_STATUSES.PENDING
    } = data;

    const [result] = await db.query(
      `
      INSERT INTO classes (class_name, class_type, teacher_id, room, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [class_name, class_type, teacher_id, room, start_date, end_date, status]
    );

    return { id: result.insertId, ...data, status };
  }

  static async findAll({ page = 1, limit = 20, search = '', status = '', class_type = '', teacher_id = null }) {
    const offset = (page - 1) * limit;
    const where = ['1=1'];
    const params = [];

    if (search) {
      where.push('(c.class_name LIKE ? OR t.full_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      where.push('c.status = ?');
      params.push(status);
    }

    if (class_type) {
      where.push('c.class_type = ?');
      params.push(class_type);
    }

    if (teacher_id) {
      where.push('c.teacher_id = ?');
      params.push(teacher_id);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM classes c
      JOIN teachers t ON c.teacher_id = t.id
      ${whereSql}
      `,
      params
    );

    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.query(
      `
      SELECT
        c.*, t.full_name AS teacher_name, t.teacher_type, t.employment_type
      FROM classes c
      JOIN teachers t ON c.teacher_id = t.id
      ${whereSql}
      ORDER BY c.start_date DESC, c.id DESC
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
    const [rows] = await db.query(
      `
      SELECT
        c.*, t.full_name AS teacher_name, t.teacher_type, t.employment_type
      FROM classes c
      JOIN teachers t ON c.teacher_id = t.id
      WHERE c.id = ?
      LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  }

  static async update(id, data) {
    const updates = [];
    const values = [];

    const fields = [
      'class_name',
      'class_type',
      'teacher_id',
      'room',
      'start_date',
      'end_date',
      'status'
    ];

    fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updates.push(`c.${field} = ?`);
        values.push(data[field]);
      }
    });

    if (!updates.length) {
      return false;
    }

    values.push(id);

    const [result] = await db.query(
      `UPDATE classes c SET ${updates.join(', ')} WHERE c.id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [studentRows] = await db.query(
      'SELECT id FROM class_students WHERE class_id = ? LIMIT 1',
      [id]
    );
    if (studentRows.length > 0) {
      throw new Error('Cannot delete class with enrolled students.');
    }

    const [result] = await db.query('DELETE FROM classes WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async updateStartedClasses() {
    const [result] = await db.query(
      `
      UPDATE classes
      SET status = ?
      WHERE status = ?
        AND start_date IS NOT NULL
        AND start_date <= CURDATE()
      `,
      [CLASS_STATUSES.IN_PROGRESS, CLASS_STATUSES.PENDING]
    );

    return result.affectedRows || 0;
  }
}

module.exports = {
  ClassModel,
  CLASS_TYPES,
  CLASS_STATUSES
};
