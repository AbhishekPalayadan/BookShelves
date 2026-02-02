const mongoose=require('mongoose')
const Order=require('../../models/orderSchema')
const Cart=require('../../models/cartSchema')
const Address=require('../../models/addressSchema')
const Product=require('../../models/productSchema');
const pdf = require("html-pdf-node");

const placeOrder = async (req, res) => {
    try {
      const userId = req.user._id;
      const { addressId } = req.body;
      console.log("PLACE ORDER userId:", userId);
  
      /* 1️⃣ GET CART + POPULATE PRODUCT & CATEGORY */
      const cart = await Cart.findOne({ userId }).populate({
        path: "items.productId",
        populate: {
          path: "category_id",
          select: "isListed"
        }
      });
  
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }
  
      /* 2️⃣ VALIDATE PRODUCTS & STOCK */
      for (let item of cart.items) {
        const product = item.productId;
  
        // product deleted or missing
        if (!product) {
          return res.status(400).json({
            message: "One of the products is no longer available"
          });
        }
  
        // product or category blocked
        if (
          product.isDeleted ||
          product.status !== "available" ||
          !product.category_id?.isListed
        ) {
          return res.status(400).json({
            message: `${product.product_name} is no longer available`
          });
        }
  
        // stock check
        if (item.quantity > product.stock) {
          return res.status(400).json({
            message: `${product.product_name} is out of stock`
          });
        }
      }
  
      /* 3️⃣ VALIDATE ADDRESS */
      const address = await Address.findOne({
        _id: new mongoose.Types.ObjectId(addressId),
        userId
      });
  
      if (!address) {
        return res.status(400).json({ message: "Address not found" });
      }
  
      /* 4️⃣ CREATE ORDER */
      const order = new Order({
        orderId: generateOrderId(),
        userId,
        items: cart.items.map(item => ({
          productId: item.productId._id,
          quantity: item.quantity,
          price: item.productId.sale_price,
          status: "pending"
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
  
      /* 5️⃣ REDUCE STOCK */
      for (let item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { stock: -item.quantity }
        });
      }
      console.log("CART BEFORE DELETE:", cart);

      /* 6️⃣ CLEAR CART */
      await Cart.findOneAndDelete({ userId });
      console.log("CART DELETED");

      return res.status(200).json({
        success: true,
        orderId: order.orderId
      });
      

  
    } catch (error) {
      console.log("Place order error:", error);
      return res.status(500).json({
        message: "Order failed"
      });
    }
  };
  


  const orderSuccess=async(req,res)=>{
    const order=await Order.findOne({
      orderId: req.params.orderId,
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


  function generateOrderId() {
    const timestamp = Date.now().toString().slice(-6);
    return `ORD-${timestamp}`;
  }
  

  const cancelOrderItem = async (req, res) => {
    try {
      const { orderId, productId } = req.body;
  
      const order = await Order.findOne({
        _id: orderId,
        userId: req.user._id,
        "items.productId": productId
      });
  
      if (!order) {
        return res.json({ success: false, message: "Order not found" });
      }
  
      const item = order.items.find(
        i => i.productId.toString() === productId
      );
  
      if (!item) {
        return res.json({ success: false, message: "Item not found" });
      }
  
      if (item.status !== "pending") {
        return res.json({
          success: false,
          message: "Item cannot be cancelled now"
        });
      }
      
  
      // cancel item
      item.status = "cancelled";
      await order.save();
  
      // restore stock
      await Product.findByIdAndUpdate(productId, {
        $inc: { stock: item.quantity }
      });
  
      res.json({ success: true });
  
    } catch (error) {
      console.log(error);
      res.json({ success: false, message: "Server error" });
    }
  };
  

// controllers/user/orderController.js
const requestReturn = async (req, res) => {
    try {
      const { orderId, productId, reason } = req.body;
  
      if (!reason) {
        return res.json({ success: false, message: "Reason required" });
      }
  
      const order = await Order.findOne({
        _id: orderId,
        userId: req.user._id,
        "items.productId": productId
      });
  
      if (!order) {
        return res.json({ success: false, message: "Order not found" });
      }
  
      const item = order.items.find(
        i => i.productId.toString() === productId
      );
  
      if (item.status !== "delivered") {
        return res.json({ success: false, message: "Return not allowed" });
      }
  
      item.status = "return_requested";
      item.returnReason = reason;
      item.returnRequestedAt = new Date();
  
      await order.save();
  
      res.json({ success: true });
    } catch (err) {
      console.log(err);
      res.json({ success: false, message: "Server error" });
    }
  };
  

  const downloadInvoice = async (req, res) => {
    try {
      console.log("INVOICE ROUTE HIT:", req.params.orderId);
      const order = await Order.findOne({
        orderId: req.params.orderId,
        userId: req.user._id
      }).populate("items.productId").lean();
  
      if (!order) return res.redirect("/orders");
  
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial; padding: 30px; }
              h2 { color: #ff4757; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 10px; }
              th { background: #f5f5f5; }
            </style>
          </head>
          <body>
            <h2>Bookshelves Invoice</h2>
            <p><strong>Order ID:</strong> ${order.orderId}</p>
            <p><strong>Date:</strong> ${new Date(order.createdAt).toDateString()}</p>
            <p><strong>Name:</strong> ${order.address.fullname}</p>
  
            <table>
              <tr>
                <th>Book</th>
                <th>Qty</th>
                <th>Price</th>
              </tr>
  
              ${order.items.map(item => `
                <tr>
                  <td>${item.productId.product_name}</td>
                  <td>${item.quantity}</td>
                  <td>₹${item.price}</td>
                </tr>
              `).join("")}
  
            </table>
  
            <h3>Total: ₹${order.totalAmount}</h3>
          </body>
        </html>
      `;
  
      // 2️⃣ Create PDF
      const file = { content: html };
      const pdfBuffer = await pdf.generatePdf(file, { format: "A4" });
  
      // 3️⃣ Download PDF
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Invoice-${order.orderId}.pdf`
      );
  
      res.send(pdfBuffer);
  
    } catch (error) {
      console.log(error);
      res.redirect("/orders");
    }
  };


  module.exports={
    placeOrder,
    orderSuccess,
    loadOrders,
    loadOrderDetails,
    cancelOrderItem,
    requestReturn,
    downloadInvoice
  }