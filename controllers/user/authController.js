const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const Wallet = require('../../models/walletSchema');
const Coupon = require('../../models/couponSchema');
const sendMail = require('../../utils/sendOtp');

const loadSignup = (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');
  res.render("user/signup", { message: null, user: null });
};

const loadLogin = (req, res) => {
  console.log(req.session);
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

  res.render("user/login", { message, user: null });
};

const loadForgotPassword = (req, res) => {
  req.session.forgotEmail = null;
  req.session.forgotOtp = null;
  req.session.forgotVerified = null;

  res.render('user/forgotPassword', {
    user: req.user || null,
    message: null
  });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.render('user/forgotPassword', {
        user: req.user || null,
        message: 'Please enter your email address.'
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.render('user/forgotPassword', {
        user: req.user || null,
        message: 'Email not registered'
      });
    }

    if (user) {
      const otp = Math.floor(100000 + Math.random() * 900000);
      await sendMail(email.trim().toLowerCase(), otp);

      req.session.forgotEmail = email.trim().toLowerCase();
      req.session.forgotOtp = otp;
      req.session.forgotVerified = false;

      console.log('Forgot password OTP:', otp);
    }

    return res.redirect('/forgot-otp');

  } catch (error) {
    console.error('forgotPassword error:', error);
    return res.render('user/forgot-password', {
      user: req.user || null,
      message: 'Something went wrong. Please try again.'
    });
  }
};

const loadForgotOtp = (req, res) => {
  if (!req.session.forgotEmail) {
    return res.redirect('/forgot-password');
  }

  res.render('user/verify-forgot-otp', {
    user: req.user || null
  });
};

const verifyForgotOtp = (req, res) => {
  const { otp } = req.body;

  if (!req.session.forgotEmail || req.session.forgotOtp == null) {
    return res.json({ success: false, message: 'Session expired. Start again.' });
  }

  if (req.session.forgotVerified) {
    return res.json({ success: false, message: 'OTP already verified.' });
  }

  if (String(otp).trim() !== String(req.session.forgotOtp)) {
    return res.json({ success: false, message: 'Incorrect OTP. Please try again.' });
  }

  req.session.forgotVerified = true;
  req.session.forgotOtp = null;

  return res.json({ success: true, redirectUrl: '/reset-password' });
};

const resendForgotOtp = async (req, res) => {
  try {
    if (!req.session.forgotEmail) {
      return res.json({ success: false, message: 'Session expired. Start again.' });
    }

    if (req.session.forgotVerified) {
      return res.json({ success: false, message: 'Already verified.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    await sendMail(req.session.forgotEmail, otp);

    req.session.forgotOtp = otp;
    console.log('Resent forgot OTP:', otp);

    return res.json({ success: true });

  } catch (error) {
    console.error('resendForgotOtp error:', error);
    return res.json({ success: false, message: 'Failed to resend OTP. Try again.' });
  }
};

const loadResetPassword = (req, res) => {
  if (!req.session.forgotEmail || !req.session.forgotVerified) {
    return res.redirect('/forgot-password');
  }

  res.render('user/resetPassword', {
    user: req.user || null,
    message: null
  });
};

const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (!req.session.forgotEmail || !req.session.forgotVerified) {
      return res.redirect('/forgot-password');
    }

    if (!password || !confirmPassword) {
      return res.render('user/resetPassword', {
        user: req.user || null,
        message: 'Both fields are required.'
      });
    }

    const strongPassword = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{6,}$/;
    if (!strongPassword.test(password)) {
      return res.render('user/resetPassword', {
        user: req.user || null,
        message: 'Password must be at least 6 characters with uppercase, lowercase, and a number.'
      });
    }

    if (password !== confirmPassword) {
      return res.render('user/resetPassword', {
        user: req.user || null,
        message: 'Passwords do not match.'
      });
    }

    const email = req.session.forgotEmail;
    const user = await User.findOne({ email });

    if (!user) {
      return res.redirect('/forgot-password');
    }

    const isSamePassword = await bcrypt.compare(password, user.password);
    if (isSamePassword) {
      return res.render('user/resetPassword', {
        user: req.user || null,
        message: 'New password cannot be the same as the current password.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    req.session.forgotEmail = null;
    req.session.forgotOtp = null;
    req.session.forgotVerified = null;

    req.session.signupSuccessMessage = 'Password reset successfully. Please log in.';
    return res.redirect('/login');

  } catch (error) {
    console.error('resetPassword error:', error);
    return res.render('user/resetPassword', {
      user: req.user || null,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// BUG FIX: logout must be GET to match the <a href="/logout"> link pattern,
// OR keep POST but ensure your views use a form with method="POST".
// Here we support both by exporting the same handler — route file decides the method.
const logout = (req, res) => {
  const adminSession = req.session.admin;

  req.logout(function (err) {
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
    // const existingName = await User.findOne({fullname});

    // if(existingName){
    //   return res.render("user/signup",{
    //     message:"Username already exists",
    //     user:null
    //   })
    // }

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
    // BUG FIX: clear any stale otpVerified flag from a previous signup attempt
    req.session.otpVerified = false;

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

const loadVerifyOtp = (req, res) => {
  if (!req.session.signupData) {
    return res.redirect("/signup");
  }

  res.render("user/verify-otp", { user: null });
};

// BUG FIX: wrapped entire verifyOtp in try/catch to prevent unhandled crashes
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (req.session.otpVerified) {
      return res.json({ success: false, message: "OTP already verified" });
    }

    if (otp != req.session.otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    const data = req.session.signupData;
    let referrer = null;

    if (data.referralCode) {
      referrer = await User.findOne({ referralCode: data.referralCode });
    }

    const newUser = await User.create({
      fullname: data.fullname,
      email: data.email,
      password: data.password,
      referralCode: data.myReferral,
      referredBy: referrer ? data.referralCode : null
    });

    await Wallet.create({ userId: newUser._id });

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

    res.json({ success: true, redirectUrl: "/login" });

  } catch (error) {
    console.error("verifyOtp error:", error);
    res.json({ success: false, message: "Something went wrong. Please try again." });
  }
};

const resendOtp = async (req, res) => {
  try {
    if (!req.session.signupData) {
      return res.json({ success: false, message: "Session expired. Please signup again." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    req.session.otp = otp;

    const email = req.session.signupData.email;
    await sendMail(email, otp);

    console.log("Resent OTP:", otp);

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Failed to resend OTP" });
  }
};

async function generateReferralCode(name) {
  let code;
  let exists = true;

  while (exists) {
    code = name.substring(0, 4).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
    const user = await User.findOne({ referralCode: code });
    if (!user) exists = false;
  }

  return code;
}

function generateCouponCode() {
  return "REF" + Math.floor(100000 + Math.random() * 900000);
}

module.exports = {
  loadSignup,
  loadLogin,
  logout,
  signup,
  loadForgotPassword,
  verifyOtp,
  loadVerifyOtp,
  resendOtp,
  forgotPassword,
  loadForgotOtp,
  verifyForgotOtp,
  resendForgotOtp,
  loadResetPassword,
  resetPassword
};