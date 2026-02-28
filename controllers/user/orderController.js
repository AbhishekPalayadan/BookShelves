const mongoose = require('mongoose')
const Order = require('../../models/orderSchema')
const Cart = require('../../models/cartSchema')
const Address = require('../../models/addressSchema')
const Product = require('../../models/productSchema');
const pdf = require("html-pdf-node");

const placeOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId } = req.body;
    console.log("PLACE ORDER userId:", userId);

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

    for (let item of cart.items) {
      const product = item.productId;

      if (!product) {
        return res.status(400).json({
          message: "One of the products is no longer available"
        });
      }

      if (
        product.isDeleted ||
        product.status !== "available" ||
        !product.category_id?.isListed
      ) {
        return res.status(400).json({
          message: `${product.product_name} is no longer available`
        });
      }

      if (item.quantity > product.stock) {
        return res.status(400).json({
          message: `${product.product_name} is out of stock`
        });
      }
    }

    const address = await Address.findOne({
      _id: new mongoose.Types.ObjectId(addressId),
      userId
    });

    if (!address) {
      return res.status(400).json({ message: "Address not found" });
    }

    const paymentMethod = req.body.paymentMethod;

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
      paymentMethod,
      status: "pending"
    });

    await order.save();

    if (paymentMethod === "COD") {


      for (let item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { stock: -item.quantity }
        });
      }
    
      await Cart.findOneAndDelete({ userId });
    
      order.status = "confirmed";
      await order.save();
    
      return res.json({
        success: true,
        orderId: order.orderId
      });
    }


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



const orderSuccess = async (req, res) => {
  const order = await Order.findOne({
    orderId: req.params.orderId,
    userId: req.user._id
  })

  if (!order) return res.redirect("/");

  const expectedDelivery = new Date(order.createdAt);
  expectedDelivery.setDate(expectedDelivery.getDate() + 3);

  console.log("User:\n", req.user);
  console.log("\nOrder:\n", order)
  res.render("user/orderSuccess", {
    user: req.user,
    order,
    expectedDelivery
  })
}

const orderFailed = async (req, res) => {
  const order = await Order.findOne({
    orderId: req.params.orderId,
    userId: req.user._id
  });

  if (!order) return res.redirect("/");

  res.render("user/orderFailed", {
    user: req.user,
    order
  });
};



const loadOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .populate("items.productId")
      .sort({ createdAt: -1 })
      .lean();

    console.log(orders)

    res.render("user/orders", {
      user: req.user,
      orders
    })
  } catch (error) {
    console.log(error)
    res.redirect('/')
  }
}



const loadOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      orderId,
      userId: req.user._id
    }).populate("items.productId")
      .lean();

    if (!order) {
      return res.redirect("/");
    }

    console.log(order.items)

    res.render("user/orderDetails", {
      user: req.user,
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


    item.status = "cancelled";
    await order.save();

    await Product.findByIdAndUpdate(productId, {
      $inc: { stock: item.quantity }
    });

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Server error" });
  }
};


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

    const gstRate = 0.18; // 18% GST
    const subtotal = order.totalAmount / (1 + gstRate);
    const gstAmount = order.totalAmount - subtotal;
    const cgst = gstAmount / 2;
    const sgst = gstAmount / 2;

    const html = `
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #333;
          }
          .invoice-box {
            max-width: 800px;
            margin: auto;
            border: 1px solid #eee;
            padding: 30px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          h1 {
            text-align: center;
            margin-bottom: 5px;
          }
          .company-details {
            text-align: center;
            margin-bottom: 30px;
          }
          .details {
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          table th {
            background: #f2f2f2;
            padding: 10px;
            border: 1px solid #ddd;
            text-align: left;
          }
          table td {
            padding: 10px;
            border: 1px solid #ddd;
          }
          .text-right {
            text-align: right;
          }
          .total-section td {
            font-weight: bold;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #777;
          }
        </style>
      </head>
      
      <body>
        <div class="invoice-box">
          
          <h1>INVOICE</h1>
          
          <div class="company-details">
            <strong>Bookshelves Pvt Ltd</strong><br>
            Kochi, Kerala, India<br>
            GSTIN: 32ABCDE1234F1Z5<br>
            Email: support@bookshelves.com
          </div>
      
          <div class="details">
            <strong>Invoice No:</strong> ${order.orderId}<br>
            <strong>Invoice Date:</strong> ${new Date(order.createdAt).toDateString()}<br><br>
            
            <strong>Bill To:</strong><br>
            ${order.address.fullname}<br>
            ${order.address.state}<br>
            ${order.address.pincode}<br>
            Phone: ${order.address.phone}
          </div>
      
          <table>
            <tr>
              <th>Book</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
      
            ${order.items.map(item => `
              <tr>
                <td>${item.productId.product_name}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price}</td>
                <td>₹${item.price * item.quantity}</td>
              </tr>
            `).join("")}
          </table>
      
          <table>
            <tr>
              <td class="text-right">Subtotal</td>
              <td class="text-right">₹${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="text-right">CGST (9%)</td>
              <td class="text-right">₹${cgst.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="text-right">SGST (9%)</td>
              <td class="text-right">₹${sgst.toFixed(2)}</td>
            </tr>
            <tr class="total-section">
              <td class="text-right">Grand Total</td>
              <td class="text-right">₹${order.totalAmount.toFixed(2)}</td>
            </tr>
          </table>
      
          <div class="footer">
            This is a computer-generated invoice.<br>
            Thank you for shopping with Bookshelves!
          </div>
      
        </div>
      </body>
      </html>
      `;


    const file = { content: html };
    const pdfBuffer = await pdf.generatePdf(file, { format: "A4" });

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


module.exports = {
  placeOrder,
  orderSuccess,
  orderFailed,
  loadOrders,
  loadOrderDetails,
  cancelOrderItem,
  requestReturn,
  downloadInvoice
}