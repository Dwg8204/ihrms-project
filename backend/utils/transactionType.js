const TRANSACTION_TYPES = Object.freeze({
  INCOME: 'INCOME',
  REFUND: 'REFUND'
});

function isValidTransactionType(type) {
  return Object.values(TRANSACTION_TYPES).includes(type);
}

module.exports = {
  TRANSACTION_TYPES,
  isValidTransactionType
};
