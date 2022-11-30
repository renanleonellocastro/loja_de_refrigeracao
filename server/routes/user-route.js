const express = require('express');
const login = require('../middleware/login');
const permission = require('../middleware/permission');
const userController = require('../controllers/user-controller');

const router = express.Router();

router.get('/', login.required, permission.manager, userController.getUsers);
router.post('/', userController.createClient);
router.delete('/', login.required, permission.manager, userController.deleteClient);
router.post('/employee', login.required, permission.manager, userController.createEmployee);
router.delete('/employee', login.required, permission.admin, userController.deleteEmployee);
router.post('/manager', login.required, permission.admin, userController.createManager);
router.delete('/manager', login.required, permission.admin, userController.deleteManager);
router.post('/login', userController.Login)
router.get('/:id', login.required, userController.getUserDetails);
router.patch('/:id', login.required, userController.updateUser);

module.exports = router;
