USE ihrms_db;

-- v1.17: Replace old business seed data with one realistic, linked dataset for all modules.

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE incident_logs;
TRUNCATE TABLE overseas_records;
TRUNCATE TABLE transactions;
TRUNCATE TABLE payment_schedules;
TRUNCATE TABLE contracts;
TRUNCATE TABLE exam_applications;
TRUNCATE TABLE class_students;
TRUNCATE TABLE classes;
TRUNCATE TABLE teachers;
TRUNCATE TABLE email_logs;
TRUNCATE TABLE candidate_documents;
TRUNCATE TABLE job_orders;
TRUNCATE TABLE partner_contacts;
TRUNCATE TABLE partners;
TRUNCATE TABLE candidates;
TRUNCATE TABLE recruitment_sources;
SET FOREIGN_KEY_CHECKS = 1;

-- Recruitment sources
INSERT INTO recruitment_sources (source_name) VALUES
('Facebook Ads'),
('Tiktok Organic'),
('CTV địa phương'),
('Giới thiệu nội bộ'),
('Website công ty');

-- Partners
INSERT INTO partners (name, country, status) VALUES
('Nghiệp đoàn Sakura Human Link', 'Nhật Bản', 'ACTIVE'),
('Kansai Tech Cooperative', 'Nhật Bản', 'ACTIVE'),
('Mirae Industrial Co., Ltd', 'Hàn Quốc', 'ON_HOLD'),
('Taiwan Formosa Manufacturing', 'Đài Loan', 'ACTIVE');

INSERT INTO partner_contacts (partner_id, contact_name, contact_phone, contact_email, contact_role, is_primary)
SELECT p.id, 'Sato Kenji', '0903000001', 'kenji.sato@sakura.co.jp', 'Trưởng phòng tiếp nhận', 1
FROM partners p WHERE p.name = 'Nghiệp đoàn Sakura Human Link'
UNION ALL
SELECT p.id, 'Nguyễn Hoài Nam', '0903000002', 'nam.nguyen@sakura.co.jp', 'Điều phối Việt Nam', 0
FROM partners p WHERE p.name = 'Nghiệp đoàn Sakura Human Link'
UNION ALL
SELECT p.id, 'Yamamoto Rei', '0903000011', 'yamamoto.rei@kansai.jp', 'HR Manager', 1
FROM partners p WHERE p.name = 'Kansai Tech Cooperative'
UNION ALL
SELECT p.id, 'Park Minseo', '0903000021', 'park.minseo@mirae.kr', 'International Recruiter', 1
FROM partners p WHERE p.name = 'Mirae Industrial Co., Ltd'
UNION ALL
SELECT p.id, 'Liu Cheng', '0903000031', 'liu.cheng@formosa.tw', 'Overseas HR', 1
FROM partners p WHERE p.name = 'Taiwan Formosa Manufacturing';

-- Job orders
INSERT INTO job_orders (partner_id, job_title, quantity_needed, salary_info, requirements, deadline, status)
SELECT p.id, 'Hàn bán tự động', 18, '32-38 triệu/tháng',
       JSON_OBJECT('gender', 'male', 'experience', '6 tháng hàn cơ bản', 'education_level', JSON_ARRAY(2, 3, 4), 'japanese_level', 'N5'),
       DATE_ADD(CURDATE(), INTERVAL 70 DAY), 'OPEN'
FROM partners p WHERE p.name = 'Nghiệp đoàn Sakura Human Link'
UNION ALL
SELECT p.id, 'Gia công tiện CNC', 12, '30-36 triệu/tháng',
       JSON_OBJECT('gender', 'any', 'experience', 'Ưu tiên từng làm xưởng cơ khí', 'education_level', JSON_ARRAY(2, 3, 4), 'japanese_level', 'N4'),
       DATE_ADD(CURDATE(), INTERVAL 95 DAY), 'OPEN'
FROM partners p WHERE p.name = 'Kansai Tech Cooperative'
UNION ALL
SELECT p.id, 'Lắp ráp linh kiện điện tử', 25, '24-29 triệu/tháng',
       JSON_OBJECT('gender', 'female', 'experience', 'Khéo tay, làm ca', 'education_level', JSON_ARRAY(2, 3), 'language', 'Korean basic'),
       DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'OPEN'
