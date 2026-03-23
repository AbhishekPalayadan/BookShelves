const User=require('../../models/userSchema')
const bcrypt=require('bcrypt');
const Wallet=require('../../models/walletSchema');
const Coupon=require('../../models/couponSchema')
const sendMail=require('../../utils/sendOtp')

const loadSignup = (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/');
    res.render("user/signup", { message: null, user: null });
  };


  const loadLogin = (req, res) => {
     console.log(req.session)
    if (req.isAuthenticated()) return res.redirect('/');
  
    let message = null;
  
    if (req.query.error === 'blocked') {
      message = 'Your account has been blocked. Please contact support.';
    } else if (req.query.error === 'invalid') {
      message = 'Invalid email or password.';
    }
  
    if (!message && req.session.signupSuccessMessage) {
      message = req.session.signupSuccessMessage;
      req.session.signupSuccessMessage = null;
    }
  
    res.render("user/login", {
      message,
      user: null
    });
  };
  

const loadForgotPassword=(req,res)=>{
  res.render('user/resetPassword');
}

const logout = (req, res) => {

  const adminSession = req.session.admin;

  req.logout(function(err) {
    if (err) {
      console.log("Logout error:", err);
      return res.redirect('/');
    }

    if (adminSession) {
      req.session.admin = adminSession;
    }

    res.redirect('/login');
  });

};
  

const signup = async (req, res) => {
  try {

    const { fullname, email, password, referralCode } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.render('user/signup', {
        message: 'User already exists',
        user: null
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const myReferral = await generateReferralCode(fullname);

    const otp = Math.floor(100000 + Math.random() * 900000);

    await sendMail(email, otp);
    
    req.session.signupData = {
      fullname,
      email,
      password: hashedPassword,
      referralCode,
      myReferral
    };
    
    req.session.otp = otp;

    console.log("OTP:", otp);

    res.redirect("/verify-otp");

  } catch (error) {
    console.log(error);
    return res.render('user/signup', {
      message: 'Signup failed. Try again.',
      user: null
    });
  }
};

const loadVerifyOtp = (req,res)=>{

  if(!req.session.signupData){
    return res.redirect("/signup")
  }

  res.render("user/verify-otp",{
    user:null
  })
}

const verifyOtp = async (req, res) => {
  const { otp } = req.body;

  if (req.session.otpVerified) {
    return res.json({
      success: false,
      message: "OTP already verified"
    });
  }

  if (otp != req.session.otp) {
    return res.json({
      success: false,
      message: "Invalid OTP"
    });
  }

  const data = req.session.signupData;

  let referrer = null;

  if (data.referralCode) {
    referrer = await User.findOne({
      referralCode: data.referralCode
    });
  }

  const newUser = await User.create({
    fullname: data.fullname,
    email: data.email,
    password: data.password,
    referralCode: data.myReferral,
    referredBy: referrer ? data.referralCode : null
  });

  await Wallet.create({
    userId: newUser._id
  });

  if (referrer) {

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
  
    const alreadyRewarded = await Coupon.findOne({
      userId: newUser._id,
      discountValue: 100
    });
  
    if (!alreadyRewarded) {
  
      await Coupon.create({
        code: generateCouponCode(),
        userId: referrer._id,
        discountType: "flat",
        discountValue: 100,
        maxDiscount: 100,
        minPurchase: 300,
        usageLimit: 1,
        expiryDate: expiry
      });
  
      await Coupon.create({
        code: generateCouponCode(),
        userId: newUser._id,
        discountType: "flat",
        discountValue: 100,
        maxDiscount: 100,
        minPurchase: 300,
        usageLimit: 1,
        expiryDate: expiry
      });
  
    }
  }

  req.session.otpVerified = true;

  req.session.signupData = null;
  req.session.otp = null;

  res.json({
    success: true,
    redirectUrl: "/login"
  });
};


const resendOtp = async (req,res)=>{

  try {

    if(!req.session.signupData){
      return res.json({
        success:false,
        message:"Session expired. Please signup again."
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    req.session.otp = otp;

    const email = req.session.signupData.email;

    await sendOtp(email, otp);

    console.log("Resent OTP:", otp);

    res.json({
      success:true
    });

  } catch (error) {

    console.log(error);

    res.json({
      success:false,
      message:"Failed to resend OTP"
    });

  }

};

async function generateReferralCode(name){

 let code
 let exists = true

 while(exists){

   code = name.substring(0,4).toUpperCase() + Math.floor(1000 + Math.random()*9000)

   const user = await User.findOne({ referralCode: code })

   if(!user){
     exists = false
   }

 }

 return code
}

function generateCouponCode(){
  return "REF" + Math.floor(100000 + Math.random()*900000)
}


module.exports={
    loadSignup,
    loadLogin,
    logout,
    signup,
    loadForgotPassword,
    verifyOtp,
    loadVerifyOtp,
    resendOtp
}