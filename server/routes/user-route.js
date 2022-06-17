const express = require('express');
const login = require('../middleware/login');
const permission = require('../middleware/permission');
const userController = require('../controllers/user-controller');

const router = express.Router();

router.post('/', userController.createClient);
router.post('/manager', login.required, permission.admin, userController.createManager);
router.post('/employee', login.required, permission.manager, userController.createEmployee);
router.post('/login', userController.Login)

module.exports = router;