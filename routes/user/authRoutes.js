const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../../controllers/user/authController');

router.get('/signup', authController.loadSignup);
router.post('/signup', authController.signup);

router.get('/verify-otp', authController.loadVerifyOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);

router.get('/login', authController.loadLogin);
router.post('/login', (req, res, next) => {
  const adminSession = req.session.admin;

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
      if (adminSession) req.session.admin = adminSession;
      return res.redirect('/');
    });
  })(req, res, next);
});

router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', (req, res, next) => {
  const adminSession = req.session.admin;

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
      if (adminSession) req.session.admin = adminSession;
      return res.redirect('/');
    });
  })(req, res, next);
});

router.get('/forgot-password', authController.loadForgotPassword);
router.post('/forgot-password', authController.forgotPassword);

router.get('/forgot-otp', authController.loadForgotOtp);
router.post('/verify-forgot-otp', authController.verifyForgotOtp);
router.post('/resend-forgot-otp', authController.resendForgotOtp);

router.get('/reset-password', authController.loadResetPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;