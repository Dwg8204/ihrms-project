const db = require('../config/db');

const MAX_CONTACTS_PER_PARTNER = 5;

class PartnerContact {
  static async create(partnerId, contactData) {
    const { contact_name, contact_phone, contact_email, contact_role, is_primary = false } = contactData;
    try {
      // Kiểm tra xem đối tác có tồn tại hay không
      const [partner] = await db.query('SELECT id FROM partners WHERE id = ?', [partnerId]);
      if (partner.length === 0) {
        throw new Error('Partner not found.');
      }

      // Kiểm tra số lượng liên hệ hiện có
      const [countResult] = await db.query('SELECT COUNT(id) AS total_contacts FROM partner_contacts WHERE partner_id = ?', [partnerId]);
      if (countResult[0].total_contacts >= MAX_CONTACTS_PER_PARTNER) {
        throw new Error(`Maximum ${MAX_CONTACTS_PER_PARTNER} contacts allowed per partner.`);
      }

      // Nếu liên hệ mới là liên hệ chính, đặt tất cả các liên hệ khác của đối tác này thành liên hệ phụ.
      if (is_primary) {
        await db.query('UPDATE partner_contacts SET is_primary = FALSE WHERE partner_id = ?', [partnerId]);
      } else {
        // Nếu không có liên hệ chính nào, chọn liên hệ đầu tiên làm liên hệ chính (tùy chọn, có thể xử lý trong giao diện người dùng).
        const [primaryCount] = await db.query('SELECT COUNT(id) AS primary_count FROM partner_contacts WHERE partner_id = ? AND is_primary = TRUE', [partnerId]);
        if (primaryCount[0].primary_count === 0 && countResult[0].total_contacts === 0) {
          is_primary = true; // Make the very first contact primary by default
        }
      }

      const [result] = await db.query(
        'INSERT INTO partner_contacts (partner_id, contact_name, contact_phone, contact_email, contact_role, is_primary) VALUES (?, ?, ?, ?, ?, ?)',
        [partnerId, contact_name, contact_phone, contact_email, contact_role, is_primary]
      );
      return { id: result.insertId, partner_id: partnerId, ...contactData };
    } catch (error) {
      throw error;
    }
  }

  static async findByPartnerId(partnerId) {
    try {
      const [rows] = await db.query('SELECT * FROM partner_contacts WHERE partner_id = ? ORDER BY is_primary DESC, contact_name ASC', [partnerId]);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await db.query('SELECT * FROM partner_contacts WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async update(id, partnerId, contactData) {
    const { contact_name, contact_phone, contact_email, contact_role, is_primary } = contactData;
    try {
      // Nếu đặt làm đối tác chính, bỏ chọn các đối tác khác cho đối tác này.
      if (is_primary === true) { // Kiểm tra rõ ràng giá trị `true` để tránh các vấn đề về giá trị undefined/null.
        await db.query('UPDATE partner_contacts SET is_primary = FALSE WHERE partner_id = ? AND id != ?', [partnerId, id]);
      }

      const [result] = await db.query(
        'UPDATE partner_contacts SET contact_name = COALESCE(?, contact_name), contact_phone = COALESCE(?, contact_phone), contact_email = COALESCE(?, contact_email), contact_role = COALESCE(?, contact_role), is_primary = COALESCE(?, is_primary) WHERE id = ? AND partner_id = ?',
        [contact_name, contact_phone, contact_email, contact_role, is_primary, id, partnerId]
      );
      if (result.affectedRows === 0) {
        return null; // Không tìm thấy thông tin liên hệ hoặc thông tin liên hệ không thuộc về đối tác này.
      }
      return { id, partner_id: partnerId, ...contactData };
    } catch (error) {
      throw error;
    }
  }

  static async delete(id, partnerId) {
    try {
      const [result] = await db.query('DELETE FROM partner_contacts WHERE id = ? AND partner_id = ?', [id, partnerId]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = PartnerContact;