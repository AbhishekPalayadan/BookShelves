const express=require('express')
const router=express.Router();
const walletController=require('../../controllers/user/walletController')

router.get('/wallet',walletController.loadWallet);

module.exports=router;
