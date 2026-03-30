const db = require('../config/db');
const { JOB_ORDER_STATUSES } = require('../utils/jobOrderStatus');

const EXAM_RESULT_STATUSES = Object.freeze({
    PASS: 'Pass',
    FAIL: 'Fail',
    RESERVE: 'Reserve',
    PENDING: 'Pending' // Mặc định khi mới tạo
});

class ExamApplication {
    static async create(examAppData) {
        const { candidate_id, job_order_id, exam_date, note } = examAppData;
        try {
            // Xác thực sự tồn tại của ứng viên và trạng thái cho phép khớp
            const [candidate] = await db.query('SELECT id, status FROM candidates WHERE id = ?', [candidate_id]);
            if (candidate.length === 0) {
                throw new Error('Candidate not found.');
            }
            if (candidate[0].status !== 'WAITING_FORM_MATCH') {
                throw new Error(`Candidate must be in WAITING_FORM_MATCH status to be added to exam list. Current status: ${candidate[0].status}`);
            }

            // Xác thực xem lệnh công việc có tồn tại và OPEN hay không
            const [jobOrder] = await db.query('SELECT id, status FROM job_orders WHERE id = ?', [job_order_id]);
            if (jobOrder.length === 0) {
                throw new Error('Job Order not found.');
            }
            if (jobOrder[0].status !== JOB_ORDER_STATUSES.OPEN) {
                throw new Error(`Job Order must be in OPEN status. Current status: ${jobOrder[0].status}`);
            }
            
            // Kiểm tra xem ứng viên đã tham gia kỳ thi cho vị trí tuyển dụng này chưa
            const [existingApp] = await db.query('SELECT id FROM exam_applications WHERE candidate_id = ? AND job_order_id = ?', [candidate_id, job_order_id]);
            if (existingApp.length > 0) {
                throw new Error('Candidate is already registered for an exam with this job order.');
            }

            const [result] = await db.query(
                'INSERT INTO exam_applications (candidate_id, job_order_id, exam_date, result_status, note) VALUES (?, ?, ?, ?, ?)',
                [candidate_id, job_order_id, exam_date, EXAM_RESULT_STATUSES.PENDING, note]
            );
            return { id: result.insertId, ...examAppData, result_status: EXAM_RESULT_STATUSES.PENDING };
        } catch (error) {
            throw error;
        }
    }

    static async findAll({ page = 1, limit = 20, search = '', candidate_id = null, job_order_id = null, result_status = '' }) {
        const offset = (page - 1) * limit;
        const where = [];
        const params = [];

        let query = `
            SELECT
                ea.*,
                c.full_name AS candidate_name,
                c.status AS candidate_status,
                jo.job_title,
                jo.partner_id,
                p.name AS partner_name
            FROM exam_applications ea
            JOIN candidates c ON ea.candidate_id = c.id
            JOIN job_orders jo ON ea.job_order_id = jo.id
            LEFT JOIN partners p ON jo.partner_id = p.id
            WHERE 1=1
        `;
        let countQuery = `
            SELECT COUNT(ea.id) AS total
            FROM exam_applications ea
            JOIN candidates c ON ea.candidate_id = c.id
            JOIN job_orders jo ON ea.job_order_id = jo.id
            LEFT JOIN partners p ON jo.partner_id = p.id
            WHERE 1=1
        `;

        if (search) {
            where.push('(c.full_name LIKE ? OR jo.job_title LIKE ? OR p.name LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (candidate_id) {
            where.push('ea.candidate_id = ?');
            params.push(candidate_id);
        }
        if (job_order_id) {
            where.push('ea.job_order_id = ?');
            params.push(job_order_id);
        }
        if (result_status) {
            where.push('ea.result_status = ?');
            params.push(result_status);
        }

        const whereSql = where.length ? ` AND ${where.join(' AND ')}` : '';
        query += whereSql + ' ORDER BY ea.exam_date DESC LIMIT ? OFFSET ?';
        countQuery += whereSql;

        const [countRows] = await db.query(countQuery, params);
        const total = Number(countRows[0].total || 0);

        const [rows] = await db.query(query, [...params, limit, offset]);

        return {
            data: rows.map(row => ({
                ...row,
                score_details: row.score_details ? JSON.parse(row.score_details) : null
            })),
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
                ea.*,
                c.full_name AS candidate_name,
                c.status AS candidate_status,
                jo.job_title,
                jo.partner_id,
                p.name AS partner_name
            FROM exam_applications ea
            JOIN candidates c ON ea.candidate_id = c.id
            JOIN job_orders jo ON ea.job_order_id = jo.id
            LEFT JOIN partners p ON jo.partner_id = p.id
            WHERE ea.id = ?
            LIMIT 1
            `,
            [id]
        );
        if (rows[0]) {
            rows[0].score_details = rows[0].score_details ? JSON.parse(rows[0].score_details) : null;
        }
        return rows[0] || null;
    }

    static async updateResult(id, resultData) {
        const { result_status, score_details, note } = resultData;
        
        // Xác thực trạng thái kết quả
        if (!Object.values(EXAM_RESULT_STATUSES).includes(result_status)) {
            throw new Error('Invalid result status.');
        }

        // Kiểm tra xem đơn đăng ký thi có tồn tại và đang ở trạng thái PENDING hay không
        const currentExamApp = await this.findById(id);
        if (!currentExamApp) {
            throw new Error('Exam application not found.');
        }
        if (currentExamApp.result_status !== EXAM_RESULT_STATUSES.PENDING) {
            throw new Error(`Exam result already updated to ${currentExamApp.result_status}.`);
        }

        let scoreDetailsJson = null;
        if (score_details) {
            if (typeof score_details === 'object') {
                scoreDetailsJson = JSON.stringify(score_details);
            } else {
                throw new Error('score_details must be a valid JSON object.');
            }
        }

        const [result] = await db.query(
            'UPDATE exam_applications SET result_status = ?, score_details = COALESCE(?, score_details), note = COALESCE(?, note) WHERE id = ?',
            [result_status, scoreDetailsJson, note, id]
        );
        return result.affectedRows > 0;
    }

    // Phương pháp này xử lý việc "hoàn tác" một ứng dụng thi, ví dụ, nếu kết quả được nhập sai
    static async resetResult(id) {
        const [result] = await db.query(
            'UPDATE exam_applications SET result_status = ?, score_details = NULL, note = NULL WHERE id = ?',
            [EXAM_RESULT_STATUSES.PENDING, id]
        );
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await db.query('DELETE FROM exam_applications WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
}

module.exports = ExamApplication;