FROM partners p WHERE p.name = 'Mirae Industrial Co., Ltd'
UNION ALL
SELECT p.id, 'Chế biến thực phẩm', 20, '26-31 triệu/tháng',
       JSON_OBJECT('gender', 'any', 'experience', 'Kỷ luật tốt', 'education_level', JSON_ARRAY(1, 2, 3), 'language', 'Chinese basic'),
       DATE_ADD(CURDATE(), INTERVAL 120 DAY), 'OPEN'
FROM partners p WHERE p.name = 'Taiwan Formosa Manufacturing'
UNION ALL
SELECT p.id, 'Sơn kim loại công nghiệp', 8, '31-35 triệu/tháng',
       JSON_OBJECT('gender', 'male', 'experience', 'Có kinh nghiệm xưởng sơn', 'education_level', JSON_ARRAY(2, 3), 'japanese_level', 'N5'),
       DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'FILLED'
FROM partners p WHERE p.name = 'Nghiệp đoàn Sakura Human Link';

SET @edu_default := (SELECT id FROM education_levels ORDER BY display_order ASC, id ASC LIMIT 1);
SET @edu_cap3 := COALESCE((SELECT id FROM education_levels WHERE name = 'Cấp 3' LIMIT 1), @edu_default);
SET @edu_trung_cap := COALESCE((SELECT id FROM education_levels WHERE name = 'Trung cấp' LIMIT 1), @edu_default);
SET @edu_cao_dang := COALESCE((SELECT id FROM education_levels WHERE name = 'Cao đẳng' LIMIT 1), @edu_default);
SET @edu_dai_hoc := COALESCE((SELECT id FROM education_levels WHERE name = 'Đại học' LIMIT 1), @edu_default);

