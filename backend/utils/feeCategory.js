const FEE_CATEGORIES = Object.freeze({
  INITIAL: 'INITIAL',
  TRAINING: 'TRAINING',
  SERVICE: 'SERVICE',
  CERTIFICATE: 'CERTIFICATE',
  VISA_PASSPORT: 'VISA_PASSPORT',
  INSURANCE: 'INSURANCE',
  DEPOSIT: 'DEPOSIT',
  OTHER: 'OTHER'
});

function isValidFeeCategory(category) {
  return Object.values(FEE_CATEGORIES).includes(category);
}

module.exports = {
  FEE_CATEGORIES,
  isValidFeeCategory
};
