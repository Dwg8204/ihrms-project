const db = require('../config/db');

const AdminUser = {
  findByCredentials: async (username, password) => {
    const query = `
      SELECT id, username, full_name, role, status
      FROM admin_users
      WHERE username = ?
        AND password_hash = SHA2(?, 256)
        AND status = 'ACTIVE'
      LIMIT 1
    `;
    const [rows] = await db.query(query, [username, password]);
    return rows[0] || null;
  }
};

module.exports = AdminUser;
