const db = require('../config/db');
const { PARTNER_STATUSES } = require('../utils/partnerStatus');

class Partner {
  static async create(partnerData) {
    const { name, country, address, status = PARTNER_STATUSES.ACTIVE } = partnerData;
    try {
      // Kiểm tra tên duy nhất
      const [existing] = await db.query('SELECT id FROM partners WHERE name = ?', [name]);
      if (existing.length > 0) {
        throw new Error('Partner name already exists.');
      }

      const [result] = await db.query(
        'INSERT INTO partners (name, country, address, status) VALUES (?, ?, ?, ?)',
        [name, country, address, status]
      );
      return { id: result.insertId, ...partnerData };
    } catch (error) {
      throw error;
    }
  }

  static async findAll(page = 1, limit = 20, search = '', status = '') {
    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        p.*, 
        COUNT(pc.id) AS total_contacts,
        MAX(CASE WHEN pc.is_primary = 1 THEN pc.contact_name END) AS contact_person,
        MAX(CASE WHEN pc.is_primary = 1 THEN pc.contact_phone END) AS phone,
        MAX(CASE WHEN pc.is_primary = 1 THEN pc.contact_email END) AS email
      FROM partners p 
      LEFT JOIN partner_contacts pc ON p.id = pc.partner_id 
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(id) AS total FROM partners WHERE 1=1';
    const params = [];
    const countParams = [];

    if (search) {
      query += ' AND (p.name LIKE ? OR pc.contact_name LIKE ? OR pc.contact_email LIKE ?)';
      countQuery += ' AND name LIKE ?'; // Simplifying count search for now or could join too
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`);
    }
    if (status) {
      query += ' AND p.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    query += ' GROUP BY p.id ORDER BY p.name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
      const [partners] = await db.query(query, params);
      const [totalResult] = await db.query(countQuery, countParams);
      const total = totalResult[0].total;

      return {
        data: partners,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await db.query(`
        SELECT 
          p.*,
          MAX(CASE WHEN pc.is_primary = 1 THEN pc.contact_name END) AS contact_person,
          MAX(CASE WHEN pc.is_primary = 1 THEN pc.contact_phone END) AS phone,
          MAX(CASE WHEN pc.is_primary = 1 THEN pc.contact_email END) AS email
        FROM partners p
        LEFT JOIN partner_contacts pc ON p.id = pc.partner_id
        WHERE p.id = ?
        GROUP BY p.id
      `, [id]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async update(id, partnerData) {
    const { name, country, address, status } = partnerData;
    try {
      // Kiểm tra xem tên có phải là duy nhất nếu tên đang được cập nhật.
      if (name) {
        const [existing] = await db.query('SELECT id FROM partners WHERE name = ? AND id != ?', [name, id]);
        if (existing.length > 0) {
          throw new Error('Partner name already exists.');
        }
      }

      const [result] = await db.query(
        'UPDATE partners SET name = COALESCE(?, name), country = COALESCE(?, country), address = COALESCE(?, address), status = COALESCE(?, status) WHERE id = ?',
        [name, country, address, status, id]
      );
      if (result.affectedRows === 0) {
        return null; // Không tìm thấy đối tác
      }
      return { id, ...partnerData };
    } catch (error) {
      throw error;
    }
  }

  static async delete(id) {
    try {
      // Kiểm tra xem có đơn đặt hàng công việc nào đang hoạt động liên quan đến đối tác này không
      const [jobOrders] = await db.query('SELECT id FROM job_orders WHERE partner_id = ? AND status != "CANCELLED" AND status != "CLOSED" AND status != "FILLED"', [id]);
      if (jobOrders.length > 0) {
        throw new Error('Cannot delete partner with active job orders. Please set partner status to INACTIVE instead.');
      }
      
      // Nếu không có đơn đặt hàng công việc nào đang hoạt động, thực hiện xóa vĩnh viễn.
      const [result] = await db.query('DELETE FROM partners WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // --- Logic xử lý đơn đặt hàng khi trạng thái đối tác thay đổi ---
  static async updateJobOrdersOnPartnerStatusChange(partnerId, newStatus) {
    if (newStatus === PARTNER_STATUSES.INACTIVE || newStatus === PARTNER_STATUSES.BLACKLISTED) {
      try {
        // Cập nhật trạng thái tất cả các đơn đặt hàng OPEN liên kết với đối tác này thành CANCELLED
        const [result] = await db.query(
          'UPDATE job_orders SET status = ? WHERE partner_id = ? AND status = ?',
          [PARTNER_STATUSES.INACTIVE === newStatus ? 'CANCELLED' : 'CLOSED', partnerId, 'OPEN'] // Giả sử Blacklisted cũng closes/cancels
        );
        return result.affectedRows;
      } catch (error) {
        console.error(`Error updating job orders for partner ${partnerId}:`, error);
        throw error;
      }
    }
    return 0; // Không cần thực hiện thao tác nào đối với các thay đổi trạng thái khác.
  }
}

module.exports = Partner;