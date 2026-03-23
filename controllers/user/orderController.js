const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Product = require('../../models/productSchema');
const Coupon = require('../../models/couponSchema');
const Wallet = require('../../models/walletSchema');
const pdf = require("html-pdf-node");

const placeOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId, paymentMethod, couponCode } = req.body;

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: { path: "category_id", select: "isListed offerPercentage" }
    });

    if (!cart || cart.items.length === 0)
      return res.status(400).json({ message: "Cart is empty" });

    for (let item of cart.items) {
      const product = item.productId;

      if (
        !product ||
        product.isDeleted ||
        product.isBlocked ||
        product.status !== "available" ||
        !product.category_id?.isListed
      ) {
        return res.status(400).json({
          message: `${product?.product_name || "Product"} not available`
        });
      }

      if (item.quantity > product.stock)
        return res.status(400).json({
          message: `${product.product_name} out of stock`
        });
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address)
      return res.status(400).json({ message: "Address not found" });

    // ===== APPLY OFFER =====
    let offerDiscountTotal = 0;

    const cartTotal = cart.items.reduce((sum, item) => {
      const product = item.productId;

      const productOffer = product.offerPercentage || 0;
      const categoryOffer = product.category_id?.offerPercentage || 0;

      const bestOffer = Math.max(productOffer, categoryOffer);

      const originalPrice = product.sale_price;
      const discountAmount = (originalPrice * bestOffer) / 100;
      const finalPrice = originalPrice - discountAmount;

      offerDiscountTotal += discountAmount * item.quantity;

      return sum + finalPrice * item.quantity;
    }, 0);

    let couponDiscount = 0;
    let finalTotal = cartTotal;


    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase()
      });

      if (!coupon)
        return res.status(400).json({ message: "Invalid coupon" });

      if (new Date() > coupon.expiryDate)
        return res.status(400).json({ message: "Coupon expired" });

      if (cartTotal < coupon.minPurchase)
        return res.status(400).json({
          message: `Minimum purchase ₹${coupon.minPurchase}`
        });

      if (coupon.usedCount >= coupon.usageLimit)
        return res.status(400).json({
          message: "Coupon usage limit reached"
        });

      const userUsage = await Order.countDocuments({
        userId,
        couponCode: coupon.code
      });

      if (userUsage >= coupon.perUserLimit)
        return res.status(400).json({
          message: "You already used this coupon"
        });

        if (coupon.discountType === "percentage") {

          couponDiscount = (cartTotal * coupon.discountValue) / 100;
        
          if (coupon.maxDiscount) {
            couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
          }
        
        } else if (coupon.discountType === "flat") {
        
          couponDiscount = coupon.discountValue;
        
        }

      if (coupon.maxDiscount)
        couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);

      finalTotal = cartTotal - couponDiscount;
    }

    // ===== WALLET CHECK BEFORE ORDER CREATION =====
    if (paymentMethod === "Wallet") {
      const wallet = await Wallet.findOne({ userId });

      if (!wallet || wallet.balance < finalTotal) {
        return res.status(400).json({
          message: "Insufficient wallet balance"
        });
      }
    }


    const order = new Order({
      orderId: generateOrderId(),
      userId,
      items: cart.items.map(item => {
        const product = item.productId;

        const productOffer = product.offerPercentage || 0;
        const categoryOffer = product.category_id?.offerPercentage || 0;
        const bestOffer = Math.max(productOffer, categoryOffer);

        const discountedPrice =
          product.sale_price -
          (product.sale_price * bestOffer) / 100;

        return {
          productId: product._id,
          quantity: item.quantity,
          price: discountedPrice,
          appliedOffer: bestOffer,
          status: "pending"
        };
      }),
      address,
      totalAmount: finalTotal,
      offerDiscountAmount: offerDiscountTotal,
      discountAmount: couponDiscount,
      couponCode: couponCode || null,
      paymentMethod,
      status:
        paymentMethod === "COD" || paymentMethod === "Wallet"
          ? "confirmed"
          : "pending"
    });

    await order.save();


if (paymentMethod === "Wallet") {
  await Wallet.findOneAndUpdate(
    { userId },
    {
      $inc: { balance: -finalTotal },
      $push: {
        transactions: {
          amount: finalTotal,
          type: "debit",
          description: "Order payment",
          date: new Date()
        }
      }
    }
  );
}


if (paymentMethod === "COD" || paymentMethod === "Wallet") {

  for (let item of cart.items) {
    await Product.findByIdAndUpdate(item.productId._id, {
      $inc: { stock: -item.quantity }
    });
  }

}


if (couponCode && (paymentMethod === "COD" || paymentMethod === "Wallet")) {
  await Coupon.findOneAndUpdate(
    { code: couponCode.toUpperCase() },
    { $inc: { usedCount: 1 } }
  );
}



if (paymentMethod === "COD" || paymentMethod === "Wallet"){
  await Cart.findOneAndDelete({userId})
}

    return res.json({
      success: true,
      orderId: order.orderId
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Order failed" });
  }
};



