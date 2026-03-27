-- 1. TẠO DATABASE VÀ CHỌN DATABASE
CREATE DATABASE IF NOT EXISTS ihrms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ihrms_db;

-- ==========================================
-- BẢNG ĐỘC LẬP (Không phụ thuộc khóa ngoại)
-- ==========================================

-- M1. Nguồn tuyển dụng
CREATE TABLE recruitment_sources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_name VARCHAR(150) NOT NULL
);

-- M2. Đối tác/Nghiệp đoàn
CREATE TABLE partners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    country VARCHAR(100),
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Active'
);

-- M6. Danh mục giấy tờ
CREATE TABLE document_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    is_mandatory BOOLEAN DEFAULT TRUE
);


-- ==========================================
-- BẢNG CẤP 1 (Phụ thuộc vào bảng Độc lập)
-- ==========================================

-- M1. Ứng viên (Phụ thuộc recruitment_sources)
CREATE TABLE candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    dob DATE,
    gender VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(100),
    address VARCHAR(255),
    height DECIMAL(5,2),
    weight DECIMAL(5,2),
    blood_type VARCHAR(5),
    education_level VARCHAR(100),
    source_id INT,
    status VARCHAR(50) DEFAULT 'Lead',
    cv_file_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES recruitment_sources(id) ON DELETE SET NULL
);

-- M2. Đơn hàng/Job (Phụ thuộc partners)
CREATE TABLE job_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partner_id INT,
    job_title VARCHAR(150) NOT NULL,
    quantity_needed INT,
    salary_info VARCHAR(255),
    requirements TEXT,
    deadline DATE,
    status VARCHAR(50) DEFAULT 'Open',
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
);


-- ==========================================
-- BẢNG CẤP 2 (Phụ thuộc vào Ứng viên và Đơn hàng)
-- ==========================================

-- M3. Danh sách thi tuyển
CREATE TABLE exam_applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT,
    job_order_id INT,
    exam_date DATE,
    result_status VARCHAR(50), -- Pass, Fail, Reserve
    score_details JSON, -- Dùng kiểu JSON để lưu điểm linh hoạt nhiều môn
    note TEXT,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (job_order_id) REFERENCES job_orders(id) ON DELETE CASCADE
);

-- M4. Hợp đồng
CREATE TABLE contracts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT,
    job_order_id INT,
    contract_number VARCHAR(100) UNIQUE,
    contract_type VARCHAR(100),
    signed_date DATE,
    status VARCHAR(50) DEFAULT 'Chờ ký',
    document_url VARCHAR(255),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (job_order_id) REFERENCES job_orders(id) ON DELETE SET NULL
);

-- M5. Định mức thu
CREATE TABLE fee_standards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_order_id INT,
    fee_name VARCHAR(150) NOT NULL,
    amount DECIMAL(15,2) NOT NULL, -- Dùng DECIMAL cho tiền tệ để không bị sai số
    due_date DATE,
    FOREIGN KEY (job_order_id) REFERENCES job_orders(id) ON DELETE CASCADE
);

-- M6. Hồ sơ thủ tục của ứng viên
CREATE TABLE candidate_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT,
    document_type_id INT,
    status VARCHAR(50) DEFAULT 'Missing', -- Missing, Processing, Completed
    issue_date DATE,
    expiration_date DATE,
    file_url VARCHAR(255),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (document_type_id) REFERENCES document_types(id) ON DELETE CASCADE
);

-- M7. Hồ sơ ngoài nước
CREATE TABLE overseas_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT,
    job_order_id INT,
    departure_date DATE,
    actual_workplace VARCHAR(255),
    contract_end_date DATE,
    status VARCHAR(50),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (job_order_id) REFERENCES job_orders(id) ON DELETE SET NULL
);


-- ==========================================
-- BẢNG CẤP 3 (Phụ thuộc vào các bảng Cấp 2)
-- ==========================================

-- M5. Giao dịch Thực tế (Phụ thuộc candidates và fee_standards)
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT,
    fee_standard_id INT,
    amount_paid DECIMAL(15,2) NOT NULL,
    transaction_date DATE,
    receipt_image_url VARCHAR(255),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (fee_standard_id) REFERENCES fee_standards(id) ON DELETE RESTRICT
);

-- M7. Ghi nhận sự cố (Phụ thuộc overseas_records)
CREATE TABLE incident_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    overseas_record_id INT,
    incident_date DATE,
    description TEXT,
    resolution_status VARCHAR(50),
    FOREIGN KEY (overseas_record_id) REFERENCES overseas_records(id) ON DELETE CASCADE
);