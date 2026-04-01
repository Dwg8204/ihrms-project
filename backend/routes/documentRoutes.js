const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { uploadCvs } = require('../middlewares/upload');

router.get('/document-types', documentController.getDocumentTypes);

router.post('/candidates/:candidateId/documents/init', documentController.initCandidateDocuments);
router.get('/candidates/:candidateId/documents', documentController.getCandidateDocuments);
router.patch(
  '/candidates/:candidateId/documents/:documentTypeCode',
  uploadCvs.single('file'),
  documentController.updateCandidateDocument
);
router.get('/candidates/:candidateId/documents/pre-exam-readiness', documentController.getPreExamReadiness);

router.get('/alerts/health-expiry', documentController.getHealthExpiryAlerts);
router.get('/alerts/visa-delay', documentController.getVisaDelayAlerts);

module.exports = router;