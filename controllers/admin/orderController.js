const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');


const loadOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId")
      .populate("items.productId")
      .sort({ createdAt: -1 })
      .lean();

    res.render("admin/orders", {
      orders,
      adminName: req.admin?.fullname || "Admin"
    });
  } catch (err) {
    console.log(err);
    res.redirect("/admin");
  }
};


const STATUS_FLOW = {
  pending: ["shipped", "cancelled"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
  returned: [],
  return_rejected: []
};


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

    // Prevent admin from changing return workflow manually
    if (item.status === "return_requested") {
      return res.json({
        success: false,
        message: "Use return approval actions"
      });
    }

    const allowedStatuses = [
      "pending",
      "shipped",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "returned",
      "return_rejected"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.json({ success: false, message: "Invalid status" });
    }

    // 🔐 FLOW VALIDATION
    const nextAllowed = STATUS_FLOW[item.status] || [];
    if (!nextAllowed.includes(status)) {
      return res.json({
        success: false,
        message: `Cannot change status from ${item.status} to ${status}`
      });
    }

    // ✅ Update status
    item.status = status;

    // 📦 If cancelled → restock product
    if (status === "cancelled") {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
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

    if (!order) {
      return res.redirect("/admin/orders");
    }

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

    if (item.status !== "return_requested") {
      return res.json({
        success: false,
        message: "No return request for this item"
      });
    }

    if (action === "approve") {
      item.status = "returned";
      item.returnProcessedAt = new Date();

      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });

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
