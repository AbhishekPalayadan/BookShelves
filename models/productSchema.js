const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
    product_name: {
        type: String,
        required: true,
        trim: true
    },
    author: {
        type: String,
        required: true
    },
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    regular_price: {
        type: Number,
        required: true
    },
    sale_price: {
        type: Number
    },
    stock: {
        type: Number,
        default: 0
    },
    description: {
        type: String
    },
    images: {
        type: [String],
        default: []
    },
    language: {
        type: String
    },
    published_date: {
        type: Date
    },
    status: {
        type: String,
        enum: ['available', 'out_of_stock','removed'],
        default: 'available'
    },
    average_ratings: {
        type: Number,
        default: 0
    },
    number_of_reviews: {
        type: Number,
        default: 0
    },
    isDeleted:{
        type:Boolean,
        default:false
    }
}, { timestamps: true })


productSchema.index({ product_name: "text" });
productSchema.index({ sale_price: 1 });
productSchema.index({ category_id: 1 });
productSchema.index({ author: 1 });
productSchema.index({ average_ratings: -1 });
productSchema.index({ createdAt: -1 });


const Product = mongoose.model("Product", productSchema)
module.exports = Product;