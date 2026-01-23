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

module.exports = router;
