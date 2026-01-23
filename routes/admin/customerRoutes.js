const express=require('express')
const router=express.Router();
const customerController=require('../../controllers/admin/customerController');
const {adminAuth}=require('../../middlewares/auth')

router.get('/users',adminAuth,customerController.customerInfo);

router.get('/blockCustomer',adminAuth,customerController.customerBlocked);

router.get('/search/user',adminAuth,customerController.searchUser)

module.exports=router;