import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { CategoryModel } from '../models/Category';
import { CreateCategoryRequest, UpdateCategoryRequest } from '../models/types';

export class CategoryController {
  static async createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const categoryData: CreateCategoryRequest = req.body;
      
      // Validate required fields
      if (!categoryData.name || !categoryData.description) {
        res.status(400).json({ error: 'Name and description are required' });
        return;
      }

      // Check if category name already exists for this user
      const existingCategory = await CategoryModel.findByNameAndUserId(user.id, categoryData.name);
      if (existingCategory) {
        res.status(409).json({ error: 'Category with this name already exists' });
        return;
      }

      const category = await CategoryModel.create(user.id, categoryData);
      res.status(201).json({ category });
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  }

  static async getCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const categories = await CategoryModel.findByUserId(user.id);
      res.json({ categories });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  }

  static async getCategoryStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const stats = await CategoryModel.getCategoryStats(user.id);
      res.json({ stats });
    } catch (error) {
      console.error('Error fetching category stats:', error);
      res.status(500).json({ error: 'Failed to fetch category stats' });
    }
  }

  static async getCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const category = await CategoryModel.findById(categoryId);
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
    } catch (error) {
      console.error('Error fetching category:', error);
      res.status(500).json({ error: 'Failed to fetch category' });
    }
  }

  static async updateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const category = await CategoryModel.findById(categoryId);
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      // Ensure user owns this category
      if (category.user_id !== user.id) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const updates: UpdateCategoryRequest = req.body;
      
      // Check if name is being updated and if it conflicts with existing category
      if (updates.name && updates.name !== category.name) {
        const existingCategory = await CategoryModel.findByNameAndUserId(user.id, updates.name);
        if (existingCategory) {
          res.status(409).json({ error: 'Category with this name already exists' });
          return;
        }
      }

      const updatedCategory = await CategoryModel.update(categoryId, updates);
      res.json({ category: updatedCategory });
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ error: 'Failed to update category' });
    }
  }

  static async deleteCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const category = await CategoryModel.findById(categoryId);
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      // Ensure user owns this category
      if (category.user_id !== user.id) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      await CategoryModel.delete(categoryId);
      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ error: 'Failed to delete category' });
    }
  }
} 