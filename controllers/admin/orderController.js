const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');


const loadOrders = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const totalOrders = await Order.countDocuments();

    const orders = await Order.find()
      .populate("userId")
      .populate("items.productId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalOrders / limit);

    res.render("admin/orders", {
      orders,
      currentPage:  page,
      totalPages,
      adminName:    req.admin?.fullname || "Admin",
      limit
    });
  } catch (err) {
    console.log(err);
    res.redirect("/admin");
  }
};


const STATUS_FLOW = {
  pending:          ["shipped", "cancelled"],
  shipped:          ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered:        [],
  cancelled:        [],
  returned:         [],
  return_rejected:  []
};


function computeItemRefund(order, item) {
  const itemTotal      = item.quantity * item.price;
  const couponDiscount = order.pricing?.couponDiscount || 0;
  const orderSubtotal  = order.pricing?.subtotal       || 0;

  if (couponDiscount > 0 && orderSubtotal > 0) {
    const itemShare  = itemTotal / orderSubtotal;
    const couponShare = Math.round(couponDiscount * itemShare);
    return Math.max(0, itemTotal - couponShare);
  }

  return itemTotal;
}


const updateOrderItemStatus = async (req, res) => {
  try {
    const { orderId, productId, status } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    const item = order.items.find(
      i => i.productId.toString() === productId
    );

    if (!item) {
      return res.json({ success: false, message: "Item not found" });
    }

    if (item.status === "return_requested") {
      return res.json({
        success: false,
        message: "Use the return approval action for this item"
      });
    }

    const nextAllowed = STATUS_FLOW[item.status] || [];
    if (!nextAllowed.includes(status)) {
      return res.json({
        success: false,
        message: `Cannot change status from "${item.status}" to "${status}"`
      });
    }

    const previousStatus = item.status;
    item.status = status;

    if (status === "cancelled") {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });

      if (order.paymentStatus === "Success") {
        const refundAmount = computeItemRefund(order, item);

        await Wallet.findOneAndUpdate(
          { userId: order.userId },
          {
            $inc: { balance: refundAmount },
            $push: {
              transactions: {
                amount: refundAmount,
                type: "credit",
                description: `Admin cancelled item refund - ${order.orderId}`,
                date: new Date()
              }
            }
          },
          { upsert: true }
        );
      }
    }

    if (status === "delivered" && order.paymentMethod === "COD") {
      const allDone = order.items.every(
        i => i.status === "delivered" || i.status === "cancelled"
      );
      if (allDone) {
        order.paymentStatus = "Success";
      }
    }

    const allCancelled = order.items.every(i => i.status === "cancelled");
    if (allCancelled) {
      order.status = "cancelled";
    } else {
      const nonCancelled = order.items.filter(i => i.status !== "cancelled");

      const statusRank = {
        pending: 0, shipped: 1, out_for_delivery: 2, delivered: 3
      };

      const minRank = Math.min(
        ...nonCancelled.map(i => statusRank[i.status] ?? 99)
      );

      const rankToStatus = {
        0: "confirmed", 
        1: "shipped",
        2: "shipped",
        3: "delivered"
      };

      if (minRank !== 99) {
        order.status = rankToStatus[minRank] ?? order.status;
      }
    }

    if (status === "cancelled") {
      const activeSubtotal = order.items
        .filter(i => i.status !== "cancelled")
        .reduce((sum, i) => sum + i.price * i.quantity, 0);
      const couponDiscount = order.pricing?.couponDiscount || 0;
      order.pricing.finalAmount = Math.max(0, activeSubtotal - couponDiscount);
    }

    await order.save();

    res.json({ success: true, message: "Status updated successfully" });

  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Update failed" });
  }
};


const viewOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("userId")
      .populate("items.productId")
      .lean();

    if (!order) return res.redirect("/admin/orders");

    res.render("admin/orderDetails", { order });
  } catch (error) {
    console.log(error);
    res.redirect("/admin/orders");
  }
};


const processReturn = async (req, res) => {
  try {
    const { orderId, productId, action } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      "items.productId": productId
    });

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    const item = order.items.find(
      i => i.productId.toString() === productId
    );

    if (!item || item.status !== "return_requested") {
      return res.json({
        success: false,
        message: "No pending return request for this item"
      });
    }

    if (action === "approve") {
      item.status = "returned";
      item.returnProcessedAt = new Date();

      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });

      const refundAmount = computeItemRefund(order, item);

      await Wallet.findOneAndUpdate(
        { userId: order.userId },
        {
          $inc: { balance: refundAmount },
          $push: {
            transactions: {
              amount: refundAmount,
              type: "credit",
              description: `Return approved refund - ${order.orderId}`,
              date: new Date()
            }
          }
        },
        { upsert: true }
      );

      const activeSubtotal = order.items
        .filter(i => i.status !== "cancelled" && i.status !== "returned")
        .reduce((sum, i) => sum + i.price * i.quantity, 0);
      const couponDiscount = order.pricing?.couponDiscount || 0;
      order.pricing.finalAmount = Math.max(0, activeSubtotal - couponDiscount);

    } else if (action === "reject") {
      item.status = "return_rejected";
      item.returnProcessedAt = new Date();
    }

    await order.save();
    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Server error" });
  }
};


module.exports = {
  loadOrders,
  updateOrderItemStatus,
  viewOrderDetails,
  processReturn
};