const User=require('../../models/userSchema')
const bcrypt=require('bcrypt')
const sendMail = require('../../utils/sendOtp');



const loadProfile = (req, res) => {
  const referralLink=`${process.env.BASE_URL}/signup?ref=${user.referralCode}`;
    res.render('user/userProfile', { user: req.user,referralLink });
  };


  const loadEditProfile = (req, res) => {
    res.render('user/edit-profile', { user: req.user });
  };


const editProfile = async (req, res) => {
  try {
    const { fullname, phone, dob } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      fullname,
      phone,
      dob
    });

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false });
  }
};


const updatePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image received"
      });
    }

    const imagePath = `/uploads/profile-images/${req.file.filename}`;

    await User.findByIdAndUpdate(req.user._id, {
      profileImage: imagePath
    });

    res.json({ success: true });

  } catch (err) {
    console.log("Profile upload error:", err);
    res.status(500).json({
      success: false,
      message: "Upload failed"
    });
  }
};



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


  
  const loadChangeEmail = (req, res) => {
    res.render("user/changeEmail", {
      user: req.user
    });
  };

  const sendChangeEmailOtp = async (req, res) => {
    try {
      const { newEmail, password } = req.body;
  
      if (!newEmail) {
        return res.status(400).json({
          success: false,
          message: "New email is required"
        });
      }
  
      const email = newEmail.trim().toLowerCase();
  
      if (email === req.user.email) {
        return res.status(400).json({
          success: false,
          message: "New email cannot be same as current email"
        });
      }
  
      const emailExists = await User.findOne({ email });
  
      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "This email is already registered"
        });
      }
  
      const user = await User.findById(req.user._id);
  
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
  
      if (user.password) {
        if (!password) {
          return res.status(400).json({
            success: false,
            message: "Current password is required"
          });
        }
  
        const isMatch = await bcrypt.compare(password, user.password);
  
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            message: "Current password is incorrect"
          });
        }
      }
  
      const otp = Math.floor(100000 + Math.random() * 900000);
  
      await sendMail(email, otp);
  
      req.session.changeEmail = email;
      req.session.changeEmailOtp = otp;
      req.session.changeEmailOtpExpires = Date.now() + 2 * 60 * 1000;
  
      return res.status(200).json({
        success: true,
        message: "OTP sent to your new email"
      });
  
    } catch (error) {
      console.log("Send change email OTP error:", error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong"
      });
    }
  };
  
  const verifyChangeEmailOtp = async (req, res) => {
    try {
      const { otp } = req.body;
  
      if (!otp) {
        return res.status(400).json({
          success: false,
          message: "OTP is required"
        });
      }
  
      if (!req.session.changeEmail || !req.session.changeEmailOtp) {
        return res.status(400).json({
          success: false,
          message: "Session expired. Please try again"
        });
      }
  
      if (Date.now() > req.session.changeEmailOtpExpires) {
        req.session.changeEmail = null;
        req.session.changeEmailOtp = null;
        req.session.changeEmailOtpExpires = null;
  
        return res.status(400).json({
          success: false,
          message: "OTP expired. Please request again"
        });
      }
  
      if (String(otp).trim() !== String(req.session.changeEmailOtp)) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP"
        });
      }
  
      await User.findByIdAndUpdate(req.user._id, {
        email: req.session.changeEmail
      });
  
      req.session.changeEmail = null;
      req.session.changeEmailOtp = null;
      req.session.changeEmailOtpExpires = null;
  
      return res.status(200).json({
        success: true,
        message: "Email changed successfully",
        redirectUrl: "/userProfile"
      });
  
    } catch (error) {
      console.log("Verify change email OTP error:", error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong"
      });
    }
  };

module.exports={
    loadProfile,
    loadEditProfile,
    editProfile,
    updatePhoto,
    loadChangePassword,
    changePassword,
    loadChangeEmail,
    sendChangeEmailOtp,
    verifyChangeEmailOtp
}