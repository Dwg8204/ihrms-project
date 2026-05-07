const db = require('../config/db');
const { JOB_ORDER_STATUSES } = require('../utils/jobOrderStatus');
const { isFutureDateTime } = require('../utils/inputValidation');

const EXAM_RESULT_STATUSES = Object.freeze({
    PASS: 'Pass',
    FAIL: 'Fail',
    RESERVE: 'Reserve',
    PENDING: 'Pending' // Mặc định khi mới tạo
});

class ExamApplication {
    static assertFutureExamDate(examDate) {
        // Cho phép để trống khi mới ghép đơn hàng (đối khớp thủ công)
        if (!examDate) return;
        
        if (!isFutureDateTime(examDate)) {
            throw new Error('exam_date must be a valid future date/time.');
        }
    }

    static buildSessionKey(timestamp, jobOrderId) {
        return `${timestamp}_${jobOrderId}`;
    }

    static parseSessionKey(sessionKey) {
        const [timestampRaw, jobOrderRaw] = String(sessionKey || '').split('_');
        const timestamp = Number.parseInt(timestampRaw, 10);
        const jobOrderId = Number.parseInt(jobOrderRaw, 10);

        if (!Number.isInteger(timestamp) || timestamp <= 0 || !Number.isInteger(jobOrderId) || jobOrderId <= 0) {
            throw new Error('sessionKey must follow format <timestamp>_<jobOrderId>.');
        }

        return { timestamp, jobOrderId };
    }

