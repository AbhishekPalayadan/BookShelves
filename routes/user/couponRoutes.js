const express = require("express");
const router = express.Router();

const { userAuth } = require("../../middlewares/auth");
const couponController = require("../../controllers/user/couponController");

router.post("/coupon/apply", userAuth,couponController.applyCoupon);
router.get("/coupons",userAuth,couponController.loadCoupons)

module.exports = router;