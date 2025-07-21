"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emailController_1 = require("../controllers/emailController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Sync emails from Gmail
router.post('/sync', emailController_1.EmailController.syncEmails);
// Get emails (with optional category filter)
router.get('/', emailController_1.EmailController.getEmails);
// Get a specific email
router.get('/:id', emailController_1.EmailController.getEmail);
// Mark email as read
router.patch('/:id/read', emailController_1.EmailController.markAsRead);
// Mark email as unread
router.patch('/:id/unread', emailController_1.EmailController.markAsUnread);
// Delete an email
router.delete('/:id', emailController_1.EmailController.deleteEmail);
// Bulk actions
router.post('/bulk', emailController_1.EmailController.bulkAction);
// Clean existing emails (process HTML content)
router.post('/clean', emailController_1.EmailController.cleanExistingEmails);
// Clear all emails for user
router.delete('/clear-all', emailController_1.EmailController.clearAllEmails);
// Test Gmail connection
router.get('/test-connection', emailController_1.EmailController.testGmailConnection);
exports.default = router;
//# sourceMappingURL=emails.js.map