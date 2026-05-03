const db = require('./config/db');

async function run() {
  const [rows] = await db.query(
    `SELECT
      c.id,
      c.full_name,
      c.email,
      ea.id AS exam_app_id,
      ea.job_order_id,
      ea.exam_date,
      ea.result_status
    FROM candidates c
    LEFT JOIN exam_applications ea ON ea.candidate_id = c.id
    WHERE c.full_name IN ('Nguyễn Bá Dương', 'Đoàn Thị Diễm', 'Bùi Ngọc Vũ')
    ORDER BY c.id, ea.id`
  );

  console.table(rows);
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
