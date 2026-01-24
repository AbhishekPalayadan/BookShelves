const express=require('express')
const router=express.Router();
const {userAuth}=require('../../middlewares/auth');
const wishlistController=require('../../controllers/user/wishlistController');

router.get('/wishlist',userAuth,wishlistController.loadWishlist);
router.post('/wishlist/toggle',userAuth,wishlistController.toggleWishlist);
router.delete('/wishlist/remove/:id',userAuth,wishlistController.removeWishlist);
router.post('/wishlist/move-all',userAuth,wishlistController.moveAllToCart);


module.exports=router;