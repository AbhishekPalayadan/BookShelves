const Product=require('../../models/productSchema')
const Category=require('../../models/categorySchema')

const setProductOffer = async (req,res)=>{
    const { discount, startDate, endDate } = req.body;
  
    await Product.findByIdAndUpdate(req.params.id,{
      offerPercentage: discount,
      offerStartDate: new Date(startDate),
      offerEndDate: new Date(endDate)
    });
  
    res.json({ success:true });
  };
  
  const removeProductOffer = async (req,res)=>{
    await Product.findByIdAndUpdate(req.params.id,{
      offerPercentage:0,
      offerStartDate:null,
      offerEndDate:null
    });
    res.redirect("/admin/products");
  };

  const setCategoryOffer = async (req,res)=>{
    const { discount, startDate, endDate } = req.body;
  
    await Category.findByIdAndUpdate(req.params.id,{
      offerPercentage: discount,
      offerStartDate: new Date(startDate),
      offerEndDate: new Date(endDate)
    });
  
    res.json({ success:true });
  };
  
  const removeCategoryOffer = async (req,res)=>{
    await Category.findByIdAndUpdate(req.params.id,{
      offerPercentage:0,
      offerStartDate:null,
      offerEndDate:null
    });
    res.redirect("/admin/category");
  };

  module.exports={
    setProductOffer,
    removeProductOffer,
    setCategoryOffer,
    removeCategoryOffer
  }