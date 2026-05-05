const express = require('express');
const router = express.Router();
const paymentScheduleController = require('../controllers/paymentScheduleController');

router.get('/candidate/:candidateId', paymentScheduleController.getPaymentSchedulesByCandidate);
router.post('/:scheduleId/pay', paymentScheduleController.recordPaymentForSchedule);
router.get('/readiness-for-exit/:candidateId', paymentScheduleController.checkExitReadiness);
router.post('/:scheduleId/refund', paymentScheduleController.recordRefundForSchedule);
router.post('/:candidateId/refund-process', paymentScheduleController.processRefundsManually);

module.exports = router;
