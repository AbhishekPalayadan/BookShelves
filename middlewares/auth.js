const User = require('../models/userSchema')



const userAuth = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  if (
    req.method !== 'GET' ||
    req.headers.accept?.includes('application/json')
  ) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  return res.redirect('/login');
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
    console.log('Error in adminAuth:', err);
    return res.status(500).send("Internal server error")
  }
}


module.exports = {
  userAuth,
  adminAuth
}