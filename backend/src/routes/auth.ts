import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get Google OAuth URL
router.get('/google/url', AuthController.getAuthUrl);

// Handle Google OAuth callback
router.get('/google/callback', AuthController.handleCallback);

// Refresh access token
router.post('/refresh', AuthController.refreshToken);

// Logout
router.post('/logout', authenticateToken, AuthController.logout);

// Get user profile
router.get('/profile', authenticateToken, AuthController.getProfile);

router.get('/accounts', authenticateToken, AuthController.listLinkedAccounts);
router.post('/accounts/link', authenticateToken, AuthController.linkGmailAccount);
router.delete('/accounts/:email', authenticateToken, AuthController.removeGmailAccount);
router.delete('/clear-all', authenticateToken, AuthController.clearAllUserData);

export default router; 