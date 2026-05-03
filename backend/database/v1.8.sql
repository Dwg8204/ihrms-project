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
  'Lịch thi đơn hàng {{job_name}}',
  '<p>Kính gửi anh/chị {{full_name}},</p><p>Lịch thi đơn hàng <strong>{{job_name}}</strong> của anh/chị sẽ diễn ra vào ngày <strong>{{exam_date}}</strong>.</p><p>Trân trọng.</p>'
)
ON DUPLICATE KEY UPDATE
  subject = VALUES(subject),
  body_html = VALUES(body_html);
