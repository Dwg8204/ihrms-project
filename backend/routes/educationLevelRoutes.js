const express = require('express');
const router = express.Router();
const educationLevelController = require('../controllers/educationLevelController');

router.post('/', educationLevelController.createEducationLevel);
router.get('/', educationLevelController.getEducationLevels);
router.get('/:id', educationLevelController.getEducationLevelById);
router.patch('/:id', educationLevelController.updateEducationLevel);
router.delete('/:id', educationLevelController.deleteEducationLevel);

module.exports = router;