const orderSuccess = async (req, res) => {
  const order = await Order.findOne({
    orderId: req.params.orderId,
    userId: req.user._id
  });

  if (!order) return res.redirect("/");

  const expectedDelivery = new Date(order.createdAt);
  expectedDelivery.setDate(expectedDelivery.getDate() + 3);

  res.render("user/orderSuccess", {
    user: req.user,
    order,
    expectedDelivery
  });
};




const orderFailed = async (req, res) => {
  const order = await Order.findOne({
    orderId: req.params.orderId,
    userId: req.user._id
  });

  if (!order) return res.redirect("/");

  res.render("user/orderFailed", {
    user: req.user,
    order
  });
};




const loadOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id ,status:"confirmed"})
      .populate("items.productId")
      .sort({ createdAt: -1 })
      .lean();

    res.render("user/orders", { user: req.user, orders });

  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
};




const loadOrderDetails = async (req, res) => {
  try {

    const { orderId } = req.params;

    const order = await Order.findOne({
      orderId,
      userId: req.user._id
    })
    .populate("items.productId")
    .lean();

    if (!order) return res.redirect("/");

    res.render("user/orderDetails", {
      user: req.user,
      order
    });

  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
};




const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, productId } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      userId: req.user._id,
      "items.productId": productId
    });

    if (!order)
      return res.json({ success: false, message: "Order not found" });

    const item = order.items.find(
      i => i.productId.toString() === productId
    );

    if (!item || item.status !== "pending")
      return res.json({
        success: false,
        message: "Cannot cancel item"
      });

      item.status = "cancelled";

const allCancelled = order.items.every(
  item => item.status === "cancelled"
);

if(allCancelled){
  order.status = "cancelled";
}

await order.save();

    await Product.findByIdAndUpdate(productId, {
      $inc: { stock: item.quantity }
    });

    const itemTotal = item.quantity * item.price;

const orderSubtotal =
  order.totalAmount + order.discountAmount;

let refundAmount = itemTotal;

if(order.discountAmount > 0){

  const itemShare = itemTotal / orderSubtotal;

  const couponShare =
    order.discountAmount * itemShare;

  refundAmount = itemTotal - couponShare;

}

if(order.paymentMethod !== "COD"){

  await Wallet.findOneAndUpdate(
    { userId: req.user._id },
    {
      $inc: { balance: refundAmount },
      $push: {
        transactions: {
          amount: refundAmount,
          type: "credit",
          description: "Order cancelled refund",
          date: new Date()
        }
      }
    }
  );

}

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.json({ success: false });
  }
};


const cancelPendingItems = async (req, res) => {
  try {

    const { orderId } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      userId: req.user._id
    });

    if (!order)
      return res.json({ success: false });

    let refundAmount = 0;

    for (let item of order.items) {

      if (item.status === "pending") {

        item.status = "cancelled";

        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: item.quantity } }
        );

        const itemTotal = item.quantity * item.price;

        const orderSubtotal =
          order.totalAmount + order.discountAmount;

        let itemRefund = itemTotal;

        if (order.discountAmount > 0) {

          const itemShare = itemTotal / orderSubtotal;

          const couponShare =
            order.discountAmount * itemShare;

          itemRefund = itemTotal - couponShare;

        }

        refundAmount += itemRefund;

      }

    }

    const allCancelled = order.items.every(
      item => item.status === "cancelled"
    );

    if (allCancelled) {
      order.status = "cancelled";
    }

    await order.save();

    if (order.paymentMethod !== "COD" && refundAmount > 0) {

      await Wallet.findOneAndUpdate(
        { userId: req.user._id },
        {
          $inc: { balance: refundAmount },
          $push: {
            transactions: {
              amount: refundAmount,
              type: "credit",
              description: "Order cancelled refund",
              date: new Date()
            }
          }
        }
      );

    }

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.json({ success: false });
  }
};




const requestReturn = async (req, res) => {
  try {
    const { orderId, productId, reason } = req.body;

    if (!reason)
      return res.json({ success: false, message: "Reason required" });

    const order = await Order.findOne({
      _id: orderId,
      userId: req.user._id,
      "items.productId": productId
    });

    if (!order)
      return res.json({ success: false });

    const item = order.items.find(
      i => i.productId.toString() === productId
    );

    if (item.status !== "delivered")
      return res.json({ success: false });

    item.status = "return_requested";
    item.returnReason = reason;
    item.returnRequestedAt = new Date();

    await order.save();

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.json({ success: false });
  }
};




const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findOne({
      orderId: req.params.orderId,
      userId: req.user._id
    }).populate("items.productId").lean();

    if (!order) return res.redirect("/orders");

    const html = `<h1>Invoice - ${order.orderId}</h1>
      <p>Total Amount: ₹${order.totalAmount}</p>`;

    const file = { content: html };
    const pdfBuffer = await pdf.generatePdf(file, { format: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Invoice-${order.orderId}.pdf`
    );

    res.send(pdfBuffer);

  } catch (error) {
    console.log(error);
    res.redirect("/orders");
  }
};




function generateOrderId() {
  const timestamp = Date.now().toString().slice(-6);
  return `ORD-${timestamp}`;
}


module.exports = {
  placeOrder,
  orderSuccess,
  orderFailed,
  loadOrders,
  loadOrderDetails,
  cancelOrderItem,
  cancelPendingItems,
  requestReturn,
  downloadInvoice
};