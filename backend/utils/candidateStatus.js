const CANDIDATE_STATUSES = Object.freeze({
  RECEIVED: 'RECEIVED',
  CONSULTING: 'CONSULTING',
  ORIGINAL_DOC_SUBMITTED: 'ORIGINAL_DOC_SUBMITTED',
  WAITING_JOB_MATCH: 'WAITING_JOB_MATCH',
  WAITING_EXAM: 'WAITING_EXAM'
});

const STATUS_ORDER = Object.freeze([
  CANDIDATE_STATUSES.RECEIVED,
  CANDIDATE_STATUSES.CONSULTING,
  CANDIDATE_STATUSES.ORIGINAL_DOC_SUBMITTED,
  CANDIDATE_STATUSES.WAITING_JOB_MATCH,
  CANDIDATE_STATUSES.WAITING_EXAM
]);

function isValidStatus(status) {
  return STATUS_ORDER.includes(status);
}

function canTransition(currentStatus, nextStatus) {
  if (!isValidStatus(currentStatus) || !isValidStatus(nextStatus)) {
    return false;
  }

  if (currentStatus === nextStatus) {
    return true;
  }

  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const nextIndex = STATUS_ORDER.indexOf(nextStatus);

  return Math.abs(nextIndex - currentIndex) === 1;
}

module.exports = {
  CANDIDATE_STATUSES,
  STATUS_ORDER,
  isValidStatus,
  canTransition
};