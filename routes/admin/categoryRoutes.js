const express=require('express');
const router=express.Router();
const categoryController=require('../../controllers/admin/categoryController')
const {adminAuth}=require('../../middlewares/auth')

router.get('/category',adminAuth,categoryController.categoryInfo);

router.post('/addCategory',adminAuth,categoryController.addCategory);
router.post('/editCategory',adminAuth,categoryController.editCategory)

router.get('/categoryStatus',adminAuth,categoryController.categoryStatus);

router.get('/deleteCategory/:id',adminAuth,categoryController.deleteCategory);

module.exports=router;