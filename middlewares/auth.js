const User = require('../models/userSchema')



const userAuth = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const user = await User.findById(req.session.user);

    if (!user) {
      req.session.user = null;
      return res.redirect("/login");
    }

    if (user.isBlocked) {
      req.session.user = null;
      return res.redirect("/login?blocked=true");
    }

    next();

  } catch (err) {
    console.log("Error in userAuth middleware:", err);
    res.status(500).send("Internal Server Error");
  }
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