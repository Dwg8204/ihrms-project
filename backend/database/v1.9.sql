USE ihrms_db;

-- M9: Remove average_score from class_students (Safely)
SET @column_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'class_students' AND COLUMN_NAME = 'average_score' AND TABLE_SCHEMA = 'ihrms_db');
SET @sql = IF(@column_exists > 0, 'ALTER TABLE class_students DROP COLUMN average_score', 'SELECT "Column average_score does not exist, skipping drop."');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
