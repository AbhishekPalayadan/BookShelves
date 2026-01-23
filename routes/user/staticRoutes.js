const express=require('express')
const router=express.Router();
const staticController=require('../../controllers/user/staticController')


router.get('/about',staticController.about);
router.get('/contact',staticController.contact);
router.get('/pageNotFound',staticController.pageNotFound);

module.exports=router;