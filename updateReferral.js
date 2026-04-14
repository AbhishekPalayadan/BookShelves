const mongoose = require("mongoose");
const User = require("./models/userSchema");

mongoose.connect("mongodb://localhost:27017/BookShelves");

function generateReferralCode(name){
  return name.substring(0,4).toUpperCase() + Math.floor(1000 + Math.random()*9000)
}
const ref="referal";

async function updateUsers(ref){

  const users = await User.find({ referralCode: null });

  for(const user of users){

    const code = generateReferralCode(user.fullname);

    await User.updateOne(
      { _id: user._id },
      { $set: { referralCode: code } }
    );

    console.log("Updated:", user.fullname, code);

  }

  console.log("Referral codes added to old users");
  process.exit();

}


const { OrderedBulkOperation } = require("mongodb");
const Coupon = require("../../models/couponSchema");
const Order=require('../../models/orderSchema')

const applyCoupon = async (req, res) => {
  try {

    const { code, cartTotal } = req.body;
    const total = Number(cartTotal);

    const coupon = await Coupon.findOne({
      code: code.toUpperCase()
    });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon" });
    }

    if(coupon.usedCount>=coupon.usageLimit){
      return res.status(400).json({
        message:"Coupon global limit reached"
      })
    }

    const userUsageCount=await Order.countDocuments({
      userId:req.user._id,
      couponCode:coupon.code
    })

    if(userUsageCount>=coupon.perUserLimit){
      return res.status(400).json({
        message:"You already used this coupon"
      })
    }
    if (new Date() > coupon.expiryDate) {
      return res.json({ success: false, message: "Coupon expired" });
    }

    if (total < coupon.minPurchase) {
      return res.json({
        success: false,
        message: `Minimum cart amount ₹${coupon.minPurchase}`
      });
    }

    let discount = 0;

if (coupon.discountType === "percentage") {

  discount = (total * coupon.discountValue) / 100;

  if (coupon.maxDiscount) {
    discount = Math.min(discount, coupon.maxDiscount);
  }

}

else if (coupon.discountType === "flat") {

  discount = coupon.discountValue;

}

    const grandTotal = Math.max(total - discount, 0);

    res.json({
      success: true,
      discount,
      grandTotal
    });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Server error" });
  }
};


const loadCoupons = async (req, res) => {
  try {

    const today = new Date();

    // Show only active & not expired coupons
    const coupons = await Coupon.find({
      expiryDate: { $gte: today },
      isActive: true
    }).sort({ expiryDate: 1 });

    res.render("user/coupons", {
      user: req.user,
      coupons
    });

  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
};


const express=require('express')

const app=express();

app.get('/home',(req,res)=>{
  res.send("its just home page")
})

app.listen(4000,()=>{
  console.log("Server is running or 4000")
})
module.exports = {
  applyCoupon,
  loadCoupons
};

console.log("applyCoupon",applyCoupon);
console.log(loadCoupons)