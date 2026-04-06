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


const blockCoupon=async(req,res)=>{
  try{
    const id=req.params.id;

    await Coupon.findByIdAndUpdate(id,{isActive:false});

    res.redirect("/admin/coupons");
  }catch(err){
    console.log(err)
  }
}


const unblockCoupon=async (req,res)=>{
  try{
    const id=req.params.id;

    await Coupon.findByIdAndUpdate(id,{isActive:true});

    res.redirect("/admin/coupons")
  }catch(err){
    console.log(err);
  }
}


const toggleCoupon = async (req, res) => {
  try {
    const id = req.params.id;

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.json({ success: false, message: "Coupon not found" });
    }

    coupon.isActive = !coupon.isActive;

    await coupon.save();

    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.json({ success: false });
  }
};

module.exports={
    loadCoupons,
    addCoupon,
    blockCoupon,
    unblockCoupon,
    toggleCoupon
}