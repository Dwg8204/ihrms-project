const db = require('../config/db');
const FeeStandard = require('./feeStandardModel');
const Transaction = require('./transactionModel');

const PaymentSchedule = {
  create: async (data) => {
    const {
      candidate_id, contract_id, original_fee_standard_id,
      description, amount_due, due_date, status, amount_paid,
      is_mandatory_for_exit, is_refundable, refund_policy_pct,
      triggered_by_event
    } = data;

    const query = `
      INSERT INTO payment_schedules (
        candidate_id, contract_id, original_fee_standard_id,
        description, amount_due, due_date, status, amount_paid,
        is_mandatory_for_exit, is_refundable, refund_policy_pct,
        triggered_by_event
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      candidate_id, contract_id, original_fee_standard_id,
      description, amount_due, due_date, status || 'PENDING', amount_paid || 0,
      is_mandatory_for_exit || false, is_refundable || false, refund_policy_pct || 0,
      triggered_by_event
    ]);
    return { id: result.insertId, ...data };
  },

  findByCandidate: async (candidateId) => {
    const query = `
      SELECT ps.*, 
             fs.fee_name, fs.fee_category,
             fs.is_refundable_on_fail_exam, fs.refund_pct_on_fail_exam,
             fs.is_refundable_on_withdrawal, fs.refund_pct_on_withdrawal,
             fs.is_refundable_on_no_go, fs.refund_pct_on_no_go
      FROM payment_schedules ps
      LEFT JOIN fee_standards fs ON ps.original_fee_standard_id = fs.id
      WHERE ps.candidate_id = ? 
      ORDER BY ps.due_date ASC
    `;
    const [rows] = await db.query(query, [candidateId]);
    return rows;
  },

  findById: async (id) => {
    const [rows] = await db.query('SELECT * FROM payment_schedules WHERE id = ?', [id]);
    return rows[0];
  },

  generatePaymentSchedulesForContract: async (contractId) => {
    // Get contract info
    const [contracts] = await db.query('SELECT * FROM contracts WHERE id = ?', [contractId]);
    if (contracts.length === 0) throw new Error('Contract not found');
    const contract = contracts[0];

    // Get candidate and job order
    const [candidates] = await db.query('SELECT * FROM candidates WHERE id = ?', [contract.candidate_id]);
    const candidate = candidates[0];

    // Get fee standards for ON_CONTRACT_SIGN
    const standards = await FeeStandard.getFeeStandardsByEvent(contract.job_order_id, contract.contract_type, 'ON_CONTRACT_SIGN');

    const createdSchedules = [];
    for (const standard of standards) {
      // Calculate due_date: usually 7 days after signing or as per contract effective date
      const dueDate = contract.signed_date || new Date();
      
      const schedule = await PaymentSchedule.create({
        candidate_id: candidate.id,
        contract_id: contract.id,
        original_fee_standard_id: standard.id,
        description: standard.fee_name,
        amount_due: standard.amount,
        due_date: dueDate,
        status: 'PENDING',
        is_mandatory_for_exit: standard.is_mandatory_for_exit,
        is_refundable: standard.is_refundable_on_withdrawal,
        refund_policy_pct: standard.refund_pct_on_withdrawal,
        triggered_by_event: 'ON_CONTRACT_SIGN'
      });
      createdSchedules.push(schedule);
    }
    return createdSchedules;
  },

  recordPayment: async (scheduleId, amount, transactionNote, receiptImageUrl, approvedByUserId) => {
    const schedule = await PaymentSchedule.findById(scheduleId);
    if (!schedule) throw new Error('Payment schedule not found');

    const newAmountPaid = parseFloat(schedule.amount_paid) + parseFloat(amount);
    let newStatus = 'PARTIALLY_PAID';
    if (newAmountPaid >= parseFloat(schedule.amount_due)) {
      newStatus = 'PAID';
    }

    await db.query('UPDATE payment_schedules SET amount_paid = ?, status = ? WHERE id = ?', [newAmountPaid, newStatus, scheduleId]);

    // Create transaction record
    await Transaction.create({
      candidate_id: schedule.candidate_id,
      contract_id: schedule.contract_id,
      fee_standard_id: schedule.original_fee_standard_id,
      payment_schedule_id: scheduleId,
      amount_paid: amount,
      transaction_type: 'INCOME',
      note: transactionNote,
      receipt_image_url: receiptImageUrl,
      approved_by_user_id: approvedByUserId
    });

    return { scheduleId, newAmountPaid, newStatus };
  },

  cancelPendingSchedules: async (candidateId, eventReason) => {
    const query = `
      UPDATE payment_schedules 
      SET status = 'CANCELLED' 
      WHERE candidate_id = ? AND status IN ('PENDING', 'OVERDUE')
    `;
    await db.query(query, [candidateId]);
    return true;
  },

  processRefunds: async (candidateId, refundCaseType) => {
    // Fetch paid schedules regardless of case
    const [paidSchedules] = await db.query(`
      SELECT ps.*, fs.is_refundable_on_fail_exam, fs.refund_pct_on_fail_exam, 
             fs.is_refundable_on_withdrawal, fs.refund_pct_on_withdrawal,
             fs.is_refundable_on_no_go, fs.refund_pct_on_no_go
      FROM payment_schedules ps
      JOIN fee_standards fs ON ps.original_fee_standard_id = fs.id
      WHERE ps.candidate_id = ? AND ps.status IN ('PAID', 'PARTIALLY_PAID')
    `, [candidateId]);

    if (refundCaseType === 'TH3') {
        // Case 3: 0% refund for all, but we still mark as REFUNDED to close the UI buttons
        for (const ps of paidSchedules) {
            await db.query("UPDATE payment_schedules SET status = 'REFUNDED', amount_paid = 0 WHERE id = ?", [ps.id]);
        }
        return []; 
    }

    const refundTransactions = [];

    for (const ps of paidSchedules) {
      let refundPct = 0;
      let isRefundable = false;

      if (refundCaseType === 'TH1') {
        isRefundable = ps.is_refundable_on_fail_exam;
        refundPct = ps.refund_pct_on_fail_exam;
      } else if (refundCaseType === 'TH2') {
        isRefundable = ps.is_refundable_on_withdrawal;
        refundPct = ps.refund_pct_on_withdrawal;
      } else if (refundCaseType === 'TH5') {
        isRefundable = ps.is_refundable_on_no_go;
        refundPct = ps.refund_pct_on_no_go;
      }

      if (isRefundable && refundPct > 0) {
        const refundAmount = (parseFloat(ps.amount_paid) * parseFloat(refundPct)) / 100;
        
        if (refundAmount > 0) {
          const transaction = await Transaction.create({
            candidate_id: ps.candidate_id,
            contract_id: ps.contract_id,
            fee_standard_id: ps.original_fee_standard_id,
            payment_schedule_id: ps.id,
            amount_paid: refundAmount,
            transaction_type: 'REFUND',
            note: `Refund processing for case ${refundCaseType}. Policy: ${refundPct}%`,
            approved_by_user_id: 1
          });
          
          await db.query("UPDATE payment_schedules SET status = 'REFUNDED', amount_paid = 0 WHERE id = ?", [ps.id]);
          refundTransactions.push(transaction);
        } else {
          // Even if refund amount is 0, we mark it as REFUNDED to close the cycle
          await db.query("UPDATE payment_schedules SET status = 'REFUNDED', amount_paid = 0 WHERE id = ?", [ps.id]);
        }
      } else {
        // If not refundable by policy, we still mark as REFUNDED (or CLOSED) 
        // to prevent further individual refund attempts
        await db.query("UPDATE payment_schedules SET status = 'REFUNDED', amount_paid = 0 WHERE id = ?", [ps.id]);
      }
    }
    return refundTransactions;
  },

  recordRefund: async (scheduleId, amount, transactionNote, approvedByUserId) => {
    const schedule = await PaymentSchedule.findById(scheduleId);
    if (!schedule) throw new Error('Payment schedule not found');

    if (schedule.status === 'REFUNDED') throw new Error('Payment already refunded');
    if (schedule.amount_paid <= 0) throw new Error('No amount paid to refund');

    // Update schedule status and reset amount_paid
    await db.query("UPDATE payment_schedules SET status = 'REFUNDED', amount_paid = 0 WHERE id = ?", [scheduleId]);

    // Create transaction record
    const transaction = await Transaction.create({
      candidate_id: schedule.candidate_id,
      contract_id: schedule.contract_id,
      fee_standard_id: schedule.original_fee_standard_id,
      payment_schedule_id: scheduleId,
      amount_paid: amount,
      transaction_type: 'REFUND',
      note: transactionNote,
      approved_by_user_id: approvedByUserId
    });

    return transaction;
  },

  checkMandatoryPaymentsForExit: async (candidateId) => {
    const [rows] = await db.query(`
      SELECT COUNT(*) as unpaid_count 
      FROM payment_schedules 
      WHERE candidate_id = ? AND is_mandatory_for_exit = 1 AND status != 'PAID'
    `, [candidateId]);
    
    return rows[0].unpaid_count === 0;
  },

  generateByEvent: async (
    candidateId,
    event,
    { jobOrderId = null, contractId = null, contractType = null, autoPaid = false, transactionNote = null } = {}
  ) => {
    const candidate = await db.query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
    if (!candidate.length) return [];

    const standards = await FeeStandard.getFeeStandardsByEvent(jobOrderId, contractType, event);
    const createdSchedules = [];

    for (const standard of standards) {
      const [existing] = await db.query(
        `
        SELECT id
        FROM payment_schedules
        WHERE candidate_id = ?
          AND original_fee_standard_id = ?
          AND triggered_by_event = ?
          AND status <> 'CANCELLED'
        LIMIT 1
        `,
        [candidateId, standard.id, event]
      );
      if (existing.length > 0) {
        continue;
      }

      const schedule = await PaymentSchedule.create({
        candidate_id: candidateId,
        contract_id: contractId,
        original_fee_standard_id: standard.id,
        description: standard.fee_name,
        amount_due: standard.amount,
        due_date: new Date(), // Default to today
        status: autoPaid ? 'PAID' : 'PENDING',
        amount_paid: autoPaid ? standard.amount : 0,
        is_mandatory_for_exit: standard.is_mandatory_for_exit,
        is_refundable: standard.is_refundable_on_withdrawal,
        refund_policy_pct: standard.refund_pct_on_withdrawal,
        triggered_by_event: event
      });

      if (autoPaid) {
        await Transaction.create({
          candidate_id: candidateId,
          contract_id: contractId,
          fee_standard_id: standard.id,
          payment_schedule_id: schedule.id,
          amount_paid: standard.amount,
          transaction_type: 'INCOME',
          note: transactionNote || `Tự động ghi nhận thu phí theo sự kiện ${event}`,
          approved_by_user_id: 1
        });
      }
      createdSchedules.push(schedule);
    }
    return createdSchedules;
  }
};

module.exports = PaymentSchedule;
