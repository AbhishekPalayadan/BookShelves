const Cart = require("../models/cartSchema");
const User = require("../models/userSchema");

const headerCounts = async (req, res, next) => {
  try {
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;

    if (req.user) {
      const cart = await Cart.findOne({ userId: req.user._id });
      const user = await User.findById(req.user._id).select("wishlist");

      res.locals.cartCount = cart
        ? cart.items.reduce((total, item) => total + item.quantity, 0)
        : 0;

      res.locals.wishlistCount = user && user.wishlist
        ? user.wishlist.length
        : 0;
    }

    next();
  } catch (error) {
    console.log("Header count error:", error);
    next();
  }
};

module.exports = headerCounts;