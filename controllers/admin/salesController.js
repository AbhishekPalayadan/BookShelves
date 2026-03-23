const Order = require("../../models/orderSchema");

const loadSales = async (req, res) => {
  try {

    let { filter, fromDate, toDate } = req.query;

    let dateFilter = {};
    const today = new Date();

    // DAILY
    if (filter === "daily") {

      const start = new Date();
      start.setHours(0,0,0,0);

      dateFilter.createdAt = {
        $gte:start,
        $lte:today
      };

    }

    // WEEKLY
    else if (filter === "weekly") {

      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);

      dateFilter.createdAt = {
        $gte:lastWeek,
        $lte:today
      };

    }

    // MONTHLY
    else if (filter === "monthly") {

      const lastMonth = new Date();
      lastMonth.setDate(today.getDate() - 30);

      dateFilter.createdAt = {
        $gte:lastMonth,
        $lte:today
      };

    }

    // CUSTOM
    else if (filter === "custom" && fromDate && toDate) {

      dateFilter.createdAt = {
        $gte:new Date(fromDate),
        $lte:new Date(toDate)
      };

    }


    // ======================
    // PRODUCT LEVEL SALES
    // ======================

    const sales = await Order.aggregate([

      {
        $match: dateFilter
      },

      {
        $unwind:"$items"
      },

      {
        $match: {
          $or: [
      
            {
              paymentMethod: "Wallet",
              status: "confirmed",
            },
      
            {
              paymentMethod: "Razorpay",
              status: { $in: ["paid", "confirmed"] },
            },
      
            {
              paymentMethod: "COD",
              "items.status": "delivered"
            }
      
          ]
        }
      },

      {
        $lookup:{
          from:"products",
          localField:"items.productId",
          foreignField:"_id",
          as:"product"
        }
      },

      {
        $unwind:"$product"
      },

      {
        $project:{
          orderId:"$orderId",
          productName:"$product.product_name",
          quantity:"$items.quantity",
          price:"$items.price",
          total:{
            $multiply:["$items.quantity","$items.price"]
          },
          createdAt:1,
          paymentMethod:1
        }
      },

      {
        $sort:{createdAt:-1}
      }

    ]);


    // ======================
    // SUMMARY CALCULATION
    // ======================

    let overallSalesCount = 0;
    let overallOrderAmount = 0;

    sales.forEach(item => {

      overallSalesCount += item.quantity;
      overallOrderAmount += item.total;

    });

    let overallDiscount = 0; // optional if you track discount per item


    // QUERY STRING FOR EXPORT

    let queryString = "";

    if (filter) queryString += `filter=${filter}&`;
    if (fromDate) queryString += `fromDate=${fromDate}&`;
    if (toDate) queryString += `toDate=${toDate}&`;


    res.render("admin/sales", {

      activeMenu:"sales",
      orders:sales,
      overallSalesCount,
      overallOrderAmount,
      overallDiscount,
      filter,
      fromDate,
      toDate,
      queryString

    });

  } catch (error) {

    console.log("Sales Report Error:", error);
    res.redirect("/admin/pageError");

  }
};

module.exports = {
  loadSales
};