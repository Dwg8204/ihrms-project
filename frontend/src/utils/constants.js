export const CANDIDATE_STATUSES = [
  'NEW_RECEIVED',
  'PAID0_DOCS_SUBMITTED',
  'WAITING_FORM_MATCH',
  'FORM_MATCHED_WAITING_EXAM',
  'PASSED',
  'FAILED_POOL',
  'CONTRACT_SIGNED',
  'WITHDRAWN'
];

export const CANDIDATE_STATUS_LABELS = {
  NEW_RECEIVED: 'Mới tiếp nhận',
  PAID0_DOCS_SUBMITTED: 'Đã nộp hồ sơ',
  WAITING_FORM_MATCH: 'Chờ ghép form',
  FORM_MATCHED_WAITING_EXAM: 'Đã ghép form, chờ thi',
  PASSED: 'Đạt',
  FAILED_POOL: 'Kho trượt',
  CONTRACT_SIGNED: 'Đã ký hợp đồng',
  WITHDRAWN: 'Đã rút hồ sơ'
};

export const JOB_ORDER_STATUSES = [
  'PENDING_REVIEW',
  'OPEN',
  'CLOSED',
  'FILLED',
  'CANCELLED',
  'EXPIRED'
];

export const JOB_ORDER_STATUS_LABELS = {
  PENDING_REVIEW: 'Chờ duyệt',
  OPEN: 'Đang mở',
  CLOSED: 'Đã đóng',
  FILLED: 'Đủ chỉ tiêu',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn'
};

export const PARTNER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLACKLISTED', 'ON_HOLD'];

export const PARTNER_STATUS_LABELS = {
  ACTIVE: 'Đang hợp tác',
  INACTIVE: 'Tạm ngưng',
  BLACKLISTED: 'Danh sách đen',
  ON_HOLD: 'Tạm giữ'
};

export const DOC_STATUSES = ['NOT_SUBMITTED', 'SUBMITTED', 'VERIFIED', 'REJECTED'];

export const DOC_STATUS_LABELS = {
  NOT_SUBMITTED: 'Chưa nộp',
  SUBMITTED: 'Đã nộp',
  VERIFIED: 'Đã xác minh',
  REJECTED: 'Từ chối'
};

export const CONTRACT_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_SIGNATURE: 'PENDING_SIGNATURE',
  SIGNED: 'SIGNED',
  LIQUIDATED: 'LIQUIDATED',
  DISPUTED: 'DISPUTED',
  CANCELLED: 'CANCELLED'
};

export const CONTRACT_STATUS_LABELS = {
  DRAFT: 'Nháp',
  PENDING_SIGNATURE: 'Chờ ký',
  SIGNED: 'Đã ký',
  LIQUIDATED: 'Đã thanh lý',
  DISPUTED: 'Tranh chấp',
  CANCELLED: 'Đã hủy'
};

export const PAYMENT_SCHEDULE_STATUSES = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

export const PAYMENT_SCHEDULE_STATUS_LABELS = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  PARTIALLY_PAID: 'Thanh toán một phần',
  OVERDUE: 'Quá hạn',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền'
};

export const TRANSACTION_TYPES = {
  INCOME: 'INCOME',
  REFUND: 'REFUND'
};

export const TRANSACTION_TYPE_LABELS = {
  INCOME: 'Thu tiền',
  REFUND: 'Hoàn tiền'
};

export const FEE_CATEGORIES = {
  INITIAL: 'INITIAL',
  TRAINING: 'TRAINING',
  SERVICE: 'SERVICE',
  CERTIFICATE: 'CERTIFICATE',
  VISA_PASSPORT: 'VISA_PASSPORT',
  INSURANCE: 'INSURANCE',
  DEPOSIT: 'DEPOSIT',
  OTHER: 'OTHER'
};

export const FEE_CATEGORY_LABELS = {
  INITIAL: 'Phí ban đầu',
  TRAINING: 'Học phí/Đào tạo',
  SERVICE: 'Phí dịch vụ',
  CERTIFICATE: 'Phí chứng chỉ',
  VISA_PASSPORT: 'Visa/Hộ chiếu',
  INSURANCE: 'Bảo hiểm',
  DEPOSIT: 'Tiền cọc',
  OTHER: 'Khác'
};
