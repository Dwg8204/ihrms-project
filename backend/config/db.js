const mysql = require('mysql2/promise');
require('dotenv').config(); 
// Tạo pool kết nối
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10, 
  queueLimit: 0
});

pool.getConnection()
  .then((conn) => {
    console.log('✅ Kết nối MySQL (ihrms_db) thành công!');
    conn.release(); 
  })
  .catch((err) => {
    console.error('❌ Lỗi kết nối MySQL:', err.message);
  });

module.exports = pool;