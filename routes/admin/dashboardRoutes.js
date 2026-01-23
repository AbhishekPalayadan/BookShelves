const express=require('express');
const router=express.Router();
const adminController=require('../../controllers/admin/adminController')
const {adminAuth}=require('../../middlewares/auth')

router.get('/',adminAuth,adminController.loadDashboard)

module.exports=router;