const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { uploadContracts, uploadTemplates } = require('../middlewares/upload');

// Contract Templates routes MUST be before dynamic contract routes
router.post('/templates', uploadTemplates.single('template_file'), contractController.createContractTemplate);
router.get('/templates', contractController.getContractTemplates);
router.get('/templates/:id', contractController.getContractTemplateById);
router.patch('/templates/:id', uploadTemplates.single('template_file'), contractController.updateContractTemplate);
router.delete('/templates/:id', contractController.deleteContractTemplate);

// Contract routes
router.post('/', uploadContracts.single('contract_file'), contractController.createContract);
router.get('/', contractController.getContracts);
router.get('/:id', contractController.getContractById);
router.patch('/:id', uploadContracts.single('contract_file'), contractController.updateContract);
router.delete('/:id', contractController.deleteContract);

module.exports = router;