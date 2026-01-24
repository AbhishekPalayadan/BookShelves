const User=require('../../models/userSchema');
const Cart=require('../../models/cartSchema')

const loadWishlist=async(req,res)=>{
    const user=await User.findById(req.user._id)
    .populate("wishlist");
  
    res.render('user/wishlist',{
      user:req.user,
      wishlist:user.wishlist
    })
  }


  const toggleWishlist = async (req, res) => {
    const { productId } = req.body;
    const userId = req.user._id;
  
    const user = await User.findById(userId);
  
    if (user.wishlist.includes(productId)) {
        // remove
        user.wishlist.pull(productId);
        await user.save();
  
        return res.json({ status: "removed" });
    } else {
        // add
        user.wishlist.push(productId);
        await user.save();
  
        return res.json({ status: "added" });
    }
  };

  
  const removeWishlist = async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
        $pull: { wishlist: req.params.id }
    });
  
    res.json({ success: true });
  };
  

  const moveAllToCart = async (req, res) => {
    try {
      const user = await User.findById(req.user._id).populate('wishlist');
  
      if (!user.wishlist.length) {
        return res.json({ success: true });
      }
  
      let cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) cart = new Cart({ userId: req.user._id, items: [] });
  
      for (let product of user.wishlist) {
        if (
          product.isDeleted ||
          product.status !== "available" ||
          product.stock < 1
        ) continue;
  
        const index = cart.items.findIndex(
          item => item.productId.toString() === product._id.toString()
        );
  
        if (index > -1) {
          cart.items[index].quantity += 1;
        } else {
          cart.items.push({
            productId: product._id,
            quantity: 1,
            price: product.sale_price
          });
        }
      }
  
      await cart.save();
  
      user.wishlist = [];
      await user.save();
  
      res.json({ success: true });
  
    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false });
    }
  };
  
  module.exports={
    loadWishlist,
    toggleWishlist,
    removeWishlist,
    moveAllToCart
  }