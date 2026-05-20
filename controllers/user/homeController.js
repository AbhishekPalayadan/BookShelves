const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const User = require('../../models/userSchema')
const { getBestOffer } = require('../../utils/offerHelper')

const loadHomePage = async (req, res) => {
    try {
        const user = req.user || null;

        const categories = await Category.find({ isListed: true }).lean();
        const categoryIds = categories.map(c => c._id);

        // Get wishlist IDs
        let wishlistIds = [];
        if (req.user) {
            const userData = await User.findById(req.user._id).lean();
            wishlistIds = userData.wishlist.map(id => id.toString());
        }

        // Helper to tag isWishlisted + apply offers
        const tagProducts = (products) =>
            products.map(p => {
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

        const topPicks = await Product.aggregate([
            { $match: { category_id: { $in: categoryIds }, stock: { $gt: 0 }, status: "available", isDeleted: false } },
            { $sample: { size: 4 } }
        ]);

        const trending = await Product.aggregate([
            { $match: { category_id: { $in: categoryIds }, stock: { $gte: 0 }, status: "available", isDeleted: false } },
            { $sample: { size: 4 } }
        ]);

        const products = await Product.find({
            category_id: { $in: categoryIds },
            stock: { $gte: 0 },
            status: "available",
            isDeleted: false
        })
            .sort({ createdAt: -1 })
            .limit(4)
            .lean();

        res.render("user/home", {
            user,
            products: tagProducts(products),
            categories,
            topPicks: tagProducts(topPicks),
            trending: tagProducts(trending)
        });

    } catch (err) {
        console.log(err);
        res.render("user/home", {
            user: null,
            products: [],
            categories: [],
            topPicks: [],
            trending: []
        });
    }
};

module.exports = { loadHomePage }