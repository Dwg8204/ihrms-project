USE ihrms_db;

CREATE TABLE IF NOT EXISTS email_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_code VARCHAR(100) NOT NULL UNIQUE,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    template_id INT NOT NULL,
    sent_at DATETIME NULL,
    status ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_logs_candidate
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    CONSTRAINT fk_email_logs_template
      FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE RESTRICT
);

CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_candidate_id ON email_logs(candidate_id);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at);

INSERT INTO email_templates (template_code, subject, body_html)
VALUES (
  'EXAM_SCHEDULE_NOTIFY',
  'Lá»‹ch thi Ä‘Æ¡n hÃ ng {{job_name}}',
  '<p>KÃ­nh gá»­i anh/chá»‹ {{full_name}},</p><p>Lá»‹ch thi Ä‘Æ¡n hÃ ng <strong>{{job_name}}</strong> cá»§a anh/chá»‹ sáº½ diá»…n ra vÃ o ngÃ y <strong>{{exam_date}}</strong>.</p><p>TrÃ¢n trá»ng.</p>'
)
ON DUPLICATE KEY UPDATE
  subject = VALUES(subject),
  body_html = VALUES(body_html);

-- M9. Teachers
CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    teacher_type VARCHAR(20) NOT NULL, -- LANGUAGE, SKILL
    employment_type VARCHAR(20) NOT NULL, -- FULL_TIME, VISITING
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- M9. Classes
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(200) NOT NULL,
    class_type VARCHAR(20) NOT NULL, -- LANGUAGE, SKILL
    teacher_id INT NOT NULL,
    room VARCHAR(100),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT
);

-- M9. Class Students (many-to-many)
CREATE TABLE IF NOT EXISTS class_students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    candidate_id INT NOT NULL,
    enroll_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'STUDYING',
    attitude_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_class_candidate (class_id, candidate_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);
