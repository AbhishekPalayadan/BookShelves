const Coupon=require('../../models/couponSchema')

const loadCoupons = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    try {

        const coupons = await Coupon.find().sort({ createdAt: -1 });

        res.render("admin/coupons", {
            activeMenu: "coupons",
            coupons
        });

    } catch (error) {
        console.log(error);
        res.redirect('/admin/pageError');
    }
}

const addCoupon = async (req, res) => {
  try {

    const {
      code,
      discountType,
      discountValue,
      maxDiscount,
      minPurchase,
      usageLimit,
      expiryDate
    } = req.body;

    if (new Date(expiryDate) < new Date()) {
      return res.json({ success: false, message: "Cannot use past date" });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase() });

    if (existing) {
      return res.json({ success: false, message: "Coupon already exists" });
    }

    await Coupon.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      maxDiscount,
      minPurchase,
      usageLimit,
      expiryDate
    });

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Server error" });
  }
};

module.exports={
    loadCoupons,
    addCoupon
}