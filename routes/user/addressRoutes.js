const express=require('express')
const router=express.Router();
const {userAuth}=require('../../middlewares/auth')
const addressController=require('../../controllers/user/addressController')


router.get('/address',userAuth,addressController.loadAddress)

router.get('/address/add',userAuth,addressController.loadAddAddress)
router.post('/address/add',userAuth,addressController.addAddress);

router.get('/address/edit/:id',userAuth,addressController.loadEditAddress);
router.patch('/address/edit/:id',userAuth,addressController.editAddress);

router.patch('/address/set-primary/:id',userAuth,addressController.setPrimaryAddress);
router.delete('/address/delete/:id',userAuth,addressController.deleteAddress);

router.get('/address/:id',userAuth,addressController.getSingleAddress);


module.exports=router;