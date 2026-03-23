const express=require('express')
const router=express.Router();
const salesController=require('../../controllers/admin/salesController')
const {adminAuth}=require('../../middlewares/auth')

router.get('/sales',adminAuth,salesController.loadSales);

module.exports=router;