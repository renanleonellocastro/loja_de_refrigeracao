const express = require('express');
const login = require('../middleware/login');
const permission = require('../middleware/permission');
const userController = require('../controllers/user-controller');

const router = express.Router();

router.get('/', login.required, permission.manager, userController.getUsers);
router.post('/', userController.createClient);
router.post('/delete', login.required, permission.manager, userController.deleteClient);
router.post('/employee', login.required, permission.manager, userController.createEmployee);
router.post('/delete/employee', login.required, permission.admin, userController.deleteEmployee);
router.post('/manager', login.required, permission.admin, userController.createManager);
router.post('/delete/manager', login.required, permission.admin, userController.deleteManager);
router.post('/login', userController.Login)

module.exports = router;