-- Candidates across full funnel statuses
INSERT INTO candidates (
  citizen_id, full_name, dob, gender, phone, email, address,
  height, weight, blood_type, education_level, experience_summary,
  source_id, source_note, status, is_fee0_paid, fee0_paid_amount, fee0_paid_at,
  withdrawal_reason, cv_file_url
) VALUES
('111111111001', 'Nguyễn Văn Long', '1998-05-12', 'Nam', '0912000001', 'long.nguyen@demo.vn', 'Nam Từ Liêm, Hà Nội', 170, 62, 'O', @edu_cap3, 'Đã từng làm xưởng cơ khí 1 năm', 1, 'Quan tâm đơn hàn', 'FORM_MATCHED_WAITING_EXAM', 1, 500000, DATE_SUB(NOW(), INTERVAL 25 DAY), NULL, 'https://files.example.com/cv/111111111001.pdf'),
('111111111002', 'Trần Thị Lan', '2000-01-21', 'Nữ', '0912000002', 'lan.tran@demo.vn', 'Kiến An, Hải Phòng', 158, 49, 'A', @edu_cao_dang, 'Làm dây chuyền điện tử 8 tháng', 2, 'Follow fanpage', 'FORM_MATCHED_WAITING_EXAM', 1, 500000, DATE_SUB(NOW(), INTERVAL 22 DAY), NULL, 'https://files.example.com/cv/111111111002.pdf'),
('111111111003', 'Lê Quốc Minh', '1997-09-03', 'Nam', '0912000003', 'minh.le@demo.vn', 'Hồng Bàng, Hải Phòng', 172, 66, 'B', @edu_trung_cap, 'Thợ tiện cơ khí 2 năm', 3, 'CTV huyện giới thiệu', 'PASSED', 1, 500000, DATE_SUB(NOW(), INTERVAL 40 DAY), NULL, 'https://files.example.com/cv/111111111003.pdf'),
('111111111004', 'Phạm Thu Huyền', '1999-11-17', 'Nữ', '0912000004', 'huyen.pham@demo.vn', 'Thanh Khê, Đà Nẵng', 160, 50, 'AB', @edu_cap3, 'Kinh nghiệm QC điện tử', 1, 'Tự để lại form website', 'FAILED_POOL', 1, 500000, DATE_SUB(NOW(), INTERVAL 38 DAY), NULL, 'https://files.example.com/cv/111111111004.pdf'),
('111111111005', 'Hoàng Văn Nam', '2001-02-08', 'Nam', '0912000005', 'nam.hoang@demo.vn', 'Thuận An, Bình Dương', 168, 60, 'O', @edu_trung_cap, 'Mới đi làm 6 tháng', 4, 'Được người thân giới thiệu', 'WAITING_FORM_MATCH', 1, 500000, DATE_SUB(NOW(), INTERVAL 19 DAY), NULL, 'https://files.example.com/cv/111111111005.pdf'),
('111111111006', 'Đặng Thị Mai', '2002-03-24', 'Nữ', '0912000006', 'mai.dang@demo.vn', 'Ninh Kiều, Cần Thơ', 157, 48, 'A', @edu_cap3, 'Chưa có kinh nghiệm', 5, 'Đăng ký trên website', 'FORM_MATCHED_WAITING_EXAM', 1, 500000, DATE_SUB(NOW(), INTERVAL 17 DAY), NULL, 'https://files.example.com/cv/111111111006.pdf'),
('111111111007', 'Bùi Thanh Sơn', '1996-12-29', 'Nam', '0912000007', 'son.bui@demo.vn', 'Ba Đình, Hà Nội', 175, 70, 'O', @edu_dai_hoc, 'Đã từng đi xuất khẩu lao động', 2, 'Inbox trực tiếp', 'PAID0_DOCS_SUBMITTED', 1, 500000, DATE_SUB(NOW(), INTERVAL 12 DAY), NULL, 'https://files.example.com/cv/111111111007.pdf'),
('111111111008', 'Vũ Thị Ngọc', '2000-06-10', 'Nữ', '0912000008', 'ngoc.vu@demo.vn', 'Hải Châu, Đà Nẵng', 159, 47, 'B', @edu_cao_dang, 'Thực tập may công nghiệp', 1, 'Facebook Ads', 'PAID0_DOCS_SUBMITTED', 1, 500000, DATE_SUB(NOW(), INTERVAL 10 DAY), NULL, 'https://files.example.com/cv/111111111008.pdf'),
('111111111009', 'Ngô Đức Huy', '1998-08-15', 'Nam', '0912000009', 'huy.ngo@demo.vn', 'Tam Kỳ, Quảng Nam', 173, 64, 'A', @edu_trung_cap, 'Có chứng chỉ hàn cơ bản', 3, 'Nguồn cộng tác viên', 'WAITING_FORM_MATCH', 1, 500000, DATE_SUB(NOW(), INTERVAL 14 DAY), NULL, 'https://files.example.com/cv/111111111009.pdf'),
('111111111010', 'Phan Gia Bảo', '1997-10-05', 'Nam', '0912000010', 'bao.phan@demo.vn', 'Vĩnh Yên, Vĩnh Phúc', 171, 63, 'AB', @edu_cap3, 'Đã làm lắp ráp 1 năm', 4, 'Người cũ giới thiệu', 'PASSED', 1, 500000, DATE_SUB(NOW(), INTERVAL 46 DAY), NULL, 'https://files.example.com/cv/111111111010.pdf'),
('111111111011', 'Lý Thị Thảo', '2001-09-30', 'Nữ', '0912000011', 'thao.ly@demo.vn', 'Lệ Thủy, Quảng Bình', 156, 46, 'O', @edu_cap3, 'Mới tốt nghiệp', 5, 'Website', 'NEW_RECEIVED', 0, NULL, NULL, NULL, 'https://files.example.com/cv/111111111011.pdf'),
('111111111012', 'Đỗ Văn Phúc', '1999-04-27', 'Nam', '0912000012', 'phuc.do@demo.vn', 'Long Biên, Hà Nội', 174, 68, 'B', @edu_trung_cap, 'Tổ trưởng chuyền phụ', 2, 'Fanpage + telesale', 'FAILED_POOL', 1, 500000, DATE_SUB(NOW(), INTERVAL 29 DAY), NULL, 'https://files.example.com/cv/111111111012.pdf'),
('111111111013', 'Tạ Minh Quân', '2003-01-16', 'Nam', '0912000013', 'quan.ta@demo.vn', 'Bến Cát, Bình Dương', 169, 59, 'A', @edu_cap3, 'Làm kho vận 6 tháng', 1, 'Facebook form', 'NEW_RECEIVED', 0, NULL, NULL, NULL, 'https://files.example.com/cv/111111111013.pdf'),
('111111111014', 'Châu Mỹ Linh', '2000-12-11', 'Nữ', '0912000014', 'linh.chau@demo.vn', 'Sơn Trà, Đà Nẵng', 160, 50, 'AB', @edu_cao_dang, 'Kỹ năng tiếng Nhật N4', 4, 'Giới thiệu nội bộ', 'WAITING_FORM_MATCH', 1, 500000, DATE_SUB(NOW(), INTERVAL 16 DAY), NULL, 'https://files.example.com/cv/111111111014.pdf'),
('111111111015', 'Nguyễn Hoài An', '1998-07-19', 'Nữ', '0912000015', 'an.nguyen@demo.vn', 'Hạ Long, Quảng Ninh', 161, 52, 'O', @edu_dai_hoc, 'Có kinh nghiệm điều dưỡng', 5, 'Website + hotline', 'CONTRACT_SIGNED', 1, 500000, DATE_SUB(NOW(), INTERVAL 65 DAY), NULL, 'https://files.example.com/cv/111111111015.pdf'),
('111111111016', 'Phùng Văn Tài', '1997-03-08', 'Nam', '0912000016', 'tai.phung@demo.vn', 'Tam Điệp, Ninh Bình', 176, 72, 'B', @edu_trung_cap, 'Rút hồ sơ do đổi kế hoạch cá nhân', 3, 'CTV huyện', 'WITHDRAWN', 0, NULL, NULL, 'Đổi kế hoạch gia đình, không đi nước ngoài', 'https://files.example.com/cv/111111111016.pdf');

