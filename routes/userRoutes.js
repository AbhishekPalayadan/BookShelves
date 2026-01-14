const express = require('express');
const router = express.Router();
const passport = require('passport');

const userController = require('../controllers/user/userController');
const { userAuth } = require("../middlewares/auth");

/* ================= HOME ================= */
router.get('/', userController.loadHomePage);

/* ================= AUTH ================= */
router.get('/signup', userController.loadSignup);

router.get('/login', userController.loadLogin);
router.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
  })
);

router.post('/logout', userController.logout);

/* ================= GOOGLE LOGIN ================= */
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/signup' }),
  (req, res) => {
    res.redirect('/');
  }
);


/* ================= PROFILE ================= */
router.get('/userProfile', userAuth, userController.loadProfile);
router.get('/edit-profile', userAuth, userController.loadEditProfile);
router.patch('/edit-profile', userAuth, userController.editProfile);


router.get('/change-password',userAuth,userController.loadChangePassword)
router.post('/change-password',userAuth,userController.changePassword)

/* ================= PRODUCTS ================= */
router.get('/products', userController.loadAllProducts);
router.get('/product-details/:id', userController.loadProduct);

/* ================= ADDRESS ================= */
router.get('/address', userAuth, userController.loadAddress);

router.get("/address/add",userAuth,userController.loadAddAddress)
router.post('/address/add', userAuth, userController.addAddress);
router.delete('/address/delete/:id',userAuth,userController.deleteAddress)

router.get("/address/edit/:id",userAuth,userController.loadEditAddress);
router.patch("/address/edit/:id",userAuth,userController.editAddress)

router.patch('/address/set-primary/:id',userAuth,userController.setPrimaryAddress)


/* ================= CART ================= */
router.get('/cart', userAuth, userController.loadCart);

/* ================= STATIC ================= */
router.get('/about', userController.about);
router.get('/contact', userController.contact);

/* ================= 404 ================= */
router.get('/pageNotFound', userController.pageNotFound);

module.exports = router;
