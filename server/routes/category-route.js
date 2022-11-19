const express = require('express');
const login = require('../middleware/login');
const permission = require('../middleware/permission');
const categoriesController = require('../controllers/category-controller');

const router = express.Router();

router.get('/', categoriesController.getCategories);
router.post('/', login.required, permission.admin, categoriesController.createCategory);
router.delete('/', login.required, permission.admin, categoriesController.deleteCategory);

module.exports = router;
