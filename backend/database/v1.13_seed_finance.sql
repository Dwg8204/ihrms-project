-- Seed v1.13: Dữ liệu mẫu để test trang Tổng quan Tài chính
-- Tự động lấy ID từ candidates + fee_standards hiện có
USE ihrms_db;

-- ============================================================
-- Tạo bảng tạm chứa 5 ứng viên đầu tiên
-- ============================================================
DROP TEMPORARY TABLE IF EXISTS tmp_cands;
CREATE TEMPORARY TABLE tmp_cands AS
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM candidates ORDER BY id LIMIT 5;

-- ============================================================
-- Chèn payment_schedules (tránh trùng nếu chạy lại)
-- ============================================================

-- Ứng viên rn=1: PAID đủ 2 khoản
INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT id, 'Phí đăng ký hồ sơ', 500000,
  DATE_SUB(CURDATE(), INTERVAL 60 DAY), 'PAID', 500000, 0, 0, 0, 'ON_REGISTRATION'
FROM tmp_cands WHERE rn = 1;

INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT id, 'Học phí đào tạo', 5000000,
  DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'PAID', 5000000, 0, 1, 65, 'ON_CONTRACT_SIGN'
FROM tmp_cands WHERE rn = 1;

-- Ứng viên rn=2: PAID 1 khoản, PARTIALLY_PAID 1 khoản, OVERDUE 1 khoản
INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT id, 'Phí đăng ký hồ sơ', 500000,
  DATE_SUB(CURDATE(), INTERVAL 75 DAY), 'PAID', 500000, 0, 0, 0, 'ON_REGISTRATION'
FROM tmp_cands WHERE rn = 2;

INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT id, 'Học phí đào tạo', 5000000,
  DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'PARTIALLY_PAID', 2500000, 0, 1, 65, 'ON_CONTRACT_SIGN'
FROM tmp_cands WHERE rn = 2;

INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT id, 'Phí làm visa / hộ chiếu', 1500000,
  DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'OVERDUE', 0, 1, 1, 100, 'BEFORE_VISA_APPLY'
FROM tmp_cands WHERE rn = 2;

-- Ứng viên rn=3: PAID rồi REFUNDED (thi trượt TH1)
INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT id, 'Phí thi chứng chỉ', 2000000,
  DATE_SUB(CURDATE(), INTERVAL 45 DAY), 'REFUNDED', 0, 0, 1, 100, 'BEFORE_OFFICIAL_CERT_EXAM'
FROM tmp_cands WHERE rn = 3;

-- Ứng viên rn=4: PENDING chưa đóng gì
INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT id, 'Phí bảo hiểm xuất cảnh', 3000000,
  DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'PENDING', 0, 1, 1, 50, 'BEFORE_DEPARTURE'
FROM tmp_cands WHERE rn = 4;

-- Ứng viên rn=5: PAID đủ 3 khoản
INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT id, 'Phí đăng ký hồ sơ', 500000,
  DATE_SUB(CURDATE(), INTERVAL 90 DAY), 'PAID', 500000, 0, 0, 0, 'ON_REGISTRATION'
FROM tmp_cands WHERE rn = 5;

INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT id, 'Học phí đào tạo', 5000000,
  DATE_SUB(CURDATE(), INTERVAL 55 DAY), 'PAID', 5000000, 0, 1, 65, 'ON_CONTRACT_SIGN'
FROM tmp_cands WHERE rn = 5;

INSERT INTO payment_schedules
  (candidate_id, description, amount_due, due_date, status, amount_paid,
   is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event)
SELECT id, 'Phí làm visa / hộ chiếu', 1500000,
  DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'PAID', 1500000, 1, 1, 100, 'BEFORE_VISA_APPLY'
FROM tmp_cands WHERE rn = 5;

-- ============================================================
-- Chèn TRANSACTIONS — dữ liệu hiển thị trên tab Tổng quan
-- ============================================================

-- Ứng viên 1: 2 lần thu
INSERT INTO transactions (candidate_id, amount_paid, transaction_type, note, transaction_date)
SELECT id, 500000, 'INCOME', 'Thu phí đăng ký hồ sơ', DATE_SUB(NOW(), INTERVAL 60 DAY)
FROM tmp_cands WHERE rn = 1;

INSERT INTO transactions (candidate_id, amount_paid, transaction_type, note, transaction_date)
SELECT id, 5000000, 'INCOME', 'Thu học phí đào tạo đợt 1', DATE_SUB(NOW(), INTERVAL 30 DAY)
FROM tmp_cands WHERE rn = 1;

-- Ứng viên 2: 2 lần thu (1 khoản đóng đủ, 1 khoản đóng nửa)
INSERT INTO transactions (candidate_id, amount_paid, transaction_type, note, transaction_date)
SELECT id, 500000, 'INCOME', 'Thu phí đăng ký hồ sơ', DATE_SUB(NOW(), INTERVAL 75 DAY)
FROM tmp_cands WHERE rn = 2;

INSERT INTO transactions (candidate_id, amount_paid, transaction_type, note, transaction_date)
SELECT id, 2500000, 'INCOME', 'Thu học phí đào tạo – đóng một phần', DATE_SUB(NOW(), INTERVAL 20 DAY)
FROM tmp_cands WHERE rn = 2;

-- Ứng viên 3: thu rồi hoàn (thi trượt TH1)
INSERT INTO transactions (candidate_id, amount_paid, transaction_type, note, transaction_date)
SELECT id, 2000000, 'INCOME', 'Thu phí thi chứng chỉ chính thức', DATE_SUB(NOW(), INTERVAL 45 DAY)
FROM tmp_cands WHERE rn = 3;

INSERT INTO transactions (candidate_id, amount_paid, transaction_type, note, transaction_date)
SELECT id, 2000000, 'REFUND', 'Hoàn phí thi chứng chỉ – ứng viên trượt thi (TH1 – 100%)', DATE_SUB(NOW(), INTERVAL 15 DAY)
FROM tmp_cands WHERE rn = 3;

-- Ứng viên 5: 3 lần thu
INSERT INTO transactions (candidate_id, amount_paid, transaction_type, note, transaction_date)
SELECT id, 500000, 'INCOME', 'Thu phí đăng ký hồ sơ', DATE_SUB(NOW(), INTERVAL 90 DAY)
FROM tmp_cands WHERE rn = 5;

INSERT INTO transactions (candidate_id, amount_paid, transaction_type, note, transaction_date)
SELECT id, 5000000, 'INCOME', 'Thu học phí đào tạo đầy đủ', DATE_SUB(NOW(), INTERVAL 55 DAY)
FROM tmp_cands WHERE rn = 5;

INSERT INTO transactions (candidate_id, amount_paid, transaction_type, note, transaction_date)
SELECT id, 1500000, 'INCOME', 'Thu phí visa / hộ chiếu', DATE_SUB(NOW(), INTERVAL 10 DAY)
FROM tmp_cands WHERE rn = 5;

DROP TEMPORARY TABLE IF EXISTS tmp_cands;

-- Kiểm tra kết quả
SELECT
  CONCAT(FORMAT(SUM(CASE WHEN transaction_type='INCOME' THEN amount_paid ELSE 0 END),0),' VND') AS tong_thu,
  CONCAT(FORMAT(SUM(CASE WHEN transaction_type='REFUND' THEN amount_paid ELSE 0 END),0),' VND') AS tong_hoan,
  COUNT(*) AS so_giao_dich
FROM transactions;
