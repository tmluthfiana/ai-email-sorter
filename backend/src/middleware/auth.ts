import { Request, Response, NextFunction } from 'express';
import { JWTUtils, JWTPayload } from '../utils/jwt';
import { UserModel } from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    google_id: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    const token = JWTUtils.extractTokenFromHeader(authHeader);
    const payload = JWTUtils.verifyToken(token);
    
    // Verify user still exists in database
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      google_id: user.google_id,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      next();
      return;
    }

    const token = JWTUtils.extractTokenFromHeader(authHeader);
    const payload = JWTUtils.verifyToken(token);
    
    const user = await UserModel.findById(payload.userId);
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        google_id: user.google_id,
      };
    }

    next();
  } catch (error) {
    // For optional auth, we just continue without setting user
    next();
  }
}; 