const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema');
const { getBestOffer } = require('../../utils/offerHelper')

const loadAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        let filter = { isDeleted: false };

        if (req.query.search) {
            filter.$or = [
                { product_name: { $regex: req.query.search, $options: "i" } },
                { author: { $regex: req.query.search, $options: "i" } }
            ];
        }

        if (req.query.category) {
            filter.category_id = {
                $in: req.query.category.split(",")
            };
        }

        if (req.query.price) {
            const priceRanges = req.query.price.split(",");
            filter.$and = filter.$and || [];
            filter.$and.push({
                $or: priceRanges.map(range => {
                    if (range === ">1000") {
                        return { sale_price: { $gt: 1000 } };
                    }
                    const [min, max] = range.split("-");
                    return {
                        sale_price: { $gte: Number(min), $lte: Number(max) }
                    };
                })
            });
        }

        let sortQuery = {};
        if (req.query.sort === "price_low") sortQuery.sale_price = 1;
        if (req.query.sort === "price_high") sortQuery.sale_price = -1;
        if (req.query.sort === "new") sortQuery.createdAt = -1;
        if (req.query.sort === "popularity") sortQuery.popularity = -1;

        const products = await Product.find(filter)
            .populate({
                path: "category_id",
                match: { isListed: true }
            })
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .lean();

        // Get wishlist IDs of logged in user
        let wishlistIds = [];
        if (req.user) {
            const userData = await User.findById(req.user._id).lean();
            wishlistIds = userData.wishlist.map(id => id.toString());
        }

        const validProducts = products.filter(p => p.category_id);

        validProducts.forEach(product => {
            const bestOffer = getBestOffer(product);
            product.appliedOffer = bestOffer.offer;
            product.offerType = bestOffer.type;
            product.discountedPrice = bestOffer.offer > 0
                ? Math.round(product.sale_price - (product.sale_price * bestOffer.offer) / 100)
                : product.sale_price;
            product.isWishlisted = wishlistIds.includes(product._id.toString());
        });

        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        const categories = await Category.find({ isListed: true }).lean();

        res.render("user/products", {
            user: req.user || null,
            products: validProducts,
            categories,
            currentPage: page,
            totalPages,
            query: req.query
        });

    } catch (err) {
        console.log(err);
        res.render("user/products", {
            user: null,
            products: [],
            categories: [],
            currentPage: 1,
            totalPages: 1,
            query: {}
        });
    }
};


const loadProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate({
                path: "category_id",
                match: { isListed: true }
            })
            .lean();

        if (!product || !product.category_id) {
            return res.render("user/page-404", { user: null });
        }

        const bestOffer = getBestOffer(product);
        product.appliedOffer = bestOffer.offer;
        product.offerType = bestOffer.type;
        product.discountedPrice = bestOffer.offer > 0
            ? Math.round(product.sale_price - (product.sale_price * bestOffer.offer) / 100)
            : product.sale_price;

        const trending = await Product.aggregate([
            {
                $match: {
                    _id: { $ne: product._id },
                    stock: { $gt: 0 },
                    status: "available",
                    isDeleted: false
                }
            },
            { $sample: { size: 4 } }
        ]);

        // Get wishlist IDs of logged in user
        let wishlistIds = [];
        let isWishlisted = false;
        if (req.user) {
            const userData = await User.findById(req.user._id).lean();
            wishlistIds = userData.wishlist.map(id => id.toString());
            isWishlisted = wishlistIds.includes(product._id.toString());
        }

        // Tag offers + isWishlisted on trending (related books)
        const taggedTrending = trending.map(p => {
            const bestOffer = getBestOffer(p);
            return {
                ...p,
                appliedOffer: bestOffer.offer,
                offerType: bestOffer.type,
                discountedPrice: bestOffer.offer > 0
                    ? Math.round(p.sale_price - (p.sale_price * bestOffer.offer) / 100)
                    : p.sale_price,
                isWishlisted: wishlistIds.includes(p._id.toString())
            };
        });

        res.render("user/productDetails", {
            user: req.user || null,
            product,
            trending: taggedTrending,
            isWishlisted
        });

    } catch (error) {
        console.log(error);
        res.render("user/page-404", { user: null });
    }
};


module.exports = {
    loadAllProducts,
    loadProduct
}