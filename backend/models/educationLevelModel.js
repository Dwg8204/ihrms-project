const db = require('../config/db');

class EducationLevel {
    static async create(levelData) {
        const { name, description, display_order } = levelData;
        try {
            const [existing] = await db.query('SELECT id FROM education_levels WHERE name = ?', [name]);
            if (existing.length > 0) {
                throw new Error('Education level name already exists.');
            }
            const [result] = await db.query(
                'INSERT INTO education_levels (name, description, display_order) VALUES (?, ?, ?)',
                [name, description, display_order]
            );
            return { id: result.insertId, ...levelData };
        } catch (error) {
            throw error;
        }
    }

    static async findAll({ page = 1, limit = 20, search = '' }) {
        page = parseInt(page);
        limit = parseInt(limit);

        if (isNaN(page) || page < 1) page = 1;
        if (isNaN(limit) || limit < 1) limit = 20;

        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM education_levels WHERE 1=1';
        let countQuery = 'SELECT COUNT(id) AS total FROM education_levels WHERE 1=1';
        const params = [];
        const countParams = [];

        if (search) {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            countQuery += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
            countParams.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY display_order ASC, name ASC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [levels] = await db.query(query, params);
        const [totalResult] = await db.query(countQuery, countParams);
        const total = totalResult[0].total;

        return {
            data: levels,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    static async findById(id) {
        try {
            const [rows] = await db.query('SELECT * FROM education_levels WHERE id = ?', [id]);
            return rows[0];
        } catch (error) {
            throw error;
        }
    }

    static async update(id, levelData) {
        const { name, description, display_order } = levelData;
        try {
            if (name) {
                const [existing] = await db.query('SELECT id FROM education_levels WHERE name = ? AND id != ?', [name, id]);
                if (existing.length > 0) {
                    throw new Error('Education level name already exists.');
                }
            }
            const [result] = await db.query(
                'UPDATE education_levels SET name = COALESCE(?, name), description = COALESCE(?, description), display_order = COALESCE(?, display_order) WHERE id = ?',
                [name, description, display_order, id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw error;
        }
    }

    static async delete(id) {
        try {
            // Kiểm tra xem có ứng viên nào có liên quan đến trình độ học vấn này không
            const [linkedCandidates] = await db.query('SELECT id FROM candidates WHERE education_level = ?', [id]);
            if (linkedCandidates.length > 0) {
                throw new Error('Cannot delete education level as it is linked to existing candidates.');
            }

            const [result] = await db.query('DELETE FROM education_levels WHERE id = ?', [id]);
            return result.affectedRows > 0;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = EducationLevel;