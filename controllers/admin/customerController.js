const User = require('../../models/userSchema')

const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { fullname: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { fullname: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        });

        res.render('admin/customers', {
            users: userData,
            adminName: "Admin",
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            activeMenu: "users",
            search: search,
            limit: limit,
            query: req.query
        });

    } catch (error) {
        console.log(error);
    }
}


const customerBlocked = async (req, res) => {
    try {
        let id = req.query.id;
        let page = req.query.page || 1;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect(`/admin/users?page=${page}`)
    } catch (error) {
        res.redirect("/admin/pageError")
    }
}

const customerUnblocked = async (req, res) => {
    try {
        let id = req.query.id;
        let page = req.query.page;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } })
        res.redirect(`/admin/users?page=${page}`)
    } catch (error) {
        res.redirect('/admin/pageError')
    }
}

module.exports = {
    customerInfo,
    customerBlocked,
    customerUnblocked
}
