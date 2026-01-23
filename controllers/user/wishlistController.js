const User=require('../../models/userSchema');


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
  

  
  module.exports={
    loadWishlist,
    toggleWishlist,
    removeWishlist
  }