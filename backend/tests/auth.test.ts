import request from 'supertest';
import app from '../src/index';
import { UserModel } from '../src/models/User';

// Mock the Google OAuth client
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/oauth2/auth'),
    getToken: jest.fn().mockResolvedValue({
      tokens: {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expiry_date: Date.now() + 3600000,
      },
    }),
    setCredentials: jest.fn(),
    request: jest.fn().mockResolvedValue({
      data: {
        id: 'mock_google_id',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/picture.jpg',
      },
    }),
  })),
}));

// Mock the JWT utils
jest.mock('../src/utils/jwt', () => ({
  JWTUtils: {
    generateToken: jest.fn().mockReturnValue('mock_jwt_token'),
    verifyToken: jest.fn().mockReturnValue({
      userId: 1,
      email: 'test@example.com',
      googleId: 'mock_google_id',
    }),
    extractTokenFromHeader: jest.fn().mockReturnValue('mock_jwt_token'),
  },
}));

describe('Auth Routes', () => {
  beforeEach(async () => {
    // Clear database before each test
    // In a real test setup, you'd use a test database
  });

  describe('GET /api/auth/google/url', () => {
    it('should return Google OAuth URL', async () => {
      const response = await request(app)
        .get('/api/auth/google/url')
        .expect(200);

      expect(response.body).toHaveProperty('authUrl');
      expect(response.body.authUrl).toBe('https://accounts.google.com/oauth2/auth');
    });
  });

  describe('GET /api/auth/google/callback', () => {
    it('should handle OAuth callback successfully', async () => {
      const response = await request(app)
        .get('/api/auth/google/callback?code=mock_auth_code')
        .expect(302); // Redirect

      expect(response.headers.location).toContain('/auth/callback?token=');
    });

    it('should return 400 if no code provided', async () => {
      await request(app)
        .get('/api/auth/google/callback')
        .expect(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return 400 if no refresh token provided', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .expect(400);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return 401 if no token provided', async () => {
      await request(app)
        .get('/api/auth/profile')
        .expect(401);
    });
  });
}); 