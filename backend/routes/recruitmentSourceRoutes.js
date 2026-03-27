const express = require('express');
const router = express.Router();
const recruitmentSourceController = require('../controllers/recruitmentSourceController');

router.get('/', recruitmentSourceController.getAllSources);
router.get('/:id', recruitmentSourceController.getSourceById);
router.post('/', recruitmentSourceController.createSource);
router.patch('/:id', recruitmentSourceController.updateSource);
router.delete('/:id', recruitmentSourceController.deleteSource);

module.exports = router;