const express = require('express');
const login = require('../middleware/login');
const permission = require('../middleware/permission');
const CategoriesController = require('../controllers/category-controller');

const router = express.Router();

router.get('/', CategoriesController.getCategories);
router.post('/', login.required, permission.admin, CategoriesController.postCategory);

module.exports = router;