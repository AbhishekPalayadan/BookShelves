const User=require('../../models/userSchema')
const bcrypt=require('bcrypt')

const loadSignup = (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/');
    res.render("user/signup", { message: null, user: null });
  };


  const loadLogin = (req, res) => {
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
    try {
      if (req.isAuthenticated()) {
        req.logout(function (err) {
          if (err) {
            console.log("Passport logout error:", err);
          }
  
          req.session.destroy(() => {
            res.clearCookie('connect.sid');
            return res.redirect('/login');
          });
        });
      } else {
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
  

  const signup = async (req, res) => {
    try {
      const { fullname, email, password } = req.body;
  
      // 1️⃣ Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.render('user/signup', {
          message: 'User already exists',
          user: null
        });
      }
  
      // 2️⃣ Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // 3️⃣ Save user
      await User.create({
        fullname,
        email,
        password: hashedPassword
      });
  
      // 4️⃣ Redirect to login with success message
      req.session.signupSuccessMessage = 'Signup successful. Please login.';
      return res.redirect('/login');
  
    } catch (error) {
      console.log(error);
      return res.render('user/signup', {
        message: 'Signup failed. Try again.',
        user: null
      });
    }
  };

module.exports={
    loadSignup,
    loadLogin,
    logout,
    signup,
    loadForgotPassword
}