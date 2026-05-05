const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

router.post('/income', transactionController.recordIncome);
router.post('/refund', transactionController.recordRefund);
router.get('/candidate/:candidateId', transactionController.getTransactionsByCandidate);

module.exports = router;
