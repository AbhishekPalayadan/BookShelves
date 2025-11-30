const User = require('../../models/userSchema')
const mongoose = require('mongoose');
const bcrypt = require('bcrypt')


const pageError = async (req, res) => {
    res.render('admin/admin-error')
}

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin");
    }
    res.render('admin/login', { message: null });
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await User.findOne({ email, isAdmin: true });

        if (!admin) {
            return res.redirect('/admin/login');
        }


        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
            return res.redirect('/admin/login');
        }


        req.session.admin = admin._id;

        return res.redirect('/admin');

    } catch (error) {
        console.log('Login error', error);
        return res.redirect('/pageError');
    }
};

const loadDashboard = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    try {
        res.render("admin/dashboard");
    } catch (error) {
        res.redirect('/pageError');
    }
}


const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroying session", err)
                return res.redirect('/pageError')
            }
            res.redirect('/admin/login')
        })
    } catch (error) {
        console.log("Unexpected error during logout", error)
        res.redirect('/pageError')
    }
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout
}
