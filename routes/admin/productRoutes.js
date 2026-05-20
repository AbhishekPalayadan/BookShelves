const express=require('express')
const router=express.Router();
const productController=require('../../controllers/admin/productController');
const {uploads}=require('../../middlewares/multer')
const {adminAuth}=require('../../middlewares/auth')


router.get('/products',adminAuth,productController.getAllProducts);

router.get('/addProducts',adminAuth,productController.getProductAddPage);
router.post('/addProducts', adminAuth, (req, res) => {
    uploads.array("images", 4)(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
  
      productController.addProducts(req, res);
    });
  });

router.get('/editProducts/:id',adminAuth,productController.getEditProductPage);
router.post('/editProducts/:id', adminAuth, (req, res) => {
    uploads.array("images", 4)(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
  
      productController.updateProduct(req, res);
    });
  });

router.get('/productStatus',adminAuth,productController.productStatus);
router.get('/deleteProduct/:id',adminAuth,productController.deleteProduct);

module.exports=router;