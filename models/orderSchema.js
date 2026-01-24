const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
      },
      quantity: Number,
      price: Number,
      status: {
        type: String,
        enum: [
          "pending",
          "delivered",
          "cancelled",
          "return_requested",
          "returned",
          "return_rejected"
        ],
        default: "pending"
      },
      returnRequestedAt: Date,
      returnProcessedAt: Date,
      returnReason: String,
      returnedAt: Date
    }
  ],  

  address: {
    fullname: String,
    phone: String,
    house: String,
    place: String,
    state: String,
    pincode: String
  },

  totalAmount: Number,

  paymentMethod: {
    type: String,
    default: "COD"
  },

  status: {
    type: String,
    enum: [
      "pending",
      "shipped",
      "delivered",
      "cancelled"
    ],
    default: "pending"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Order", orderSchema);
