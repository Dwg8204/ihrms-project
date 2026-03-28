START TRANSACTION;

-- =====================================================
-- A. M1: Chuan hoa trang thai funnel moi + phi dot 0
-- =====================================================

ALTER TABLE candidates
  MODIFY status VARCHAR(50) NOT NULL DEFAULT 'NEW_RECEIVED';

ALTER TABLE candidates
  ADD COLUMN is_fee0_paid TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN fee0_paid_amount DECIMAL(15,2) NULL AFTER is_fee0_paid,
  ADD COLUMN fee0_paid_at DATETIME NULL AFTER fee0_paid_amount;

-- Map trang thai cu sang trang thai moi
UPDATE candidates
SET status = CASE
  WHEN status = 'Lead' THEN 'NEW_RECEIVED'
  WHEN status = 'RECEIVED' THEN 'NEW_RECEIVED'
  WHEN status = 'CONSULTING' THEN 'PAID0_DOCS_SUBMITTED'
  WHEN status = 'ORIGINAL_DOC_SUBMITTED' THEN 'PAID0_DOCS_SUBMITTED'
  WHEN status = 'WAITING_JOB_MATCH' THEN 'WAITING_FORM_MATCH'
  WHEN status = 'WAITING_EXAM' THEN 'FORM_MATCHED_WAITING_EXAM'
  ELSE 'NEW_RECEIVED'
END;

ALTER TABLE candidates
  ADD INDEX idx_candidates_fee0_status (is_fee0_paid, status);

-- =====================================================
-- B. M6: Chuan hoa document_types cho 2 giai doan
-- =====================================================

ALTER TABLE document_types
  ADD COLUMN code VARCHAR(80) NULL AFTER id,
  ADD COLUMN phase ENUM('PRE_EXAM','POST_EXAM') NOT NULL DEFAULT 'PRE_EXAM' AFTER name,
  ADD COLUMN is_required_for_gate TINYINT(1) NOT NULL DEFAULT 0 AFTER is_mandatory,
  ADD COLUMN warning_before_days INT NOT NULL DEFAULT 15 AFTER is_required_for_gate,
  ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER warning_before_days;

UPDATE document_types
SET code = CONCAT('DOC_', id)
WHERE code IS NULL OR code = '';

ALTER TABLE document_types
  MODIFY code VARCHAR(80) NOT NULL,
  ADD CONSTRAINT uq_document_types_code UNIQUE (code);

-- =====================================================
-- C. M6: Chuan hoa candidate_documents cho checklist + alert
-- =====================================================

UPDATE candidate_documents SET status = 'NOT_SUBMITTED' WHERE status = 'Missing';
UPDATE candidate_documents SET status = 'SUBMITTED' WHERE status = 'Processing';
UPDATE candidate_documents SET status = 'VERIFIED' WHERE status = 'Completed';

ALTER TABLE candidate_documents
  MODIFY status VARCHAR(30) NOT NULL DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN expected_complete_date DATE NULL AFTER expiration_date,
  ADD COLUMN submitted_at DATETIME NULL AFTER expected_complete_date,
  ADD COLUMN verified_at DATETIME NULL AFTER submitted_at,
  ADD COLUMN rejected_reason VARCHAR(255) NULL AFTER verified_at,
  ADD COLUMN note TEXT NULL AFTER rejected_reason;

-- Xoa ban ghi trung (neu co) truoc khi them unique key
DELETE cd1
FROM candidate_documents cd1
JOIN candidate_documents cd2
  ON cd1.candidate_id = cd2.candidate_id
 AND cd1.document_type_id = cd2.document_type_id
 AND cd1.id > cd2.id;

ALTER TABLE candidate_documents
  ADD UNIQUE KEY uq_candidate_document (candidate_id, document_type_id),
  ADD INDEX idx_candidate_documents_candidate_status (candidate_id, status),
  ADD INDEX idx_candidate_documents_status_expected (status, expected_complete_date),
  ADD INDEX idx_candidate_documents_expiration (expiration_date);

-- =====================================================
-- D. Seed 7 giay to cung + 3 thu tuc hau thi
-- =====================================================

INSERT INTO document_types
(code, name, phase, is_mandatory, is_required_for_gate, warning_before_days, display_order)
VALUES
('PRE_RESUME', 'So yeu ly lich (Ho so xin viec)', 'PRE_EXAM', 1, 1, 0, 1),
('PRE_HEALTH_CERT', 'Giay kham suc khoe dat chuan', 'PRE_EXAM', 1, 1, 30, 2),
('PRE_POLICE_CONFIRM', 'Giay xac nhan dan su cong an xa', 'PRE_EXAM', 1, 1, 0, 3),
('PRE_MARITAL_CONFIRM', 'Giay xac nhan tinh trang hon nhan', 'PRE_EXAM', 1, 1, 0, 4),
('PRE_HIGHEST_DEGREE', 'Bang tot nghiep cap cao nhat', 'PRE_EXAM', 1, 1, 0, 5),
('PRE_BIRTH_RESIDENCE_ID', 'Khai sinh + xac nhan cu tru + CCCD photo cong chung', 'PRE_EXAM', 1, 1, 0, 6),
('PRE_PROFILE_PHOTO', 'Anh ho so dinh nhat', 'PRE_EXAM', 1, 1, 0, 7),
('POST_VISA', 'Visa', 'POST_EXAM', 1, 0, 15, 8),
('POST_PASSPORT', 'Ho chieu', 'POST_EXAM', 1, 0, 30, 9),
('POST_COE', 'Tu cach luu tru (COE)', 'POST_EXAM', 1, 0, 15, 10)
ON DUPLICATE KEY UPDATE
name = VALUES(name),
phase = VALUES(phase),
is_mandatory = VALUES(is_mandatory),
is_required_for_gate = VALUES(is_required_for_gate),
warning_before_days = VALUES(warning_before_days),
display_order = VALUES(display_order);

COMMIT;