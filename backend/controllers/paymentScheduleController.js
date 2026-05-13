const PaymentSchedule = require('../models/paymentScheduleModel');

exports.createPaymentSchedule = async (req, res) => {
  try {
    const {
      candidate_id, description, amount_due, due_date,
      is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event
    } = req.body;
    if (!candidate_id || !description || !amount_due) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
    }
    
    // Validate due_date if provided
    if (due_date) {
      const dueDateObj = new Date(due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDateObj < today) {
        return res.status(400).json({ success: false, message: 'Hạn đóng không được là ngày trong quá khứ.' });
      }
    }
    
    const schedule = await PaymentSchedule.create({
      candidate_id,
      description,
      amount_due,
      due_date: due_date || null,
      status: 'PENDING',
      is_mandatory_for_exit: is_mandatory_for_exit || false,
      is_refundable: is_refundable || false,
      refund_policy_pct: refund_policy_pct || 0,
      triggered_by_event: triggered_by_event || 'MANUAL'
    });
    res.status(201).json({ success: true, data: schedule, message: 'Đã tạo khoản phí thành công.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPaymentSchedulesByCandidate = async (req, res) => {
  try {
    const schedules = await PaymentSchedule.findByCandidate(req.params.candidateId);
    res.status(200).json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.recordPaymentForSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { amount, note, receipt_image_url, approved_by_user_id } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount.' });
    }

    const result = await PaymentSchedule.recordPayment(
      scheduleId,
      amount,
      note,
      receipt_image_url,
      approved_by_user_id
    );

    res.status(200).json({ success: true, data: result, message: 'Payment recorded successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.checkExitReadiness = async (req, res) => {
  try {
    const isReady = await PaymentSchedule.checkMandatoryPaymentsForExit(req.params.candidateId);
    res.status(200).json({ 
      success: true, 
      isReady, 
      message: isReady ? 'All mandatory payments settled.' : 'Candidate has outstanding mandatory payments.' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.processRefundsManually = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { refundCaseType } = req.body; // TH1, TH2, TH3, TH5

    if (!['TH1', 'TH2', 'TH3', 'TH5'].includes(refundCaseType)) {
      return res.status(400).json({ success: false, message: 'Invalid refund case type.' });
    }

    const refunds = await PaymentSchedule.processRefunds(candidateId, refundCaseType);
    res.status(200).json({ success: true, data: refunds, message: 'Refunds processed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.recordRefundForSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { amount, note, approved_by_user_id } = req.body;
    const normalizedAmount = Number(amount);
    
    if (amount === undefined || amount === null || Number.isNaN(normalizedAmount) || normalizedAmount < 0) {
      return res.status(400).json({ success: false, message: 'Invalid refund amount.' });
    }

    const result = await PaymentSchedule.recordRefund(
      scheduleId,
      normalizedAmount,
      note,
      approved_by_user_id
    );

    res.status(200).json({ success: true, data: result, message: 'Refund recorded successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
