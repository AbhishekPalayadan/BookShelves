const User = require('../../models/userSchema')

const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = req.query.page || 1;
        const limit = 5;

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { fullname: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        })
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
            currentPage: page
        });

    } catch (error) {
        console.log(error);
    }
}


const customerBlocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect("/admin/users")
    } catch (error) {
        res.redirect("/pageError")
    }
}

const customerUnblocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } })
        res.redirect("/admin/users")
    } catch (error) {
        res.redirect('/pageError')
    }
}

module.exports = {
    customerInfo,
    customerBlocked,
    customerUnblocked
}
