-- Migration v1.11: Module 5 - Finance and Fees
USE ihrms_db;

-- 1. Update candidates table
ALTER TABLE candidates
ADD COLUMN withdrawal_reason TEXT NULL AFTER status;

-- 2. Update fee_standards table
ALTER TABLE fee_standards
CHANGE COLUMN due_date due_event VARCHAR(100) NULL,
ADD COLUMN contract_type VARCHAR(255) NULL AFTER due_event;

ALTER TABLE fee_standards
ADD COLUMN fee_category ENUM('INITIAL', 'TRAINING', 'SERVICE', 'CERTIFICATE', 'VISA_PASSPORT', 'INSURANCE', 'DEPOSIT', 'OTHER') NOT NULL DEFAULT 'OTHER' AFTER amount,
ADD COLUMN is_refundable_on_fail_exam BOOLEAN DEFAULT FALSE AFTER fee_category,
ADD COLUMN refund_pct_on_fail_exam DECIMAL(5,2) DEFAULT 0.00 AFTER is_refundable_on_fail_exam,
ADD COLUMN is_refundable_on_withdrawal BOOLEAN DEFAULT FALSE AFTER refund_pct_on_fail_exam,
ADD COLUMN refund_pct_on_withdrawal DECIMAL(5,2) DEFAULT 0.00 AFTER is_refundable_on_withdrawal,
ADD COLUMN is_refundable_on_no_go BOOLEAN DEFAULT FALSE AFTER refund_pct_on_withdrawal,
ADD COLUMN refund_pct_on_no_go DECIMAL(5,2) DEFAULT 0.00 AFTER is_refundable_on_no_go,
ADD COLUMN is_mandatory_for_exit BOOLEAN DEFAULT FALSE AFTER refund_pct_on_no_go;

-- 3. Create payment_schedules table (Must exist before adding FK to transactions)
CREATE TABLE IF NOT EXISTS payment_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    contract_id INT NULL,
    original_fee_standard_id INT NULL,
    description VARCHAR(255) NOT NULL,
    amount_due DECIMAL(15,2) NOT NULL,
    due_date DATE NULL,
    status ENUM('PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    amount_paid DECIMAL(15,2) DEFAULT 0.00,
    balance DECIMAL(15,2) GENERATED ALWAYS AS (amount_due - amount_paid) STORED,
    is_mandatory_for_exit BOOLEAN DEFAULT FALSE,
    is_refundable BOOLEAN DEFAULT FALSE,
    refund_policy_pct DECIMAL(5,2) DEFAULT 0.00,
    triggered_by_event VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL,
    FOREIGN KEY (original_fee_standard_id) REFERENCES fee_standards(id) ON DELETE SET NULL
);

-- 4. Update transactions table
ALTER TABLE transactions
ADD COLUMN transaction_type ENUM('INCOME', 'REFUND') NOT NULL DEFAULT 'INCOME' AFTER amount_paid,
ADD COLUMN payment_schedule_id INT NULL AFTER transaction_type,
ADD COLUMN note TEXT NULL AFTER receipt_image_url,
ADD COLUMN approved_by_user_id INT NULL AFTER note,
ADD COLUMN is_reconciled BOOLEAN DEFAULT FALSE AFTER approved_by_user_id;

ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_payment_schedule
FOREIGN KEY (payment_schedule_id) REFERENCES payment_schedules(id) ON DELETE SET NULL;

-- 5. Update contracts table
ALTER TABLE contracts
MODIFY COLUMN contract_type VARCHAR(255) NOT NULL DEFAULT 'Thỏa thuận dịch vụ';

