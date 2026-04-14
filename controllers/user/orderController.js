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

    let coupon = null;
    let couponDiscount = 0;
    let finalTotal = cartTotal;

    if (couponCode) {
      coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

      if (!coupon)
        return res.status(400).json({ message: "Invalid coupon" });

      if (!coupon.isActive)
        return res.status(400).json({ message: "This coupon is currently not valid" });

      if (new Date() > coupon.expiryDate)
        return res.status(400).json({ message: "Coupon expired" });

      if (cartTotal < coupon.minPurchase)
        return res.status(400).json({
          message: `Minimum purchase ₹${coupon.minPurchase}`
        });

      if (coupon.usedCount >= coupon.usageLimit)
        return res.status(400).json({ message: "Coupon usage limit reached" });

      const userUsage = await Order.countDocuments({
        userId,
        "coupon.code": coupon.code
      });

      if (userUsage >= coupon.perUserLimit)
        return res.status(400).json({ message: "You already used this coupon" });

      if (coupon.discountType === "percentage") {
        couponDiscount = (cartTotal * coupon.discountValue) / 100;
      } else if (coupon.discountType === "flat") {
        couponDiscount = coupon.discountValue;
      }

      if (coupon.maxDiscount)
        couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);

      couponDiscount = Math.round(couponDiscount);
      finalTotal = Math.max(0, cartTotal - couponDiscount);
    }

    if (paymentMethod === "COD" && finalTotal > 1000) {
      return res.status(400).json({
        success: false,
        message: "Cash on Delivery is available only for orders below ₹1000"
      });
    }

    if (paymentMethod === "WALLET") {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet || wallet.balance < finalTotal) {
        return res.status(400).json({ message: "Insufficient wallet balance" });
      }
    }

    let paymentStatus = "Pending";
    if (paymentMethod === "WALLET") {
      paymentStatus = "Success";
    }

    const order = new Order({
      orderId: generateOrderId(),
      userId,
      items: cart.items.map(item => {
        const product = item.productId;
        const productOffer = product.offerPercentage || 0;
        const categoryOffer = product.category_id?.offerPercentage || 0;
        const bestOffer = Math.max(productOffer, categoryOffer);
        const originalPrice = Math.round(product.sale_price);
        const offerDiscount = Math.round((originalPrice * bestOffer) / 100);
        const finalPrice = Math.round(originalPrice - offerDiscount);
        const quantity = item.quantity;
        const itemTotal = finalPrice * quantity;
        const taxPercentage = 18;
        const taxAmount = Math.round(itemTotal * 0.18);

        return {
          productId: product._id,
          productName: product.product_name,
          productImage: product.images?.[0] || "",
          quantity,
          originalPrice,
          price: finalPrice,
          appliedOffer: bestOffer,
          offerType: productOffer >= categoryOffer ? "product" : "category",
          offerDiscount,
          itemTotal,
          taxPercentage,
          taxAmount,
          status: "pending"
        };
      }),
      address,
      pricing: {
        subtotal: Math.round(cartTotal),
        offerDiscount: Math.round(offerDiscountTotal),
        couponDiscount: couponDiscount,
        shippingCharge: 0,
        finalAmount: Math.round(finalTotal)
      },
      coupon: coupon
        ? {
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue
          }
        : null,
      paymentMethod,
      paymentStatus,
      status:
        paymentMethod === "COD" || paymentMethod === "WALLET"
          ? "confirmed"
          : "pending"
    });

    await order.save();

    if (paymentMethod === "WALLET") {
      await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: { balance: -finalTotal },
          $push: {
            transactions: {
              amount: finalTotal,
              type: "debit",
              description: `Order payment - ${order.orderId}`,
              date: new Date()
            }
          }
        }
      );
    }

    if (paymentMethod === "COD" || paymentMethod === "WALLET") {
      for (let item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { stock: -item.quantity }
        });
      }
    }

    if (coupon && (paymentMethod === "COD" || paymentMethod === "WALLET")) {
      await Coupon.findOneAndUpdate(
        { code: coupon.code },
        { $inc: { usedCount: 1 } }
      );
    }

    if (paymentMethod === "COD" || paymentMethod === "WALLET") {
      await Cart.findOneAndDelete({ userId });
    }

    return res.json({ success: true, orderId: order.orderId });

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

  res.render("user/orderFailed", { user: req.user, order });
};


const loadOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
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

    const order = await Order.findOne({ orderId, userId: req.user._id })
      .populate("items.productId")
      .lean();

    if (!order) return res.redirect("/");

    res.render("user/orderDetails", { user: req.user, order });

  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
};


function computeItemRefund(order, item) {
  const itemTotal = item.quantity * item.price; 
  const couponDiscount = order.pricing?.couponDiscount || 0;
  const orderSubtotal = order.pricing?.subtotal || 0; 

  if (couponDiscount > 0 && orderSubtotal > 0) {
    const itemShare = itemTotal / orderSubtotal;
    const couponShare = Math.round(couponDiscount * itemShare);
    return Math.max(0, itemTotal - couponShare);
  }

  return itemTotal;
}


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
      return res.json({ success: false, message: "Cannot cancel item" });

    item.status = "cancelled";

    const allCancelled = order.items.every(i => i.status === "cancelled");
    if (allCancelled) order.status = "cancelled";

    const activeSubtotal = order.items
      .filter(i => i.status !== "cancelled")
      .reduce((sum, i) => sum + i.price * i.quantity, 0);
    const couponDiscount = order.pricing?.couponDiscount || 0;
    order.pricing.finalAmount = Math.max(0, activeSubtotal - couponDiscount);

    await order.save();

    await Product.findByIdAndUpdate(productId, {
      $inc: { stock: item.quantity }
    });

    const paymentCollected =
      order.paymentMethod !== "COD" && order.paymentStatus === "Success";

    if (paymentCollected) {
      const refundAmount = computeItemRefund(order, item);

      await Wallet.findOneAndUpdate(
        { userId: req.user._id },
        {
          $inc: { balance: refundAmount },
          $push: {
            transactions: {
              amount: refundAmount,
              type: "credit",
              description: `Refund for cancelled item - ${order.orderId}`,
              date: new Date()
            }
          }
        },
        { upsert: true }
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

    const order = await Order.findOne({ _id: orderId, userId: req.user._id });

    if (!order) return res.json({ success: false });

    const paymentCollected =
      order.paymentMethod !== "COD" && order.paymentStatus === "Success";

    let refundAmount = 0;

    for (let item of order.items) {
      if (item.status === "pending") {
        item.status = "cancelled";

        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity }
        });

        if (paymentCollected) {
          refundAmount += computeItemRefund(order, item);
        }
      }
    }

    const allCancelled = order.items.every(i => i.status === "cancelled");
    if (allCancelled) order.status = "cancelled";

    const activeSubtotal = order.items
      .filter(i => i.status !== "cancelled")
      .reduce((sum, i) => sum + i.price * i.quantity, 0);
    const couponDiscount = order.pricing?.couponDiscount || 0;
    order.pricing.finalAmount = Math.max(0, activeSubtotal - couponDiscount);

    await order.save();

    if (paymentCollected && refundAmount > 0) {
      await Wallet.findOneAndUpdate(
        { userId: req.user._id },
        {
          $inc: { balance: refundAmount },
          $push: {
            transactions: {
              amount: refundAmount,
              type: "credit",
              description: `Refund for cancelled items - ${order.orderId}`,
              date: new Date()
            }
          }
        },
        { upsert: true }
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

    if (!reason || reason.trim().length < 3)
      return res.json({ success: false, message: "Please provide a valid reason" });

    const order = await Order.findOne({
      _id: orderId,
      userId: req.user._id,
      "items.productId": productId
    });

    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.items.find(
      i => i.productId.toString() === productId
    );

    if (!item || item.status !== "delivered")
      return res.json({ success: false, message: "Item cannot be returned" });

    item.status = "return_requested";
    item.returnReason = reason.trim();
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

    const activeItems = order.items.filter(i => i.status !== "cancelled");

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: Arial, sans-serif;
        font-size: 13px;
        color: #222;
        background: #fff;
        max-width: 700px;
        margin: 0 auto;
      }
      .invoice-header {
        background: #1a73e8;
        color: #fff;
        text-align: center;
        padding: 22px 0 18px;
      }
      .invoice-header h1 {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 3px;
        text-transform: uppercase;
      }
      .invoice-body { padding: 28px 36px 40px; }
      .section-title {
        font-size: 15px;
        font-weight: 700;
        color: #111;
        margin: 28px 0 6px;
      }
      .section-divider {
        border: none;
        border-top: 2px solid #1a73e8;
        margin-bottom: 16px;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        row-gap: 6px;
        column-gap: 20px;
        margin-bottom: 4px;
      }
      .info-row { display: flex; gap: 8px; }
      .info-label { font-weight: 700; min-width: 120px; color: #111; }
      .info-value { color: #333; }
      .address-block { line-height: 1.8; color: #333; }
      .items-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      .items-table thead tr { background: #1a73e8; color: #fff; }
      .items-table thead th {
        padding: 10px 12px;
        text-align: left;
        font-weight: 500;
        font-size: 12px;
      }
      .items-table thead th.right { text-align: right; }
      .items-table tbody tr { border-bottom: 1px solid #e8e8e8; }
      .items-table tbody tr:last-child { border-bottom: none; }
      .items-table tbody td { padding: 11px 12px; color: #333; }
      .items-table tbody td.right { text-align: right; }
      .summary-wrapper { display: flex; justify-content: flex-end; margin-top: 20px; }
      .summary-box { width: 280px; }
      .summary-row {
        display: flex;
        justify-content: space-between;
        padding: 7px 0;
        border-bottom: 1px solid #e0e0e0;
        color: #444;
      }
      .summary-row:last-child { border-bottom: none; }
      .summary-row.total-row {
        font-weight: 700;
        font-size: 15px;
        color: #1a73e8;
        border-top: 2px solid #1a73e8;
        margin-top: 4px;
        padding-top: 10px;
      }
      .invoice-footer {
        text-align: center;
        margin-top: 60px;
        color: #888;
        font-size: 11px;
        line-height: 1.8;
      }
    </style>
    </head>
    <body>

    <div class="invoice-header">
      <h1>Invoice</h1>
    </div>

    <div class="invoice-body">

      <p class="section-title">Order Information</p>
      <hr class="section-divider">
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Order ID:</span>
          <span class="info-value">${order.orderId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Order Date:</span>
          <span class="info-value">${new Date(order.createdAt).toLocaleDateString("en-IN")}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status:</span>
          <span class="info-value">${order.status}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Method:</span>
          <span class="info-value">${order.paymentMethod}</span>
        </div>
      </div>

      <p class="section-title">Shipping Address</p>
      <hr class="section-divider">
      <div class="address-block">
        ${order.address.fullname}<br>
        ${order.address.house}, ${order.address.place}<br>
        ${order.address.state} - ${order.address.pincode}<br>
        Phone: ${order.address.phone}
      </div>

      <p class="section-title">Order Items</p>
      <hr class="section-divider">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:36px;">#</th>
            <th>Product</th>
            <th class="right" style="width:50px;">Qty</th>
            <th class="right">Unit Price</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${activeItems.map((item, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${item.productName}</td>
              <td class="right">${item.quantity}</td>
              <td class="right">&#8377;${item.price}</td>
              <td class="right">&#8377;${item.price * item.quantity}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <p class="section-title">Order Summary</p>
      <hr class="section-divider">
      <div class="summary-wrapper">
        <div class="summary-box">
          <div class="summary-row">
            <span>Subtotal (After Offers):</span>
            <span>&#8377;${order.pricing.subtotal}</span>
          </div>
          ${order.pricing.offerDiscount > 0 ? `
          <div class="summary-row">
            <span>Offer Discount:</span>
            <span style="color:#27ae60;">-&#8377;${order.pricing.offerDiscount}</span>
          </div>` : ""}
          ${order.pricing.couponDiscount > 0 ? `
          <div class="summary-row">
            <span>Coupon Discount${order.coupon?.code ? ` (${order.coupon.code})` : ""}:</span>
            <span style="color:#27ae60;">-&#8377;${order.pricing.couponDiscount}</span>
          </div>` : ""}
          <div class="summary-row total-row">
            <span>Total Amount:</span>
            <span>&#8377;${order.pricing.finalAmount}</span>
          </div>
        </div>
      </div>

    </div>

    <div class="invoice-footer">
      Thank you for your purchase!<br>
      This is a computer-generated invoice and does not require a signature.
    </div>

    </body>
    </html>
    `;

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
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `ORD-${timestamp}${rand}`;
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