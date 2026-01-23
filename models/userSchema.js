const mongoose = require('mongoose')


const userSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: false,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        unique: true
    },
    password: {
        type: String
    },
    phone:
    {
        type: String,
        required: false,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        unique: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    resetOtp:{
        type:String
    },
    dob:{
        type:Date
    },
    resetOtpExpire:{
        type:Date
    },
    profileImage:{
        type:String,
        default:null
    },
    wishlist:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"Product"
        }
    ]
}, { timestamps: true });


const User = mongoose.model("User", userSchema)
module.exports = User;