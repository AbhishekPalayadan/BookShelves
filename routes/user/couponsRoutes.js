const express=require('express');
const router=express.Router();
const couponsController=require('../../controllers/user/couponsController')

router.get('/coupons',couponsController.loadCoupons);

module.exports=router;