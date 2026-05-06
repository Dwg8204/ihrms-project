const express = require('express');
const router = express.Router();
const feeStandardController = require('../controllers/feeStandardController');

router.post('/', feeStandardController.createFeeStandard);
router.get('/', feeStandardController.getFeeStandards);
router.get('/:id', feeStandardController.getFeeStandardById);
router.patch('/:id', feeStandardController.updateFeeStandard);
router.delete('/:id', feeStandardController.deleteFeeStandard);

module.exports = router;
