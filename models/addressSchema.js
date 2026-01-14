const mongoose=require('mongoose')

const addressSchema=new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    fullname:{
        type:String,
        required:true,
        trim:true
    },
    phone:{
        type:String,
        required:true,
        trim:true
    },
    house:{
        type:String,
        required:true,
        trim:true
    },
    place:{
        type:String,
        required:true,
        trim:true
    },
    // city:{
    //     type:String,
    //     required:true,
    //     trim:true
    // },
    state:{
        type:String,
        required:true,
        trim:true
    },
    pincode:{
        type:String,
        required:true,
        trim:true
    },
    isPrimary:{
        type:Boolean,
        default:false
    },
}
,{
    timestamps:true
})

module.exports=mongoose.model('Address',addressSchema)