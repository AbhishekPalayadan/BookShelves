const express=require('express')
const router=express.Router();
const {uploads}=require('../../middlewares/multer');
const {userAuth}=require('../../middlewares/auth');
const profileController=require('../../controllers/user/profileController')



router.get('/userProfile',userAuth,profileController.loadProfile);
router.get('/edit-profile',userAuth,profileController.loadEditProfile);
router.patch('/edit-profile',userAuth,profileController.editProfile);

router.post('/profile/photo',userAuth,uploads.single('image'),profileController.updatePhoto)

router.get('/change-password',userAuth,profileController.loadChangePassword);
router.post('/change-password',userAuth,profileController.changePassword);

module.exports=router;