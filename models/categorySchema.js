const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    description: {
        type: String,
        default: ""
    },
    offer: {
        type: String,
        default: null
    },
    isListed:{
        type:Boolean,
        default:true
    },
}, { timestamps: true })

const Category = mongoose.model("Category", categorySchema)
module.exports = Category;