    static async create(examAppData) {
        const { candidate_id, job_order_id, exam_date, note } = examAppData;
        try {
            this.assertFutureExamDate(exam_date);

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
                c.citizen_id AS candidate_citizen_id,
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

    static async findSessions({ view = 'all', search = '' }) {
        const where = ['ea.exam_date IS NOT NULL'];
        const params = [];

        if (search) {
            where.push('(jo.job_title LIKE ? OR p.name LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        let havingSql = '';
        if (view === 'schedule') {
            havingSql = "HAVING SUM(CASE WHEN ea.result_status = 'Pending' THEN 1 ELSE 0 END) > 0";
        }

        const [rows] = await db.query(
            `
            SELECT
                CONCAT(UNIX_TIMESTAMP(ea.exam_date), '_', ea.job_order_id) AS session_key,
                ea.exam_date,
                ea.job_order_id,
                jo.job_title,
                p.name AS partner_name,
                COUNT(*) AS total_candidates,
                SUM(CASE WHEN ea.result_status = 'Pending' THEN 1 ELSE 0 END) AS pending_candidates,
                SUM(CASE WHEN ea.result_status = 'Pass' THEN 1 ELSE 0 END) AS passed_candidates,
                SUM(CASE WHEN ea.result_status = 'Fail' THEN 1 ELSE 0 END) AS failed_candidates,
                SUM(CASE WHEN ea.result_status = 'Reserve' THEN 1 ELSE 0 END) AS reserve_candidates
            FROM exam_applications ea
            JOIN job_orders jo ON ea.job_order_id = jo.id
            LEFT JOIN partners p ON jo.partner_id = p.id
            WHERE ${where.join(' AND ')}
            GROUP BY ea.exam_date, ea.job_order_id, jo.job_title, p.name
            ${havingSql}
            ORDER BY ea.exam_date DESC, ea.job_order_id ASC
            `,
            params
        );

        return rows;
    }

    static async findSessionDetail(sessionKey) {
        const { timestamp, jobOrderId } = this.parseSessionKey(sessionKey);

        const [rows] = await db.query(
            `
            SELECT
                CONCAT(UNIX_TIMESTAMP(ea.exam_date), '_', ea.job_order_id) AS session_key,
                ea.exam_date,
                ea.id,
                ea.candidate_id,
                ea.job_order_id,
                ea.result_status,
                ea.note,
                ea.score_details,
                c.full_name AS candidate_name,
                c.citizen_id AS candidate_citizen_id,
                c.phone AS candidate_phone,
                c.email AS candidate_email,
                c.status AS candidate_status,
                jo.job_title,
                jo.partner_id,
                p.name AS partner_name
            FROM exam_applications ea
            JOIN candidates c ON ea.candidate_id = c.id
            JOIN job_orders jo ON ea.job_order_id = jo.id
            LEFT JOIN partners p ON jo.partner_id = p.id
            WHERE UNIX_TIMESTAMP(ea.exam_date) = ? AND ea.job_order_id = ?
            ORDER BY c.full_name ASC, ea.id ASC
            `,
            [timestamp, jobOrderId]
        );

        if (!rows.length) {
            return null;
        }

        return {
            session_key: rows[0].session_key,
            exam_date: rows[0].exam_date,
            job_order_id: rows[0].job_order_id,
            job_title: rows[0].job_title,
            partner_name: rows[0].partner_name,
            total_candidates: rows.length,
            pending_candidates: rows.filter((row) => row.result_status === 'Pending').length,
            passed_candidates: rows.filter((row) => row.result_status === 'Pass').length,
            failed_candidates: rows.filter((row) => row.result_status === 'Fail').length,
            reserve_candidates: rows.filter((row) => row.result_status === 'Reserve').length,
            candidates: rows.map((row) => ({
                id: row.id,
                candidate_id: row.candidate_id,
                candidate_name: row.candidate_name,
                candidate_citizen_id: row.candidate_citizen_id,
                candidate_phone: row.candidate_phone,
                candidate_email: row.candidate_email,
                candidate_status: row.candidate_status,
                job_order_id: row.job_order_id,
                job_title: row.job_title,
                partner_id: row.partner_id,
                partner_name: row.partner_name,
                result_status: row.result_status,
                note: row.note,
                score_details: row.score_details ? JSON.parse(row.score_details) : null,
                exam_date: row.exam_date
            }))
        };
    }

    static async findById(id) {
        const [rows] = await db.query(
            `
            SELECT
                ea.*,
                c.full_name AS candidate_name,
                c.citizen_id AS candidate_citizen_id,
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

        // Kiểm tra xem đơn đăng ký thi có tồn tại hay không
        const currentExamApp = await this.findById(id);
        if (!currentExamApp) {
            throw new Error('Exam application not found.');
        }
        if (currentExamApp.result_status === result_status) {
            throw new Error(`Exam result is already ${result_status}.`);
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
            'UPDATE exam_applications SET result_status = ?, score_details = COALESCE(?, score_details), note = COALESCE(?, note), exam_date = COALESCE(exam_date, NOW()) WHERE id = ?',
            [result_status, scoreDetailsJson, note, id]
        );

        if (result.affectedRows > 0) {
            // Cập nhật trạng thái ứng viên tương ứng (Module 1 & 5)
            const Candidate = require('./candidateModel');
            const { CANDIDATE_STATUSES } = require('../utils/candidateStatus');
            
            let newCandidateStatus = null;
            if (result_status === EXAM_RESULT_STATUSES.PASS) {
                newCandidateStatus = CANDIDATE_STATUSES.PASSED;
            } else if (result_status === EXAM_RESULT_STATUSES.FAIL) {
                newCandidateStatus = CANDIDATE_STATUSES.FAILED_POOL;
            }

            if (newCandidateStatus) {
                await Candidate.transitionStatus(currentExamApp.candidate_id, newCandidateStatus, { 
                    jobOrderId: currentExamApp.job_order_id 
                });
            }
        }

        return result.affectedRows > 0;
    }

    static async findPendingCandidatesByJobOrder(jobOrderId) {
        const parsedJobOrderId = Number.parseInt(jobOrderId, 10);
        if (!Number.isInteger(parsedJobOrderId) || parsedJobOrderId <= 0) {
            throw new Error('job_order_id must be a positive integer.');
        }

        const [jobOrderRows] = await db.query(
            'SELECT id, job_title FROM job_orders WHERE id = ? LIMIT 1',
            [parsedJobOrderId]
        );
        if (!jobOrderRows.length) {
            throw new Error('Job Order not found.');
        }

        const [rows] = await db.query(
            `
            SELECT
                ea.id,
                ea.exam_date,
                ea.result_status,
                ea.candidate_id,
                c.citizen_id AS candidate_citizen_id,
                c.full_name AS candidate_name,
                c.phone AS candidate_phone,
                c.email AS candidate_email,
                c.status AS candidate_status
            FROM exam_applications ea
            JOIN candidates c ON c.id = ea.candidate_id
            WHERE ea.job_order_id = ? AND ea.result_status = 'Pending'
            ORDER BY c.full_name ASC
            `,
            [parsedJobOrderId]
        );

        return {
            job_order_id: parsedJobOrderId,
            job_title: jobOrderRows[0].job_title,
            candidates: rows
        };
    }

    static async updateSchedule(id, scheduleData) {
        const { exam_date } = scheduleData;

        const currentExamApp = await this.findById(id);
        if (!currentExamApp) {
            throw new Error('Exam application not found.');
        }

        if (currentExamApp.result_status !== EXAM_RESULT_STATUSES.PENDING) {
            throw new Error('Cannot update exam schedule when result is already recorded.');
        }

        if (!exam_date) {
            throw new Error('exam_date is required.');
        }

        const examDate = new Date(exam_date);
        if (Number.isNaN(examDate.getTime())) {
            throw new Error('exam_date is invalid.');
        }
        this.assertFutureExamDate(exam_date);

        const [result] = await db.query(
            'UPDATE exam_applications SET exam_date = ? WHERE id = ?',
            [exam_date, id]
        );

        return result.affectedRows > 0;
    }

    static async updateSessionSchedule(sessionKey, exam_date) {
        const { timestamp, jobOrderId } = this.parseSessionKey(sessionKey);

        if (!exam_date) {
            throw new Error('exam_date is required.');
        }

        const parsedDate = new Date(exam_date);
        if (Number.isNaN(parsedDate.getTime())) {
            throw new Error('exam_date is invalid.');
        }
        this.assertFutureExamDate(exam_date);

        const [statsRows] = await db.query(
            `
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN result_status = 'Pending' THEN 1 ELSE 0 END) AS pending_total
            FROM exam_applications
            WHERE UNIX_TIMESTAMP(exam_date) = ? AND job_order_id = ?
            `,
            [timestamp, jobOrderId]
        );

        const stats = statsRows[0] || { total: 0, pending_total: 0 };
        const total = Number(stats.total || 0);
        const pendingTotal = Number(stats.pending_total || 0);

        if (total === 0) {
            throw new Error('Exam session not found.');
        }

        if (pendingTotal !== total) {
            throw new Error('Cannot update exam session because some candidates already have exam results.');
        }

        const [result] = await db.query(
            'UPDATE exam_applications SET exam_date = ? WHERE UNIX_TIMESTAMP(exam_date) = ? AND job_order_id = ?',
            [exam_date, timestamp, jobOrderId]
        );

        const newTimestamp = Math.floor(parsedDate.getTime() / 1000);
        return {
            affectedRows: result.affectedRows,
            sessionKey: this.buildSessionKey(newTimestamp, jobOrderId)
        };
    }

    static async bulkScheduleSession({ job_order_id, exam_application_ids, exam_date }) {
        const parsedJobOrderId = Number.parseInt(job_order_id, 10);
        if (!Number.isInteger(parsedJobOrderId) || parsedJobOrderId <= 0) {
            throw new Error('job_order_id must be a positive integer.');
        }

        const appIds = Array.isArray(exam_application_ids)
            ? [...new Set(exam_application_ids.map((id) => Number.parseInt(id, 10)).filter((id) => Number.isInteger(id) && id > 0))]
            : [];
        if (!appIds.length) {
            throw new Error('exam_application_ids must be a non-empty array of positive integers.');
        }

        if (!exam_date) {
            throw new Error('exam_date is required.');
        }

        const parsedDate = new Date(exam_date);
        if (Number.isNaN(parsedDate.getTime())) {
            throw new Error('exam_date is invalid.');
        }
        this.assertFutureExamDate(exam_date);

        const placeholders = appIds.map(() => '?').join(',');
        const [rows] = await db.query(
            `
            SELECT id, result_status, job_order_id
            FROM exam_applications
            WHERE id IN (${placeholders})
            `,
            appIds
        );

        if (rows.length !== appIds.length) {
            throw new Error('Some exam applications were not found.');
        }

        if (rows.some((row) => Number(row.job_order_id) !== parsedJobOrderId)) {
            throw new Error('All exam applications must belong to the same job order.');
        }

        if (rows.some((row) => row.result_status !== 'Pending')) {
            throw new Error('Only pending exam applications can be scheduled in bulk.');
        }

        const [result] = await db.query(
            `
            UPDATE exam_applications
            SET exam_date = ?
            WHERE job_order_id = ? AND id IN (${placeholders})
            `,
            [exam_date, parsedJobOrderId, ...appIds]
        );

        const sessionTimestamp = Math.floor(parsedDate.getTime() / 1000);
        return {
            affectedRows: result.affectedRows,
            sessionKey: this.buildSessionKey(sessionTimestamp, parsedJobOrderId)
        };
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