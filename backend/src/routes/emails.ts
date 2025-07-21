import { Router } from 'express';
import { EmailController } from '../controllers/emailController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Sync emails from Gmail
router.post('/sync', EmailController.syncEmails);

// Get emails (with optional category filter)
router.get('/', EmailController.getEmails);

// Get a specific email
router.get('/:id', EmailController.getEmail);

// Mark email as read
router.patch('/:id/read', EmailController.markAsRead);

// Mark email as unread
router.patch('/:id/unread', EmailController.markAsUnread);

// Delete an email
router.delete('/:id', EmailController.deleteEmail);

// Bulk actions
router.post('/bulk', EmailController.bulkAction);

// Clean existing emails (process HTML content)
router.post('/clean', EmailController.cleanExistingEmails);

// Clear all emails for user
router.delete('/clear-all', EmailController.clearAllEmails);

// Test Gmail connection
router.get('/test-connection', EmailController.testGmailConnection);

// Get emails by category
router.get('/categories/:categoryId/emails', authenticateToken, EmailController.getEmailsByCategory);

// Bulk unsubscribe
router.post('/bulk-unsubscribe', authenticateToken, EmailController.bulkUnsubscribe);

// Advanced unsubscribe (headless browser stub)
router.post('/advanced-unsubscribe', authenticateToken, EmailController.advancedUnsubscribe);

export default router; 