-- 7. Seed contract templates
INSERT INTO contract_templates (name, template_type, template_file_url, description) VALUES
('Thỏa thuận dịch vụ', 'docx', 'templates/thoa_thuan_dich_vu.docx', 'Mẫu thỏa thuận dịch vụ chung cho ứng viên'),
('Hợp đồng đào tạo', 'docx', 'templates/hop_dong_dao_tao.docx', 'Hợp đồng đào tạo ngoại ngữ và kỹ năng'),
('Cam kết chống trốn', 'docx', 'templates/cam_ket_chong_tron.docx', 'Bản cam kết dành cho ứng viên đi Nhật'),
('Hợp đồng cung ứng', 'docx', 'templates/hop_dong_cung_ung.docx', 'Hợp đồng cung ứng lao động với đối tác')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 6. Insert and Update fee_standards with rules from cases TH1-TH5
-- Initial entries
-- 6. Insert and Update fee_standards with rules from cases TH1-TH5
-- Using INSERT ... ON DUPLICATE KEY UPDATE for all standard fees
INSERT INTO fee_standards (job_order_id, contract_type, fee_name, amount, fee_category, is_refundable_on_fail_exam, refund_pct_on_fail_exam, is_refundable_on_withdrawal, refund_pct_on_withdrawal, is_refundable_on_no_go, refund_pct_on_no_go, is_mandatory_for_exit, due_event) VALUES
(NULL, NULL, 'Phí đăng ký hồ sơ', 500000.00, 'INITIAL', FALSE, 0.00, FALSE, 0.00, FALSE, 0.00, FALSE, 'ON_REGISTRATION'),
(NULL, NULL, 'Phí dịch thuật / công chứng giấy tờ', 1000000.00, 'SERVICE', FALSE, 0.00, FALSE, 0.00, FALSE, 0.00, FALSE, 'BEFORE_DOC_SUBMISSION'),
(NULL, NULL, 'Phí thi chứng chỉ chính thức', 2000000.00, 'CERTIFICATE', FALSE, 0.00, TRUE, 100.00, FALSE, 0.00, FALSE, 'BEFORE_OFFICIAL_CERT_EXAM'),
(NULL, NULL, 'Phí làm visa / hộ chiếu', 1500000.00, 'VISA_PASSPORT', TRUE, 80.00, TRUE, 100.00, TRUE, 30.00, TRUE, 'BEFORE_VISA_APPLY'),
(NULL, NULL, 'Phí bảo hiểm xuất cảnh', 3000000.00, 'INSURANCE', TRUE, 90.00, TRUE, 100.00, TRUE, 50.00, TRUE, 'BEFORE_DEPARTURE'),
(NULL, 'Hợp đồng đào tạo', 'Học phí đào tạo ngoại ngữ / kỹ năng', 5000000.00, 'TRAINING', TRUE, 50.00, TRUE, 65.00, FALSE, 0.00, FALSE, 'ON_CONTRACT_SIGN'),
(NULL, 'Thỏa thuận dịch vụ', 'Phí môi giới / dịch vụ (Đợt 1)', 10000000.00, 'SERVICE', TRUE, 60.00, TRUE, 70.00, TRUE, 25.00, TRUE, 'ON_CONTRACT_SIGN'),
(NULL, 'Thỏa thuận dịch vụ', 'Tiền cọc cam kết / cọc chống trốn', 20000000.00, 'DEPOSIT', TRUE, 100.00, TRUE, 50.00, FALSE, 0.00, TRUE, 'ON_CONTRACT_SIGN'),
(NULL, NULL, 'Phí khám sức khỏe', 800000.00, 'INITIAL', FALSE, 0.00, FALSE, 0.00, FALSE, 0.00, TRUE, 'BEFORE_HEALTH_CHECK'),
(NULL, NULL, 'Phí thi kiểm tra nội bộ', 300000.00, 'INITIAL', FALSE, 0.00, TRUE, 100.00, FALSE, 0.00, FALSE, 'BEFORE_INTERNAL_EXAM'),
(NULL, NULL, 'Phí hồ sơ (Cọc đợt 1)', 2000000.00, 'INITIAL', TRUE, 100.00, TRUE, 80.00, FALSE, 0.00, TRUE, 'ON_PASSED_EXAM')
ON DUPLICATE KEY UPDATE 
    amount = VALUES(amount),
    fee_category = VALUES(fee_category),
    is_refundable_on_fail_exam = VALUES(is_refundable_on_fail_exam),
    refund_pct_on_fail_exam = VALUES(refund_pct_on_fail_exam),
    is_refundable_on_withdrawal = VALUES(is_refundable_on_withdrawal),
    refund_pct_on_withdrawal = VALUES(refund_pct_on_withdrawal),
    is_refundable_on_no_go = VALUES(is_refundable_on_no_go),
    refund_pct_on_no_go = VALUES(refund_pct_on_no_go),
    is_mandatory_for_exit = VALUES(is_mandatory_for_exit),
    due_event = VALUES(due_event);