-- Candidate documents: initialize full checklist for every candidate
INSERT INTO candidate_documents (candidate_id, document_type_id, status, note)
SELECT c.id, dt.id, 'NOT_SUBMITTED', 'Khởi tạo checklist theo loại giấy tờ'
FROM candidates c
CROSS JOIN document_types dt;

-- PRE_EXAM docs verified for progressed candidates
UPDATE candidate_documents cd
JOIN candidates c ON c.id = cd.candidate_id
JOIN document_types dt ON dt.id = cd.document_type_id
SET
  cd.status = 'VERIFIED',
  cd.issue_date = DATE_SUB(CURDATE(), INTERVAL 90 DAY),
  cd.expiration_date = CASE
    WHEN dt.code = 'PRE_HEALTH_CERT' AND c.status = 'CONTRACT_SIGNED' THEN DATE_ADD(CURDATE(), INTERVAL 20 DAY)
    WHEN dt.code = 'PRE_HEALTH_CERT' THEN DATE_ADD(CURDATE(), INTERVAL 150 DAY)
    ELSE NULL
  END,
  cd.submitted_at = DATE_SUB(NOW(), INTERVAL 55 DAY),
  cd.verified_at = DATE_SUB(NOW(), INTERVAL 50 DAY),
  cd.file_url = CONCAT('https://files.example.com/docs/', c.citizen_id, '/', dt.code, '.pdf'),
  cd.note = 'Đã xác minh hồ sơ đầu vào'
WHERE dt.phase = 'PRE_EXAM'
  AND c.status IN ('WAITING_FORM_MATCH', 'FORM_MATCHED_WAITING_EXAM', 'PASSED', 'FAILED_POOL', 'CONTRACT_SIGNED');

-- PRE_EXAM docs submitted but not verified yet
UPDATE candidate_documents cd
JOIN candidates c ON c.id = cd.candidate_id
JOIN document_types dt ON dt.id = cd.document_type_id
SET
  cd.status = 'SUBMITTED',
  cd.submitted_at = DATE_SUB(NOW(), INTERVAL 8 DAY),
  cd.expected_complete_date = DATE_ADD(CURDATE(), INTERVAL 6 DAY),
  cd.file_url = CONCAT('https://files.example.com/docs/', c.citizen_id, '/', dt.code, '.pdf'),
  cd.note = 'Đã nộp, chờ kiểm tra bản gốc'
WHERE dt.phase = 'PRE_EXAM'
  AND c.status = 'PAID0_DOCS_SUBMITTED';

-- POST_EXAM docs for passed / contracted candidates
UPDATE candidate_documents cd
JOIN candidates c ON c.id = cd.candidate_id
JOIN document_types dt ON dt.id = cd.document_type_id
SET
  cd.status = 'SUBMITTED',
  cd.submitted_at = DATE_SUB(NOW(), INTERVAL 12 DAY),
  cd.expected_complete_date = DATE_ADD(CURDATE(), INTERVAL 18 DAY),
  cd.file_url = CONCAT('https://files.example.com/docs/', c.citizen_id, '/', dt.code, '.pdf'),
  cd.note = 'Đang xử lý hồ sơ hậu thi'
WHERE dt.phase = 'POST_EXAM'
  AND c.status IN ('PASSED', 'CONTRACT_SIGNED');

