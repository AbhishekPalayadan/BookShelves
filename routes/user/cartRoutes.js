const express=require('express')
const router=express.Router();
const {userAuth}=require('../../middlewares/auth')
const cartController=require('../../controllers/user/cartController')


router.get('/cart',userAuth,cartController.loadCart);
router.post('/cart/add',userAuth,cartController.addToCart);
router.delete('/cart/remove/:itemId',userAuth,cartController.removeFromCart)

router.get('/checkout',userAuth,cartController.loadCheckout);

module.exports=router;