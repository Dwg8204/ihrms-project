const PARTNER_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLACKLISTED: 'BLACKLISTED',
  ON_HOLD: 'ON_HOLD'
});

function isValidPartnerStatus(status) {
  return Object.values(PARTNER_STATUSES).includes(status);
}

module.exports = {
  PARTNER_STATUSES,
  isValidPartnerStatus
};