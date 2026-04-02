USE ihrms_db;

-- Upgrade exam_applications.exam_date to include time precision for M3 scheduling.
ALTER TABLE exam_applications
MODIFY COLUMN exam_date DATETIME NULL;
