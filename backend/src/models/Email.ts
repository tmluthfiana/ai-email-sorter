import pool from '../config/database';
import { Email, EmailSummary } from './types';

export class EmailModel {
  static async create(emailData: Omit<Email, 'id' | 'created_at' | 'updated_at'>): Promise<Email> {
    const {
      user_id,
      category_id,
      gmail_id,
      thread_id,
      subject,
      sender,
      recipients,
      body,
      html_body,
      clean_text,
      summary,
      is_read,
      is_archived,
      received_at
    } = emailData;
    
    const query = `
      INSERT INTO emails (
        user_id, category_id, gmail_id, thread_id, subject, sender, 
        recipients, body, html_body, clean_text, summary, is_read, is_archived, received_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    
    const values = [
      user_id, category_id, gmail_id, thread_id, subject, sender,
      recipients, body, html_body, clean_text, summary, is_read, is_archived, received_at
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findById(id: number): Promise<Email | null> {
    const query = 'SELECT * FROM emails WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByGmailId(userId: number, gmailId: string): Promise<Email | null> {
    const query = 'SELECT * FROM emails WHERE user_id = $1 AND gmail_id = $2';
    const result = await pool.query(query, [userId, gmailId]);
    return result.rows[0] || null;
  }

  static async findByCategory(categoryId: number, limit = 50, offset = 0): Promise<EmailSummary[]> {
    const query = `
      SELECT 
        e.id,
        e.subject,
        e.sender,
        e.summary,
        e.received_at,
        e.is_read,
        c.name as category_name
      FROM emails e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.category_id = $1
      ORDER BY e.received_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [categoryId, limit, offset]);
    return result.rows;
  }

  static async findByUserId(userId: number, limit = 50, offset = 0): Promise<EmailSummary[]> {
    const query = `
      SELECT 
        e.id,
        e.subject,
        e.sender,
        e.summary,
        e.received_at,
        e.is_read,
        c.name as category_name
      FROM emails e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = $1
      ORDER BY e.received_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  static async updateCategory(emailId: number, categoryId: number | null): Promise<Email> {
    const query = `
      UPDATE emails 
      SET category_id = $2
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [emailId, categoryId]);
    return result.rows[0];
  }

  static async markAsRead(emailId: number): Promise<Email> {
    const query = `
      UPDATE emails 
      SET is_read = true
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [emailId]);
    return result.rows[0];
  }

  static async markAsUnread(emailId: number): Promise<Email> {
    const query = `
      UPDATE emails 
      SET is_read = false
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [emailId]);
    return result.rows[0];
  }

  static async delete(emailId: number): Promise<void> {
    const query = 'DELETE FROM emails WHERE id = $1';
    await pool.query(query, [emailId]);
  }

  static async bulkDelete(emailIds: number[]): Promise<void> {
    if (emailIds.length === 0) return;
    
    const placeholders = emailIds.map((_, index) => `$${index + 1}`).join(',');
    const query = `DELETE FROM emails WHERE id IN (${placeholders})`;
    await pool.query(query, emailIds);
  }

  static async bulkMarkAsRead(emailIds: number[]): Promise<void> {
    if (emailIds.length === 0) return;
    
    const placeholders = emailIds.map((_, index) => `$${index + 1}`).join(',');
    const query = `UPDATE emails SET is_read = true WHERE id IN (${placeholders})`;
    await pool.query(query, emailIds);
  }

  static async bulkMarkAsUnread(emailIds: number[]): Promise<void> {
    if (emailIds.length === 0) return;
    
    const placeholders = emailIds.map((_, index) => `$${index + 1}`).join(',');
    const query = `UPDATE emails SET is_read = false WHERE id IN (${placeholders})`;
    await pool.query(query, emailIds);
  }

  static async getUncategorizedEmails(userId: number, limit = 50, offset = 0): Promise<EmailSummary[]> {
    const query = `
      SELECT 
        e.id,
        e.subject,
        e.sender,
        e.summary,
        e.received_at,
        e.is_read,
        NULL as category_name
      FROM emails e
      WHERE e.user_id = $1 AND e.category_id IS NULL
      ORDER BY e.received_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }
} 