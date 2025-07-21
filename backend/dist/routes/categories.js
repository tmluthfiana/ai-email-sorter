"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const categoryController_1 = require("../controllers/categoryController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Create a new category
router.post('/', categoryController_1.CategoryController.createCategory);
// Get all categories for the user
router.get('/', categoryController_1.CategoryController.getCategories);
// Get category statistics
router.get('/stats', categoryController_1.CategoryController.getCategoryStats);
// Get a specific category
router.get('/:id', categoryController_1.CategoryController.getCategory);
// Update a category
router.put('/:id', categoryController_1.CategoryController.updateCategory);
// Delete a category
router.delete('/:id', categoryController_1.CategoryController.deleteCategory);
exports.default = router;
//# sourceMappingURL=categories.js.map