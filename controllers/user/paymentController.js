const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Coupon = require('../../models/couponSchema');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const razorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) return res.json({ success: false, message: "Order not found" });

    if (order.status === "confirmed" && order.paymentStatus === "Success") {
      return res.json({ success: false, message: "Order is already paid" });
    }

    const activeSubtotal = order.items
      .filter(i => i.status !== "cancelled")
      .reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);

    const couponDisc = order.pricing?.couponDiscount || 0;
    const finalAmount = Math.max(0, Math.round(activeSubtotal - couponDisc));

    order.pricing.finalAmount = finalAmount;
    await order.save();

    if (finalAmount === 0) {
      return res.json({ success: false, message: "Nothing to pay" });
    }

    const options = {
      amount: finalAmount * 100, 
      currency: "INR",
      receipt: order.orderId
    };

    const razorpayOrderData = await razorpay.orders.create(options);

    res.json({
      success: true,
      razorpayOrder: razorpayOrderData,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Server error" });
  }
};


const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await Order.findOneAndUpdate(
        { orderId, userId: req.user._id },
        { paymentStatus: "Failed" }
      );
      return res.json({ success: false, message: "Payment verification failed" });
    }

    const order = await Order.findOne({ orderId, userId: req.user._id });

    if (!order) return res.json({ success: false, message: "Order not found" });

    if (order.status === "confirmed" && order.paymentStatus === "Success") {
      return res.json({ success: true });
    }

    const activeSubtotal = order.items
      .filter(i => i.status !== "cancelled")
      .reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);

    const couponDisc = order.pricing?.couponDiscount || 0;
    const newFinalAmount = Math.max(0, Math.round(activeSubtotal - couponDisc));

    order.status = "confirmed";
    order.paymentMethod = "RAZORPAY";
    order.paymentStatus = "Success";
    order.pricing.finalAmount = newFinalAmount;
    await order.save();

    for (let item of order.items) {
      if (item.status !== "cancelled") {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity }
        });
      }
    }

    await Cart.findOneAndDelete({ userId: order.userId });

    if (order.coupon?.code) {
      await Coupon.findOneAndUpdate(
        { code: order.coupon.code },
        { $inc: { usedCount: 1 } }
      );
    }

    return res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Server error" });
  }
};


module.exports = {
  razorpayOrder,
  verifyPayment
};