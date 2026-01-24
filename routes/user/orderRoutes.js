const express=require('express')
const router=express.Router();
const {userAuth}=require('../../middlewares/auth')
const orderController=require('../../controllers/user/orderController');

router.post('/order/place',userAuth,orderController.placeOrder);
router.get('/order-success/:orderId',userAuth,orderController.orderSuccess);

router.get('/orders',userAuth,orderController.loadOrders);
router.get('/orders/:orderId',userAuth,orderController.loadOrderDetails);
router.patch('/orders/cancel-item',userAuth,orderController.cancelOrderItem);

router.patch("/orders/return-item",userAuth,orderController.requestReturn);

module.exports=router;