import { Category, CreateCategoryRequest, UpdateCategoryRequest } from './types';
export declare class CategoryModel {
    static create(userId: number, categoryData: CreateCategoryRequest): Promise<Category>;
    static findById(id: number): Promise<Category | null>;
    static findByUserId(userId: number): Promise<Category[]>;
    static findByNameAndUserId(userId: number, name: string): Promise<Category | null>;
    static update(id: number, updates: UpdateCategoryRequest): Promise<Category>;
    static delete(id: number): Promise<void>;
    static getCategoryStats(userId: number): Promise<Array<Category & {
        email_count: number;
    }>>;
}
//# sourceMappingURL=Category.d.ts.map