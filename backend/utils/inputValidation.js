function normalizeDigits(value, maxLength = null) {
  const digits = String(value || '').replace(/\D/g, '');
  return typeof maxLength === 'number' ? digits.slice(0, maxLength) : digits;
}

function normalizePhoneNumber(value) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;
  return normalizeDigits(value);
}

function isValidVietnamesePhoneNumber(value) {
  return /^0\d{9}$/.test(String(value || ''));
}

function normalizeEmail(value) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;
  return String(value).trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function normalizeGender(value) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (['nam', 'male', 'm'].includes(normalized)) return 'Nam';
  if (['nu', 'female', 'f'].includes(normalized)) return 'Nữ';
  return String(value).trim();
}

function isValidCandidateGender(value) {
  return value === 'Nam' || value === 'Nữ';
}

function parseDateOnly(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function isPastDateOnly(value) {
  const parsed = parseDateOnly(value);
  if (!parsed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed < today;
}

function parseDateTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isFutureDateTime(value) {
  const parsed = parseDateTime(value);
  return Boolean(parsed) && parsed.getTime() > Date.now();
}

module.exports = {
  normalizeDigits,
  normalizePhoneNumber,
  isValidVietnamesePhoneNumber,
  normalizeEmail,
  isValidEmail,
  normalizeGender,
  isValidCandidateGender,
  parseDateOnly,
  isPastDateOnly,
  parseDateTime,
  isFutureDateTime
};
