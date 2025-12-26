const mongoose=require('mongoose')

const reviewSchema=new mongoose.Schema({
    product_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Product',
        required:true
    },
    user_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    rating:{
        type:Number,
        required:true,
        min:1,
        max:5
    },
    Comment:{
        type:String,
        default:""
    }
},{timestamps:true})

module.exports=mongoose.model("Review",reviewSchema)