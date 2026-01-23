const User = require('../../models/userSchema')
const Order=require('../../models/orderSchema')
const mongoose = require('mongoose');
const bcrypt = require('bcrypt')


const pageError = async (req, res) => {
    res.render('admin/admin-error')
}

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin");
    }
    res.render('admin/login', { message: null, errors: {} });
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        let errors = {};

        if (!email || email.trim() === "") {
            errors.email = "Email cannot be empty"
        }

        if (!password || password.trim() === "") {
            errors.password = "Password cannot be empty"
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailPattern.test(email)) {
            errors.email = "Enter a valid email address";
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).render("admin/login", { errors, message: null })
        }

        const admin = await User.findOne({ email, isAdmin: true });

        if (!admin) {
            return res.status(400).render("admin/login", {
                errors: { email: "Admin account not found" },
                message: null
            })
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
            return res.status(400).render('admin/login', {
                errors: { password: "Incorrect Password" },
                message: null
            })
        }


        req.session.admin = admin._id;

        return res.redirect('/admin');

    } catch (error) {
        console.log('Login error', error);
        return res.redirect('/admin/pageError');
    }
};

const loadDashboard = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    try {
        res.render("admin/dashboard", { activeMenu: "dashboard" });
    } catch (error) {
        res.redirect('/admin/pageError');
    }
}


const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroying session", err)
                return res.redirect('/admin/pageError')
            }
            res.redirect('/admin/login')
        })
    } catch (error) {
        console.log("Unexpected error during logout", error)
        res.redirect('/admin/pageError')
    }
}



const loadOrders = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    try {
        const orders=await Order.findOne
        res.render("admin/orders", { activeMenu: "orders" });
    } catch (error) {
        res.redirect('/admin/pageError');
    }
}

const loadSales = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    try {
        res.render("admin/sales", { activeMenu: "sales" });
    } catch (error) {
        res.redirect('/admin/pageError');
    }
}


const loadCoupons = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    try {
        res.render("admin/coupons", { activeMenu: "coupons" });
    } catch (error) {
        res.redirect('/admin/pageError');
    }
}


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
    loadOrders,
    loadSales,
    loadCoupons,
}
