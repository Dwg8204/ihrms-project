-- Migration / Seed v1.12: Demo data for Module 5 - Finance
-- Chèn dữ liệu mẫu payment_schedules + transactions cho 3 ứng viên đầu tiên
USE ihrms_db;

-- ============================================================
-- 1. PAYMENT SCHEDULES (lịch thu phí) cho 3 ứng viên đầu tiên
-- ============================================================

-- Lấy ID của 3 ứng viên đầu tiên vào bảng tạm
CREATE TEMPORARY TABLE tmp_candidates AS
  SELECT id FROM candidates ORDER BY id ASC LIMIT 3;

-- Ứng viên 1: đã đóng phí đăng ký + đào tạo, còn nợ phí visa
INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT
  id,
  'Phí đăng ký hồ sơ', 500000,
  DATE_SUB(CURDATE(), INTERVAL 45 DAY),
  'PAID', 500000,
  0, 0, 0.00,
  'ON_REGISTRATION'
FROM tmp_candidates LIMIT 1;

INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT
  id,
  'Phí hồ sơ (Cọc đợt 1)', 2000000,
  DATE_SUB(CURDATE(), INTERVAL 30 DAY),
  'PAID', 2000000,
  1, 1, 80.00,
  'BEFORE_INTERNAL_EXAM'
FROM tmp_candidates LIMIT 1;

INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT
  id,
  'Học phí đào tạo ngoại ngữ / kỹ năng', 5000000,
  DATE_SUB(CURDATE(), INTERVAL 5 DAY),
  'OVERDUE', 0,
  0, 1, 65.00,
  'BEFORE_INTERNAL_EXAM'
FROM tmp_candidates LIMIT 1;

-- Ứng viên 2: đóng 1 phần học phí, còn nợ
INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT
  id,
  'Phí đăng ký hồ sơ', 500000,
  DATE_SUB(CURDATE(), INTERVAL 60 DAY),
  'PAID', 500000,
  0, 0, 0.00,
  'ON_REGISTRATION'
FROM tmp_candidates ORDER BY id ASC LIMIT 1 OFFSET 1;

INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT
  id,
  'Phí hồ sơ (Cọc đợt 1)', 2000000,
  DATE_SUB(CURDATE(), INTERVAL 20 DAY),
  'PARTIALLY_PAID', 1000000,
  1, 1, 80.00,
  'BEFORE_INTERNAL_EXAM'
FROM tmp_candidates ORDER BY id ASC LIMIT 1 OFFSET 1;

INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT
  id,
  'Học phí đào tạo', 5000000,
  DATE_ADD(CURDATE(), INTERVAL 14 DAY),
  'PENDING', 0,
  0, 1, 65.00,
  'BEFORE_INTERNAL_EXAM'
FROM tmp_candidates ORDER BY id ASC LIMIT 1 OFFSET 1;

-- Ứng viên 3: đã đóng xong + được hoàn phí thi trượt
INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT
  id,
  'Phí đăng ký hồ sơ', 500000,
  DATE_SUB(CURDATE(), INTERVAL 90 DAY),
  'PAID', 500000,
  0, 0, 0.00,
  'ON_REGISTRATION'
FROM tmp_candidates ORDER BY id ASC LIMIT 1 OFFSET 2;

INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT
  id,
  'Phí hồ sơ (Cọc đợt 1)', 2000000,
  DATE_SUB(CURDATE(), INTERVAL 40 DAY),
  'REFUNDED', 0,
  1, 1, 100.00,
  'BEFORE_INTERNAL_EXAM'
FROM tmp_candidates ORDER BY id ASC LIMIT 1 OFFSET 2;

-- ============================================================
-- 2. TRANSACTIONS (giao dịch thực tế) cho các khoản đã PAID
-- ============================================================

-- Thu phí đăng ký ứng viên 1
INSERT INTO transactions
  (candidate_id, fee_standard_id, amount_paid, transaction_type, note, transaction_date)
SELECT
  c.id, fs.id, 500000, 'INCOME',
  'Thu phí đăng ký hồ sơ đợt tiếp nhận',
  DATE_SUB(NOW(), INTERVAL 45 DAY)
