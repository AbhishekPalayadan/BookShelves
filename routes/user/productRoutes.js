const express=require('express')
const router=express.Router();
const productController=require('../../controllers/user/productController')

router.get('/products',productController.loadAllProducts);
router.get('/product-details/:id',productController.loadProduct);

module.exports=router;