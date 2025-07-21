"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryModel = void 0;
const database_1 = __importDefault(require("../config/database"));
class CategoryModel {
    static async create(userId, categoryData) {
        const { name, description, color = '#3B82F6' } = categoryData;
        const query = `
      INSERT INTO categories (user_id, name, description, color)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
        const values = [userId, name, description, color];
        const result = await database_1.default.query(query, values);
        return result.rows[0];
    }
    static async findById(id) {
        const query = 'SELECT * FROM categories WHERE id = $1';
        const result = await database_1.default.query(query, [id]);
        return result.rows[0] || null;
    }
    static async findByUserId(userId) {
        const query = 'SELECT * FROM categories WHERE user_id = $1 ORDER BY created_at DESC';
        const result = await database_1.default.query(query, [userId]);
        return result.rows;
    }
    static async findByNameAndUserId(userId, name) {
        const query = 'SELECT * FROM categories WHERE user_id = $1 AND name = $2';
        const result = await database_1.default.query(query, [userId, name]);
        return result.rows[0] || null;
    }
    static async update(id, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        if (fields.length === 0) {
            throw new Error('No fields to update');
        }
        const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
        const query = `
      UPDATE categories 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
        const result = await database_1.default.query(query, [id, ...values]);
        return result.rows[0];
    }
    static async delete(id) {
        const query = 'DELETE FROM categories WHERE id = $1';
        await database_1.default.query(query, [id]);
    }
    static async getCategoryStats(userId) {
        const query = `
      SELECT c.*, COUNT(e.id) as email_count
      FROM categories c
      LEFT JOIN emails e ON c.id = e.category_id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
        const result = await database_1.default.query(query, [userId]);
        return result.rows;
    }
}
exports.CategoryModel = CategoryModel;
//# sourceMappingURL=Category.js.map