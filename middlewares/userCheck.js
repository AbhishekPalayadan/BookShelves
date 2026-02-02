const User=require('../models/userSchema')

const userCheck=async(req,res,next){

    const {email,password}=req.body;

    const user=await User.findOne({email});

    if()

    if(!user){
        next();
    }
    res.json({success:true,message:"User already exist"})
}