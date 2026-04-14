const Order = require("../../models/orderSchema");
const pdf = require("html-pdf-node");
const ExcelJS = require("exceljs");


const getSalesData = async (req, skip = 0, limit = 10) => {
  let { filter, fromDate, toDate } = req.query;

  let dateFilter = {};
  const today = new Date();

  if (filter === "daily") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    dateFilter.createdAt = { $gte: start, $lte: today };
  } else if (filter === "weekly") {
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    dateFilter.createdAt = { $gte: lastWeek, $lte: today };
  } else if (filter === "monthly") {
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    dateFilter.createdAt = { $gte: lastMonth, $lte: today };
  } else if (filter === "custom" && fromDate && toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.createdAt = {
      $gte: new Date(fromDate),
      $lte: end
    };
  }

  const result = await Order.aggregate([
    {
      $match: {
        ...dateFilter,
        status:        { $in: ["confirmed", "shipped", "delivered", "pending"] },
        paymentStatus: { $in: ["Success", "Pending"] }
      }
    },

    { $unwind: "$items" },

    {
      $match: {
        "items.status": { $nin: ["cancelled", "returned"] }
      }
    },

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
        orderId:       1,
        createdAt:     1,
        paymentMethod: 1,
        paymentStatus: 1,
        orderStatus:   "$status",

        productName: {
          $ifNull: ["$items.productName", "$product.product_name"]
        },

        quantity:      { $ifNull: ["$items.quantity", 0] },
        originalPrice: { $ifNull: ["$items.originalPrice", 0] },
        price:         { $ifNull: ["$items.price", 0] },

        /* Offer discount for this item line = offerDiscount per unit × qty */
        offerDiscount: {
          $multiply: [
            { $ifNull: ["$items.offerDiscount", 0] },
            { $ifNull: ["$items.quantity", 0] }
          ]
        },

        /* Item total (post-offer) */
        itemTotal: {
          $multiply: [
            { $ifNull: ["$items.price", 0] },
            { $ifNull: ["$items.quantity", 0] }
          ]
        },

        /*
         * Proportional coupon discount for this item:
         *   couponDisc × (itemTotal / orderSubtotal)
         * We store orderSubtotal so we can compute the share in a $addFields stage.
         */
        couponDiscountTotal: { $ifNull: ["$pricing.couponDiscount", 0] },
        orderSubtotal:       { $ifNull: ["$pricing.subtotal", 0] }
      }
    },

    /* Compute proportional coupon share per item */
    {
      $addFields: {
        couponShare: {
          $cond: {
            if: { $gt: ["$orderSubtotal", 0] },
            then: {
              $multiply: [
                "$couponDiscountTotal",
                { $divide: ["$itemTotal", "$orderSubtotal"] }
              ]
            },
            else: 0
          }
        }
      }
    },

    /* Net revenue per item = itemTotal - couponShare */
    {
      $addFields: {
        netRevenue: {
          $max: [0, { $subtract: ["$itemTotal", "$couponShare"] }]
        }
      }
    },

    { $sort: { createdAt: -1 } },

    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit }
        ],
        totalCount: [{ $count: "count" }],

        overallTotals: [
          {
            $group: {
              _id: null,
              totalQty:       { $sum: "$quantity" },
              totalRevenue:   { $sum: "$netRevenue" },
              totalOfferDisc: { $sum: "$offerDiscount" },
              totalCouponDisc:{ $sum: "$couponShare" }
            }
          }
        ]
      }
    }
  ]);

  const data          = result[0]?.data          || [];
  const totalCount    = result[0]?.totalCount?.[0]?.count || 0;
  const overallTotals = result[0]?.overallTotals?.[0]    || {
    totalQty:        0,
    totalRevenue:    0,
    totalOfferDisc:  0,
    totalCouponDisc: 0
  };

  return { sales: data, totalCount, overallTotals };
};


const loadSales = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const { sales, totalCount, overallTotals } = await getSalesData(req, skip, limit);

    const totalPages = Math.ceil(totalCount / limit);

    let { filter, fromDate, toDate } = req.query;

    let queryString = "";
    if (filter)   queryString += `filter=${filter}&`;
    if (fromDate) queryString += `fromDate=${fromDate}&`;
    if (toDate)   queryString += `toDate=${toDate}&`;

    res.render("admin/sales", {
      activeMenu:         "sales",
      orders:             sales,
      overallSalesCount:  overallTotals.totalQty,
      overallOrderAmount: overallTotals.totalRevenue.toFixed(2),
      overallDiscount:    overallTotals.totalOfferDisc.toFixed(2),
      overallCouponDisc:  overallTotals.totalCouponDisc.toFixed(2),
      filter,
      fromDate,
      toDate,
      queryString,
      currentPage: page,
      totalPages,
      limit
    });

  } catch (error) {
    console.log("Sales Report Error:", error);
    res.redirect("/admin/pageError");
  }
};


