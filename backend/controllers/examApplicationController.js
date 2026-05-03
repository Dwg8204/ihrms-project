const ExamApplication = require('../models/examApplicationModel');
const Candidate = require('../models/candidateModel');
const { CANDIDATE_STATUSES } = require('../utils/candidateStatus');
const db = require('../config/db');
const { autoSendExamResultEmail } = require('./emailController');

exports.createExamApplication = async (req, res, next) => {
    try {
        const { candidate_id, job_order_id, exam_date, note } = req.body;

        if (!candidate_id || !job_order_id || !exam_date) {
            return res.status(400).json({ success: false, message: 'Candidate ID, Job Order ID, and Exam Date are required.' });
        }

        // Tạo đơn đăng ký thi
        const newExamApp = await ExamApplication.create({ candidate_id, job_order_id, exam_date, note });
        
        // TỰ ĐỘNG CẬP NHẬT TRẠNG THÁI ỨNG VIÊN (Tích hợp Mô-đun 1)
        await Candidate.transitionStatus(candidate_id, CANDIDATE_STATUSES.FORM_MATCHED_WAITING_EXAM, { jobOrderId: job_order_id });

        res.status(201).json({ success: true, data: newExamApp, message: 'Exam application created and candidate status updated.' });
    } catch (error) {
        if (error.message.includes('Candidate not found') || error.message.includes('Job Order not found') || error.message.includes('must be in WAITING_FORM_MATCH status') || error.message.includes('Job Order must be in OPEN status')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message.includes('already registered for an exam')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        if (error.message.includes('Invalid status transition') || error.message.includes('Candidate must be in')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};

exports.getExamApplications = async (req, res, next) => {
    try {
        const { page, limit, search, candidate_id, job_order_id, result_status } = req.query;
        const examApps = await ExamApplication.findAll({
            page: parseInt(page),
            limit: parseInt(limit),
            search,
            candidate_id: candidate_id ? parseInt(candidate_id) : null,
            job_order_id: job_order_id ? parseInt(job_order_id) : null,
            result_status
        });
        res.status(200).json({ success: true, ...examApps });
    } catch (error) {
        next(error);
    }
};

exports.getExamSessions = async (req, res, next) => {
    try {
        const { view = 'all', search = '' } = req.query;
        if (!['all', 'schedule', 'result'].includes(view)) {
            return res.status(400).json({ success: false, message: 'view must be one of: all, schedule, result.' });
        }

        const sessions = await ExamApplication.findSessions({ view, search: String(search || '').trim() });
        res.status(200).json({ success: true, data: sessions });
    } catch (error) {
        next(error);
    }
};

exports.getExamSessionDetail = async (req, res, next) => {
    try {
        const { sessionKey } = req.params;
        const detail = await ExamApplication.findSessionDetail(sessionKey);
        if (!detail) {
            return res.status(404).json({ success: false, message: 'Exam session not found.' });
        }

        res.status(200).json({ success: true, data: detail });
    } catch (error) {
        if (error.message.includes('sessionKey')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

exports.getPendingCandidatesByJobOrder = async (req, res, next) => {
    try {
        const { jobOrderId } = req.params;
        const data = await ExamApplication.findPendingCandidatesByJobOrder(jobOrderId);
        res.status(200).json({ success: true, data });
    } catch (error) {
        if (error.message.includes('job_order_id') || error.message.includes('Job Order not found')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

exports.getExamApplicationById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const examApp = await ExamApplication.findById(id);
        if (!examApp) {
            return res.status(404).json({ success: false, message: 'Exam application not found.' });
        }
        res.status(200).json({ success: true, data: examApp });
    } catch (error) {
        next(error);
    }
};

exports.updateExamResult = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { result_status, score_details, note } = req.body;

        if (!result_status) {
            return res.status(400).json({ success: false, message: 'Result status is required.' });
        }

        const currentExamApp = await ExamApplication.findById(id);
        if (!currentExamApp) {
            return res.status(404).json({ success: false, message: 'Exam application not found.' });
        }

        const updated = await ExamApplication.updateResult(id, { result_status, score_details, note });
        if (!updated) {
            return res.status(500).json({ success: false, message: 'Failed to update exam result.' });
        }

        // TỰ ĐỘNG CẬP NHẬT TRẠNG THÁI ỨNG VIÊN (Tích hợp Mô-đun 1)
        let newCandidateStatus = null;
        if (result_status === 'Pass') {
            newCandidateStatus = CANDIDATE_STATUSES.PASSED;
        } else if (result_status === 'Fail') {
            newCandidateStatus = CANDIDATE_STATUSES.FAILED_POOL;
        }

        let usedFallbackStatusSync = false;
        if (newCandidateStatus) {
            try {
                await Candidate.transitionStatus(currentExamApp.candidate_id, newCandidateStatus, { jobOrderId: currentExamApp.job_order_id });
            } catch (transitionError) {
                // Legacy/test data can be out of workflow order (e.g. NEW_RECEIVED).
                // Exam result is already updated above, so force-sync candidate status to keep data consistent.
                await db.query(
                    'UPDATE candidates SET status = ? WHERE id = ?',
                    [newCandidateStatus, currentExamApp.candidate_id]
                );
                usedFallbackStatusSync = true;
            }
        }

        // Tự động gửi email thông báo kết quả thi (không blocking)
        if (result_status === 'Pass' || result_status === 'Fail') {
            autoSendExamResultEmail(currentExamApp.candidate_id, result_status);
        }

        res.status(200).json({
            success: true,
            message: usedFallbackStatusSync
                ? 'Exam result updated. Candidate status was force-synced due to legacy status data.'
                : 'Exam result updated and candidate status updated.'
        });
    } catch (error) {
        if (error.message.includes('Exam application not found') || error.message.includes('Invalid result status') || error.message.includes('Exam result already updated') || error.message.includes('Exam result is already') || error.message.includes('score_details must be a valid JSON object')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message.includes('Invalid status transition') || error.message.includes('Candidate must be in') || error.message.includes('No pending exam application')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};

exports.updateExamSchedule = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { exam_date } = req.body;

        if (!exam_date) {
            return res.status(400).json({ success: false, message: 'exam_date is required.' });
        }

        const updated = await ExamApplication.updateSchedule(id, { exam_date });
        if (!updated) {
            return res.status(500).json({ success: false, message: 'Failed to update exam schedule.' });
        }

        const refreshed = await ExamApplication.findById(id);
        res.status(200).json({ success: true, data: refreshed, message: 'Exam schedule updated successfully.' });
    } catch (error) {
        if (error.message.includes('Exam application not found') || error.message.includes('exam_date')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message.includes('Cannot update exam schedule when result is already recorded')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};

exports.updateExamSession = async (req, res, next) => {
    try {
        const { sessionKey } = req.params;
        const { exam_date } = req.body;

        if (!exam_date) {
            return res.status(400).json({ success: false, message: 'exam_date is required.' });
        }

        const updated = await ExamApplication.updateSessionSchedule(sessionKey, exam_date);
        const refreshed = await ExamApplication.findSessionDetail(updated.sessionKey);

        res.status(200).json({ success: true, data: refreshed, message: 'Exam session updated successfully.' });
    } catch (error) {
        if (
            error.message.includes('sessionKey') ||
            error.message.includes('exam_date') ||
            error.message.includes('Exam session not found')
        ) {
            return res.status(400).json({ success: false, message: error.message });
        }

        if (error.message.includes('Cannot update exam session because some candidates already have exam results')) {
            return res.status(409).json({ success: false, message: error.message });
        }

        next(error);
    }
};

exports.bulkScheduleSession = async (req, res, next) => {
    try {
        const { job_order_id, exam_application_ids, exam_date } = req.body;

        const result = await ExamApplication.bulkScheduleSession({
            job_order_id,
            exam_application_ids,
            exam_date
        });

        const refreshed = await ExamApplication.findSessionDetail(result.sessionKey);
        res.status(200).json({
            success: true,
            data: refreshed,
            message: 'Exam session created/updated successfully for selected candidates.'
        });
    } catch (error) {
        if (
            error.message.includes('job_order_id') ||
            error.message.includes('exam_application_ids') ||
            error.message.includes('exam_date') ||
            error.message.includes('not found') ||
            error.message.includes('same job order') ||
            error.message.includes('pending exam applications')
        ) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

exports.deleteExamApplication = async (req, res, next) => {
    try {
        const { id } = req.params;
        const examApp = await ExamApplication.findById(id);
        if (!examApp) {
            return res.status(404).json({ success: false, message: 'Exam application not found.' });
        }
        
        // Ngăn chặn việc xóa nếu kết quả đã được ghi lại.
        if (examApp.result_status !== 'Pending') {
            return res.status(409).json({ success: false, message: 'Cannot delete exam application with recorded result. Consider resetting result instead.' });
        }

        const deleted = await ExamApplication.delete(id);
        if (!deleted) {
            return res.status(500).json({ success: false, message: 'Failed to delete exam application.' });
        }

        const candidate = await Candidate.getById(examApp.candidate_id);
        if (candidate && candidate.status === CANDIDATE_STATUSES.FORM_MATCHED_WAITING_EXAM) {
            const pendingApps = await ExamApplication.findAll({
                page: 1,
                limit: 1,
                candidate_id: examApp.candidate_id,
                result_status: 'Pending'
            });

            if (Number(pendingApps?.pagination?.total || 0) === 0) {
                await Candidate.transitionStatus(examApp.candidate_id, CANDIDATE_STATUSES.WAITING_FORM_MATCH, {
                    jobOrderId: examApp.job_order_id
                });
            }
        }

        res.status(200).json({ success: true, message: 'Exam application deleted successfully.' });
    } catch (error) {
        if (error.message.includes('Invalid status transition') || error.message.includes('Candidate must be in')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};

// Có thể bổ sung thêm bộ điều khiển tại đây cho 'Đào tạo Định hướng'
// exports.createTrainingSchedule = ...
// exports.getTrainingSchedule = ...