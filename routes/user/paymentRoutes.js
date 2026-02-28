const express=require('express')
const router=express.Router();

const paymentController=require("../../controllers/user/paymentController");

router.post("/create-order",paymentController.razorpayOrder);
router.post("/verify",paymentController.verifyPayment);

module.exports=router;