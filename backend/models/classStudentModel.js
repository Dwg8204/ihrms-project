const db = require('../config/db');

const CLASS_STUDENT_STATUSES = Object.freeze({
  STUDYING: 'STUDYING',
  DROPPED: 'DROPPED',
  GRADUATED: 'GRADUATED'
});

class ClassStudentModel {
  static async addStudent(data) {
    const {
      class_id,
      candidate_id,
      enroll_date = null,
      status = CLASS_STUDENT_STATUSES.STUDYING,
      attitude_note = null
    } = data;

    const [result] = await db.query(
      `
      INSERT INTO class_students
        (class_id, candidate_id, enroll_date, status, attitude_note)
      VALUES (?, ?, ?, ?, ?)
      `,
      [class_id, candidate_id, enroll_date, status, attitude_note]
    );

    return { id: result.insertId, ...data, status };
  }

  static async findByClassId({ class_id, page = 1, limit = 50, search = '' }) {
    const offset = (page - 1) * limit;
    const where = ['cs.class_id = ?'];
    const params = [class_id];

    if (search) {
      where.push('(c.full_name LIKE ? OR c.citizen_id LIKE ? OR c.phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM class_students cs
      JOIN candidates c ON cs.candidate_id = c.id
      ${whereSql}
      `,
      params
    );

    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.query(
      `
      SELECT
        cs.*, c.full_name AS candidate_name, c.citizen_id AS candidate_citizen_id,
        c.phone AS candidate_phone, c.status AS candidate_status
      FROM class_students cs
      JOIN candidates c ON cs.candidate_id = c.id
      ${whereSql}
      ORDER BY cs.enroll_date DESC, cs.id DESC
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
      SELECT cs.*
      FROM class_students cs
      WHERE cs.id = ?
      LIMIT 1
      `,
      [id]
    );
    return rows[0] || null;
  }

  static async update(id, data) {
    const updates = [];
    const values = [];

    const fields = ['enroll_date', 'status', 'attitude_note'];

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
      `UPDATE class_students SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM class_students WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = {
  ClassStudentModel,
  CLASS_STUDENT_STATUSES
};
