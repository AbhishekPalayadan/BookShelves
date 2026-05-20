const Wallet = require('../../models/walletSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');




const loadWallet = async (req, res) => {
  try {
    const currentPage = parseInt(req.query.page) || 1;
    const limit = 5;

    let wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet) {
      wallet = new Wallet({
        userId: req.user._id,
        balance: 0,
        transactions: []
      });

      await wallet.save();
    }

    const transactions = wallet.transactions || [];

    const totalTransactions = transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit) || 1;

    const startIndex = (currentPage - 1) * limit;
    const paginatedTransactions = transactions.slice(
      startIndex,
      startIndex + limit
    );

    const queryParams = new URLSearchParams(req.query);
    queryParams.delete("page");

    const queryString = queryParams.toString()
      ? "&" + queryParams.toString()
      : "";

    res.render("user/wallet", {
      user: req.user,
      wallet,
      transactions: paginatedTransactions,
      currentPage,
      totalPages,
      queryString
    });

  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
};




const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createWalletOrder = async (req, res) => {
  try {

    const { amount } = req.body;

    const options = {
      amount: Math.round(amount * 100), 
      currency: "INR",
      receipt: "wallet_" + Date.now()
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.log(error);
    res.json({ success: false });
  }
};





const verifyWalletPayment = async (req, res) => {
  try {

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.json({ success: false });
    }


    await Wallet.findOneAndUpdate(
      { userId: req.user._id },
      {
        $inc: { balance: amount },
        $push: {
          transactions: {
            amount,
            type: "credit",
            description: "Money added via Razorpay",
            date: new Date()
          }
        }
      }
    );

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.json({ success: false });
  }
};



module.exports = {
  loadWallet,
  createWalletOrder,
  verifyWalletPayment
};