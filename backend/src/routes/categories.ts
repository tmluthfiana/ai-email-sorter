import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Create a new category
router.post('/', CategoryController.createCategory);

// Get all categories for the user
router.get('/', CategoryController.getCategories);

// Get category statistics
router.get('/stats', CategoryController.getCategoryStats);

// Get a specific category
router.get('/:id', CategoryController.getCategory);

// Update a category
router.put('/:id', CategoryController.updateCategory);

// Delete a category
router.delete('/:id', CategoryController.deleteCategory);

export default router; 