USE ihrms_db;

-- 1. Thêm bảng partner_contacts để quản lý nhiều người liên hệ cho đối tác
CREATE TABLE partner_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partner_id INT NOT NULL,
    contact_name VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    contact_role VARCHAR(100), -- Ví dụ: "Quản lý tuyển dụng", "Trưởng phòng hành chính"
    is_primary BOOLEAN DEFAULT FALSE, -- Đánh dấu người liên hệ chính
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
    UNIQUE KEY uq_partner_contact (partner_id, contact_name) -- Đảm bảo tên người liên hệ duy nhất cho mỗi đối tác
);

-- 2. Cập nhật kiểu dữ liệu của cột requirements trong job_orders thành JSON
-- Lưu ý: Nếu cột đã có dữ liệu TEXT, có thể cần chuyển đổi thủ công hoặc đảm bảo dữ liệu hiện có hợp lệ JSON.
ALTER TABLE job_orders
MODIFY COLUMN requirements JSON;