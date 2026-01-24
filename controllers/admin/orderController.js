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

    const allowedStatuses = [
      "pending",
      "delivered",
      "cancelled",
      "returned",
      "return_rejected"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.json({ success: false, message: "Invalid status" });
    }

    if (item.status === "return_requested") {
      return res.json({
        success: false,
        message: "Use return approval actions"
      });
    }

    item.status = status;
    await order.save();

    res.json({ success: true });
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
