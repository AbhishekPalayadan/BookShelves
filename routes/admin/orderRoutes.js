const express=require('express')
const router=express.Router();
const orderController=require('../../controllers/admin/orderController')
const {adminAuth}=require('../../middlewares/auth')

router.get('/orders',adminAuth,orderController.loadOrders)
router.patch('/updateOrderStatus',adminAuth,orderController.updateOrderStatus);

module.exports=router;