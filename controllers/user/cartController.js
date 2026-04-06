const Cart = require('../../models/cartSchema')
const Product = require('../../models/productSchema')
const Address=require('../../models/addressSchema');
const Coupon=require('../../models/couponSchema')
const Order=require('../../models/orderSchema')
const { getBestOffer } = require("../../utils/offerHelper");


const loadCart = async (req, res) => {
    
    const cart = await Cart.findOne({ userId: req.user._id })
        .populate({
            path: "items.productId",
            populate: { path: "category_id" }
        })
        .lean();

    if (!cart) {
        return res.render('user/userCart', {
            cart: null,
            user: req.user,
            cartItems: [],
            cartTotal: 0
        });
    }

    let cartTotal=0;
    let hasUnavailable=false;
    let outOfStock=false;

    for(const item of cart.items){
        const product=item.productId;

        if (
            !product ||
            product.isBlocked ||
            product.isDeleted ||
            product.stock === 0 ||
            !product.category_id ||
            product.category_id.isListed === false
          ) {
            item.unavailable = true;
            hasUnavailable = true;
            continue;
          }

          if (product.stock < item.quantity) {
            outOfStock = true;
            item.stockIssue = true;
            item.availableStock = product.stock;
        }

const bestOffer = getBestOffer(product);

product.appliedOffer = bestOffer.offer;
product.offerType = bestOffer.type;

if (bestOffer.offer > 0) {
    const discountAmount = Math.round(
        (product.sale_price * bestOffer.offer) / 100
      );
      
      product.discountedPrice = Math.round(
        product.sale_price - discountAmount
      );
} else {
  product.discountedPrice = product.sale_price;
}
        
        cartTotal += product.discountedPrice * item.quantity;
    }
    let message = null;

if (hasUnavailable) {
    message = "One or more products in your cart are unavailable";
}

if (outOfStock) {
    message = "Some products are out of stock";
}

return res.render("user/userCart", {
    cart,
    user: req.user,
    cartItems: cart.items,
    cartTotal,
    message
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

        const product = await Product.findById(productId).populate("category_id");

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if(product.isBlocked || product.isDeleted){
            return res.status(400).json({
                message:"This product is currently unavailable"
            })
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
        }).populate({
            path: "items.productId",
            populate: { path: "category_id" }
        });

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        for(const item of cart.items){
            const product=await Product.findById(item.productId._id)

            if (
                !product ||
                product.isBlocked ||
                product.isDeleted ||
                !product.category_id ||
                product.category_id.isListed === false
              ) {
                return res.redirect("/cart");
              }

            if(product.stock<item.quantity){
                return res.redirect("/cart")
            }
        }

        let cartTotal = 0;
        let offerDiscountTotal = 0;

        cart.items.forEach(item => {

            const product = item.productId;

            const bestOffer = getBestOffer(product);

product.appliedOffer = bestOffer.offer;
product.offerType = bestOffer.type;

let discountedPrice = product.sale_price;

if (bestOffer.offer > 0) {
    const discountAmount = Math.round(
        (product.sale_price * bestOffer.offer) / 100
      );

  discountedPrice = Math.round(
    product.sale_price - discountAmount
  );

  offerDiscountTotal += discountAmount * item.quantity;
}

product.discountedPrice = discountedPrice;

cartTotal += discountedPrice * item.quantity;

        });

        const address = await Address.find({
            userId: req.user._id
        }).sort({ isPrimary: -1 });

        const allCoupons = await Coupon.find({
            isActive: true,
            expiryDate: { $gt: new Date() }
          });
        
        const coupons=[];

        for(const coupon of allCoupons){

            if(coupon.usedCount >= coupon.usageLimit){
                continue;
            }

            if(cartTotal < coupon.minPurchase){
                continue;
            }

            const userUsage=await Order.countDocuments({
                userId:req.user._id,
                couponCode:coupon.code
            })

            if(userUsage >= coupon.perUserLimit){
                continue;
            }

            coupons.push(coupon);
        }

        res.render("user/checkout", {
            user: req.user,
            cartItems: cart.items,
            cartTotal,
            offerDiscountTotal,
            address,
            coupons
        });

    } catch (error) {
        console.log("Checkout load error:", error);
        res.redirect("/cart");
    }
};


const updateQuantity = async (req, res) => {
    const { productId, change } = req.body;
    const userId = req.user._id;
  
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });
  
    const item = cart.items.find(
      i => i.productId.toString() === productId
    );
  
    if (!item) return res.status(404).json({ message: "Item not found" });

    const product=await Product.findById(productId);

    if(product.isBlocked){
        return res.status(400).json({
            message:"Product is unavailable"
        })
    }

    if (change === 1 && item.quantity >= product.stock) {
        return res.status(400).json({
            message: `Only ${product.stock} items available`
        });
    }

    if (item.quantity + change < 1) {
        return res.status(400).json({
            message: "Minimum quantity is 1"
        });
    }
  
    item.quantity += change;
  
    if (item.quantity < 1) {
      return res.status(400).json({ message: "Minimum quantity is 1" });
    }
  
    await cart.save();
    res.json({ success: true });
  };
  

module.exports = {
    loadCart,
    addToCart,
    removeFromCart,
    loadCheckout,
    updateQuantity
}