-- Contract signed candidate has verified visa/passport already
UPDATE candidate_documents cd
JOIN candidates c ON c.id = cd.candidate_id
JOIN document_types dt ON dt.id = cd.document_type_id
SET
  cd.status = 'VERIFIED',
  cd.issue_date = DATE_SUB(CURDATE(), INTERVAL 40 DAY),
  cd.expiration_date = CASE
    WHEN dt.code = 'POST_VISA' THEN DATE_ADD(CURDATE(), INTERVAL 170 DAY)
    WHEN dt.code = 'POST_PASSPORT' THEN DATE_ADD(CURDATE(), INTERVAL 1825 DAY)
    ELSE NULL
  END,
  cd.verified_at = DATE_SUB(NOW(), INTERVAL 7 DAY),
  cd.note = 'Hoàn tất giấy tờ xuất cảnh trọng yếu'
WHERE c.citizen_id = '111111111015'
  AND dt.code IN ('POST_VISA', 'POST_PASSPORT');

-- Exam sessions and results
INSERT INTO exam_applications (candidate_id, job_order_id, exam_date, result_status, score_details, note)
SELECT c.id, jo.id, DATE_ADD(NOW(), INTERVAL 2 DAY), 'Pending', NULL, 'Ca thi sáng - đợt 1'
FROM candidates c, job_orders jo
WHERE c.citizen_id = '111111111001' AND jo.job_title = 'Hàn bán tự động'
UNION ALL
SELECT c.id, jo.id, DATE_ADD(NOW(), INTERVAL 2 DAY), 'Pending', NULL, 'Ca thi sáng - đợt 1'
FROM candidates c, job_orders jo
WHERE c.citizen_id = '111111111002' AND jo.job_title = 'Hàn bán tự động'
UNION ALL
SELECT c.id, jo.id, DATE_SUB(NOW(), INTERVAL 6 DAY), 'Pass', JSON_OBJECT('discipline', 8.0, 'skill', 8.8, 'language', 7.2), 'Đạt chuẩn đầu vào'
FROM candidates c, job_orders jo
WHERE c.citizen_id = '111111111003' AND jo.job_title = 'Gia công tiện CNC'
UNION ALL
SELECT c.id, jo.id, DATE_SUB(NOW(), INTERVAL 6 DAY), 'Fail', JSON_OBJECT('discipline', 7.0, 'skill', 5.2, 'language', 6.1), 'Tay nghề chưa đạt yêu cầu vị trí'
FROM candidates c, job_orders jo
WHERE c.citizen_id = '111111111004' AND jo.job_title = 'Gia công tiện CNC'
UNION ALL
SELECT c.id, jo.id, DATE_SUB(NOW(), INTERVAL 3 DAY), 'Reserve', JSON_OBJECT('discipline', 8.2, 'skill', 6.8, 'language', 6.5), 'Đưa vào danh sách dự bị'
FROM candidates c, job_orders jo
WHERE c.citizen_id = '111111111005' AND jo.job_title = 'Lắp ráp linh kiện điện tử'
UNION ALL
SELECT c.id, jo.id, DATE_ADD(NOW(), INTERVAL 4 DAY), 'Pending', NULL, 'Ca thi chiều - bổ sung'
FROM candidates c, job_orders jo
WHERE c.citizen_id = '111111111006' AND jo.job_title = 'Lắp ráp linh kiện điện tử'
UNION ALL
SELECT c.id, jo.id, DATE_SUB(NOW(), INTERVAL 14 DAY), 'Pass', JSON_OBJECT('discipline', 8.4, 'skill', 8.0, 'language', 7.0), 'Đủ điều kiện tạo hợp đồng'
FROM candidates c, job_orders jo
WHERE c.citizen_id = '111111111010' AND jo.job_title = 'Chế biến thực phẩm'
UNION ALL
SELECT c.id, jo.id, DATE_SUB(NOW(), INTERVAL 10 DAY), 'Fail', JSON_OBJECT('discipline', 6.4, 'skill', 5.8, 'language', 5.5), 'Không đạt thể lực theo chuẩn đơn hàng'
FROM candidates c, job_orders jo
WHERE c.citizen_id = '111111111012' AND jo.job_title = 'Chế biến thực phẩm'
UNION ALL
SELECT c.id, jo.id, DATE_SUB(NOW(), INTERVAL 18 DAY), 'Pass', JSON_OBJECT('discipline', 9.0, 'skill', 8.6, 'language', 7.8), 'Ứng viên ưu tiên ký hợp đồng'
FROM candidates c, job_orders jo
WHERE c.citizen_id = '111111111015' AND jo.job_title = 'Sơn kim loại công nghiệp';

