const express=require('express')
const router=express.Router();
const walletController=require('../../controllers/user/walletController')
const {userAuth}=require('../../middlewares/auth');

router.get("/wallet", userAuth, walletController.loadWallet);

router.post("/wallet/create-order", userAuth, walletController.createWalletOrder);

router.post("/wallet/verify", userAuth, walletController.verifyWalletPayment);

module.exports=router;
