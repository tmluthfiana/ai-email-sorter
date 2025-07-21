"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get Google OAuth URL
router.get('/google/url', authController_1.AuthController.getAuthUrl);
// Handle Google OAuth callback
router.get('/google/callback', authController_1.AuthController.handleCallback);
// Refresh access token
router.post('/refresh', authController_1.AuthController.refreshToken);
// Logout
router.post('/logout', auth_1.authenticateToken, authController_1.AuthController.logout);
// Get user profile
router.get('/profile', auth_1.authenticateToken, authController_1.AuthController.getProfile);
exports.default = router;
//# sourceMappingURL=auth.js.map