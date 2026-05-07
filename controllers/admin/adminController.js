const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


const pageError = async (req, res) => {
  res.render('admin/admin-error');
};

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin");
  }
  res.render('admin/login', { message: null, errors: {} });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    let errors = {};

    if (!email || email.trim() === "") {
      errors.email = "Email cannot be empty";
    }

    if (!password || password.trim() === "") {
      errors.password = "Password cannot be empty";
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailPattern.test(email)) {
      errors.email = "Enter a valid email address";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).render("admin/login", { errors, message: null });
    }

    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.status(400).render("admin/login", {
        errors: { email: "Admin account not found" },
        message: null
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(400).render('admin/login', {
        errors: { password: "Incorrect Password" },
        message: null
      });
    }

    req.session.admin = admin._id;
    return res.redirect('/admin');

  } catch (error) {
    console.log('Login error', error);
    return res.redirect('/admin/pageError');
  }
};


const loadDashboard = async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');

  try {
    const filter = req.query.filter || 'monthly';

    const periodExpr = filter === 'yearly'
      ? { $toString: { $year: '$createdAt' } }
      : {
          $concat: [
            { $toString: { $year: '$createdAt' } },
            '-',
            {
              $cond: {
                if: { $lt: [{ $month: '$createdAt' }, 10] },
                then: { $concat: ['0', { $toString: { $month: '$createdAt' } }] },
                else: { $toString: { $month: '$createdAt' } }
              }
            }
          ]
        };

    const activeStatuses = { $in: ['confirmed', 'shipped', 'delivered'] };

    const salesData = await Order.aggregate([
      { $match: { status: activeStatuses } },
      { $group: { _id: periodExpr, totalSales: { $sum: '$pricing.finalAmount' } } },
      { $sort: { _id: 1 } }
    ]);

    const totalRevenueData = await Order.aggregate([
      { $match: { status: activeStatuses } },
      { $group: { _id: null, total: { $sum: '$pricing.finalAmount' } } }
    ]);
    const totalRevenue = totalRevenueData[0]?.total || 0;

    const totalOrders = await Order.countDocuments({ status: activeStatuses });

    const totalUsers = await User.countDocuments({ isAdmin: { $ne: true } });

    const bestProducts = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.status': { $nin: ['cancelled', 'returned'] } } },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          productImage: { $first: '$items.productImage' },
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.itemTotal' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);


    const categoryData = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.status': { $nin: ['cancelled', 'returned'] } } },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $eq: ['$items.offerType', 'category'] }, then: 'Category Offer' },
                { case: { $eq: ['$items.offerType', 'product'] },  then: 'Product Offer'  }
              ],
              default: 'No Offer'
            }
          },
          revenue: { $sum: '$items.itemTotal' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    const paymentDataRaw = await Order.aggregate([
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.finalAmount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const paymentLabelMap = { COD: 'COD', RAZORPAY: 'Razorpay', WALLET: 'Wallet' };
    const paymentData = paymentDataRaw.map(d => ({
      ...d,
      _id: paymentLabelMap[d._id] || d._id 
    }));

    const customerData = await User.aggregate([
      { $match: { isAdmin: { $ne: true } } },
      { $group: { _id: periodExpr, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const ordersOverview = await Order.aggregate([
      { $group: { _id: periodExpr, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'fullname email');

    const statusBreakdown = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const itemStatusBreakdown = await Order.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.render('admin/dashboard', {
      activeMenu: 'dashboard',
      filter,
      salesData,
      totalRevenue,
      totalOrders,
      totalUsers,
      bestProducts,
      categoryData,
      paymentData,
      customerData,
      ordersOverview,
      recentOrders,
      statusBreakdown,
      itemStatusBreakdown
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.redirect('/admin/pageError');
  }
};


const logout = async (req, res) => {
  try {
    delete req.session.admin;
    res.redirect('/admin/login');
  } catch (error) {
    console.log("Unexpected error during logout", error);
    res.redirect('/admin/pageError');
  }
};


module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageError,
  logout,
};