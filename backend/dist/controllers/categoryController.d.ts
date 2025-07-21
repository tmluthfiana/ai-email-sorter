import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
export declare class CategoryController {
    static createCategory(req: AuthenticatedRequest, res: Response): Promise<void>;
    static getCategories(req: AuthenticatedRequest, res: Response): Promise<void>;
    static getCategoryStats(req: AuthenticatedRequest, res: Response): Promise<void>;
    static getCategory(req: AuthenticatedRequest, res: Response): Promise<void>;
    static updateCategory(req: AuthenticatedRequest, res: Response): Promise<void>;
    static deleteCategory(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=categoryController.d.ts.map