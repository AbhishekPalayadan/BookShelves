const express=require('express');
const router=express.Router();
const adminController=require('../../controllers/admin/adminController')
const {adminAuth}=require('../../middlewares/auth')


router.get('/coupons',adminAuth,adminController.loadCoupons)

module.exports=router;