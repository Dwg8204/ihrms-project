const CONTRACT_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',                       // Bản nháp, chưa gửi đi
  PENDING_SIGNATURE: 'PENDING_SIGNATURE', // Đang chờ ký bởi các bên
  SIGNED: 'SIGNED',                     // Đã ký bởi các bên, có hiệu lực
  LIQUIDATED: 'LIQUIDATED',             // Đã thanh lý, hợp đồng hoàn thành
  DISPUTED: 'DISPUTED',                 // Đang có tranh chấp
  CANCELLED: 'CANCELLED'                // Đã hủy (soft delete)
});

const CONTRACT_TRANSITIONS = Object.freeze({
  [CONTRACT_STATUSES.DRAFT]: [
    CONTRACT_STATUSES.PENDING_SIGNATURE,
    CONTRACT_STATUSES.CANCELLED
  ],
  [CONTRACT_STATUSES.PENDING_SIGNATURE]: [
    CONTRACT_STATUSES.SIGNED,
    CONTRACT_STATUSES.CANCELLED
  ],
  [CONTRACT_STATUSES.SIGNED]: [
    CONTRACT_STATUSES.LIQUIDATED,
    CONTRACT_STATUSES.DISPUTED,
    CONTRACT_STATUSES.CANCELLED // Có thể hủy hợp đồng đang hiệu lực trong trường hợp đặc biệt
  ],
  [CONTRACT_STATUSES.LIQUIDATED]: [], // Đã thanh lý thì không thay đổi nữa
  [CONTRACT_STATUSES.DISPUTED]: [
    CONTRACT_STATUSES.SIGNED, // Trở lại hiệu lực sau khi giải quyết
    CONTRACT_STATUSES.LIQUIDATED,
    CONTRACT_STATUSES.CANCELLED
  ],
  [CONTRACT_STATUSES.CANCELLED]: [] // Đã hủy thì không thay đổi nữa (trừ khi có nghiệp vụ phục hồi)
});

function isValidContractStatus(status) {
  return Object.values(CONTRACT_STATUSES).includes(status);
}

function canTransitionContractStatus(currentStatus, nextStatus) {
  if (!isValidContractStatus(currentStatus) || !isValidContractStatus(nextStatus)) {
    return false;
  }
  if (currentStatus === nextStatus) {
    return true; // Cho phép cập nhật cùng trạng thái
  }
  const allowed = CONTRACT_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

module.exports = {
  CONTRACT_STATUSES,
  isValidContractStatus,
  canTransitionContractStatus
};