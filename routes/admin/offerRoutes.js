const express=require('express')
const router=express.Router();
const offerController=require('../../controllers/admin/offerController')


router.post("/setProductOffer/:id", offerController.setProductOffer);
router.get("/removeProductOffer/:id", offerController.removeProductOffer);

router.post("/setCategoryOffer/:id", offerController.setCategoryOffer);
router.get("/removeCategoryOffer/:id", offerController.removeCategoryOffer);

module.exports=router;