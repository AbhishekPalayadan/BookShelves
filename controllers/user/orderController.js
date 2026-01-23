const Order=require('../../models/orderSchema')
const Cart=require('../../models/cartSchema')
const Address=require('../../models/addressSchema')
const Product=require('../../models/productSchema');

const placeOrder = async (req, res) => {
    try {
      const userId = req.user._id;
      const { addressId } = req.body;
      // 1️⃣ Get cart
      const cart = await Cart.findOne({ userId }).populate("items.productId");
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }
  
      // 2️⃣ Validate stock
      for (let item of cart.items) {
        if (item.quantity > item.productId.stock) {
          return res.status(400).json({
            message: `${item.productId.product_name} is out of stock`
          });
        }
      }
      const addressObjectId=new mongoose.Types.ObjectId(addressId)
      // 3️⃣ Get address from Address collection ✅
      const address = await Address.findOne({
        _id: addressObjectId,
        userId
      });
  
  
      if (!address) {
        return res.status(400).json({ message: "Address not found" });
      }
  
      // 4️⃣ Create order
      const order = new Order({
        orderId: generateOrderId(),
        userId,
        items: cart.items.map(item => ({
          productId: item.productId._id,
          quantity: item.quantity,
          price: item.productId.sale_price
        })),
        address,
        totalAmount: cart.items.reduce(
          (sum, item) => sum + item.quantity * item.productId.sale_price,
          0
        ),
        paymentMethod: "COD",
        status: "pending"
      });
      await order.save();
  
      // 5️⃣ Reduce stock
      for (let item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { stock: -item.quantity }
        });
      }
  
      // 6️⃣ Clear cart
      await Cart.findOneAndDelete({ userId });
  
      res.json({
        success: true,
        orderId: order.orderId
      });
      console.log('its end')
  
    } catch (error) {
      console.log("Place order error:", error);
      res.status(500).json({ message: "Order failed" });
    }
  };



  const orderSuccess=async(req,res)=>{
    const order=await Order.findOne({
      orderId:req.params.orderId,
      userId:req.user._id
    })
  
    if(!order) return res.redirect("/");
  
    const expectedDelivery=new Date(order.createdAt);
    expectedDelivery.setDate(expectedDelivery.getDate()+3);
  
    console.log("User:\n",req.user);
    console.log("\nOrder:\n",order)
    res.render("user/orderSuccess",{
      user:req.user,
      order,
      expectedDelivery
    })
  }



  const loadOrders=async(req,res)=>{
    try {
      const orders=await Order.find({userId:req.user._id})
      .populate("items.productId")
      .sort({createdAt:-1})
      .lean();
  
      console.log(orders)
  
      res.render("user/orders",{  
        user:req.user,
        orders
      })
    } catch (error) {
      console.log(error)
      res.redirect('/')
    }
  }



  const loadOrderDetails=async(req,res)=>{
    try {
      const {orderId}=req.params;
  
      const order=await Order.findOne({
        orderId,
        userId:req.user._id
      }).populate("items.productId")
      .lean();
  
      if(!order){
        return res.redirect("/");
      }
  
      console.log(order.items)
  
      res.render("user/orderDetails",{
        user:req.user,
        order
      })
    } catch (error) {
      console.log(error);
      res.redirect('/')
    }
  }



  const cancelOrderItem=async (req,res)=>{
    try {
      const {orderId,productId}=req.body;
  
      const order=await Order.findOne({
        _id:orderId,
        "items.productId":productId
      })
  
      if(!order){
        return res.json({success:false,message:"Order not found"})
      }
  
      const item=order.items.find(
        i=>i.productId.toString() === productId
      )
  
      if(!item){
        return res.json({success:false,message:"Item not found"});
      }
  
      if(item.status=== "cancelled"){
        return res.json({success:false,message:"Item already cancelled"});
      }
  
      item.status="cancelled";
  
      await order.save();
  
      res.json({success:true})
    } catch (error) {
      console.log(error);
      res.json({success:false,message:"Server error"})
    }
  }



  module.exports={
    placeOrder,
    orderSuccess,
    loadOrders,
    loadOrderDetails,
    cancelOrderItem
  }