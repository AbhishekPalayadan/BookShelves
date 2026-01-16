const mongoose=require('mongoose')

const orderSchema=new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    items:[
        {
            productId:{
                type:mongoose.Schema.Types.ObjectId,
                ref:"Product",
            },
            quantity:Number,
            price:Number
        }
    ],
    addressId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Address",
        required:true,
    },
    status:{
        type:String,
        default:Date.now
    }
})

module.exports=mongoose.model("Order",orderSchema);