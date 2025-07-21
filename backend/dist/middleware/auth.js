"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authenticateToken = void 0;
const jwt_1 = require("../utils/jwt");
const User_1 = require("../models/User");
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: 'Authorization header required' });
            return;
        }
        const token = jwt_1.JWTUtils.extractTokenFromHeader(authHeader);
        const payload = jwt_1.JWTUtils.verifyToken(token);
        // Verify user still exists in database
        const user = await User_1.UserModel.findById(payload.userId);
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
    }
    catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};
exports.authenticateToken = authenticateToken;
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            next();
            return;
        }
        const token = jwt_1.JWTUtils.extractTokenFromHeader(authHeader);
        const payload = jwt_1.JWTUtils.verifyToken(token);
        const user = await User_1.UserModel.findById(payload.userId);
        if (user) {
            req.user = {
                id: user.id,
                email: user.email,
                google_id: user.google_id,
            };
        }
        next();
    }
    catch (error) {
        // For optional auth, we just continue without setting user
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map