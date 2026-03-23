const express=require('express');
const router=express.Router();
const couponController=require('../../controllers/admin/couponController')
const {adminAuth}=require('../../middlewares/auth')


router.get('/coupons',adminAuth,couponController.loadCoupons)

router.post('/coupons/add',adminAuth,couponController.addCoupon)

module.exports=router;