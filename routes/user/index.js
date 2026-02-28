const express = require('express');
const router = express.Router();

router.use('/', require('./homeRoutes'));
router.use('/', require('./authRoutes'));
router.use('/', require('./profileRoutes'));
router.use('/', require('./productRoutes'));
router.use('/', require('./addressRoutes'));
router.use('/', require('./cartRoutes'));
router.use('/', require('./wishlistRoutes'));
router.use('/', require('./orderRoutes'));
router.use('/', require('./staticRoutes'));
router.use('/',require('./walletRoutes'));
router.use('/',require('./couponsRoutes'));
router.use('/',require('./paymentRoutes'));

module.exports = router;