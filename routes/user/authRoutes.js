const express=require('express')
const router=express.Router();
const passport=require('passport');
const authController=require('../../controllers/user/authController');


router.get('/signup',authController.loadSignup);
router.get('/login',authController.loadLogin);

router.post('/login',passport.authenticate('local',{successRedirect:'/',failureRedirect:'/login'}));

router.post('/logout',authController.logout);

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));

router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),
(req,res)=>res.redirect('/'))


module.exports=router;