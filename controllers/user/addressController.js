const Address=require('../../models/addressSchema');



const loadAddress = async (req, res) => {
    const address = await Address.find({ userId: req.user._id })
      .sort({ isPrimary: -1 });
  
    res.render('user/userAddress', {
      address,
      activeMenu: 'address',
      user: req.user
    });
  };


  const loadAddAddress=async(req,res)=>{
    try {
      const user=req.user;
  
      if(!user){
        return res.redirect('/login');
      }
      return res.render('user/addAddress',{
        user,
        message:null
      })
    } catch (error) {
      console.log('Load Add Address Error',error);
      return res.redirect('/address')
    }
  }
  

  const addAddress = async (req, res) => {
    try {
      const { fullname, phone, house, place, state, pincode } = req.body;
  
      if (!fullname || !phone || !house || !place || !state || !pincode) {
        return res.json({
          success: false,
          message: "All fields are required"
        });
      }
  
      if (fullname.length < 3) {
        return res.json({
          success: false,
          message: "Full name must be at least 3 characters"
        });
      }
  
      if (!/^\d{10}$/.test(phone)) {
        return res.json({
          success: false,
          message: "Invalid phone number"
        });
      }
  
      if (!/^\d{6}$/.test(pincode)) {
        return res.json({
          success: false,
          message: "Invalid pincode"
        });
      }
  
      const addressCount = await Address.countDocuments({
        userId: req.user._id
      });
  
  
      const isPrimary = addressCount === 0;
  
      await Address.create({
        userId: req.user._id,
        fullname,
        phone,
        house,
        place,
        state,
        pincode,
        isPrimary
      });
  
      res.json({
        success: true,
        message: "Address added successfully"
      });
  
    } catch (error) {
      console.log(error);
      return res.json({
        success: false,
        message: "Server error"
      });
    }
  };


  const loadEditAddress=async(req,res)=>{
    try {
      const address=await Address.findOne({
        _id:req.params.id,
        userId:req.user._id
      })
  
      if(!address){
        return res.redirect('/address');
      }
  
      res.render('user/editAddress',{
        user:req.user,
        address
      })
    } catch (error) {
      console.log(error)
      res.redirect('/address')
    }
  }



  const editAddress = async (req, res) => {
    try {
      const updated = await Address.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        req.body,
        { new: true }
      );
  
      if (!updated) {
        return res.json({
          success: false,
          message: 'Address not found'
        });
      }
  
      res.json({
        success: true,
        message: 'Address updated successfully'
      });
  
    } catch (error) {
      console.log(error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  };
  

  const deleteAddress=async(req,res)=>{
    try {
      const userId=req.user._id;
      const addressId=req.params.id;
  
      const deleted=await Address.findOneAndDelete({_id:addressId,userId})
  
      if(!deleted){
        return res.status(404).json({
          success:false,
          message:"Address not found"
        })
      }
      res.json({
        success:true,
        message:"Address deleted successfully"
      })
    } catch (error) {
      console.log(error);
      res.status(500).json({
        success:false,
        message:"Server error"
      }) 
    }
  }


  const setPrimaryAddress=async(req,res)=>{
    try {
      const userId=req.user._id;
      const addressId=req.params.id;
      console.log(userId);
      console.log(addressId)
  
      await Address.updateMany({userId},{$set:{isPrimary:false}})
  
      const updated=await Address.findOneAndUpdate(
        {_id:addressId,userId},
        {isPrimary:true}
      )
  
      if(!updated){
        return res.status(404).json({
          success:false,
          message:"Address not found"
        })
      }
  
      res.json({success:true})
      } catch (error) {
        console.log(error);
        res.status(500).json({success:false})
    }
  }



  const getSingleAddress = async (req, res) => {
    const address = await Address.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
  
    if (!address) {
      return res.json({ success: false });
    }
  
    res.json({
      success: true,
      address
    });
  };
  

  module.exports={
    loadAddress,
    loadAddAddress,
    addAddress,
    loadEditAddress,
    editAddress,
    deleteAddress,
    setPrimaryAddress,
    getSingleAddress
  }