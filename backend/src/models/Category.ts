import pool from '../config/database';
import { Category, CreateCategoryRequest, UpdateCategoryRequest } from './types';

export class CategoryModel {
  static async create(userId: number, categoryData: CreateCategoryRequest): Promise<Category> {
    const { name, description, color = '#3B82F6' } = categoryData;
    
    const query = `
      INSERT INTO categories (user_id, name, description, color)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [userId, name, description, color];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findById(id: number): Promise<Category | null> {
    const query = 'SELECT * FROM categories WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByUserId(userId: number): Promise<Category[]> {
    const query = 'SELECT * FROM categories WHERE user_id = $1 ORDER BY created_at DESC';
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  static async findByNameAndUserId(userId: number, name: string): Promise<Category | null> {
    const query = 'SELECT * FROM categories WHERE user_id = $1 AND name = $2';
    const result = await pool.query(query, [userId, name]);
    return result.rows[0] || null;
  }

  static async update(id: number, updates: UpdateCategoryRequest): Promise<Category> {
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
    
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0];
  }

  static async delete(id: number): Promise<void> {
    const query = 'DELETE FROM categories WHERE id = $1';
    await pool.query(query, [id]);
  }

  static async getCategoryStats(userId: number): Promise<Array<Category & { email_count: number }>> {
    const query = `
      SELECT c.*, COUNT(e.id) as email_count
      FROM categories c
      LEFT JOIN emails e ON c.id = e.category_id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows;
  }
} 