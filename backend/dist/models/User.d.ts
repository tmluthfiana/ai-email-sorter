import { User } from './types';
export declare class UserModel {
    static create(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User>;
    static findByGoogleId(google_id: string): Promise<User | null>;
    static findByEmail(email: string): Promise<User | null>;
    static findByRefreshToken(refreshToken: string): Promise<User | null>;
    static findById(id: number): Promise<User | null>;
    static updateTokens(id: number, access_token: string, refresh_token: string, token_expiry: Date): Promise<User>;
    static updateProfile(id: number, updates: Partial<Pick<User, 'name' | 'picture'>>): Promise<User>;
    static delete(id: number): Promise<void>;
}
//# sourceMappingURL=User.d.ts.map