const mongoose=require('mongoose')
const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Order=require('../../models/orderSchema')
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const bcrypt=require('bcrypt');

/* ========================= HOME ========================= */

const loadHomePage = async (req, res) => {
  try {
    const user = req.user || null;

    const categories = await Category.find({ isListed: true}).lean();
    const categoryIds = categories.map(c => c._id);

    const topPicks = await Product.aggregate([
      { $match: { category_id:{$in:categoryIds}, stock: { $gt: 0 }, status: "available" ,isDeleted:false} },
      { $sample: { size: 4 } }
    ]);
    const trending = await Product.aggregate([
      { $match: { category_id:{$in:categoryIds}, stock: { $gte: 0 }, status: "available" ,isDeleted:false} },
      { $sample: { size: 4 } }
    ]);

    const products = await Product.find({
      category_id: { $in: categoryIds },
      stock: { $gte: 0 },
      status: "available",
      isDeleted:false
    })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

    res.render("user/home", {
      user,
      products,
      categories,
      topPicks,
      trending
    });

  } catch (err) {
    console.log(err);
    res.render("user/home", {
      user: null,
      products: [],
      categories: [],
      topPicks: [],
      trending: []
    });
  }
};

/* ========================= AUTH PAGES ========================= */

const loadSignup = (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');
  res.render("user/signup", { message: null, user: null });
};

const loadLogin = (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');

  const msg = req.session.signupSuccessMessage || null;
  req.session.signupSuccessMessage = null;

  res.render("user/login", { message: msg, user: null });
};

const logout = (req, res) => {
  try {
    // Passport logout (safe)
    if (req.isAuthenticated()) {
      req.logout(function (err) {
        if (err) {
          console.log("Passport logout error:", err);
        }

        // Always destroy session
        req.session.destroy(() => {
          res.clearCookie('connect.sid');
          return res.redirect('/login');
        });
      });
    } else {
      // If user already logged out
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        return res.redirect('/login');
      });
    }
  } catch (error) {
    console.log("Logout failed:", error);
    return res.redirect('/login');
  }
};



/* ========================= PROFILE ========================= */

const loadProfile = (req, res) => {
  res.render('user/userProfile', { user: req.user });
};

const loadEditProfile = (req, res) => {
  res.render('user/edit-profile', { user: req.user });
};

const editProfile = async (req, res) => {
  try {
    const { fullname, email, phone, dob } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      fullname,
      email,
      phone,
      dob
    });

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false });
  }
};

const updatePhoto=async(req,res)=>{
  try {
    await User.findByIdAndUpdate(req.user._id,{
      profileImage:"/uploads/tmp/"+req.file.filename
    });
    res.redirect("/userProfile")
  } catch (error) {
    console.log(error)
  }
}

/* ========================= PRODUCTS ========================= */

const loadAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    let filter = { isDeleted: false };

    if (req.query.search) {
      filter.$or = [
        { product_name: { $regex: req.query.search, $options: "i" } },
        { author: { $regex: req.query.search, $options: "i" } }
      ];
    }

    const products = await Product.find(filter)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const categories = await Category.find({ isListed: true }).lean();

    res.render("user/products", {
      user: req.user || null,
      products,
      categories,
      currentPage: page,
      totalPages,
      query: req.query
    });

  } catch (err) {
    console.log(err);
    res.render("user/products", {
      user: null,
      products: [],
      categories: [],
      currentPage: 1,
      totalPages: 1,
      query: {}
    });
  }
};

const loadProduct = async (req, res) => {
  try {
    // 1️⃣ Get product
    const product = await Product.findById(req.params.id)
      .populate("category_id")
      .lean();

    if (!product) {
      return res.render("user/page-404", { user: null });
    }

    // 2️⃣ Get trending products
    const trending = await Product.aggregate([
      {
        $match: {
          _id: { $ne: product._id },
          stock: { $gt: 0 },
          status: "available",
          isDeleted: false
        }
      },
      { $sample: { size: 4 } }
    ]);

    // 3️⃣ Wishlist check
    let isWishlisted = false;
    if (req.user) {
      const userData = await User.findById(req.user._id);
      isWishlisted = userData.wishlist.includes(product._id);
    }

    // 4️⃣ Render page
    res.render("user/productDetails", {
      user: req.user || null,
      product,
      trending,        // ✅ IMPORTANT
      isWishlisted
    });

  } catch (error) {
    console.log(error);
    res.render("user/page-404", { user: null });
  }
};


