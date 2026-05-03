const db = require('../config/db');

const EmailRecipient = {
  getCandidatesForManualSend: async (candidateIds = []) => {
    if (!candidateIds.length) return [];

    const placeholders = candidateIds.map(() => '?').join(', ');

    const [rows] = await db.query(
      `
      SELECT
        c.id,
        c.full_name,
        c.email,
        c.phone,
        c.citizen_id,
        c.status,
        latest_exam.exam_date,
        jo.job_title AS job_name
      FROM candidates c
      LEFT JOIN (
        SELECT ea.candidate_id, ea.job_order_id, ea.exam_date
        FROM exam_applications ea
        INNER JOIN (
          SELECT candidate_id, MAX(exam_date) AS max_exam_date
          FROM exam_applications
          GROUP BY candidate_id
        ) latest ON latest.candidate_id = ea.candidate_id AND latest.max_exam_date = ea.exam_date
      ) latest_exam ON latest_exam.candidate_id = c.id
      LEFT JOIN job_orders jo ON jo.id = latest_exam.job_order_id
      WHERE c.id IN (${placeholders})
      `,
      candidateIds
    );

    return rows;
  }
};

module.exports = EmailRecipient;
