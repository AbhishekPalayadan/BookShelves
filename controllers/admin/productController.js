const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');
const { TMP_UPLOAD_DIR, FINAL_DIR } = require('../../middlewares/multer');
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        res.render("admin/products-add", { cat: category });
    } catch (error) {
        res.redirect("admin/pageError");
    }
};


const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1; `    `
        const limit = 4;


        const sort = req.query.sort || "";
        const categoryFilter = req.query.category || "";
        const minPrice = req.query.minPrice || "";
        const maxPrice = req.query.maxPrice || "";


        let filterQuery = {
            product_name: { $regex: search, $options: "i" }
        };


        if (categoryFilter) {
            filterQuery.category_id = categoryFilter;
        }


        if (minPrice || maxPrice) {
            filterQuery.sale_price = {};
            if (minPrice) filterQuery.sale_price.$gte = Number(minPrice);
            if (maxPrice) filterQuery.sale_price.$lte = Number(maxPrice);
        }


        let sortQuery = {};

        switch (sort) {
            case "name_asc":
                sortQuery.product_name = 1;
                break;

            case "name_desc":
                sortQuery.product_name = -1;
                break;

            case "price_low":
                sortQuery.sale_price = 1;
                break;

            case "price_high":
                sortQuery.sale_price = -1;
                break;

            case "stock_low":
                sortQuery.stock = 1;
                break;

            case "stock_high":
                sortQuery.stock = -1;
                break;

            default:
                sortQuery.createdAt = -1;
        }



        const productData = await Product.find(filterQuery)
            .populate("category_id")
            .sort(sortQuery)
            .skip((page - 1) * limit)
            .limit(limit);

        const count = await Product.countDocuments(filterQuery);

        const category = await Category.find({ isListed: true });


        res.render("admin/products", {
            data: productData,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            cat: category,
            activeMenu: "products",
            query: req.query
        });

    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageError");
    }
};



const addProducts = async (req, res) => {
    try {
        const data = req.body;


        if (data.stockQuantity < 5) {
            return res.status(400).json("The stock must be greater than or equal to 5");
        }


        const productExists = await Product.findOne({ product_name: data.productName });
        if (productExists) {
            return res.status(400).json("Product already exists, please try another name");
        }


        const category = await Category.findById(data.category);
        if (!category) {
            return res.status(400).json("Invalid category selected");
        }


        const images = (req.files || []).map(file => file.filename);




        images.forEach(filename => {
            const tmpPath = path.join(TMP_UPLOAD_DIR, filename);
            const finalPath = path.join(FINAL_DIR, filename);

            if (fs.existsSync(tmpPath)) {
                fs.renameSync(tmpPath, finalPath);
            }
        });



        const newProduct = new Product({
            product_name: data.productName,
            author: data.author,
            description: data.description,
            category_id: category._id,
            regular_price: data.regularPrice,
            sale_price: data.salePrice,
            stock: data.stockQuantity,
            language: data.language,
            published_date: data.publishedDate,
            images: images,
            status: "available"
        });

        await newProduct.save();

        return res.redirect("/admin/products");

    } catch (error) {
        console.error("Error saving product:", error);
        return res.redirect('/admin/pageError');
    }
};



const getEditProductPage = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findById(id).lean();
        if (!product) return res.redirect('/admin/pageError');

        const category = await Category.find(({ isListed: true }))
        res.render('admin/products-edit', {
            product,
            cat: category,
            adminName: typeof req.user != 'undefined' ? req.user.name : 'Admin',
            activeMenu: 'products'
        })
    } catch (error) {
        console.error("Error loading edit page:", error);
        return res.redirect('/admin/pageError');
    }
}


const updateProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const body = req.body;

        const product = await Product.findById(id);
        if (!product) return res.status(404).send('Product not found')

        let keepImages = [];
        if (body.keepImages) {
            if (Array.isArray(body.keepImages)) keepImages = body.keepImages;
            else keepImages = [body.keepImages]
        }
        const newFiles = (req.files || []).map(f => f.filename)

        newFiles.forEach(filename => {
            const tmpPath = path.join(TMP_UPLOAD_DIR, filename);
            const finalPath = path.join(FINAL_DIR, filename);
            try {
                if (fs.existsSync(tmpPath)) fs.renameSync(tmpPath, finalPath);
            } catch (error) {
                console.error("Error moving file:", tmpPath, error)
            }
        })

        const finalImages = keepImages.concat(newFiles);
        const removed = product.images.filter(img => !finalImages.includes(img))
        removed.forEach(filename => {
            const toDelete = path.join(FINAL_DIR, filename);
            try {
                if (fs.existsSync(toDelete)) fs.unlinkSync(toDelete)
            } catch (error) {
                console.error('Failed to delete old images:', toDelete, error)
            }
        })


        product.product_name = body.productName || product.product_name;
        product.author = body.author || product.author;
        product.description = body.description || product.description;
        product.category_id = body.category || product.category_id;
        product.regular_price = body.regularPrice || product.regular_price;
        product.sale_price = body.salePrice || product.sale_price;
        product.stock = body.stockQuantity || product.stock;
        product.language = body.language || product.language;
        product.published_date = body.publishedDate || product.published_date;

        product.images = finalImages;

        await product.save();

        return res.redirect('/admin/products');


    } catch (error) {
        console.error('Error updating product:', error)
        return res.redirect('/admin/pageError');
    }
}




const deleteProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findById(id);
        if (!product) {
            return res.redirect('/admin/products');
        }

        await Product.findByIdAndUpdate(id,
            { isDeleted: true });

        res.redirect('/admin/products')
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageError')
    }
}

module.exports = {
    getProductAddPage,
    getAllProducts,
    addProducts,
    getEditProductPage,
    updateProduct,
    deleteProduct
};
