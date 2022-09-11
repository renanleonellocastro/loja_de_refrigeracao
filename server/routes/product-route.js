const express = require('express');
const router = express.Router();
const multer = require('multer');
const login = require('../middleware/login');
const permission = require('../middleware/permission');

const ProductsController = require('../controllers/product-controller');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, new Date().toISOString() + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5
    },
    fileFilter: fileFilter
});

router.get('/', ProductsController.getProducts);
router.post('/', login.required, permission.manager, ProductsController.createProduct);
router.get('/:productid', ProductsController.getProductDetail);
router.patch('/:productid', login.required, permission.manager, ProductsController.updateProduct);
router.delete('/:productid', login.required, permission.admin, ProductsController.deleteProduct);
router.post('/:productid/image', login.required, permission.manager, upload.single('image'), ProductsController.postImage);
router.get('/:productid/images', ProductsController.getImages);

module.exports = router;
