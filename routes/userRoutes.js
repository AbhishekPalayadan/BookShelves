const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const passport = require('passport');
const { userAuth, adminAuth } = require("../middlewares/auth")


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

router.post('/logout', userController.logout)

router.get('/forgot-password', userController.forgotPassword)

router.get('/products', userController.loadAllProducts)

router.get('/product-details/:id', userController.loadProduct)

router.get('/userProfile',userAuth, userController.loadProfile)

router.get('/edit-profile',userController.loadEditProfile);
router.patch('/edit-profile',userAuth,)

router.get('/forgot-password', userController.forgotPassword);
router.post('/forgot-password', userController.sendForgotPasswordOtp);

router.post('/verify-forgot-otp', userController.verifyForgotOtp);

router.get('/reset-password', (req, res) => {
    if (!req.session.allowPasswordReset) return res.redirect('/forgot-password');
    res.render('user/resetPassword', { user: null, message: null })
})

router.post('/reset-password', userController.resetPassword)

router.post("/resend-forgot-otp", userController.resendForgotOtp);

router.get('/address',userController.loadAddress);

router.get('/cart',userController.loadCart);

router.get('/about',userController.about);

router.get('/contact',userController.contact)

module.exports = router;
