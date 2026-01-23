const Cart = require('../../models/cartSchema')
const Product = require('../../models/productSchema')
const Address=require('../../models/addressSchema')


const loadCart = async (req, res) => {
    const cart = await Cart.findOne({ userId: req.user._id })
        .populate("items.productId");

    const cartItems = cart ? cart.items : [];
    const cartTotal = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    res.render('user/userCart', {
        cart,
        user: req.user,
        cartItems,
        cartTotal
    });
};


const MAX_PER_PRODUCT = 10;

const addToCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, quantity } = req.body;

        if (!quantity || quantity < 1) {
            return res.status(400).json({ message: "Invalid quantity" });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (quantity > product.stock) {
            return res.status(400).json({
                message: "Requested quantity exceeds stock"
            })
        }

        let cart = await Cart.findOne({
            userId
        }).populate("items.productId");
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const itemIndex = cart.items.findIndex(
            item => item.productId._id.toString() === productId
        )

        if (itemIndex > -1) {
            const existingQty = cart.items[itemIndex].quantity;
            const newQty = existingQty + quantity;

            if (newQty > MAX_PER_PRODUCT) {
                return res.status(400).json({
                    message: `You can add only ${MAX_PER_PRODUCT} items of this product`
                })
            }
            if (newQty > product.stock) {
                return res.status(400).json({
                    message: "Total quantity exceeds stock"
                })
            }
            cart.items[itemIndex].quantity = newQty;

        } else {
            if (quantity > MAX_PER_PRODUCT) {
                return res.status(400).json({
                    message: `You can add only ${MAX_PER_PRODUCT} items of this product`
                })
            }
            cart.items.push({
                productId,
                quantity,
                price: product.sale_price
            })
        }

        await cart.save();

        res.status(200).json({
            message: "Added to cart"
        })
    } catch (err) {
        console.log("Add to cart error:", err);
        res.status(500).json({ message: "Something went wrong" })
    }
}



const removeFromCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { itemId } = req.params;

        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({
                message: "Cart not found"
            })
        }
        cart.items = cart.items.filter(
            item => item._id.toString() !== itemId
        )

        await cart.save();

        res.status(200).json({
            message: "Item removed from cart"
        })
    } catch (error) {
        console.log("Remove from cart error:", error)
        res.status(500).json({
            message: "Something went wrong"
        })
    }
}



const loadCheckout = async (req, res) => {
    try {
        const cart = await Cart.findOne({
            userId: req.user._id
        }).populate("items.productId");

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        const cartTotal = cart.items.reduce(
            (sum, item) => sum + item.productId.sale_price * item.quantity,
            0
        )

        const address = await Address.find({ userId: req.user._id }).sort({ isPrimary: -1 })

        res.render("user/checkout", {
            user: req.user,
            cartItems: cart.items,
            cartTotal,
            address
        })
    } catch (error) {
        console.log("Checkout load error:", error);
        res.redirect("/cart")
    }
}



module.exports = {
    loadCart,
    addToCart,
    removeFromCart,
    loadCheckout
}