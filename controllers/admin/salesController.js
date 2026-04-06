const Order = require("../../models/orderSchema");

const loadSales = async (req, res) => {
  try {
    let { filter, fromDate, toDate } = req.query;

    let dateFilter = {};
    const today = new Date();

    // ===== DATE FILTER =====

    if (filter === "daily") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      dateFilter.createdAt = { $gte: start, $lte: today };
    }

    else if (filter === "weekly") {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);

      dateFilter.createdAt = { $gte: lastWeek, $lte: today };
    }

    else if (filter === "monthly") {
      const lastMonth = new Date();
      lastMonth.setDate(today.getDate() - 30);

      dateFilter.createdAt = { $gte: lastMonth, $lte: today };
    }

    else if (filter === "custom" && fromDate && toDate) {
      dateFilter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }


    const sales=await getSalesData(req)

    let overallSalesCount = 0;
    let overallOrderAmount = 0;
    let overallDiscount = 0;

    sales.forEach(item => {

      const qty = Number(item.quantity || 0);
      const total = Number(item.total || 0);
      const discount = Number(item.discount || 0);
    
      overallSalesCount += qty;
      overallOrderAmount += total;
      overallDiscount += discount;
    
    });


    let queryString = "";

    if (filter) queryString += `filter=${filter}&`;
    if (fromDate) queryString += `fromDate=${fromDate}&`;
    if (toDate) queryString += `toDate=${toDate}&`;

    // ===== RENDER =====

    res.render("admin/sales", {
      activeMenu: "sales",
      orders: sales,
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

const pdf = require("html-pdf-node");

const downloadSalesPDF = async (req, res) => {
  try {

    const sales = await getSalesData(req); // reuse logic

    let rows = "";

    sales.forEach(item => {
      rows += `
        <tr>
          <td>${item.orderId}</td>
          <td>${new Date(item.createdAt).toLocaleDateString()}</td>
          <td>${item.productName}</td>
          <td>${item.quantity}</td>
          <td>${item.price}</td>
          <td>${item.discount}</td>
          <td>${item.total}</td>
        </tr>
      `;
    });

    const html = `
      <h2 style="text-align:center;">Sales Report</h2>

      <table border="1" cellspacing="0" cellpadding="6" width="100%">
        <tr>
          <th>Order</th>
          <th>Date</th>
          <th>Product</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Discount</th>
          <th>Total</th>
        </tr>
        ${rows}
      </table>
    `;

    const file = { content: html };

    const pdfBuffer = await pdf.generatePdf(file, { format: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=sales.pdf");

    res.send(pdfBuffer);

  } catch (err) {
    console.log(err);
    res.redirect("/admin/sales");
  }
};


const ExcelJS = require("exceljs");

const downloadSalesExcel = async (req, res) => {
  try {

    const sales = await getSalesData(req);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales");

    sheet.columns = [
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Product", key: "product", width: 30 },
      { header: "Qty", key: "qty", width: 10 },
      { header: "Price", key: "price", width: 10 },
      { header: "Discount", key: "discount", width: 15 },
      { header: "Total", key: "total", width: 15 }
    ];

    sales.forEach(item => {
      sheet.addRow({
        orderId: item.orderId,
        date: new Date(item.createdAt).toLocaleDateString(),
        product: item.productName,
        qty: item.quantity,
        price: item.price,
        discount: item.discount,
        total: item.total
      });
    });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sales.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.log(err);
    res.redirect("/admin/sales");
  }
};

const getSalesData = async (req) => {

  let { filter, fromDate, toDate } = req.query;

  let dateFilter = {};
  const today = new Date();

  if (filter === "daily") {
    const start = new Date();
    start.setHours(0,0,0,0);
    dateFilter.createdAt = { $gte: start, $lte: today };
  }

  else if (filter === "weekly") {
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    dateFilter.createdAt = { $gte: lastWeek, $lte: today };
  }

  else if (filter === "monthly") {
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    dateFilter.createdAt = { $gte: lastMonth, $lte: today };
  }

  else if (filter === "custom" && fromDate && toDate) {
    dateFilter.createdAt = {
      $gte: new Date(fromDate),
      $lte: new Date(toDate)
    };
  }

  const sales = await Order.aggregate([
    { $match: dateFilter },
    { $unwind: "$items" },

    {
      $lookup: {
        from: "products",
        localField: "items.productId",
        foreignField: "_id",
        as: "product"
      }
    },
    {
      $unwind: {
        path: "$product",
        preserveNullAndEmptyArrays: true
      }
    },

    {
      $project: {
        orderId: 1,
        createdAt: 1,
        paymentMethod: 1,

        productName: {
          $ifNull: ["$items.productName", "$product.product_name"]
        },

        quantity: { $ifNull: ["$items.quantity", 0] },
        price: { $ifNull: ["$items.price", 0] },

        discount: {
          $multiply: [
            { $ifNull: ["$items.offerDiscount", 0] },
            { $ifNull: ["$items.quantity", 0] }
          ]
        },

        total: {
          $cond: {
            if: { $gt: [{ $ifNull: ["$items.itemTotal", 0] }, 0] },
            then: "$items.itemTotal",
            else: {
              $multiply: [
                { $ifNull: ["$items.price", 0] },
                { $ifNull: ["$items.quantity", 0] }
              ]
            }
          }
        }
      }
    },
    {$sort:{createdAt:-1}}
  ]);

  return sales;
};

module.exports = { 
  loadSales,
  downloadSalesPDF,
  downloadSalesExcel

 };