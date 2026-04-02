const express = require('express');
const router = express.Router();
const examAppController = require('../controllers/examApplicationController');

router.post('/', examAppController.createExamApplication);
router.get('/', examAppController.getExamApplications);
router.post('/sessions/bulk-schedule', examAppController.bulkScheduleSession);
router.get('/sessions', examAppController.getExamSessions);
router.get('/sessions/:sessionKey', examAppController.getExamSessionDetail);
router.patch('/sessions/:sessionKey', examAppController.updateExamSession);
router.get('/job-orders/:jobOrderId/pending-candidates', examAppController.getPendingCandidatesByJobOrder);
router.get('/:id', examAppController.getExamApplicationById);
router.patch('/:id/schedule', examAppController.updateExamSchedule);
router.patch('/:id/result', examAppController.updateExamResult); // Lộ trình cụ thể để cập nhật kết quả
router.delete('/:id', examAppController.deleteExamApplication);

// Các tuyến đường bổ sung cho 'Đào tạo Định hướng' có thể được thêm vào đây
// router.post('/training-schedules', trainingController.createTrainingSchedule);
// router.get('/training-schedules', trainingController.getTrainingSchedules);

module.exports = router;