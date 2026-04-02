const express = require('express');
const router = express.Router();
const jobOrderController = require('../controllers/jobOrderController');

router.post('/', jobOrderController.createJobOrder);
router.get('/', jobOrderController.getJobOrders);
router.get('/:id', jobOrderController.getJobOrderById);
router.patch('/:id', jobOrderController.updateJobOrder);
router.delete('/:id', jobOrderController.softDeleteJobOrder); // Soft delete (cancel)

// Matching candidates
router.get('/:jobOrderId/matching-candidates', jobOrderController.getMatchingCandidates);
router.get('/:jobOrderId/candidates', jobOrderController.getJobOrderCandidates);
router.delete('/:jobOrderId/candidates/:candidateId', jobOrderController.removeCandidateFromJobOrder);

router.post('/:jobOrderId/manual-match', jobOrderController.manualMatchCandidateToJobOrder);

module.exports = router;