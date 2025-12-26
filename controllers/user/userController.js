const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Address=require('../../models/addressSchema')
const Cart=require('../../models/cartSchema')
const nodeMailer = require('nodemailer');
const bcrypt = require('bcrypt');
require('dotenv').config();



const login = async (req, res) => {
  try {
    const { email, password } = req.body;


    const findUser = await User.findOne({ isAdmin: 0, email });


    console.log("Entered password:", password);
    console.log("DB password:", findUser ? findUser.password : "User not found");

    if (!findUser) {
      return res.render('user/login', { message: "User not found", user: null });
    }

    if (findUser.isBlocked) {
      return res.render('user/login', { message: "User is blocked by admin", user: null });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("user/login", { message: 'Incorrect Password', user: null });
    }

    req.session.user = findUser._id;
    return res.redirect('/');

  } catch (error) {
    console.error('Login error', error);
    return res.render('user/login', { message: "Login Failed. Please try again", user: null });
  }
};





const loadHomePage = async (req, res) => {
  try {
    const userId = req.session.user;

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



    let products = await Product.find({
      category_id: { $in: categoryIds },
      stock: { $gte: 0 },
      status: "available"
    })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

    console.log("🔍 HOMEPAGE PRODUCTS FOUND:", products.length);

    if (!userId) {
      return res.render("user/home", {
        user: null,
        products: products,
        categories: categories,
        topPicks: topPicks,
        trending: trending
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.render("user/home", {
        user: null,
        products: products,
        categories: categories,
        topPicks: topPicks,
        trending: trending
      });
    }


    if (user.isBlocked) {
      req.session.user = null;
      return res.redirect("/login?isBlocked=true");
    }

    return res.render("user/home", {
      user: user,
      products: products,
      categories: categories,
      topPicks: topPicks,
      trending: trending
    });

  } catch (err) {
    console.log("HOME ERROR:", err);
    return res.render("user/home", { user: null, products: [], categories: null, topPicks: null });
  }
};








const pageNotFound = async (req, res) => {
  try {
    return res.render("user/page-404", { user: null });
  } catch (err) {
    res.redirect('user/pageNotFound')
  }
};




const loadSignup = async (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect('/')
    }
    return res.render("user/signup", { message: null, user: null });
  } catch (err) {
    console.log("Signup page not loading", err);
    res.status(500).send("Server error");
  }
};




const signup = async (req, res) => {
  try {
    const { fullname, email, password, cPassword } = req.body;
    console.log(req.body)


    if (password !== cPassword) {
      return res.render("user/signup", { message: "Passwords do not match", user: null });
    }


    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("user/signup", { message: "User with this email already exists", user: null });
    }


    const otp = generateOtp();
    console.log("SIGNUP OTP:", otp);


    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("user/signup", { message: "Failed to send OTP. Please try again.", user: null });
    }


    const hashedPassword = await bcrypt.hash(password, 10);


    req.session.userOtp = otp;
    req.session.userData = { fullname, email, password: hashedPassword };


    res.render("user/verify-otp", { message: "OTP sent to your email for verification.", user: null });

    console.log("OTP sent:", otp);
  } catch (err) {
    console.error("Signup error:", err);
    res.redirect("/pageNotFound");
  }
};




function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}




async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodeMailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: `"BookShelves" <${process.env.NODEMAILER_EMAIL}>`,
      to: email,
      subject: "Verify your account",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;">
          <h2>Verify Your Email</h2>
          <p>Your One Time Password (OTP) is:</p>
          <h3 style="color:#007bff;">${otp}</h3>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    });

    console.log("Email sent successfully:", info.response);
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}


const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    console.log("Entered OTP:", otp);
    console.log("Expected OTP:", req.session.userOtp);

    if (otp !== req.session.userOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP, please try again"
      });
    }

    const user = req.session.userData;

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Session expired, please signup again"
      });
    }

    const newUser = new User({
      fullname: user.fullname,
      email: user.email,
      password: user.password,
      isAdmin: 0
    });

    await newUser.save();

    req.session.signupSuccessMessage = "Account created successfully! Please login.";


    return res.json({
      success: true,
      redirectUrl: "/login"
    });

  } catch (err) {
    console.error("Error verifying OTP", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


const loadLogin = async (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect('/');
    }

    let msg = req.session.signupSuccessMessage || null;

    if(req.query.isBlocked==="true"){
      msg="User is blocked by the Admin"
    }

    req.session.signupSuccessMessage = null;

    return res.render("user/login", { message: msg, user: null });

  } catch (err) {
    res.redirect("/pageNotFound");
  }
}



