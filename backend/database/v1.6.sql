USE ihrms_db;

-- 1. Cập nhật bảng contracts hiện có
-- Thêm các trường mới
ALTER TABLE contracts
ADD COLUMN effective_date DATE AFTER signed_date,
ADD COLUMN expiry_date DATE AFTER effective_date,
ADD COLUMN contract_details_json JSON NULL AFTER document_url,
ADD COLUMN cancelled_at DATETIME NULL AFTER contract_details_json,
ADD COLUMN cancelled_reason TEXT NULL AFTER cancelled_at;

-- Sửa giá trị mặc định cho cột status thành 'DRAFT'
ALTER TABLE contracts
MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'DRAFT';

-- Đảm bảo candidate_id là NOT NULL và có ON DELETE RESTRICT
-- Nếu đã tạo bảng contracts, có thể cần DROP và ADD lại FOREIGN KEY để thêm RESTRICT
-- HOẶC: Thay đổi hành vi ON DELETE nếu đã tồn tại FK. Ví dụ:
-- ALTER TABLE contracts DROP FOREIGN KEY contracts_ibfk_1;
-- ALTER TABLE contracts ADD CONSTRAINT contracts_ibfk_1 FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE RESTRICT;

-- 2. Tạo bảng contract_templates mới cho Giai đoạn 2 
CREATE TABLE IF NOT EXISTS contract_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL, -- Tên mẫu hợp đồng
    template_type VARCHAR(100) NOT NULL, -- Ví dụ: "Labor Export", "Training"
    template_file_url VARCHAR(255) NOT NULL, -- Đường dẫn tới file mẫu (.docx)
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Thêm cột created_at nếu chưa tồn tại
ALTER TABLE contracts
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Thêm cột updated_at nếu chưa tồn tại
ALTER TABLE contracts
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Thêm cột contract_id vào bảng transactions
ALTER TABLE transactions
ADD COLUMN contract_id INT NULL AFTER fee_standard_id;

-- Thêm khóa ngoại cho bảng transactions
ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_contract
FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL; -- SET NULL để không bị chặn xóa hợp đồng nếu transactions vẫn còn


-- Thêm cột contract_id vào bảng overseas_records
ALTER TABLE overseas_records
ADD COLUMN contract_id INT NULL AFTER job_order_id; -- Thêm sau job_order_id hoặc vị trí phù hợp

-- Thêm khóa ngoại cho bảng overseas_records
ALTER TABLE overseas_records
ADD CONSTRAINT fk_overseas_records_contract
FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL; -- SET NULL để không bị chặn xóa hợp đồng nếu overseas_records vẫn còn

-- Đảm bảo database đã được chọn
USE ihrms_db;

-- Bước 1: Tạo bảng education_levels để quản lý danh mục trình độ học vấn
CREATE TABLE IF NOT EXISTS education_levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL, -- Ví dụ: "Cấp 2", "Cấp 3", "Cao đẳng", "Đại học"
    description TEXT,
    display_order INT DEFAULT 0, -- Thứ tự hiển thị
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bước 2: Thêm dữ liệu mẫu vào education_levels (có thể điều chỉnh)
INSERT INTO education_levels (name, display_order) VALUES
('Không bằng cấp', 0),
('Cấp 2', 10),
('Cấp 3', 20),
('Trung cấp', 30),
('Cao đẳng', 40),
('Đại học', 50),
('Sau đại học', 60)
ON DUPLICATE KEY UPDATE name = VALUES(name);


-- Bước 3: Chuẩn bị để thay đổi kiểu dữ liệu của candidates.education_level

-- Tạo một cột tạm thời để lưu ID trình độ học vấn
ALTER TABLE candidates
ADD COLUMN education_level_id INT NULL AFTER education_level;

-- Di chuyển dữ liệu từ cột cũ sang cột mới (nếu có dữ liệu hiện tại)
-- LƯU Ý: Bước này rất quan trọng nếu đã có dữ liệu trong candidates.education_level.
-- Cần chạy thủ công các lệnh UPDATE sau để map chuỗi cũ sang ID mới.
-- Ví dụ (chạy từng dòng hoặc viết script phức tạp hơn nếu có nhiều giá trị khác nhau):
-- UPDATE candidates c
-- JOIN education_levels el ON c.education_level = el.name
-- SET c.education_level_id = el.id
-- WHERE c.education_level IS NOT NULL;

-- Nếu không có dữ liệu cũ hoặc muốn bỏ qua dữ liệu cũ, có thể bỏ qua các lệnh UPDATE trên.

-- Xóa cột education_level cũ 
ALTER TABLE candidates
DROP COLUMN education_level;

-- Đổi tên cột education_level_id thành education_level
ALTER TABLE candidates
CHANGE COLUMN education_level_id education_level INT NULL;

-- Thêm khóa ngoại cho education_level
ALTER TABLE candidates
ADD CONSTRAINT fk_candidates_education_level
FOREIGN KEY (education_level) REFERENCES education_levels(id) ON DELETE SET NULL; -- SET NULL để không bị chặn xóa cấp độ học vấn nếu còn ứng viên