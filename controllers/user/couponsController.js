const loadCoupons = (req, res) => {
    res.render("user/coupons",{user:req.user});
  };

  module.exports={
    loadCoupons
  }