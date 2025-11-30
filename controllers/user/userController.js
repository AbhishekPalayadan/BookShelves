const User = require('../../models/userSchema');
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
    if (userId) {
      const userData = await User.findById(userId);
      return res.render("user/home", { user: userData })
    } else {
      return res.render("user/home", { user: null })
    }
  } catch (err) {
    console.log("Home page not found:", err);
    res.status(500).send("Server error");
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

    const msg = req.session.signupSuccessMessage || null;


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



const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Session destruction error", err)
        return res.redirect('/pageNotFound')
      }
      return res.redirect('/login')
    })
  } catch (error) {
    console.log('Logout error', error);
    res.redirect('/pageNotFound')

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
  logout
};
