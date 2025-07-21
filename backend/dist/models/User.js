"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const database_1 = __importDefault(require("../config/database"));
class UserModel {
    static async create(userData) {
        const { google_id, email, name, picture, access_token, refresh_token, token_expiry } = userData;
        const query = `
      INSERT INTO users (google_id, email, name, picture, access_token, refresh_token, token_expiry)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
        const values = [google_id, email, name, picture, access_token, refresh_token, token_expiry];
        const result = await database_1.default.query(query, values);
        return result.rows[0];
    }
    static async findByGoogleId(google_id) {
        const query = 'SELECT * FROM users WHERE google_id = $1';
        const result = await database_1.default.query(query, [google_id]);
        return result.rows[0] || null;
    }
    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await database_1.default.query(query, [email]);
        return result.rows[0] || null;
    }
    static async findByRefreshToken(refreshToken) {
        const query = 'SELECT * FROM users WHERE refresh_token = $1';
        const result = await database_1.default.query(query, [refreshToken]);
        return result.rows[0] || null;
    }
    static async findById(id) {
        const query = 'SELECT * FROM users WHERE id = $1';
        const result = await database_1.default.query(query, [id]);
        return result.rows[0] || null;
    }
    static async updateTokens(id, access_token, refresh_token, token_expiry) {
        const query = `
      UPDATE users 
      SET access_token = $2, refresh_token = $3, token_expiry = $4
      WHERE id = $1
      RETURNING *
    `;
        const result = await database_1.default.query(query, [id, access_token, refresh_token, token_expiry]);
        return result.rows[0];
    }
    static async updateProfile(id, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        if (fields.length === 0) {
            throw new Error('No fields to update');
        }
        const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
        const query = `
      UPDATE users 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
        const result = await database_1.default.query(query, [id, ...values]);
        return result.rows[0];
    }
    static async delete(id) {
        const query = 'DELETE FROM users WHERE id = $1';
        await database_1.default.query(query, [id]);
    }
}
exports.UserModel = UserModel;
//# sourceMappingURL=User.js.map