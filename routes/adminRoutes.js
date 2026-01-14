const express = require('express')
const router = express.Router();
const adminController = require('../controllers/admin/adminController')
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController')
const { uploads } = require('../middlewares/multer');
const { userAuth, adminAuth } = require("../middlewares/auth")

router.get('/pageError', adminController.pageError);

router.get('/login', adminController.loadLogin)
router.post('/login', adminController.login)
router.get('/', adminAuth, adminController.loadDashboard)
router.get('/logout', adminController.logout)

router.get('/users', adminAuth, customerController.customerInfo)
router.get('/blockCustomer', adminAuth, customerController.customerBlocked)
// router.get('/unblockCustomer', adminAuth, customerControaller.customerUnblocked)

router.get('/category', adminAuth, categoryController.categoryInfo);
router.get('/categoryStatus', categoryController.categoryStatus);
router.get("/deleteCategory/:id", adminAuth, categoryController.deleteCategory);


router.post('/addCategory', adminAuth, categoryController.addCategory)
router.post('/editCategory/:id', adminAuth, categoryController.editCategory)

router.get('/addProducts', adminAuth, productController.getProductAddPage)
router.post('/addProducts', adminAuth, uploads.array("images", 4), productController.addProducts);

router.get('/editProducts/:id', adminAuth, productController.getEditProductPage);
router.post('/editProducts/:id', adminAuth, uploads.array("images", 4), productController.updateProduct)

router.get('/deleteProduct/:id', adminAuth, productController.deleteProduct)

router.get('/products', adminAuth, productController.getAllProducts)

router.get("/orders", adminAuth, adminController.loadOrders)

router.get('/sales', adminAuth, adminController.loadSales)

router.get('/coupons', adminAuth, adminController.loadCoupons)

router.get("/search/user", adminAuth, adminController.searchUser)

module.exports = router;