const express = require('express');
const login = require('../middleware/login');
const permission = require('../middleware/permission');
const CategoriesController = require('../controllers/category-controller');

const router = express.Router();

router.get('/', CategoriesController.getCategories);
router.post('/', login.required, permission.admin, CategoriesController.createCategory);
router.delete('/', login.required, permission.admin, CategoriesController.deleteCategory);

module.exports = router;
