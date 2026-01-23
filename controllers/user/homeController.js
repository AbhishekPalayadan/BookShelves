const Category=require('../../models/categorySchema')
const Product=require('../../models/productSchema')

const loadHomePage = async (req, res) => {
    try {
      const user = req.user || null;
  
      const categories = await Category.find({ isListed: true}).lean();
      const categoryIds = categories.map(c => c._id);
  
      const topPicks = await Product.aggregate([
        { $match: { category_id:{$in:categoryIds}, stock: { $gt: 0 }, status: "available" ,isDeleted:false} },
        { $sample: { size: 4 } }
      ]);
      const trending = await Product.aggregate([
        { $match: { category_id:{$in:categoryIds}, stock: { $gte: 0 }, status: "available" ,isDeleted:false} },
        { $sample: { size: 4 } }
      ]);
  
      const products = await Product.find({
        category_id: { $in: categoryIds },
        stock: { $gte: 0 },
        status: "available",
        isDeleted:false
      })
        .sort({ createdAt: -1 })
        .limit(4)
        .lean();
  
      res.render("user/home", {
        user,
        products,
        categories,
        topPicks,
        trending
      });
  
    } catch (err) {
      console.log(err);
      res.render("user/home", {
        user: null,
        products: [],
        categories: [],
        topPicks: [],
        trending: []
      });
    }
  };

  module.exports={
    loadHomePage,
  }