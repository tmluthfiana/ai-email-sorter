import { Request, Response } from 'express';
export declare class AuthController {
    static getAuthUrl(req: Request, res: Response): Promise<void>;
    static handleCallback(req: Request, res: Response): Promise<void>;
    static refreshToken(req: Request, res: Response): Promise<void>;
    static logout(req: Request, res: Response): Promise<void>;
    static getProfile(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=authController.d.ts.map