const forgotPassword = async (req, res) => {
  try {
    return res.render("user/forgotPassword", { message: null, user: null });
  } catch (err) {
    console.log("Forgot password page not loading", err);
    res.status(500).send("Server error");
  }
};


const otpVerification = async (req, res) => {
  try {
    return res.render("user/verify-otp", { message: null, user: null });
  } catch (err) {
    console.log("OTP verification page not loading", err);
    res.status(500).send("Server error");
  }
};


const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in session" })
    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      console.log('Resend OTP:', otp);
      res.status(200).json({ success: true, message: "OTP Resend Successfully" })
    } else {
      res.status(500).json({ success: false, message: "Failed to resend OTP.Please try again" });
    }

  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(500).json({ success: false, message: "Internal Server Error.Please try again" })
  }
}



const logout=async(req,res)=>{
  try {
    req.session.destroy(err=>{
      if(err){
        console.log('Session Destruction Error',err);
        return res.status(500).json({success:false})
      }
      return res.json({success:true})
    })
  } catch (error) {
    console.log('Logout Error',error)
    return res.status(500).json({success:false})
  }
}




const loadAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const sort = req.query.sort || "";


    const categoryParam = req.query.category || "";
    const categoryArray = categoryParam ? categoryParam.split(",") : [];


    let filter = {
      isDeleted: false,
    };


    if (search) {
      filter.$or = [
        { product_name: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } }
      ];
    }


    if (categoryArray.length > 0) {
      filter.category_id = { $in: categoryArray };
    }


    const priceParam = req.query.price || "";
    const priceList = priceParam.split(",").filter(Boolean);

    if (priceList.length > 0) {
      filter.$or = priceList.map(range => {


        if (range === "1000+" || range === ">1000") {
          return { sale_price: { $gt: 1000 } };
        }

        if (range.includes("-")) {
          const [min, max] = range.split("-").map(Number);
          if (!isNaN(min) && !isNaN(max)) {
            return { sale_price: { $gte: min, $lte: max } };
          }
        }

        return null;

      }).filter(Boolean);
    }


    let sortQuery = {};

    switch (sort) {
      case "price_low":
        sortQuery.sale_price = 1;
        break;
      case "price_high":
        sortQuery.sale_price = -1;
        break;
      case "new":
        sortQuery.createdAt = -1;
        break;
      case "popularity":
        sortQuery.number_of_reviews = -1;
        break;
      default:
        sortQuery.createdAt = -1;
    }


    const products = await Product.find(filter)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const categories = await Category.find({ isListed: true }).lean();

    return res.render("user/products", {
      user: req.session.user || null,
      products,
      categories,
      currentPage: page,
      totalPages,
      query: req.query
    });

  } catch (err) {
    console.log(err);
    return res.render("user/products", {
      user: req.session.user,
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
    const productId = req.params.id;

    const product = await Product.findById(productId).populate("category_id").lean();

    if (!product) {
      return res.render("user/page-404", { user: null });
    }

    const user = req.session.user ? await User.findById(req.session.user).lean() : null;

    const trending = await Product.aggregate([
      {
        $match: {
          _id: { $ne: product._id },
          stock: { $gt: 0 },
          status: "available"
        }
      },
      { $sample: { size: 4 } }
    ]);

    return res.render("user/productDetails", {
      user,
      product,
      trending
    });

  } catch (error) {
    console.log("product details page error", error);
    return res.render("user/page-404", { user: null });
  }
};


const loadProfile = async (req, res) => {
  try {
    const userId=req.session.user;

    if(!userId){
      return res.redirect('/login')
    }

    const userData=await User.findById(userId);

    return res.render('user/userProfile',{user:userData})

  } catch (error) {
    console.log(error);
    return res.redirect('/login')
  }
}


const sendForgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email, isAdmin: false });

    if (!user) {
      return res.render("user/forgotPassword", {
        message: "No account found with this email",
        user: null
      })
    }
    const otp = generateOtp();
    console.log("FORGOT PASSWORD OTP:", otp, typeof (otp));

    user.resetOtp = otp;
    user.resetOtpExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(email, otp);

    req.session.resetEmail = email;

    return res.render("user/verify-forgot-otp", {
      message: "OTP sent to your email",
      email,
      user: null
    })
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.render("user/forgotPassword", {
      message: "Something went wrong. Try again.",
      user: null
    });
  }
}

