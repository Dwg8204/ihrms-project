const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');
const upload = require('../middlewares/upload');

router.get('/kanban', candidateController.getKanbanBoard);
router.get('/funnel-summary', candidateController.getFunnelSummary);

router.get('/', candidateController.getAllCandidates);
router.get('/:id', candidateController.getCandidateById);

router.post('/', upload.single('cv_file'), candidateController.createCandidate);
router.patch('/:id', upload.single('cv_file'), candidateController.updateCandidate);
router.patch('/:id/status', candidateController.updateCandidateStatus);
router.delete('/:id', candidateController.deleteCandidate);

module.exports = router;