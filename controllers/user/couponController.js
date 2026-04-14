const Coupon = require("../../models/couponSchema");
const Order  = require('../../models/orderSchema');


const applyCoupon = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    const total = Number(cartTotal);

    if (!code || !total || total <= 0) {
      return res.json({ success: false, message: "Invalid request" });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon code" });
    }

    if (!coupon.isActive) {
      return res.json({ success: false, message: "This coupon is no longer active" });
    }

    if (new Date() > coupon.expiryDate) {
      return res.json({ success: false, message: "Coupon has expired" });
    }

    if (coupon.usedCount >= coupon.usageLimit) {
      return res.json({ success: false, message: "Coupon usage limit reached" });
    }

    // Check per-user usage using coupon.code stored in order.coupon.code
    const userUsageCount = await Order.countDocuments({
      userId: req.user._id,
      "coupon.code": coupon.code
    });

    if (userUsageCount >= coupon.perUserLimit) {
      return res.json({ success: false, message: "You have already used this coupon" });
    }

    if (total < coupon.minPurchase) {
      return res.json({
        success: false,
        message: `Minimum cart amount required: ₹${coupon.minPurchase}`
      });
    }

    let discount = 0;

    if (coupon.discountType === "percentage") {
      discount = (total * coupon.discountValue) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else if (coupon.discountType === "flat") {
      discount = coupon.discountValue;
    }

    discount = Math.round(discount);
    const grandTotal = Math.max(0, total - discount);

    res.json({
      success: true,
      discount,
      grandTotal,
      couponCode: coupon.code
    });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Server error" });
  }
};


const loadCoupons = async (req, res) => {
  try {
    const today = new Date();

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