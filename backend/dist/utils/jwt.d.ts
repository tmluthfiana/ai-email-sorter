import { User } from '../models/types';
export interface JWTPayload {
    userId: number;
    email: string;
    googleId: string;
}
export declare class JWTUtils {
    static generateToken(user: User): string;
    static verifyToken(token: string): JWTPayload;
    static extractTokenFromHeader(authHeader: string): string;
}
//# sourceMappingURL=jwt.d.ts.map