const verifyForgotOtp = async (req, res) => {
  try {
    const otp = (req.body.otp || "").trim();
    const email = req.session.resetEmail;

    const user = await User.findOne({ email });

    console.log("Entered:", otp);
    console.log("Stored:", user?.resetOtp);
    console.log("Expiry:", user?.resetOtpExpire);

    if (!user) {
      return res.json({
        success: false,
        message: "Session expired. Try again."
      });
    }

    if (String(user.resetOtp) !== String(otp)) {
      return res.json({
        success: false,
        message: "Invalid OTP"
      });
    }

    if (Date.now() > user.resetOtpExpire) {
      return res.json({
        success: false,
        message: "OTP expired. Please request again."
      });
    }

    req.session.allowPasswordReset = true;

    return res.json({
      success: true,
      redirectUrl: "/reset-password"
    });

  } catch (error) {
    console.log(error);
    return res.json({
      success: false,
      message: "Server error. Try again."
    });
  }
};




const resetPassword = async (req, res) => {
  try {
    if (!req.session.allowPasswordReset) {
      return res.redirect("/forgot-password");
    }

    if (req.method === "GET") {
      return res.render("user/resetPassword", {
        user: null,
        message: null
      });
    }


    const { password, confirmPassword } = req.body;
    const email = req.session.resetEmail;

    if (password !== confirmPassword) {
      return res.render("user/resetPassword", {
        message: "Passwords do not match",
        user: null
      })
    }

    const hashed = await bcrypt.hash(password, 10);

    await User.updateOne(
      { email },
      {
        $set: {
          password: hashed,
          resetOtp: null,
          resetOtpExpire: null
        }
      })

    req.session.allowPasswordReset = null;
    req.session.resetEmail = null;

    return res.render("user/login", {
      message: "Password reset successfull.Please login.",
      user: null
    })
  } catch (error) {
    console.error("Password reset error:", error);
    return res.render("user/resetPassword", {
      message: "Something went wrong.Try again.",
      user: null
    })
  }
}


const resendForgotOtp = async (req, res) => {
  try {
    const email = req.session.resetEmail;
    if (!email) {
      return res.status(400).json({ success: false, message: "Session expired" });
    }

    const otp = generateOtp();
    console.log("This is the resend Forgot OTP:", otp)

    await sendVerificationEmail(email, otp);

    await User.updateOne(
      { email },
      {
        $set: {
          resetOtp: otp,
          resetOtpExpire: Date.now() + 10 * 60 * 1000
        }
      }
    );

    res.json({ success: true, message: "OTP resent" });

  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Failed to resend OTP" });
  }
};


const loadAddress=async(req,res)=>{
  try {
    const userId=req.session.user;
    const user=await User.findById(userId)
    const address=await Address.find({userId}).sort({isPrimary:-1});
    console.log(address)
    return res.render('user/userAddress',{
      address,
      activeMenu:'address',
      user
    })
  } catch (error) {
    
  }
}

const loadCart=async(req,res)=>{
  try {
    const userId=req.session.user;
    console.log("userId:",userId);

    const cart=await Cart.findOne({userId})
    .populate("items.productId");

    const cartItems=cart?cart.items:[];

    const cartTotal=cartItems.reduce((total,item)=>{
      return total+item.price*item.quantity;
    },0);

    res.render('user/userCart',{
      cart,
      user:req.user,
      cartItems,
      cartTotal
    })


  } catch (error) {
    console.log(error);
    res.redirect('/pageError')
  }
}



const loadEditProfile=async(req,res)=>{
  try {
    res.render('user/edit-profile',{
      user:req.user
    })
  } catch (error) {
    console.log('error in edit profile view')
  }
}

const about=async(req,res)=>{
  try {
    res.render('user/about',{
      user:req.user || null
    })
  } catch (error) {
    console.log('about page rendering error',error)
  }
}


const contact=async(req,res)=>{
  try {
    res.render('user/contact',{
      user:req.user || null
    });
  } catch (error) {
    console.log('contact page rendering error',error)
  }
}


module.exports = {
  loadHomePage,

  pageNotFound,

  loadSignup,
  signup,

  otpVerification,
  verifyOtp,
  resendOtp,

  loadLogin,
  login,

  forgotPassword,
  logout,
  loadAllProducts,
  loadProduct,

  loadProfile,

  sendForgotPasswordOtp,
  verifyForgotOtp,
  resetPassword,

  resendForgotOtp,

  loadAddress,

  loadCart,

  loadEditProfile,

  about,
  contact
};
