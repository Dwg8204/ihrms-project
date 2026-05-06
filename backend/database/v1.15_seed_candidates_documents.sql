-- Seed v1.15: Them 50 ung vien va 30 ung vien hoan tat ho so xuat canh
USE ihrms_db;

-- Bao dam co it nhat 1 nguon tuyen dung de gan cho ung vien
INSERT INTO recruitment_sources (source_name)
SELECT 'Seed Source'
WHERE NOT EXISTS (
  SELECT 1 FROM recruitment_sources WHERE source_name = 'Seed Source'
);

SET @seed_source_id := (
  SELECT id
  FROM recruitment_sources
  ORDER BY id ASC
  LIMIT 1
);

SET @seed_education_level_id := (
  SELECT id
  FROM education_levels
  ORDER BY display_order ASC, id ASC
  LIMIT 1
);

DROP TEMPORARY TABLE IF EXISTS tmp_seed_candidates;
CREATE TEMPORARY TABLE tmp_seed_candidates AS
SELECT
  seq.rn,
  LPAD(990000000000 + seq.rn, 12, '0') AS citizen_id,
  CONCAT('Ung vien seed ', LPAD(seq.rn, 2, '0')) AS full_name,
  CASE WHEN MOD(seq.rn, 2) = 0 THEN 'Nam' ELSE 'Nu' END AS gender,
  CONCAT('09', LPAD(10000000 + seq.rn, 8, '0')) AS phone,
  CONCAT('seed.candidate', LPAD(seq.rn, 2, '0'), '@example.com') AS email,
  CONCAT('Dia chi seed so ', seq.rn, ', Ha Noi') AS address,
  DATE_SUB('2004-12-31', INTERVAL seq.rn * 37 DAY) AS dob,
  160 + MOD(seq.rn, 18) AS height,
  50 + MOD(seq.rn, 16) AS weight,
  CASE MOD(seq.rn, 4)
    WHEN 0 THEN 'A'
    WHEN 1 THEN 'B'
    WHEN 2 THEN 'AB'
    ELSE 'O'
  END AS blood_type,
  CASE MOD(seq.rn, 4)
    WHEN 0 THEN @seed_education_level_id
    WHEN 1 THEN @seed_education_level_id
    WHEN 2 THEN @seed_education_level_id
    ELSE @seed_education_level_id
  END AS education_level,
  CASE
    WHEN seq.rn <= 30 THEN 'CONTRACT_SIGNED'
    WHEN seq.rn <= 40 THEN 'PASSED'
    ELSE 'WAITING_FORM_MATCH'
  END AS status,
  DATE_SUB(CURDATE(), INTERVAL seq.rn DAY) AS created_date
FROM (
  SELECT (t.n * 10 + o.n + 1) AS rn
  FROM (
    SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  ) t
  CROSS JOIN (
    SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
  ) o
  WHERE (t.n * 10 + o.n + 1) <= 50
) seq;

INSERT INTO candidates (
  citizen_id,
  full_name,
  dob,
  gender,
  phone,
  email,
  address,
  height,
  weight,
  blood_type,
  education_level,
  source_id,
  status,
  created_at,
  updated_at
)
SELECT
  t.citizen_id,
  t.full_name,
  t.dob,
  t.gender,
  t.phone,
  t.email,
  t.address,
  t.height,
  t.weight,
  t.blood_type,
  t.education_level,
  @seed_source_id,
  t.status,
  t.created_date,
  NOW()
FROM tmp_seed_candidates t
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  dob = VALUES(dob),
  gender = VALUES(gender),
  phone = VALUES(phone),
  email = VALUES(email),
  address = VALUES(address),
  height = VALUES(height),
  weight = VALUES(weight),
  blood_type = VALUES(blood_type),
  education_level = VALUES(education_level),
  source_id = VALUES(source_id),
  status = VALUES(status),
  updated_at = NOW();

DROP TEMPORARY TABLE IF EXISTS tmp_seed_target_candidates;
CREATE TEMPORARY TABLE tmp_seed_target_candidates AS
SELECT c.id, t.rn
FROM candidates c
JOIN tmp_seed_candidates t
  ON t.citizen_id COLLATE utf8mb4_unicode_ci = c.citizen_id;

-- 30 ung vien dau co checklist ho so xuat canh hoan tat
INSERT INTO candidate_documents (
  candidate_id,
  document_type_id,
  status,
  issue_date,
  expiration_date,
  expected_complete_date,
  submitted_at,
  verified_at,
  file_url,
  note
)
SELECT
  tc.id,
  dt.id,
  'VERIFIED',
  DATE_SUB(CURDATE(), INTERVAL 45 DAY),
  CASE dt.code
    WHEN 'POST_PASSPORT' THEN DATE_ADD(CURDATE(), INTERVAL 1825 DAY)
    WHEN 'POST_VISA' THEN DATE_ADD(CURDATE(), INTERVAL 180 DAY)
    ELSE DATE_ADD(CURDATE(), INTERVAL 365 DAY)
  END,
  DATE_SUB(CURDATE(), INTERVAL 10 DAY),
  DATE_SUB(NOW(), INTERVAL 12 DAY),
  DATE_SUB(NOW(), INTERVAL 7 DAY),
  CONCAT('https://seed.local/docs/', LOWER(dt.code), '/', tc.id, '.pdf'),
  'Checklist ho so xuat canh da hoan tat (seed v1.15)'
FROM tmp_seed_target_candidates tc
JOIN document_types dt
  ON dt.code IN ('POST_VISA', 'POST_PASSPORT', 'POST_COE')
WHERE tc.rn <= 30
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  issue_date = VALUES(issue_date),
  expiration_date = VALUES(expiration_date),
  expected_complete_date = VALUES(expected_complete_date),
  submitted_at = VALUES(submitted_at),
  verified_at = VALUES(verified_at),
  file_url = VALUES(file_url),
  note = VALUES(note);

DROP TEMPORARY TABLE IF EXISTS tmp_seed_target_candidates;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_candidates;

-- Kiem tra ket qua seed
SELECT COUNT(*) AS seeded_candidates
FROM candidates
WHERE citizen_id BETWEEN '990000000001' AND '990000000050';

SELECT COUNT(DISTINCT cd.candidate_id) AS completed_departure_checklist_candidates
FROM candidate_documents cd
JOIN document_types dt ON dt.id = cd.document_type_id
JOIN candidates c ON c.id = cd.candidate_id
WHERE c.citizen_id BETWEEN '990000000001' AND '990000000050'
  AND dt.code IN ('POST_VISA', 'POST_PASSPORT', 'POST_COE')
  AND cd.status = 'VERIFIED'
GROUP BY NULL;
