ALTER TABLE recruitment_sources
ADD CONSTRAINT uq_recruitment_sources_source_name UNIQUE (source_name);

ALTER TABLE candidates
MODIFY status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED';

ALTER TABLE candidates
ADD COLUMN source_note VARCHAR(255) NULL AFTER source_id,
ADD COLUMN experience_summary TEXT NULL AFTER education_level,
ADD INDEX idx_candidates_status_created (status, created_at),
ADD INDEX idx_candidates_source_status_created (source_id, status, created_at),
ADD INDEX idx_candidates_phone (phone),
ADD INDEX idx_candidates_email (email);