const downloadSalesPDF = async (req, res) => {
  try {
    const { sales, overallTotals } = await getSalesData(req, 0, 100000);

    let rows = "";
    sales.forEach(item => {
      rows += `
        <tr>
          <td>${item.orderId}</td>
          <td>${new Date(item.createdAt).toLocaleDateString("en-IN")}</td>
          <td>${item.productName || "-"}</td>
          <td>${item.quantity}</td>
          <td>₹${Number(item.price).toFixed(2)}</td>
          <td>₹${Number(item.offerDiscount || 0).toFixed(2)}</td>
          <td>₹${Number(item.couponShare || 0).toFixed(2)}</td>
          <td>₹${Number(item.netRevenue || 0).toFixed(2)}</td>
          <td>${item.paymentMethod}</td>
          <td>${item.paymentStatus}</td>
        </tr>
      `;
    });

    const html = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h2   { text-align: center; margin-bottom: 10px; }
          .summary { display: flex; gap: 20px; margin-bottom: 20px; font-size: 13px; flex-wrap: wrap; }
          .summary div { background: #f4f6f9; padding: 10px 16px; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 7px; text-align: center; }
          th { background: #f7f7f7; font-weight: 600; }
        </style>
      </head>
      <body>
        <h2>Sales Report</h2>

        <div class="summary">
          <div><strong>Total Items Sold:</strong> ${overallTotals.totalQty}</div>
          <div><strong>Net Revenue:</strong> ₹${overallTotals.totalRevenue.toFixed(2)}</div>
          <div><strong>Offer Discounts Given:</strong> ₹${overallTotals.totalOfferDisc.toFixed(2)}</div>
          <div><strong>Coupon Discounts Given:</strong> ₹${overallTotals.totalCouponDisc.toFixed(2)}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Offer Disc</th>
              <th>Coupon Disc</th>
              <th>Net Revenue</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;

    const file      = { content: html };
    const pdfBuffer = await pdf.generatePdf(file, { format: "A4", landscape: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
    res.send(pdfBuffer);

  } catch (err) {
    console.log(err);
    res.redirect("/admin/sales");
  }
};


const downloadSalesExcel = async (req, res) => {
  try {
    const { sales, overallTotals } = await getSalesData(req, 0, 100000);

    const workbook = new ExcelJS.Workbook();
    const sheet    = workbook.addWorksheet("Sales Report");

    sheet.addRow(["Sales Report"]);
    sheet.addRow([]);
    sheet.addRow(["Total Items Sold",        overallTotals.totalQty]);
    sheet.addRow(["Net Revenue",             `₹${overallTotals.totalRevenue.toFixed(2)}`]);
    sheet.addRow(["Total Offer Discount",    `₹${overallTotals.totalOfferDisc.toFixed(2)}`]);
    sheet.addRow(["Total Coupon Discount",   `₹${overallTotals.totalCouponDisc.toFixed(2)}`]);
    sheet.addRow([]);

    sheet.addRow([
      "Order ID", "Date", "Product", "Qty",
      "Unit Price (₹)", "Offer Discount (₹)", "Coupon Discount (₹)", "Net Revenue (₹)",
      "Payment Method", "Payment Status"
    ]);

    const headerRow = sheet.getRow(8);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern", pattern: "solid",
      fgColor: { argb: "FFf7f7f7" }
    };

    sheet.columns = [
      { key: "orderId",        width: 22 },
      { key: "date",           width: 15 },
      { key: "product",        width: 30 },
      { key: "qty",            width: 8  },
      { key: "price",          width: 15 },
      { key: "offerDisc",      width: 18 },
      { key: "couponDisc",     width: 18 },
      { key: "netRevenue",     width: 16 },
      { key: "paymentMethod",  width: 16 },
      { key: "paymentStatus",  width: 16 }
    ];

    sales.forEach(item => {
      sheet.addRow({
        orderId:       item.orderId,
        date:          new Date(item.createdAt).toLocaleDateString("en-IN"),
        product:       item.productName || "-",
        qty:           item.quantity,
        price:         Number(item.price).toFixed(2),
        offerDisc:     Number(item.offerDiscount  || 0).toFixed(2),
        couponDisc:    Number(item.couponShare     || 0).toFixed(2),
        netRevenue:    Number(item.netRevenue      || 0).toFixed(2),
        paymentMethod: item.paymentMethod,
        paymentStatus: item.paymentStatus
      });
    });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sales-report.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.log(err);
    res.redirect("/admin/sales");
  }
};


module.exports = {
  loadSales,
  downloadSalesPDF,
  downloadSalesExcel
};