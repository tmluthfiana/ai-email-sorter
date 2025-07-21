import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
export declare class EmailController {
    static syncEmails(req: AuthenticatedRequest, res: Response): Promise<void>;
    static getEmails(req: AuthenticatedRequest, res: Response): Promise<void>;
    static getEmail(req: AuthenticatedRequest, res: Response): Promise<void>;
    static markAsRead(req: AuthenticatedRequest, res: Response): Promise<void>;
    static markAsUnread(req: AuthenticatedRequest, res: Response): Promise<void>;
    static bulkAction(req: AuthenticatedRequest, res: Response): Promise<void>;
    static deleteEmail(req: AuthenticatedRequest, res: Response): Promise<void>;
    static cleanExistingEmails(req: AuthenticatedRequest, res: Response): Promise<void>;
    static testGmailConnection(req: AuthenticatedRequest, res: Response): Promise<void>;
    static clearAllEmails(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=emailController.d.ts.map