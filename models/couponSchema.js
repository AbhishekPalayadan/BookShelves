const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({

  code: {
    type: String,
    required: true,
    unique: true
  },

  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User"
  },

  discountType:{
    type:String,
    enum:["percentage","flat"],
    required:true
  },

  discountValue: {
    type: Number,
    required: true
  },

  maxDiscount: {
    type: Number,
    required: function () {
      return this.discountType === "percentage";
    }
  },

  minPurchase: {
    type: Number,
    required: true
  },

  usageLimit: {
    type: Number,
    required: true
  },

  expiryDate: {
    type: Date,
    required: true
  },

  usedCount:{
    type:Number,
    default:0
  },

  perUserLimit:{
    type:Number,
    default:1
  },

  isActive:{
    type:Boolean,
    default:true
  }
},{
  timestamps:true
});

module.exports = mongoose.model("Coupon", couponSchema);