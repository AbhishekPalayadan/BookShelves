const express=require('express')
const router=express.Router();
const {userAuth,userAuthAjax}=require('../../middlewares/auth')
const cartController=require('../../controllers/user/cartController')


router.get('/cart',userAuth,cartController.loadCart);
router.post('/cart/add',userAuthAjax,cartController.addToCart);
router.delete('/cart/remove/:itemId',userAuth,cartController.removeFromCart)
router.patch("/cart/update", userAuth, cartController.updateQuantity);

router.get('/checkout',userAuth,cartController.loadCheckout);

module.exports=router;