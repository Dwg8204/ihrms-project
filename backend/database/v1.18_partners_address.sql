-- v1.18: Add address field to partners table
ALTER TABLE partners ADD COLUMN address VARCHAR(255) NULL;
