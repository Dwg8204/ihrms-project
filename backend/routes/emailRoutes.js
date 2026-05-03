const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');

router.get('/templates', emailController.getTemplates);
router.get('/templates/:id', emailController.getTemplateById);
router.post('/templates', emailController.createTemplate);
router.patch('/templates/:id', emailController.updateTemplate);
router.delete('/templates/:id', emailController.deleteTemplate);

router.get('/logs', emailController.getLogs);
router.post('/manual-send', emailController.sendManual);

module.exports = router;
