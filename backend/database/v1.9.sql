USE ihrms_db;

-- M9: Remove average_score from class_students
ALTER TABLE class_students
DROP COLUMN average_score;
