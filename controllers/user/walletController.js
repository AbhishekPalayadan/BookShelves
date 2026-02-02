const loadWallet = (req, res) => {
    res.render("user/wallet",{user:req.user});
  };

  module.exports={
    loadWallet
  }