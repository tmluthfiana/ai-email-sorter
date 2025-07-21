"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryController = void 0;
const Category_1 = require("../models/Category");
class CategoryController {
    static async createCategory(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const categoryData = req.body;
            // Validate required fields
            if (!categoryData.name || !categoryData.description) {
                res.status(400).json({ error: 'Name and description are required' });
                return;
            }
            // Check if category name already exists for this user
            const existingCategory = await Category_1.CategoryModel.findByNameAndUserId(user.id, categoryData.name);
            if (existingCategory) {
                res.status(409).json({ error: 'Category with this name already exists' });
                return;
            }
            const category = await Category_1.CategoryModel.create(user.id, categoryData);
            res.status(201).json({ category });
        }
        catch (error) {
            console.error('Error creating category:', error);
            res.status(500).json({ error: 'Failed to create category' });
        }
    }
    static async getCategories(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const categories = await Category_1.CategoryModel.findByUserId(user.id);
            res.json({ categories });
        }
        catch (error) {
            console.error('Error fetching categories:', error);
            res.status(500).json({ error: 'Failed to fetch categories' });
        }
    }
    static async getCategoryStats(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const stats = await Category_1.CategoryModel.getCategoryStats(user.id);
            res.json({ stats });
        }
        catch (error) {
            console.error('Error fetching category stats:', error);
            res.status(500).json({ error: 'Failed to fetch category stats' });
        }
    }
    static async getCategory(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const categoryId = parseInt(req.params.id);
            if (isNaN(categoryId)) {
                res.status(400).json({ error: 'Invalid category ID' });
                return;
            }
            const category = await Category_1.CategoryModel.findById(categoryId);
            if (!category) {
                res.status(404).json({ error: 'Category not found' });
                return;
            }
            // Ensure user owns this category
            if (category.user_id !== user.id) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            res.json({ category });
        }
        catch (error) {
            console.error('Error fetching category:', error);
            res.status(500).json({ error: 'Failed to fetch category' });
        }
    }
    static async updateCategory(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const categoryId = parseInt(req.params.id);
            if (isNaN(categoryId)) {
                res.status(400).json({ error: 'Invalid category ID' });
                return;
            }
            const category = await Category_1.CategoryModel.findById(categoryId);
            if (!category) {
                res.status(404).json({ error: 'Category not found' });
                return;
            }
            // Ensure user owns this category
            if (category.user_id !== user.id) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            const updates = req.body;
            // Check if name is being updated and if it conflicts with existing category
            if (updates.name && updates.name !== category.name) {
                const existingCategory = await Category_1.CategoryModel.findByNameAndUserId(user.id, updates.name);
                if (existingCategory) {
                    res.status(409).json({ error: 'Category with this name already exists' });
                    return;
                }
            }
            const updatedCategory = await Category_1.CategoryModel.update(categoryId, updates);
            res.json({ category: updatedCategory });
        }
        catch (error) {
            console.error('Error updating category:', error);
            res.status(500).json({ error: 'Failed to update category' });
        }
    }
    static async deleteCategory(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const categoryId = parseInt(req.params.id);
            if (isNaN(categoryId)) {
                res.status(400).json({ error: 'Invalid category ID' });
                return;
            }
            const category = await Category_1.CategoryModel.findById(categoryId);
            if (!category) {
                res.status(404).json({ error: 'Category not found' });
                return;
            }
            // Ensure user owns this category
            if (category.user_id !== user.id) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            await Category_1.CategoryModel.delete(categoryId);
            res.json({ message: 'Category deleted successfully' });
        }
        catch (error) {
            console.error('Error deleting category:', error);
            res.status(500).json({ error: 'Failed to delete category' });
        }
    }
}
exports.CategoryController = CategoryController;
//# sourceMappingURL=categoryController.js.map