const PAYMENT_SCHEDULE_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
});

function isValidPaymentScheduleStatus(status) {
  return Object.values(PAYMENT_SCHEDULE_STATUSES).includes(status);
}

module.exports = {
  PAYMENT_SCHEDULE_STATUSES,
  isValidPaymentScheduleStatus
};
