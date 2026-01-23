const User=require('../../models/userSchema')
const bcrypt=require('bcrypt')



const loadProfile = (req, res) => {
    res.render('user/userProfile', { user: req.user });
  };


  const loadEditProfile = (req, res) => {
    res.render('user/edit-profile', { user: req.user });
  };


const editProfile = async (req, res) => {
  try {
    const { fullname, email, phone, dob } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      fullname,
      email,
      phone,
      dob
    });

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false });
  }
};


const updatePhoto=async(req,res)=>{
    try {
      await User.findByIdAndUpdate(req.user._id,{
        profileImage:"/uploads/tmp/"+req.file.filename
      });
      res.redirect("/userProfile")
    } catch (error) {
      console.log(error)
    }
  }


  const loadChangePassword=(req,res)=>{
    res.render('user/changePasswordProfile',{
      user:req.user
    });
  }


  const changePassword=async(req,res)=>{
    try {
      const {oldPassword,newPassword}=req.body;
      if(!oldPassword || !newPassword){
        return res.status(400).json({
          message:"All fields are required"
        })
      }
  
      const user=await User.findById(req.user._id);
  
      if(!user){
        return res.status(404).json({
          message:"User not found"
        })
      }
  
      const isMatch=await bcrypt.compare(oldPassword,user.password);
  
      if(!isMatch){
        return res.status(401).json({
          message:"Old password is incorrect"
        })
      }
  
      const hashedPassword=await bcrypt.hash(newPassword,10);
  
      user.password=hashedPassword;
      await user.save();
  
      res.status(200).json({
        message:"Password change successfully"
      })
    } catch (error) {
      console.log(error);
      res.status(500).json({
        message:"Something went wrong"
      })
    }
  }
  


module.exports={
    loadProfile,
    loadEditProfile,
    editProfile,
    updatePhoto,
    loadChangePassword,
    changePassword
}