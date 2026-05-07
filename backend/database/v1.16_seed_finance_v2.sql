-- V1.16: Cập nhật định mức phí toàn diện theo yêu cầu người dùng
-- Xóa các định mức cũ để tránh trùng lặp nếu cần, hoặc chỉ thêm mới
DELETE FROM fee_standards;

INSERT INTO fee_standards 
(fee_name, amount, fee_category, due_event, is_mandatory_for_exit, 
 is_refundable_on_fail_exam, refund_pct_on_fail_exam, 
 is_refundable_on_withdrawal, refund_pct_on_withdrawal, 
 is_refundable_on_no_go, refund_pct_on_no_go)
VALUES
-- 1. Phí đăng ký hồ sơ
('Phí đăng ký hồ sơ', 500000, 'INITIAL', 'ON_REGISTRATION', 1, 0, 0, 0, 0, 0, 0),

-- 2. Phí dịch thuật / công chứng
('Phí dịch thuật / công chứng', 1000000, 'INITIAL', 'ON_REGISTRATION', 1, 0, 0, 0, 0, 0, 0),

-- 3. Phí khám sức khỏe
('Phí khám sức khỏe', 2000000, 'INITIAL', 'ON_REGISTRATION', 1, 0, 0, 0, 0, 0, 0),

-- 4. Học phí đào tạo
('Học phí đào tạo', 15000000, 'TRAINING', 'ON_REGISTRATION', 1, 1, 50, 1, 65, 0, 0),

-- 5. Phí thi kiểm tra nội bộ
('Phí thi kiểm tra nội bộ', 500000, 'EXAM', 'ON_REGISTRATION', 1, 0, 0, 1, 100, 0, 0),

-- 6. Phí thi chứng chỉ chính thức
('Phí thi chứng chỉ chính thức', 2500000, 'EXAM', 'ON_REGISTRATION', 1, 0, 0, 1, 100, 0, 0),

-- 7. Phí môi giới / dịch vụ xuất cảnh
('Phí dịch vụ xuất cảnh', 30000000, 'SERVICE', 'ON_CONTRACT_SIGN', 1, 1, 60, 1, 70, 1, 25),

-- 8. Phí làm visa / hộ chiếu
('Phí làm visa / hộ chiếu', 5000000, 'SERVICE', 'ON_CONTRACT_SIGN', 1, 1, 80, 1, 100, 1, 30),

-- 9. Phí bảo hiểm xuất cảnh
('Phí bảo hiểm xuất cảnh', 3000000, 'OTHER', 'ON_CONTRACT_SIGN', 1, 1, 90, 1, 100, 1, 50),

-- 10. Đặt cọc cam kết
('Đặt cọc cam kết', 10000000, 'DEPOSIT', 'ON_REGISTRATION', 1, 1, 100, 1, 50, 0, 0);