/* ========================= ADDRESS ========================= */

const loadAddress = async (req, res) => {
  const address = await Address.find({ userId: req.user._id })
    .sort({ isPrimary: -1 });

  res.render('user/userAddress', {
    address,
    activeMenu: 'address',
    user: req.user
  });
};


const getSingleAddress = async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!address) {
    return res.json({ success: false });
  }

  res.json({
    success: true,
    address
  });
};


const loadAddAddress=async(req,res)=>{
  try {
    const user=req.user;

    if(!user){
      return res.redirect('/login');
    }
    return res.render('user/addAddress',{
      user,
      message:null
    })
  } catch (error) {
    console.log('Load Add Address Error',error);
    return res.redirect('/address')
  }
}


const addAddress = async (req, res) => {
  try {
    const { fullname, phone, house, place, state, pincode } = req.body;

    if (!fullname || !phone || !house || !place || !state || !pincode) {
      return res.json({
        success: false,
        message: "All fields are required"
      });
    }

    if (fullname.length < 3) {
      return res.json({
        success: false,
        message: "Full name must be at least 3 characters"
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.json({
        success: false,
        message: "Invalid phone number"
      });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.json({
        success: false,
        message: "Invalid pincode"
      });
    }

    const addressCount = await Address.countDocuments({
      userId: req.user._id
    });


    const isPrimary = addressCount === 0;

    await Address.create({
      userId: req.user._id,
      fullname,
      phone,
      house,
      place,
      state,
      pincode,
      isPrimary
    });

    res.json({
      success: true,
      message: "Address added successfully"
    });

  } catch (error) {
    console.log(error);
    return res.json({
      success: false,
      message: "Server error"
    });
  }
};


const deleteAddress=async(req,res)=>{
  try {
    const userId=req.user._id;
    const addressId=req.params.id;

    const deleted=await Address.findOneAndDelete({_id:addressId,userId})

    if(!deleted){
      return res.status(404).json({
        success:false,
        message:"Address not found"
      })
    }
    res.json({
      success:true,
      message:"Address deleted successfully"
    })
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success:false,
      message:"Server error"
    }) 
  }
}

const loadEditAddress=async(req,res)=>{
  try {
    const address=await Address.findOne({
      _id:req.params.id,
      userId:req.user._id
    })

    if(!address){
      return res.redirect('/address');
    }

    res.render('user/editAddress',{
      user:req.user,
      address
    })
  } catch (error) {
    console.log(error)
    res.redirect('/address')
  }
}

const editAddress = async (req, res) => {
  try {
    const updated = await Address.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.json({
        success: false,
        message: 'Address not found'
      });
    }

    res.json({
      success: true,
      message: 'Address updated successfully'
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


const setPrimaryAddress=async(req,res)=>{
  try {
    const userId=req.user._id;
    const addressId=req.params.id;
    console.log(userId);
    console.log(addressId)

    await Address.updateMany({userId},{$set:{isPrimary:false}})

    const updated=await Address.findOneAndUpdate(
      {_id:addressId,userId},
      {isPrimary:true}
    )

    if(!updated){
      return res.status(404).json({
        success:false,
        message:"Address not found"
      })
    }

    res.json({success:true})
    } catch (error) {
      console.log(error);
      res.status(500).json({success:false})
  }
}

/* ========================= CART ========================= */

const loadCart = async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id })
    .populate("items.productId");

  const cartItems = cart ? cart.items : [];
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  res.render('user/userCart', {
    cart,
    user: req.user,
    cartItems,
    cartTotal
  });
};



const loadChangePassword=(req,res)=>{
  res.render('user/changePasswordProfile',{
    user:req.user
  });
}

