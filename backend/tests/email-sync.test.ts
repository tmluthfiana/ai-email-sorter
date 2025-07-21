import request from 'supertest';
import app from '../src/index';
import pool from '../src/config/database';
import { GmailService } from '../src/services/GmailService';
import { AIService } from '../src/services/AIService';
import { JWTUtils } from '../src/utils/jwt';

// Mock external services
jest.mock('../src/services/GmailService');
jest.mock('../src/services/AIService');

describe('Email Sync Tests', () => {
  let authToken: string;
  let userId: number;
  let categoryId: number;

  beforeAll(async () => {
    // Directly create a test user in the DB
    const userResult = await pool.query(`
      INSERT INTO users (google_id, email, name, picture, access_token, refresh_token)
      VALUES ('test_user_id', 'test@example.com', 'Test User', 'https://example.com/picture.jpg', 'test_access_token', 'test_refresh_token')
      RETURNING *
    `);
    const testUser = userResult.rows[0];

    // Generate a JWT for the test user
    authToken = JWTUtils.generateToken(testUser);
    userId = testUser.id;

    // Create test category
    const categoryResponse = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Category',
        description: 'Test category for email sorting',
        color: '#3B82F6'
      });

    categoryId = categoryResponse.body.id;
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM emails WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM categories WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /emails/sync', () => {
    it('should sync emails successfully', async () => {
      // Mock Gmail service responses
      const mockGmailMessages = [
        {
          id: 'gmail_1',
          threadId: 'thread_1',
          internalDate: Date.now().toString(),
          payload: {
            headers: [
              { name: 'Subject', value: 'Test Email 1' },
              { name: 'From', value: 'sender1@example.com' },
              { name: 'To', value: 'test@example.com' }
            ],
            body: {
              data: Buffer.from('Test email body 1').toString('base64')
            }
          }
        }
      ];

      (GmailService.listMessages as jest.Mock).mockResolvedValue(mockGmailMessages);
      (GmailService.getMessage as jest.Mock).mockResolvedValue(mockGmailMessages[0]);
      (GmailService.archiveMessage as jest.Mock).mockResolvedValue(undefined);

      // Mock AI service response
      (AIService.categorizeEmail as jest.Mock).mockResolvedValue({
        category_id: categoryId,
        confidence: 0.95,
        summary: 'This is a test email about testing'
      });

      const response = await request(app)
        .post('/emails/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ maxEmails: 10 });

      expect(response.status).toBe(200);
      expect(response.body.processed).toBe(1);
      expect(response.body.errors).toBe(0);
      expect(response.body.message).toContain('Successfully processed 1 emails');
    });

    it('should handle Gmail API errors gracefully', async () => {
      (GmailService.listMessages as jest.Mock).mockRejectedValue(new Error('Gmail API error'));

      const response = await request(app)
        .post('/emails/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ maxEmails: 10 });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to sync emails');
    });

    it('should skip emails without subjects', async () => {
      const mockGmailMessages = [
        {
          id: 'gmail_1',
          threadId: 'thread_1',
          internalDate: Date.now().toString(),
          payload: {
            headers: [
              { name: 'From', value: 'sender1@example.com' },
              { name: 'To', value: 'test@example.com' }
            ],
            body: {
              data: Buffer.from('Test email body 1').toString('base64')
            }
          }
        }
      ];

      (GmailService.listMessages as jest.Mock).mockResolvedValue(mockGmailMessages);
      (GmailService.getMessage as jest.Mock).mockResolvedValue(mockGmailMessages[0]);

      const response = await request(app)
        .post('/emails/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ maxEmails: 10 });

      expect(response.status).toBe(200);
      expect(response.body.processed).toBe(0);
    });
  });

  describe('GET /emails', () => {
    beforeEach(async () => {
      // Create test emails
      await pool.query(`
        INSERT INTO emails (user_id, category_id, gmail_id, subject, sender, body, summary, is_read, received_at)
        VALUES 
        ($1, $2, 'gmail_1', 'Test Email 1', 'sender1@example.com', 'Test body 1', 'Test summary 1', false, NOW()),
        ($1, $2, 'gmail_2', 'Test Email 2', 'sender2@example.com', 'Test body 2', 'Test summary 2', true, NOW())
      `, [userId, categoryId]);
    });

    afterEach(async () => {
      await pool.query('DELETE FROM emails WHERE user_id = $1', [userId]);
    });

    it('should return emails for user', async () => {
      const response = await request(app)
        .get('/emails')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.emails).toHaveLength(2);
      expect(response.body.emails[0]).toHaveProperty('subject');
      expect(response.body.emails[0]).toHaveProperty('sender');
      expect(response.body.emails[0]).toHaveProperty('summary');
    });

    it('should filter emails by category', async () => {
      const response = await request(app)
        .get(`/emails?categoryId=${categoryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.emails).toHaveLength(2);
      expect(response.body.emails[0].category_id).toBe(categoryId);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/emails?limit=1&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.emails).toHaveLength(1);
    });
  });

  describe('GET /emails/:id', () => {
    let emailId: number;

    beforeEach(async () => {
      const result = await pool.query(`
        INSERT INTO emails (user_id, category_id, gmail_id, subject, sender, body, html_body, clean_text, summary, is_read, received_at)
        VALUES ($1, $2, 'gmail_1', 'Test Email', 'sender@example.com', 'Test body', '<html>Test HTML</html>', 'Test clean text', 'Test summary', false, NOW())
        RETURNING id
      `, [userId, categoryId]);
      emailId = result.rows[0].id;
    });

    afterEach(async () => {
      await pool.query('DELETE FROM emails WHERE user_id = $1', [userId]);
    });

    it('should return email details', async () => {
      const response = await request(app)
        .get(`/emails/${emailId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toHaveProperty('id', emailId);
      expect(response.body.email).toHaveProperty('subject', 'Test Email');
      expect(response.body.email).toHaveProperty('clean_text');
      expect(response.body.category).toHaveProperty('id', categoryId);
    });

    it('should return 404 for non-existent email', async () => {
      const response = await request(app)
        .get('/emails/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Email not found');
    });

    it('should return 403 for email not owned by user', async () => {
      // Create email for different user
      const otherUserResult = await pool.query(`
        INSERT INTO users (google_id, email, name, picture, access_token, refresh_token)
        VALUES ('other_user', 'other@example.com', 'Other User', '', 'token', 'refresh')
        RETURNING id
      `);
      const otherUserId = otherUserResult.rows[0].id;

      const otherEmailResult = await pool.query(`
        INSERT INTO emails (user_id, category_id, gmail_id, subject, sender, body, summary, is_read, received_at)
        VALUES ($1, $2, 'gmail_other', 'Other Email', 'other@example.com', 'Other body', 'Other summary', false, NOW())
        RETURNING id
      `, [otherUserId, categoryId]);
      const otherEmailId = otherEmailResult.rows[0].id;

      const response = await request(app)
        .get(`/emails/${otherEmailId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');

      // Clean up
      await pool.query('DELETE FROM emails WHERE id = $1', [otherEmailId]);
      await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });

  describe('POST /emails/bulk-unsubscribe', () => {
    let emailIds: number[];

    beforeEach(async () => {
      const result = await pool.query(`
        INSERT INTO emails (user_id, category_id, gmail_id, subject, sender, body, clean_text, summary, is_read, received_at)
        VALUES 
        ($1, $2, 'gmail_1', 'Newsletter 1', 'newsletter1@example.com', 'Test body with unsubscribe link: https://example.com/unsubscribe', 'Test body with unsubscribe link: https://example.com/unsubscribe', 'Test summary', false, NOW()),
        ($1, $2, 'gmail_2', 'Newsletter 2', 'newsletter2@example.com', 'Test body without unsubscribe', 'Test body without unsubscribe', 'Test summary', false, NOW())
        RETURNING id
      `, [userId, categoryId]);
      emailIds = result.rows.map((row: any) => row.id);
    });

    afterEach(async () => {
      await pool.query('DELETE FROM emails WHERE user_id = $1', [userId]);
    });

    it('should process bulk unsubscribe successfully', async () => {
      const response = await request(app)
        .post('/emails/bulk-unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email_ids: emailIds });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Bulk unsubscribe completed');
      expect(response.body.results).toHaveLength(2);
      
      // Check that emails were deleted
      const remainingEmails = await pool.query('SELECT COUNT(*) FROM emails WHERE user_id = $1', [userId]);
      expect(parseInt(remainingEmails.rows[0].count)).toBe(0);
    });

    it('should extract unsubscribe links correctly', async () => {
      const response = await request(app)
        .post('/emails/bulk-unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email_ids: [emailIds[0]] });

      expect(response.status).toBe(200);
      expect(response.body.results[0].success).toBe(true);
      expect(response.body.results[0].links).toContain('https://example.com/unsubscribe');
    });

    it('should handle emails without unsubscribe links', async () => {
      const response = await request(app)
        .post('/emails/bulk-unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email_ids: [emailIds[1]] });

      expect(response.status).toBe(200);
      expect(response.body.results[0].success).toBe(false);
      expect(response.body.results[0].message).toBe('No unsubscribe links found');
    });

    it('should return 400 for invalid request', async () => {
      const response = await request(app)
        .post('/emails/bulk-unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email_ids: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('email_ids array is required');
    });
  });

  describe('Email Actions', () => {
    let emailId: number;

    beforeEach(async () => {
      const result = await pool.query(`
        INSERT INTO emails (user_id, category_id, gmail_id, subject, sender, body, summary, is_read, received_at)
        VALUES ($1, $2, 'gmail_1', 'Test Email', 'sender@example.com', 'Test body', 'Test summary', false, NOW())
        RETURNING id
      `, [userId, categoryId]);
      emailId = result.rows[0].id;
    });

    afterEach(async () => {
      await pool.query('DELETE FROM emails WHERE user_id = $1', [userId]);
    });

    it('should mark email as read', async () => {
      (GmailService.markAsRead as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .patch(`/emails/${emailId}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Email marked as read');
    });

    it('should mark email as unread', async () => {
      (GmailService.markAsUnread as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .patch(`/emails/${emailId}/unread`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Email marked as unread');
    });

    it('should delete email', async () => {
      (GmailService.deleteMessage as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/emails/${emailId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Email deleted successfully');
    });
  });
}); 