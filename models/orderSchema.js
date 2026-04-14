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
      productName: String,
      productImage: String,
      quantity: Number,
      originalPrice: Number,
      price: Number,
      appliedOffer: Number,
      offerType: String,
      offerDiscount: Number,
      itemTotal: Number,
      taxPercentage: Number,
      taxAmount: Number,
      status: {
        type: String,
        enum: [
          "pending",
          "shipped",
          "out_for_delivery",
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

  pricing: {
    subtotal: Number,
    couponDiscount: Number,
    offerDiscount: Number,
    shippingCharge: Number,
    finalAmount: Number
  },

  coupon: {
    code: String,
    discountType: String,
    discountValue: Number
  },

  paymentMethod: {
    type: String,
    enum: [
      'COD',
      'RAZORPAY',
      'WALLET'
    ],
    required: true
  },

  paymentStatus: {
    type: String,
    enum: [
      "Pending",
      "Success",
      "Failed"
    ],
    default: "Pending"
  },

  status: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
      "failed"     
    ],
    default: "pending"
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
});

module.exports = mongoose.model("Order", orderSchema);