-- Contracts for passed candidates
INSERT INTO contracts (
  candidate_id, job_order_id, contract_number, contract_type,
  signed_date, effective_date, expiry_date, status,
  document_url, contract_details_json
)
SELECT c.id, jo.id, 'HD-2605-0001', 'Thỏa thuận dịch vụ',
       DATE_SUB(CURDATE(), INTERVAL 4 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 360 DAY), 'PENDING_SIGNATURE',
       'https://files.example.com/contracts/HD-2605-0001.pdf',
       JSON_OBJECT('broker_fee', 30000000, 'training_fee', 15000000, 'payment_plan', '4 đợt')
FROM candidates c, job_orders jo
WHERE c.citizen_id = '111111111003' AND jo.job_title = 'Gia công tiện CNC'
UNION ALL
SELECT c.id, jo.id, 'HD-2604-0015', 'Thỏa thuận dịch vụ',
       DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 365 DAY), 'SIGNED',
       'https://files.example.com/contracts/HD-2604-0015.pdf',
       JSON_OBJECT('broker_fee', 30000000, 'service_fee', 5000000, 'deposit', 10000000)
FROM candidates c, job_orders jo
WHERE c.citizen_id = '111111111015' AND jo.job_title = 'Sơn kim loại công nghiệp';

SET @fs_reg := (SELECT id FROM fee_standards WHERE fee_name = 'Phí đăng ký hồ sơ' LIMIT 1);
SET @fs_translate := (SELECT id FROM fee_standards WHERE fee_name = 'Phí dịch thuật / công chứng' LIMIT 1);
SET @fs_training := (SELECT id FROM fee_standards WHERE fee_name = 'Học phí đào tạo' LIMIT 1);
SET @fs_service := (SELECT id FROM fee_standards WHERE fee_name = 'Phí dịch vụ xuất cảnh' LIMIT 1);
SET @fs_deposit := (SELECT id FROM fee_standards WHERE fee_name = 'Đặt cọc cam kết' LIMIT 1);

-- Payment schedules (finance module)
INSERT INTO payment_schedules (
  candidate_id, contract_id, original_fee_standard_id, description,
  amount_due, due_date, status, amount_paid,
  is_mandatory_for_exit, is_refundable, refund_policy_pct, triggered_by_event
)
SELECT c.id, NULL, @fs_reg, 'Phí đăng ký hồ sơ', 500000, DATE_SUB(CURDATE(), INTERVAL 25 DAY), 'PAID', 500000, 1, 0, 0, 'ON_REGISTRATION'
FROM candidates c WHERE c.citizen_id = '111111111001'
UNION ALL
SELECT c.id, NULL, @fs_translate, 'Phí dịch thuật / công chứng', 1000000, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'PAID', 1000000, 1, 0, 0, 'ON_REGISTRATION'
FROM candidates c WHERE c.citizen_id = '111111111001'
UNION ALL
SELECT c.id, ct.id, @fs_training, 'Học phí đào tạo', 15000000, DATE_SUB(CURDATE(), INTERVAL 8 DAY), 'PARTIALLY_PAID', 7000000, 1, 1, 50, 'BEFORE_INTERNAL_EXAM'
FROM candidates c
JOIN contracts ct ON ct.candidate_id = c.id
WHERE c.citizen_id = '111111111015'
UNION ALL
SELECT c.id, ct.id, @fs_service, 'Phí dịch vụ xuất cảnh', 30000000, DATE_ADD(CURDATE(), INTERVAL 20 DAY), 'PENDING', 0, 1, 1, 70, 'ON_CONTRACT_SIGN'
FROM candidates c
JOIN contracts ct ON ct.candidate_id = c.id
WHERE c.citizen_id = '111111111015'
UNION ALL
SELECT c.id, ct.id, @fs_deposit, 'Đặt cọc cam kết', 10000000, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'OVERDUE', 0, 1, 1, 50, 'ON_CONTRACT_SIGN'
FROM candidates c
JOIN contracts ct ON ct.candidate_id = c.id
WHERE c.citizen_id = '111111111015'
UNION ALL
SELECT c.id, ct.id, @fs_training, 'Học phí đào tạo', 15000000, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'PENDING', 0, 1, 1, 50, 'BEFORE_INTERNAL_EXAM'
FROM candidates c
JOIN contracts ct ON ct.candidate_id = c.id
WHERE c.citizen_id = '111111111003';

