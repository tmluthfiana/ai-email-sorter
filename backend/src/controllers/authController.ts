import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { UserModel } from '../models/User';
import { JWTUtils } from '../utils/jwt';
import { GmailService } from '../services/GmailService';
import pool from '../config/database';

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
  
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );
};

export class AuthController {
  static async getAuthUrl(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ error: 'Failed to generate auth URL' });
    }
  }

  static async handleCallback(req: Request, res: Response): Promise<void> {
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

      const userInfo = userInfoResponse.data as any;

      // Check if user exists
      let user = await UserModel.findByGoogleId(userInfo.id);

      if (user) {
        // Update tokens for existing user
        await UserModel.updateTokens(
          user.id,
          tokens.access_token,
          tokens.refresh_token,
          tokens.expiry_date!
        );
      } else {
        // Create new user
        user = await UserModel.create({
          google_id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: new Date(tokens.expiry_date!),
        });
      }

      // Generate JWT token
      const token = JWTUtils.generateToken(user);

      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${token}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        res.status(400).json({ error: 'Refresh token required' });
        return;
      }

      const user = await UserModel.findByRefreshToken(refresh_token);
      if (!user) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      // Refresh the access token
      const newTokens = await GmailService.refreshAccessToken(refresh_token);
      
      // Update user tokens
      await UserModel.updateTokens(
        user.id,
        newTokens.access_token,
        newTokens.refresh_token || refresh_token,
        newTokens.expiry_date
      );

      // Generate new JWT token
      const token = JWTUtils.generateToken(user);

      res.json({ token, user });
    } catch (error) {
      console.error('Error refreshing token:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // In a real application, you might want to blacklist the token
      // For now, we'll just return a success response
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Error during logout:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const { user } = req as any;
      
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const userProfile = await UserModel.findById(user.id);
      if (!userProfile) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Remove sensitive information
      const { access_token, refresh_token, token_expiry, ...safeUser } = userProfile;
      
      res.json({ user: safeUser });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  static async listLinkedAccounts(req: Request, res: Response): Promise<void> {
    // TODO: Implement real logic to list all Gmail accounts linked to the user
    res.json({ accounts: [{ email: 'tml.dummy@gmail.com', primary: true }] });
  }

  static async linkGmailAccount(req: Request, res: Response): Promise<void> {
    // TODO: Implement real logic to link a new Gmail account via OAuth
    res.json({ message: 'Link Gmail account flow not implemented (stub)' });
  }

  static async removeGmailAccount(req: Request, res: Response): Promise<void> {
    // TODO: Implement real logic to remove a linked Gmail account
    res.json({ message: 'Remove Gmail account flow not implemented (stub)' });
  }

  static async clearAllUserData(req: Request, res: Response): Promise<void> {
    try {
      const { user } = req as any;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      
      // Delete emails
      await pool.query('DELETE FROM emails WHERE user_id = $1', [user.id]);
      
      // Delete categories
      await pool.query('DELETE FROM categories WHERE user_id = $1', [user.id]);
      
      // Delete user
      await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
      
      res.json({ message: 'All user data deleted successfully' });
    } catch (error) {
      console.error('Error clearing all user data:', error);
      res.status(500).json({ error: 'Failed to clear all user data' });
    }
  }
} 