const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');

/* ========================= HOME ========================= */

const loadHomePage = async (req, res) => {
  try {
    const user = req.user || null;

    const categories = await Category.find({ isListed: true }).lean();
    const categoryIds = categories.map(c => c._id);

    const topPicks = await Product.aggregate([
      { $match: { stock: { $gt: 0 }, status: "available" } },
      { $sample: { size: 4 } }
    ]);

    const trending = await Product.aggregate([
      { $match: { stock: { $gte: 0 }, status: "available" } },
      { $sample: { size: 4 } }
    ]);

    const products = await Product.find({
      category_id: { $in: categoryIds },
      stock: { $gte: 0 },
      status: "available"
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
    const product = await Product.findById(req.params.id)
      .populate("category_id")
      .lean();

    if (!product) {
      return res.render("user/page-404", { user: null });
    }

    const trending = await Product.aggregate([
      { $match: { _id: { $ne: product._id }, stock: { $gt: 0 } } },
      { $sample: { size: 4 } }
    ]);

    res.render("user/productDetails", {
      user: req.user || null,
      product,
      trending
    });

  } catch (err) {
    console.log(err);
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

const addAddress=async(req,res)=>{
  try{
    const {fullname,phone,house,place,state,pincode}=req.body;

    if(!fullname || !phone ||!house ||!place ||!state ||!pincode){
      return res.json({
        success:false,
        message:"All fields are required"
      });
    }

    if(fullname.length <3){
      return res.json({
        success:false,
        message:"Full name must be at least 3 characters"
      })
    }

    if(!/^\d{10}$/.test(phone)){
      return res.json({
        success:false,
        message:"Invalid phone number"
      })
    }
    if(!/^\d{6}$/.test(pincode)){
      return res.json({
        success:false,
        message:'Invalid pincode'
      })
    }

    await Address.create({
      userId:req.user._id,
      fullname,
      phone,
      house,
      place,
      state,
      pincode,
      isPrimary:false
    })

    res.json({
      success:true,
      message:"Address added successfully"
    })
  }catch(error){
    console.log(error);
    return res.json({
      success:false,
      message:"Server error"
    })
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

  loadAllProducts,
  loadProduct,

  loadAddress,
  loadAddAddress,
  addAddress,
  loadCart,

  about,
  contact,
  pageNotFound
};
