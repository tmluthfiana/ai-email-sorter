import pool from '../config/database';
import { User } from './types';

export class UserModel {
  static async create(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const { google_id, email, name, picture, access_token, refresh_token, token_expiry } = userData;
    
    const query = `
      INSERT INTO users (google_id, email, name, picture, access_token, refresh_token, token_expiry)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [google_id, email, name, picture, access_token, refresh_token, token_expiry];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByGoogleId(google_id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE google_id = $1';
    const result = await pool.query(query, [google_id]);
    return result.rows[0] || null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  static async findByRefreshToken(refreshToken: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE refresh_token = $1';
    const result = await pool.query(query, [refreshToken]);
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findAllWithValidTokens() {
    const result = await pool.query(`
      SELECT * FROM users 
      WHERE access_token IS NOT NULL 
      AND refresh_token IS NOT NULL
      ORDER BY created_at DESC
    `);
    return result.rows;
  }

  static async updateTokens(userId: number, accessToken: string, refreshToken: string, expiryDate: number) {
    await pool.query(`
      UPDATE users 
      SET access_token = $1, refresh_token = $2, token_expiry = $3
      WHERE id = $4
    `, [accessToken, refreshToken, new Date(expiryDate), userId]);
  }

  static async updateProfile(id: number, updates: Partial<Pick<User, 'name' | 'picture'>>): Promise<User> {
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
    
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0];
  }

  static async delete(id: number): Promise<void> {
    const query = 'DELETE FROM users WHERE id = $1';
    await pool.query(query, [id]);
  }
} 