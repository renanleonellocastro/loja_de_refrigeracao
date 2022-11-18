const express = require('express');
const router = express.Router();
const image = require('../middleware/upload-image');
const login = require('../middleware/login');
const permission = require('../middleware/permission');

const productsController = require('../controllers/product-controller');

router.get('/', productsController.getProducts);
router.post('/', login.required, permission.manager, productsController.createProduct);
router.get('/:productid', productsController.getProductDetail);
router.patch('/:productid', login.required, permission.manager, productsController.updateProduct);
router.delete('/:productid', login.required, permission.admin, productsController.deleteProduct);
router.get('/:productid/image', productsController.getImages);
router.post('/:productid/image', login.required, permission.manager, image.upload.single('image'), productsController.uploadImage);
router.delete('/:productid/image/:imageid', login.required, permission.manager, productsController.deleteImage);

module.exports = router;
