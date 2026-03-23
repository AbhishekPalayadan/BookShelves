const Razorpay=require('razorpay')
const crypto=require('crypto');
const Order=require('../../models/orderSchema');
const Product=require('../../models/productSchema');
const Cart=require('../../models/cartSchema')

const razorpay=new Razorpay({
    key_id:process.env.RAZORPAY_KEY_ID,
    key_secret:process.env.RAZORPAY_KEY_SECRET,
})

const razorpayOrder=async(req,res)=>{
    try{
        const {orderId}=req.body;
        const order=await Order.findOne({orderId});

        if(!order){
            return res.json({success:false});
        }

        const options={
          amount: Math.round(order.totalAmount * 100),
            currency:"INR",
            receipt:order.orderId
        }

        const razorpayOrder=await razorpay.orders.create(options);

        res.json({
            success:true,
            razorpayOrder,
            key:process.env.RAZORPAY_KEY_ID
        })
    }catch(err){
        console.log(err);
        res.json({success:false})
    }
}

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {

      const order = await Order.findOne({ orderId,userId:req.user._id });

      if (!order) {
        return res.json({ success: false });
      }

      order.status = "confirmed";
      order.paymentMethod = "Razorpay";
      await order.save();

      for (let item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity }
        });
      }

      await Cart.findOneAndDelete({ userId: order.userId });

      return res.json({ success: true });

    } else {

      await Order.findOneAndUpdate(
        { orderId },
        { status: "failed" }
      );

      return res.json({ success: false });
    }

  } catch (err) {
    console.log(err);
    res.json({ success: false });
  }
};


module.exports={
    razorpayOrder,
    verifyPayment
}