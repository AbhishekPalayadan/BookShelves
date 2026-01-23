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
  

module.exports={
    loadSignup,
    loadLogin,
    logout
}