-- Transactions linked to schedules
INSERT INTO transactions (
  candidate_id, fee_standard_id, contract_id, payment_schedule_id,
  amount_paid, transaction_type, note, receipt_image_url,
  approved_by_user_id, is_reconciled, transaction_date
)
SELECT ps.candidate_id, ps.original_fee_standard_id, ps.contract_id, ps.id,
       500000, 'INCOME', 'Thu đủ phí đăng ký hồ sơ', 'https://files.example.com/receipts/r-001.jpg', 1, 1, DATE_SUB(NOW(), INTERVAL 25 DAY)
FROM payment_schedules ps
JOIN candidates c ON c.id = ps.candidate_id
WHERE c.citizen_id = '111111111001' AND ps.description = 'Phí đăng ký hồ sơ'
UNION ALL
SELECT ps.candidate_id, ps.original_fee_standard_id, ps.contract_id, ps.id,
       1000000, 'INCOME', 'Thu phí dịch thuật hồ sơ đợt đầu', 'https://files.example.com/receipts/r-002.jpg', 1, 1, DATE_SUB(NOW(), INTERVAL 20 DAY)
FROM payment_schedules ps
JOIN candidates c ON c.id = ps.candidate_id
WHERE c.citizen_id = '111111111001' AND ps.description = 'Phí dịch thuật / công chứng'
UNION ALL
SELECT ps.candidate_id, ps.original_fee_standard_id, ps.contract_id, ps.id,
       7000000, 'INCOME', 'Thu học phí đào tạo đợt 1', 'https://files.example.com/receipts/r-003.jpg', 1, 1, DATE_SUB(NOW(), INTERVAL 6 DAY)
FROM payment_schedules ps
JOIN candidates c ON c.id = ps.candidate_id
WHERE c.citizen_id = '111111111015' AND ps.description = 'Học phí đào tạo';

-- M7 overseas + incidents
INSERT INTO overseas_records (candidate_id, job_order_id, contract_id, departure_date, actual_workplace, contract_end_date, status)
SELECT c.id, jo.id, ct.id, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'Xưởng sơn Osaka Plant 2', DATE_ADD(CURDATE(), INTERVAL 360 DAY), 'ĐANG LÀM VIỆC'
FROM candidates c
JOIN contracts ct ON ct.candidate_id = c.id
JOIN job_orders jo ON jo.id = ct.job_order_id
WHERE c.citizen_id = '111111111015';

INSERT INTO incident_logs (overseas_record_id, incident_date, description, resolution_status)
SELECT o.id, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Ứng viên phản ánh đổi ca liên tục trong tuần đầu.', 'ĐÃ XỬ LÝ - điều chỉnh lịch ca'
FROM overseas_records o
JOIN candidates c ON c.id = o.candidate_id
WHERE c.citizen_id = '111111111015'
UNION ALL
SELECT o.id, CURDATE(), 'Cần bổ sung bảo hộ lao động đúng size.', 'ĐANG THEO DÕI'
FROM overseas_records o
JOIN candidates c ON c.id = o.candidate_id
WHERE c.citizen_id = '111111111015';

-- M9 teachers / classes / class students
INSERT INTO teachers (full_name, phone, email, teacher_type, employment_type, status) VALUES
('Trần Minh Đức', '0908111111', 'duc.tran@ihrms.vn', 'LANGUAGE', 'FULL_TIME', 'ACTIVE'),
('Nguyễn Thu Hà', '0908222222', 'ha.nguyen@ihrms.vn', 'LANGUAGE', 'VISITING', 'ACTIVE'),
('Lê Văn Khải', '0908333333', 'khai.le@ihrms.vn', 'SKILL', 'FULL_TIME', 'ACTIVE'),
('Phạm Quang Huy', '0908444444', 'huy.pham@ihrms.vn', 'SKILL', 'VISITING', 'INACTIVE');

INSERT INTO classes (class_name, class_type, teacher_id, room, start_date, end_date, status)
SELECT 'Lớp Nhật N5 - Kỳ 05', 'LANGUAGE', t.id, 'P201', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'IN_PROGRESS'
FROM teachers t WHERE t.full_name = 'Trần Minh Đức'
UNION ALL
SELECT 'Lớp Nhật N4 tăng tốc', 'LANGUAGE', t.id, 'P305', DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 95 DAY), 'PENDING'
FROM teachers t WHERE t.full_name = 'Nguyễn Thu Hà'
UNION ALL
SELECT 'Kỹ năng hàn MIG cơ bản', 'SKILL', t.id, 'Xưởng A1', DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 25 DAY), 'IN_PROGRESS'
FROM teachers t WHERE t.full_name = 'Lê Văn Khải';

