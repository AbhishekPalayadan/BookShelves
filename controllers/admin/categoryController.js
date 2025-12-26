const Category = require('../../models/categorySchema')


const categoryInfo = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({ isDeleted: false })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const filter = {
            isDeleted: false,
            name: { $regex: search, $options: "i" }
        }
        const totalCategories = await Category.countDocuments({ isDeleted: false });
        const totalPages = Math.ceil(totalCategories / limit);
        res.render('admin/category', {
            cat: categoryData,
            currentPage: page,
            activeMenu: "category",
            totalPages: totalPages,
            totalCategories: totalCategories,
            query: req.query,
            search

        })

    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageError')
    }
}


const addCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        const categoryName=name.trim().toLowerCase();
        const existingCategory = await Category.findOne({
            name:{$regex:`^${categoryName}$`,$options:"i"}
        });
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" })
        }
        const newCategory = new Category({
            name:categoryName,
            description
        })
        await newCategory.save();
        return res.json({ message: "Category addedd successfully" })
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" })
    }
}


const categoryStatus = async (req, res) => {
    try {
        const id = req.query.id;
        const newStatus = req.query.status === "true";

        await Category.findByIdAndUpdate(id, { isListed: newStatus });

        res.redirect('/admin/category');
    } catch (err) {
        console.log(err);
        res.redirect('/admin/pageError');
    }
};


const editCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        await Category.findByIdAndUpdate(req.params.id,{
            name,
            description
        })
        return res.json({ success: true })
    } catch (error) {
        console.error("Edit Category Error:", error);
        return res.status(500).json({ error: "Something went wrong" })
    }
}


const deleteCategory = async (req, res) => {
    try {
        const id = req.params.id;

        await Category.findByIdAndUpdate(id, {
            isDeleted: true
        });

        return res.redirect("/admin/category");
    } catch (error) {
        console.log(error);
        res.redirect("/admin/category");
    }
};



module.exports = {
    categoryInfo,
    addCategory,
    categoryStatus,
    editCategory,
    deleteCategory
};
