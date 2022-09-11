const express = require('express');
const router = express.Router();

const orderController = require('../controllers/order-controller');

// verificar aqui como travar o usuario para ver somente as ordens dele e não de outros usuarios
router.get('/', login.required, permission.manager, orderController.getOrders);
router.get('/:orderid', login.required, orderController.getOrder);
router.post('/', login.required, orderController.createOrder);
router.update('/:orderid', login.required, permission.admin, orderController.changeOrderState);
router.delete('/:orderid', login.required, permission.admin, orderController.deleteOrder);
router.get('/user', login.required, orderController.getOrdersByUser);

module.exports = router;
