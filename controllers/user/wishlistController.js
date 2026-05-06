const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');

const loadWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate("wishlist");
        console.log(user)

        res.render('user/wishlist', {
            user: req.user,
            wishlist: user.wishlist || []
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
    }
};

const toggleWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);

        if (user.wishlist.includes(productId)) {
            user.wishlist.pull(productId);
            await user.save();
            return res.json({ status: "removed" });
        } else {
            user.wishlist.push(productId);
            await user.save();
            return res.json({ status: "added" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

const removeWishlist = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { wishlist: req.params.id }
        });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

const moveAllToCart = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('wishlist');

        if (!user.wishlist.length) {
            return res.json({ success: true, moved: 0, skipped: 0 });
        }

        let cart = await Cart.findOne({ userId: req.user._id });
        if (!cart) cart = new Cart({ userId: req.user._id, items: [] });

        let moved   = 0;
        let skipped = 0;
        const movedIds = [];

        for (let product of user.wishlist) {
            // Skip any product that is deleted, removed, or out of stock
            if (
                !product ||
                product.isDeleted ||
                product.status === 'removed' ||
                product.status === 'out_of_stock' ||
                product.stock < 1
            ) {
                skipped++;
                continue;
            }

            const index = cart.items.findIndex(
                item => item.productId.toString() === product._id.toString()
            );

            if (index > -1) {
                cart.items[index].quantity += 1;
            } else {
                cart.items.push({
                    productId: product._id,
                    quantity: 1,
                    price: product.sale_price
                });
            }

            movedIds.push(product._id);
            moved++;
        }

        await cart.save();

        // Only remove successfully moved items from wishlist;
        // keep unavailable ones so the user can see them
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { wishlist: { $in: movedIds } }
        });

        res.json({ success: true, moved, skipped });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

module.exports = {
    loadWishlist,
    toggleWishlist,
    removeWishlist,
    moveAllToCart
};