START TRANSACTION;

-- Add CCCD field for candidate-level business identity
SET @has_citizen_col := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'candidates'
    AND COLUMN_NAME = 'citizen_id'
);

SET @sql_add_col := IF(
  @has_citizen_col = 0,
  'ALTER TABLE candidates ADD COLUMN citizen_id VARCHAR(12) NULL AFTER id',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

-- Backfill old rows with deterministic temporary values so the NOT NULL + UNIQUE
-- constraints can be applied without breaking current data.
UPDATE candidates
SET citizen_id = LPAD(id, 12, '0')
WHERE citizen_id IS NULL OR TRIM(citizen_id) = '';

ALTER TABLE candidates
  MODIFY citizen_id VARCHAR(12) NOT NULL;

SET @has_uq := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'candidates'
    AND INDEX_NAME = 'uq_candidates_citizen_id'
);

SET @sql_add_uq := IF(
  @has_uq = 0,
  'ALTER TABLE candidates ADD CONSTRAINT uq_candidates_citizen_id UNIQUE (citizen_id)',
  'SELECT 1'
);
PREPARE stmt_add_uq FROM @sql_add_uq;
EXECUTE stmt_add_uq;
DEALLOCATE PREPARE stmt_add_uq;

SET @has_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'candidates'
    AND INDEX_NAME = 'idx_candidates_citizen_id'
);

SET @sql_add_idx := IF(
  @has_idx = 0,
  'ALTER TABLE candidates ADD INDEX idx_candidates_citizen_id (citizen_id)',
  'SELECT 1'
);
PREPARE stmt_add_idx FROM @sql_add_idx;
EXECUTE stmt_add_idx;
DEALLOCATE PREPARE stmt_add_idx;

COMMIT;
