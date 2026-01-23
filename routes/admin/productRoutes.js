const express=require('express')
const router=express.Router();
const productController=require('../../controllers/admin/productController');
const {uploads}=require('../../middlewares/multer')
const {adminAuth}=require('../../middlewares/auth')


router.get('/products',adminAuth,productController.getAllProducts);

router.get('/addProducts',adminAuth,productController.getProductAddPage);
router.post('/addProducts',adminAuth,uploads.array("images",4),productController.addProducts);

router.get('/editProducts/:id',adminAuth,productController.getEditProductPage);
router.post('/editProducts/:id',adminAuth,uploads.array("images",4),productController.updateProduct);

router.get('/productStatus',adminAuth,productController.productStatus);
router.get('/deleteProduct/:id',adminAuth,productController.deleteProduct);

module.exports=router;