FROM tmp_candidates c
CROSS JOIN (SELECT id FROM fee_standards WHERE fee_name LIKE '%đăng ký hồ sơ%' LIMIT 1) fs
LIMIT 1;

-- Thu học phí ứng viên 1
INSERT INTO transactions
  (candidate_id, fee_standard_id, amount_paid, transaction_type, note, transaction_date)
SELECT
  c.id, fs.id, 5000000, 'INCOME',
  'Thu học phí đào tạo – ứng viên 1',
  DATE_SUB(NOW(), INTERVAL 30 DAY)
FROM tmp_candidates c
CROSS JOIN (SELECT id FROM fee_standards WHERE fee_name LIKE '%đào tạo%' LIMIT 1) fs
LIMIT 1;

-- Thu phí đăng ký ứng viên 2
INSERT INTO transactions
  (candidate_id, fee_standard_id, amount_paid, transaction_type, note, transaction_date)
SELECT
  c.id, fs.id, 500000, 'INCOME',
  'Thu phí đăng ký hồ sơ đợt tiếp nhận',
  DATE_SUB(NOW(), INTERVAL 60 DAY)
FROM tmp_candidates c
CROSS JOIN (SELECT id FROM fee_standards WHERE fee_name LIKE '%đăng ký hồ sơ%' LIMIT 1)  fs
ORDER BY c.id ASC LIMIT 1 OFFSET 1;

-- Thu học phí một phần ứng viên 2 lần 1
INSERT INTO transactions
  (candidate_id, fee_standard_id, amount_paid, transaction_type, note, transaction_date)
SELECT
  c.id, fs.id, 2500000, 'INCOME',
  'Thu học phí đợt 1 (đóng bù sau)',
  DATE_SUB(NOW(), INTERVAL 20 DAY)
FROM tmp_candidates c
CROSS JOIN (SELECT id FROM fee_standards WHERE fee_name LIKE '%đào tạo%' LIMIT 1) fs
ORDER BY c.id ASC LIMIT 1 OFFSET 1;

-- Thu phí đăng ký ứng viên 3
INSERT INTO transactions
  (candidate_id, fee_standard_id, amount_paid, transaction_type, note, transaction_date)
SELECT
  c.id, fs.id, 500000, 'INCOME',
  'Thu phí đăng ký hồ sơ',
  DATE_SUB(NOW(), INTERVAL 90 DAY)
FROM tmp_candidates c
CROSS JOIN (SELECT id FROM fee_standards WHERE fee_name LIKE '%đăng ký hồ sơ%' LIMIT 1) fs
ORDER BY c.id ASC LIMIT 1 OFFSET 2;

-- Thu phí thi chứng chỉ ứng viên 3
INSERT INTO transactions
  (candidate_id, fee_standard_id, amount_paid, transaction_type, note, transaction_date)
SELECT
  c.id, fs.id, 2000000, 'INCOME',
  'Thu phí thi chứng chỉ chính thức',
  DATE_SUB(NOW(), INTERVAL 40 DAY)
FROM tmp_candidates c
CROSS JOIN (SELECT id FROM fee_standards WHERE fee_name LIKE '%chứng chỉ%' LIMIT 1) fs
ORDER BY c.id ASC LIMIT 1 OFFSET 2;

-- Hoàn tiền thi trượt ứng viên 3 (TH1 – hoàn 100%)
INSERT INTO transactions
  (candidate_id, fee_standard_id, amount_paid, transaction_type, note, transaction_date)
SELECT
  c.id, fs.id, 2000000, 'REFUND',
  'Hoàn phí thi chứng chỉ – ứng viên trượt thi (TH1 – 100%)',
  DATE_SUB(NOW(), INTERVAL 10 DAY)
FROM tmp_candidates c
CROSS JOIN (SELECT id FROM fee_standards WHERE fee_name LIKE '%chứng chỉ%' LIMIT 1) fs
ORDER BY c.id ASC LIMIT 1 OFFSET 2;

DROP TEMPORARY TABLE IF EXISTS tmp_candidates;
