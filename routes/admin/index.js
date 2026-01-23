const express = require('express');
const router = express.Router();

router.use('/', require('./authRoutes'));
router.use('/', require('./dashboardRoutes'));
router.use('/', require('./customerRoutes'));
router.use('/', require('./categoryRoutes'));
router.use('/', require('./productRoutes'));
router.use('/', require('./orderRoutes'));
router.use('/', require('./salesRoutes'));
router.use('/',require('./couponRoutes'));

module.exports = router;