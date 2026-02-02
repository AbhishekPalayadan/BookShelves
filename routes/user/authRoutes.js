const express=require('express')
const router=express.Router();
const passport=require('passport');
const authController=require('../../controllers/user/authController');


router.get('/signup',authController.loadSignup);
router.post('/signup', authController.signup);

router.get('/login',authController.loadLogin);

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      if (info && info.message === 'blocked') {
        return res.redirect('/login?error=blocked');
      }
      return res.redirect('/login?error=invalid');
    }
    req.logIn(user, err => {
      if (err) return next(err);
      return res.redirect('/');
    });
  })(req, res, next);
});

router.get('/forgot-password',authController.loadForgotPassword)

router.post('/logout',authController.logout);

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));

router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      if (info && info.message === 'blocked') {
        return res.redirect('/login?error=blocked');
      }
      return res.redirect('/login?error=invalid');
    }

    req.logIn(user, err => {
      if (err) return next(err);
      return res.redirect('/');
    });
  })(req, res, next);
});

  

module.exports=router;