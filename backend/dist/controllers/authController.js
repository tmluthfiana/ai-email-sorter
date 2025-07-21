"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const google_auth_library_1 = require("google-auth-library");
const User_1 = require("../models/User");
const jwt_1 = require("../utils/jwt");
const GmailService_1 = require("../services/GmailService");
// Check if OAuth credentials are configured
const isOAuthConfigured = () => {
    return process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REDIRECT_URI &&
        process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' &&
        process.env.GOOGLE_CLIENT_SECRET !== 'your-google-client-secret';
};
// Create OAuth client dynamically
const createOAuthClient = () => {
    if (!isOAuthConfigured()) {
        throw new Error('OAuth credentials not configured');
    }
    return new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
};
class AuthController {
    static async getAuthUrl(req, res) {
        try {
            if (!isOAuthConfigured()) {
                res.status(500).json({
                    error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.'
                });
                return;
            }
            const scopes = [
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.modify',
                'https://www.googleapis.com/auth/gmail.labels',
            ];
            const authUrl = createOAuthClient().generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                prompt: 'consent',
            });
            res.json({ authUrl });
        }
        catch (error) {
            console.error('Error generating auth URL:', error);
            res.status(500).json({ error: 'Failed to generate auth URL' });
        }
    }
    static async handleCallback(req, res) {
        try {
            if (!isOAuthConfigured()) {
                res.status(500).json({
                    error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.'
                });
                return;
            }
            const { code } = req.query;
            if (!code || typeof code !== 'string') {
                res.status(400).json({ error: 'Authorization code required' });
                return;
            }
            // Exchange code for tokens
            const oauth2Client = createOAuthClient();
            const { tokens } = await oauth2Client.getToken(code);
            if (!tokens.access_token || !tokens.refresh_token) {
                res.status(400).json({ error: 'Failed to get access token' });
                return;
            }
            // Get user info from Google
            oauth2Client.setCredentials(tokens);
            const userInfoResponse = await oauth2Client.request({
                url: 'https://www.googleapis.com/oauth2/v2/userinfo',
            });
            const userInfo = userInfoResponse.data;
            // Check if user exists
            let user = await User_1.UserModel.findByGoogleId(userInfo.id);
            if (user) {
                // Update tokens for existing user
                user = await User_1.UserModel.updateTokens(user.id, tokens.access_token, tokens.refresh_token, new Date(tokens.expiry_date));
            }
            else {
                // Create new user
                user = await User_1.UserModel.create({
                    google_id: userInfo.id,
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expiry: new Date(tokens.expiry_date),
                });
            }
            // Generate JWT token
            const token = jwt_1.JWTUtils.generateToken(user);
            // Redirect to frontend with token
            const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${token}`;
            res.redirect(redirectUrl);
        }
        catch (error) {
            console.error('Error handling OAuth callback:', error);
            res.status(500).json({ error: 'Authentication failed' });
        }
    }
    static async refreshToken(req, res) {
        try {
            const { refresh_token } = req.body;
            if (!refresh_token) {
                res.status(400).json({ error: 'Refresh token required' });
                return;
            }
            const user = await User_1.UserModel.findByRefreshToken(refresh_token);
            if (!user) {
                res.status(401).json({ error: 'Invalid refresh token' });
                return;
            }
            // Refresh the access token
            const newTokens = await GmailService_1.GmailService.refreshAccessToken(refresh_token);
            // Update user tokens
            const updatedUser = await User_1.UserModel.updateTokens(user.id, newTokens.access_token, newTokens.refresh_token || refresh_token, new Date(newTokens.expiry_date));
            // Generate new JWT token
            const token = jwt_1.JWTUtils.generateToken(updatedUser);
            res.json({ token, user: updatedUser });
        }
        catch (error) {
            console.error('Error refreshing token:', error);
            res.status(500).json({ error: 'Failed to refresh token' });
        }
    }
    static async logout(req, res) {
        try {
            // In a real application, you might want to blacklist the token
            // For now, we'll just return a success response
            res.json({ message: 'Logged out successfully' });
        }
        catch (error) {
            console.error('Error during logout:', error);
            res.status(500).json({ error: 'Logout failed' });
        }
    }
    static async getProfile(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const userProfile = await User_1.UserModel.findById(user.id);
            if (!userProfile) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            // Remove sensitive information
            const { access_token, refresh_token, token_expiry, ...safeUser } = userProfile;
            res.json({ user: safeUser });
        }
        catch (error) {
            console.error('Error getting profile:', error);
            res.status(500).json({ error: 'Failed to get profile' });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map