const changePassword=async(req,res)=>{
  try {
    const {oldPassword,newPassword}=req.body;
    if(!oldPassword || !newPassword){
      return res.status(400).json({
        message:"All fields are required"
      })
    }

    const user=await User.findById(req.user._id);

    if(!user){
      return res.status(404).json({
        message:"User not found"
      })
    }

    const isMatch=await bcrypt.compare(oldPassword,user.password);

    if(!isMatch){
      return res.status(401).json({
        message:"Old password is incorrect"
      })
    }

    const hashedPassword=await bcrypt.hash(newPassword,10);

    user.password=hashedPassword;
    await user.save();

    res.status(200).json({
      message:"Password change successfully"
    })
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:"Something went wrong"
    })
  }
}


const MAX_PER_PRODUCT=10;

const addToCart=async(req,res)=>{
  try{
    const userId=req.user._id;
    const {productId,quantity}=req.body;

    if(!quantity || quantity<1){
      return res.status(400).json({message:"Invalid quantity"});
    }

    const product=await Product.findById(productId);

    if(!product){
      return res.status(404).json({message:"Product not found"});
    }

    if(quantity>product.stock){
      return res.status(400).json({
        message:"Requested quantity exceeds stock"
      })
    }

    let cart=await Cart.findOne({
      userId
    }).populate("items.productId");
    if(!cart){
      cart=new Cart({userId,items:[]});
    }

    const itemIndex=cart.items.findIndex(
      item=>item.productId._id.toString()===productId
    )

    if(itemIndex > -1){
      const existingQty=cart.items[itemIndex].quantity;
      const newQty = existingQty + quantity;

      if(newQty > MAX_PER_PRODUCT){
        return res.status(400).json({
          message:`You can add only ${MAX_PER_PRODUCT} items of this product`
        })
      }
      if(newQty>product.stock){
        return res.status(400).json({
          message:"Total quantity exceeds stock"
        })
      }
      cart.items[itemIndex].quantity=newQty;

    }else{
      if(quantity>MAX_PER_PRODUCT){
        return res.status(400).json({
          message:`You can add only ${MAX_PER_PRODUCT} items of this product`
        })
      }
      cart.items.push({
        productId,
        quantity,
        price:product.sale_price
      })
    }

    await cart.save();

    res.status(200).json({
      message:"Added to cart"
    })
  }catch(err){
    console.log("Add to cart error:",err);
    res.status(500).json({message:"Something went wrong"})
  }
}


const removeFromCart=async(req,res)=>{
  try {
    const userId=req.user._id;
    const {itemId}=req.params;

    const cart=await Cart.findOne({userId});

    if(!cart){
      return res.status(404).json({
        message:"Cart not found"
      })
    }
    cart.items=cart.items.filter(
      item=>item._id.toString() !==itemId
    )

    await cart.save();

    res.status(200).json({
      message:"Item removed from cart"
    })
  } catch (error) {
    console.log("Remove from cart error:",error)
    res.status(500).json({
      message:"Something went wrong"
    })
  }
}


const loadCheckout=async(req,res)=>{
  try {
    const cart=await Cart.findOne({
      userId:req.user._id
    }).populate("items.productId");

    if(!cart || cart.items.length === 0){
      return res.redirect('/cart');
    }

    const cartTotal=cart.items.reduce(
      (sum,item)=>sum + item.productId.sale_price * item.quantity,
      0
    )

    const address=await Address.find({userId:req.user._id}).sort({isPrimary:-1})

    res.render("user/checkout",{
      user:req.user,
      cartItems:cart.items,
      cartTotal,
      address
    })
  } catch (error) {
    console.log("Checkout load error:",error);
    res.redirect("/cart")
  }
}


const loadWishlist=async(req,res)=>{
  const user=await User.findById(req.user._id)
  .populate("wishlist");

  res.render('user/wishlist',{
    user:req.user,
    wishlist:user.wishlist
  })
}

const removeWishlist = async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
      $pull: { wishlist: req.params.id }
  });

  res.json({ success: true });
};



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


function generateOrderId() {
  const timestamp = Date.now().toString().slice(-6);
  return `ORD-${timestamp}`;
}


const placeOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId } = req.body;
    // 1️⃣ Get cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // 2️⃣ Validate stock
    for (let item of cart.items) {
      if (item.quantity > item.productId.stock) {
        return res.status(400).json({
          message: `${item.productId.product_name} is out of stock`
        });
      }
    }
    const addressObjectId=new mongoose.Types.ObjectId(addressId)
    // 3️⃣ Get address from Address collection ✅
    const address = await Address.findOne({
      _id: addressObjectId,
      userId
    });


    if (!address) {
      return res.status(400).json({ message: "Address not found" });
    }

    // 4️⃣ Create order
    const order = new Order({
      orderId: generateOrderId(),
      userId,
      items: cart.items.map(item => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.sale_price
      })),
      address,
      totalAmount: cart.items.reduce(
        (sum, item) => sum + item.quantity * item.productId.sale_price,
        0
      ),
      paymentMethod: "COD",
      status: "pending"
    });
    await order.save();

    // 5️⃣ Reduce stock
    for (let item of cart.items) {
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { stock: -item.quantity }
      });
    }

    // 6️⃣ Clear cart
    await Cart.findOneAndDelete({ userId });

    res.json({
      success: true,
      orderId: order.orderId
    });
    console.log('its end')

  } catch (error) {
    console.log("Place order error:", error);
    res.status(500).json({ message: "Order failed" });
  }
};



const orderSuccess=async(req,res)=>{
  const order=await Order.findOne({
    orderId:req.params.orderId,
    userId:req.user._id
  })

  if(!order) return res.redirect("/");

  const expectedDelivery=new Date(order.createdAt);
  expectedDelivery.setDate(expectedDelivery.getDate()+3);

  console.log("User:\n",req.user);
  console.log("\nOrder:\n",order)
  res.render("user/orderSuccess",{
    user:req.user,
    order,
    expectedDelivery
  })
}



const loadOrderDetails=async(req,res)=>{
  try {
    const {orderId}=req.params;

    const order=await Order.findOne({
      orderId,
      userId:req.user._id
    }).populate("items.productId")
    .lean();

    if(!order){
      return res.redirect("/");
    }

    console.log(order.items)

    res.render("user/orderDetails",{
      user:req.user,
      order
    })
  } catch (error) {
    console.log(error);
    res.redirect('/')
  }
}

const cancelOrderItem=async (req,res)=>{
  try {
    const {orderId,productId}=req.body;

    const order=await Order.findOne({
      _id:orderId,
      "items.productId":productId
    })

    if(!order){
      return res.json({success:false,message:"Order not found"})
    }

    const item=order.items.find(
      i=>i.productId.toString() === productId
    )

    if(!item){
      return res.json({success:false,message:"Item not found"});
    }

    if(item.status=== "cancelled"){
      return res.json({success:false,message:"Item already cancelled"});
    }

    item.status="cancelled";

    await order.save();

    res.json({success:true})
  } catch (error) {
    console.log(error);
    res.json({success:false,message:"Server error"})
  }
}

const loadOrders=async(req,res)=>{
  try {
    const orders=await Order.find({userId:req.user._id})
    .populate("items.productId")
    .sort({createdAt:-1})
    .lean();

    console.log(orders)

    res.render("user/orders",{  
      user:req.user,
      orders
    })
  } catch (error) {
    console.log(error)
    res.redirect('/')
  }
}
/* ========================= STATIC ========================= */

const about = (req, res) => {
  res.render('user/about', { user: req.user || null });
};

const contact = (req, res) => {
  res.render('user/contact', { user: req.user || null });
};

const pageNotFound = (req, res) => {
  res.render("user/page-404", { user: req.user || null });
};

/* ========================= EXPORT ========================= */

module.exports = {
  loadHomePage,
  loadSignup,
  loadLogin,
  logout,

  loadProfile,
  loadEditProfile,
  editProfile,
  updatePhoto,

  loadAllProducts,
  loadProduct,

  loadAddress,
  getSingleAddress,


  loadAddAddress,
  addAddress,
  deleteAddress,
  setPrimaryAddress,
  loadEditAddress,
  editAddress,

  loadCart,
  addToCart,
  removeFromCart,

  loadCheckout,

  loadWishlist,
  removeWishlist,

  about,
  contact,
  pageNotFound,
  loadChangePassword,
  changePassword,

  toggleWishlist,
  placeOrder,
  orderSuccess,


  loadOrderDetails,
  cancelOrderItem,

  loadOrders

};
