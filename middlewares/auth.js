const User = require('../models/userSchema');

const userAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.passport || !req.session.passport.user) {
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.passport.user);

    if (!user || user.isBlocked) {
      req.session.destroy(() => {
        return res.redirect('/login?error=blocked');
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.log('userAuth error:', error);
    return res.redirect('/login');
  }
};


module.exports = { userAuth };




const adminAuth = async (req, res, next) => {
  try {
    if (!req.session.admin) {
      return res.redirect('/admin/login');
    }
    const admin = await User.findById(req.session.admin);
    if (!admin) {
      return res.redirect('/admin/login');
    }
    if (!admin.isAdmin) {
      return res.redirect('/admin/login')
    }
    if (admin.isBlocked) {
      req.session.admin = null;
      return res.redirect('/admin/login')
    }
    next();
  } catch (error) {
    console.log('Error in adminAuth:', error);
    return res.status(500).send("Internal server error")
  }
}

const userAuthAjax=(req,res,next)=>{
  if(req.user){
    return next();
  }

  return res.status(401).json({
    success:false,
    redirect:"/login",
    message:"Please login first"
  })
}


module.exports = {
  userAuth,
  adminAuth,
  userAuthAjax
}