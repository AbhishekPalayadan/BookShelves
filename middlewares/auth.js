const User = require('../models/userSchema')



const userAuth = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }

  if (req.user.isBlocked) {
    req.logout(() => {
      return res.redirect('/login?blocked=true');
    });
  }

  next();
};





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
    console.log('Error in adminAuth:', err);
    return res.status(500).send("Internal server error")
  }
}


module.exports = {
  userAuth,
  adminAuth
}