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


module.exports = {
  applyCoupon,
  loadCoupons
};