INSERT INTO class_students (class_id, candidate_id, enroll_date, status, attitude_note)
SELECT cl.id, c.id, DATE_SUB(CURDATE(), INTERVAL 18 DAY), 'STUDYING', 'Đi học đều, thái độ tốt'
FROM classes cl
JOIN candidates c ON c.citizen_id = '111111111001'
WHERE cl.class_name = 'Lớp Nhật N5 - Kỳ 05'
UNION ALL
SELECT cl.id, c.id, DATE_SUB(CURDATE(), INTERVAL 17 DAY), 'STUDYING', 'Tiếp thu nhanh, cần luyện nghe thêm'
FROM classes cl
JOIN candidates c ON c.citizen_id = '111111111002'
WHERE cl.class_name = 'Lớp Nhật N5 - Kỳ 05'
UNION ALL
SELECT cl.id, c.id, DATE_SUB(CURDATE(), INTERVAL 12 DAY), 'STUDYING', 'Kỹ thuật thao tác tốt'
FROM classes cl
JOIN candidates c ON c.citizen_id = '111111111003'
WHERE cl.class_name = 'Kỹ năng hàn MIG cơ bản'
UNION ALL
SELECT cl.id, c.id, DATE_SUB(CURDATE(), INTERVAL 11 DAY), 'STUDYING', 'Ổn định chuyên cần'
FROM classes cl
JOIN candidates c ON c.citizen_id = '111111111010'
WHERE cl.class_name = 'Kỹ năng hàn MIG cơ bản'
UNION ALL
SELECT cl.id, c.id, DATE_ADD(CURDATE(), INTERVAL 4 DAY), 'STUDYING', 'Đã xếp lớp trước, chờ khai giảng'
FROM classes cl
JOIN candidates c ON c.citizen_id = '111111111014'
WHERE cl.class_name = 'Lớp Nhật N4 tăng tốc';

-- Mail logs for module mail history
SET @tpl_exam_schedule := (SELECT id FROM email_templates WHERE template_code = 'EXAM_SCHEDULE_NOTIFY' LIMIT 1);
SET @tpl_exam_pass := (SELECT id FROM email_templates WHERE template_code = 'EXAM_PASS_NOTIFY' LIMIT 1);
SET @tpl_exam_fail := (SELECT id FROM email_templates WHERE template_code = 'EXAM_FAIL_NOTIFY' LIMIT 1);

INSERT INTO email_logs (candidate_id, template_id, sent_at, status, error_message)
SELECT c.id, @tpl_exam_schedule, DATE_SUB(NOW(), INTERVAL 1 DAY), 'SENT', NULL
FROM candidates c WHERE c.citizen_id = '111111111001'
UNION ALL
SELECT c.id, @tpl_exam_schedule, DATE_SUB(NOW(), INTERVAL 1 DAY), 'SENT', NULL
FROM candidates c WHERE c.citizen_id = '111111111002'
UNION ALL
SELECT c.id, @tpl_exam_pass, DATE_SUB(NOW(), INTERVAL 13 DAY), 'SENT', NULL
FROM candidates c WHERE c.citizen_id = '111111111015'
UNION ALL
SELECT c.id, @tpl_exam_fail, DATE_SUB(NOW(), INTERVAL 9 DAY), 'FAILED', 'Mailbox không tồn tại hoặc bị từ chối'
FROM candidates c WHERE c.citizen_id = '111111111012'
UNION ALL
SELECT c.id, @tpl_exam_schedule, NULL, 'PENDING', NULL
FROM candidates c WHERE c.citizen_id = '111111111006';

SELECT 'v1.17 realistic seed applied' AS result;
SELECT COUNT(*) AS total_candidates FROM candidates;
SELECT COUNT(*) AS total_job_orders FROM job_orders;
SELECT COUNT(*) AS total_exam_apps FROM exam_applications;
SELECT COUNT(*) AS total_contracts FROM contracts;
SELECT COUNT(*) AS total_payment_schedules FROM payment_schedules;
SELECT COUNT(*) AS total_transactions FROM transactions;
SELECT COUNT(*) AS total_classes FROM classes;
SELECT COUNT(*) AS total_email_logs FROM email_logs;
