const Cart = require("../models/cartSchema");
const Wishlist = require("../models/wishlistSchema");

const headerCounts = async (req, res, next) => {
  try {
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;

    if (req.user) {
      const cart = await Cart.findOne({ userId: req.user._id });
      const wishlist = await Wishlist.findOne({ userId: req.user._id });

      res.locals.cartCount = cart
        ? cart.items.reduce((total, item) => total + item.quantity, 0)
        : 0;

      res.locals.wishlistCount = wishlist
        ? wishlist.products.length
        : 0;
    }

    next();
  } catch (error) {
    console.log(error);
    next();
  }
};

module.exports = headerCounts;