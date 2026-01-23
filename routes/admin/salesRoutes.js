const express=require('express')
const router=express.Router();
const adminController=require('../../controllers/admin/adminController')
const {adminAuth}=require('../../middlewares/auth')

router.get('/sales',adminAuth,adminController.loadSales);

module.exports=router;