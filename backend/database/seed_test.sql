USE ihrms_db;

-- ── 1. Nguồn tuyển dụng ──────────────────────────────
INSERT IGNORE INTO recruitment_sources (id, source_name) VALUES
(1, 'Facebook'),
(2, 'Zalo'),
(3, 'Người quen giới thiệu');

-- ── 2. Đối tác ───────────────────────────────────────
INSERT IGNORE INTO partners (id, name, country, contact_person, phone, email, status) VALUES
(1, 'Công ty Nhật Bản ABC', 'Nhật Bản', 'Tanaka Kenji', '0901111111', 'tanaka@abc.jp', 'Active'),
(2, 'Công ty Hàn Quốc XYZ', 'Hàn Quốc', 'Kim Minho', '0902222222', 'kim@xyz.kr', 'Active');

-- ── 3. Đơn hàng ──────────────────────────────────────
INSERT IGNORE INTO job_orders (id, partner_id, job_title, quantity_needed, salary_info, requirements, deadline, status) VALUES
(1, 1, 'Gia công cơ khí', 10, '25-30 triệu/tháng', 'Tốt nghiệp THPT, sức khỏe tốt', '2026-06-30', 'Open'),
(2, 1, 'Hàn điện công nghiệp', 5, '28-35 triệu/tháng', 'Có chứng chỉ hàn cơ bản', '2026-07-15', 'Open'),
(3, 2, 'Lắp ráp điện tử', 8, '22-27 triệu/tháng', 'Tốt nghiệp THPT, cẩn thận', '2026-08-01', 'Open');

-- ── 4. Ứng viên (có email thật để test) ──────────────
INSERT IGNORE INTO candidates (id, citizen_id, full_name, dob, gender, phone, email, address, status, source_id) VALUES
(1, '001099001001', 'Nguyễn Văn An', '1998-03-15', 'Nam', '0911000001', 'test1@mailinator.com', 'Hà Nội', 'Exam', 1),
(2, '001099001002', 'Trần Thị Bình', '2000-07-22', 'Nữ', '0911000002', 'test2@mailinator.com', 'Hải Phòng', 'Exam', 2),
(3, '001099001003', 'Lê Văn Cường', '1997-11-05', 'Nam', '0911000003', 'test3@mailinator.com', 'Đà Nẵng', 'Exam', 1),
(4, '001099001004', 'Phạm Thị Dung', '2001-01-30', 'Nữ', '0911000004', 'test4@mailinator.com', 'TP.HCM', 'Lead', 3),
(5, '001099001005', 'Hoàng Văn Em', '1999-09-18', 'Nam', '0911000005', 'test5@mailinator.com', 'Cần Thơ', 'Lead', 2);

-- ── 5. Hồ sơ thi tuyển ───────────────────────────────
INSERT IGNORE INTO exam_applications (id, candidate_id, job_order_id, exam_date, result_status, note) VALUES
(1, 1, 1, '2026-05-20', 'Pending', 'Dự thi lần 1'),
(2, 2, 1, '2026-05-20', 'Pending', 'Dự thi lần 1'),
(3, 3, 2, '2026-05-22', 'Pending', 'Dự thi lần 1'),
(4, 4, 3, '2026-05-25', 'Pending', 'Dự thi lần 1'),
(5, 5, 3, '2026-05-25', 'Pending', 'Dự thi lần 1');

SELECT 'Seed OK' AS result;
SELECT COUNT(*) AS so_ung_vien FROM candidates;
SELECT COUNT(*) AS so_don_hang FROM job_orders;
SELECT COUNT(*) AS so_ho_so_thi FROM exam_applications;
