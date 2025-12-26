const mongoose=require('mongoose')

const cartSchema=new  mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    items:[
        {
            productId:{
                type:mongoose.Schema.Types.ObjectId,
                ref:'Product'
            },
            quantity:{
                type:Number,
                default:1
            },
            price:{
                type:Number
            }
        }
    ],
    totalPrice:{
        type:Number
    }
})


module.exports=mongoose.model("Cart",cartSchema);