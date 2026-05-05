const Transaction = require('../models/transactionModel');

exports.recordIncome = async (req, res) => {
  try {
    const transaction = await Transaction.create({
      ...req.body,
      transaction_type: 'INCOME'
    });
    res.status(201).json({ success: true, data: transaction, message: 'Income transaction recorded successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.recordRefund = async (req, res) => {
  try {
    const transaction = await Transaction.create({
      ...req.body,
      transaction_type: 'REFUND'
    });
    res.status(201).json({ success: true, data: transaction, message: 'Refund transaction recorded successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTransactionsByCandidate = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { page, limit, transaction_type } = req.query;
    const transactions = await Transaction.findAll({
      candidate_id: candidateId,
      page,
      limit,
      transaction_type
    });
    const summary = await Transaction.getSummaryByCandidate(candidateId);
    res.status(200).json({ success: true, data: transactions, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
