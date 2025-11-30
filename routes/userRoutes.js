const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const passport = require('passport');


router.get('/', userController.loadHomePage);

router.get('/pageNotFound', userController.pageNotFound);

router.get('/signup', userController.loadSignup);
router.post('/signup', userController.signup);

router.get('/otp-verification', userController.otpVerification);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);


router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
    req.session.user = req.user._id;
    res.redirect('/');
})


router.get('/login', userController.loadLogin);
router.post('/login', userController.login);

router.get('/logout', userController.logout)

router.get('/forgot-password', userController.forgotPassword)

module.exports = router;
