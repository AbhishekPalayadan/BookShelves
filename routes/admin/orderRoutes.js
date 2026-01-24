const express = require("express");
const router = express.Router();

const {adminAuth} = require("../../middlewares/auth"); 

const orderController = require("../../controllers/admin/orderController");
router.get("/orders", adminAuth, orderController.loadOrders);

router.get("/orders/:orderId", adminAuth, orderController.viewOrderDetails);

router.patch(
  "/orders/update-item-status",
  adminAuth,
  orderController.updateOrderItemStatus
);

router.patch(
  "/orders/process-return",
  adminAuth,
  orderController.processReturn
);

module.exports = router;
