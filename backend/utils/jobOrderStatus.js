const JOB_ORDER_STATUSES = Object.freeze({
  OPEN: 'OPEN',
  PENDING_REVIEW: 'PENDING_REVIEW',
  CLOSED: 'CLOSED',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED', // Trạng thái cho xóa mềm hoặc khi đối tác ngừng hoạt động
  EXPIRED: 'EXPIRED'
});

const JOB_ORDER_TRANSITIONS = Object.freeze({
  [JOB_ORDER_STATUSES.PENDING_REVIEW]: [JOB_ORDER_STATUSES.OPEN, JOB_ORDER_STATUSES.CANCELLED],
  [JOB_ORDER_STATUSES.OPEN]: [
    JOB_ORDER_STATUSES.CLOSED,
    JOB_ORDER_STATUSES.FILLED,
    JOB_ORDER_STATUSES.CANCELLED,
    JOB_ORDER_STATUSES.EXPIRED
  ],
  [JOB_ORDER_STATUSES.CLOSED]: [JOB_ORDER_STATUSES.OPEN], // Có thể mở lại
  [JOB_ORDER_STATUSES.FILLED]: [JOB_ORDER_STATUSES.CLOSED], // Khi filled có thể đóng, nhưng không open lại trực tiếp
  [JOB_ORDER_STATUSES.CANCELLED]: [], // Đơn hàng đã hủy thì không thay đổi được nữa
  [JOB_ORDER_STATUSES.EXPIRED]: [JOB_ORDER_STATUSES.CLOSED, JOB_ORDER_STATUSES.CANCELLED] // Có thể đóng hoặc hủy nếu hết hạn
});

function isValidJobOrderStatus(status) {
  return Object.values(JOB_ORDER_STATUSES).includes(status);
}

function canTransitionJobOrderStatus(currentStatus, nextStatus) {
  if (!isValidJobOrderStatus(currentStatus) || !isValidJobOrderStatus(nextStatus)) {
    return false;
  }
  if (currentStatus === nextStatus) {
    return true; // Cho phép cập nhật cùng trạng thái
  }
  const allowed = JOB_ORDER_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

module.exports = {
  JOB_ORDER_STATUSES,
  isValidJobOrderStatus,
  canTransitionJobOrderStatus
};