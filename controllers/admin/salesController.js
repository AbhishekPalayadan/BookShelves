const Order = require("../../models/orderSchema");
const pdf = require("html-pdf-node");
const ExcelJS = require("exceljs");


// ─────────────────────────────────────────────
//  HELPER: build date filter from req.query
// ─────────────────────────────────────────────
const buildDateFilter = (query) => {
  const { filter, fromDate, toDate } = query;
  const today = new Date();
  let dateFilter = {};

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
    dateFilter.createdAt = { $gte: new Date(fromDate), $lte: end };
  }

  return dateFilter;
};


// ─────────────────────────────────────────────
//  HELPER: active / confirmed sales data
// ─────────────────────────────────────────────
const getSalesData = async (req, skip = 0, limit = 10) => {
  const dateFilter = buildDateFilter(req.query);

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

        offerDiscount: {
          $multiply: [
            { $ifNull: ["$items.offerDiscount", 0] },
            { $ifNull: ["$items.quantity", 0] }
          ]
        },

        itemTotal: {
          $multiply: [
            { $ifNull: ["$items.price", 0] },
            { $ifNull: ["$items.quantity", 0] }
          ]
        },

        couponDiscountTotal: { $ifNull: ["$pricing.couponDiscount", 0] },
        orderSubtotal:       { $ifNull: ["$pricing.subtotal", 0] }
      }
    },

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
              totalQty:        { $sum: "$quantity" },
              totalRevenue:    { $sum: "$netRevenue" },
              totalOfferDisc:  { $sum: "$offerDiscount" },
              totalCouponDisc: { $sum: "$couponShare" }
            }
          }
        ]
      }
    }
  ]);

  const data          = result[0]?.data          || [];
  const totalCount    = result[0]?.totalCount?.[0]?.count || 0;
  const overallTotals = result[0]?.overallTotals?.[0]    || {
    totalQty: 0, totalRevenue: 0, totalOfferDisc: 0, totalCouponDisc: 0
  };

  return { sales: data, totalCount, overallTotals };
};


// ─────────────────────────────────────────────
//  HELPER: returns & cancelled refund data
// ─────────────────────────────────────────────
const getRefundData = async (req) => {
  const dateFilter = buildDateFilter(req.query);

  const result = await Order.aggregate([
    { $match: { ...dateFilter } },

    { $unwind: "$items" },

    {
      $match: {
        "items.status": { $in: ["cancelled", "returned"] }
      }
    },

    {
      $project: {
        orderId:       1,
        createdAt:     1,
        paymentMethod: 1,
        paymentStatus: 1,
        itemStatus:    "$items.status",
        productName:   "$items.productName",
        quantity:      { $ifNull: ["$items.quantity", 0] },
        price:         { $ifNull: ["$items.price", 0] },

        offerDiscount: {
          $multiply: [
            { $ifNull: ["$items.offerDiscount", 0] },
            { $ifNull: ["$items.quantity", 0] }
          ]
        },

        itemTotal: {
          $multiply: [
            { $ifNull: ["$items.price", 0] },
            { $ifNull: ["$items.quantity", 0] }
          ]
        },

        // Refund only applies when payment was actually made
        refundAmount: {
          $cond: {
            if: { $eq: ["$paymentStatus", "Success"] },
            then: {
              $multiply: [
                { $ifNull: ["$items.price", 0] },
                { $ifNull: ["$items.quantity", 0] }
              ]
            },
            else: 0
          }
        }
      }
    },

    { $sort: { createdAt: -1 } },

    {
      $facet: {
        data: [{ $skip: 0 }, { $limit: 100000 }],

        totals: [
          {
            $group: {
              _id: null,
              totalRefundQty:    { $sum: "$quantity" },
              totalRefundAmount: { $sum: "$refundAmount" }
            }
          }
        ]
      }
    }
  ]);

  return {
    refunds: result[0]?.data || [],
    refundTotals: result[0]?.totals?.[0] || {
      totalRefundQty: 0,
      totalRefundAmount: 0
    }
  };
};


// ─────────────────────────────────────────────
//  CONTROLLER: Load Sales Page
// ─────────────────────────────────────────────
const loadSales = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const { sales, totalCount, overallTotals } = await getSalesData(req, skip, limit);
    const { refunds, refundTotals }            = await getRefundData(req);

    const totalPages = Math.ceil(totalCount / limit);

    const { filter, fromDate, toDate } = req.query;

    let queryString = "";
    if (filter)   queryString += `filter=${filter}&`;
    if (fromDate) queryString += `fromDate=${fromDate}&`;
    if (toDate)   queryString += `toDate=${toDate}&`;

    res.render("admin/sales", {
      activeMenu:         "sales",
      orders:             sales,
      refunds,
      refundTotals,
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


// ─────────────────────────────────────────────
//  CONTROLLER: Download PDF
// ─────────────────────────────────────────────
const downloadSalesPDF = async (req, res) => {
  try {
    const { sales, overallTotals }  = await getSalesData(req, 0, 100000);
    const { refunds, refundTotals } = await getRefundData(req);

    // ── Sales rows ──
    let salesRows = "";
    sales.forEach((item, i) => {
      salesRows += `
        <tr>
          <td>${i + 1}</td>
          <td>${item.orderId}</td>
          <td>${new Date(item.createdAt).toLocaleDateString("en-IN")}</td>
          <td class="left">${item.productName || "-"}</td>
          <td>${item.quantity}</td>
          <td>₹${Number(item.price).toFixed(2)}</td>
          <td class="red">₹${Number(item.offerDiscount || 0).toFixed(2)}</td>
          <td class="red">₹${Number(item.couponShare || 0).toFixed(2)}</td>
          <td class="green">₹${Number(item.netRevenue || 0).toFixed(2)}</td>
          <td>${item.paymentMethod}</td>
          <td>${item.paymentStatus}</td>
        </tr>
      `;
    });

    // ── Refund rows ──
    let refundRows = "";
    refunds.forEach((item, i) => {
      refundRows += `
        <tr class="refund-row">
          <td>${i + 1}</td>
          <td>${item.orderId}</td>
          <td>${new Date(item.createdAt).toLocaleDateString("en-IN")}</td>
          <td class="left">${item.productName || "-"}</td>
          <td>${item.quantity}</td>
          <td>₹${Number(item.price).toFixed(2)}</td>
          <td class="type-badge">${item.itemStatus === "returned" ? "Returned" : "Cancelled"}</td>
          <td class="red">- ₹${Number(item.refundAmount || 0).toFixed(2)}</td>
          <td>${item.paymentMethod}</td>
          <td>${item.paymentStatus}</td>
        </tr>
      `;
    });

    const html = `
      <html>
      <head>
        <style>
          @page { margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            font-size: 10px;
            color: #333;
            padding: 0;
          }
          h2 {
            text-align: center;
            font-size: 15px;
            margin-bottom: 4px;
          }
          .subtitle {
            text-align: center;
            font-size: 10px;
            color: #888;
            margin-bottom: 14px;
          }
          .summary {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 14px;
          }
          .summary div {
            background: #f4f6f9;
            padding: 7px 12px;
            border-radius: 5px;
            font-size: 10px;
            min-width: 130px;
          }
          .section-title {
            font-size: 12px;
            font-weight: 700;
            margin: 18px 0 8px;
            padding: 5px 10px;
            border-radius: 4px;
          }
          .section-title.green-bg { background: #e8f8f0; color: #16a34a; }
          .section-title.red-bg   { background: #fff0f0; color: #e53935; }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5px;
            page-break-inside: auto;
          }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td {
            border: 1px solid #ddd;
            padding: 5px 5px;
            text-align: center;
            word-break: break-word;
          }
          th {
            background: #f0f0f0;
            font-weight: 700;
          }
          tbody tr:nth-child(even) { background: #fafafa; }
          .refund-row { background: #fff8f8 !important; }

          .left  { text-align: left; }
          .green { color: #16a34a; font-weight: 600; }
          .red   { color: #e53935; }
          .type-badge { font-weight: 600; }
        </style>
      </head>
      <body>

        <h2>Sales Report</h2>
        <div class="subtitle">Generated on ${new Date().toLocaleDateString("en-IN")}</div>

        <!-- Summary -->
        <div class="summary">
          <div><strong>Total Items Sold:</strong> ${overallTotals.totalQty}</div>
          <div><strong>Net Revenue:</strong> ₹${overallTotals.totalRevenue.toFixed(2)}</div>
          <div><strong>Offer Discounts:</strong> ₹${overallTotals.totalOfferDisc.toFixed(2)}</div>
          <div><strong>Coupon Discounts:</strong> ₹${overallTotals.totalCouponDisc.toFixed(2)}</div>
          <div><strong>Refunded Items:</strong> ${refundTotals.totalRefundQty}</div>
          <div><strong>Total Refund Amount:</strong> ₹${refundTotals.totalRefundAmount.toFixed(2)}</div>
        </div>

        <!-- Active Sales Table -->
        <div class="section-title green-bg">✓ Confirmed Sales</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Order ID</th>
              <th>Date</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Offer Disc</th>
              <th>Coupon Disc</th>
              <th>Net Revenue</th>
              <th>Payment</th>
              <th>Pay Status</th>
            </tr>
          </thead>
          <tbody>${salesRows || '<tr><td colspan="11" style="text-align:center;color:#aaa;">No sales found</td></tr>'}</tbody>
        </table>

        <!-- Refunds & Cancellations Table -->
        <div class="section-title red-bg">↩ Returns & Cancellations</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Order ID</th>
              <th>Date</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Type</th>
              <th>Refund Amount</th>
              <th>Payment</th>
              <th>Pay Status</th>
            </tr>
          </thead>
          <tbody>${refundRows || '<tr><td colspan="10" style="text-align:center;color:#aaa;">No returns or cancellations</td></tr>'}</tbody>
        </table>

      </body>
      </html>
    `;

    const file      = { content: html };
    const pdfBuffer = await pdf.generatePdf(file, {
      format: "A4",
      landscape: true,
      margin: { top: "12mm", bottom: "12mm", left: "8mm", right: "8mm" },
      printBackground: true
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
    res.send(pdfBuffer);

  } catch (err) {
    console.log("PDF Error:", err);
    res.redirect("/admin/sales");
  }
};


// ─────────────────────────────────────────────
//  CONTROLLER: Download Excel
// ─────────────────────────────────────────────
const downloadSalesExcel = async (req, res) => {
  try {
    const { sales, overallTotals }  = await getSalesData(req, 0, 100000);
    const { refunds, refundTotals } = await getRefundData(req);

    const workbook = new ExcelJS.Workbook();

    // ── Sheet 1: Sales ──────────────────────────
    const salesSheet = workbook.addWorksheet("Sales");

    salesSheet.addRow(["Sales Report"]).font = { bold: true, size: 14 };
    salesSheet.addRow([]);
    salesSheet.addRow(["Total Items Sold",      overallTotals.totalQty]);
    salesSheet.addRow(["Net Revenue",           `₹${overallTotals.totalRevenue.toFixed(2)}`]);
    salesSheet.addRow(["Total Offer Discount",  `₹${overallTotals.totalOfferDisc.toFixed(2)}`]);
    salesSheet.addRow(["Total Coupon Discount", `₹${overallTotals.totalCouponDisc.toFixed(2)}`]);
    salesSheet.addRow([]);

    const salesHeaderRow = salesSheet.addRow([
      "#", "Order ID", "Date", "Product", "Qty",
      "Unit Price (₹)", "Offer Disc (₹)", "Coupon Disc (₹)",
      "Net Revenue (₹)", "Payment Method", "Payment Status"
    ]);
    salesHeaderRow.font = { bold: true };
    salesHeaderRow.fill = {
      type: "pattern", pattern: "solid", fgColor: { argb: "FFe8f8f0" }
    };

    salesSheet.columns = [
      { key: "sno",           width: 6  },
      { key: "orderId",       width: 24 },
      { key: "date",          width: 14 },
      { key: "product",       width: 32 },
      { key: "qty",           width: 6  },
      { key: "price",         width: 14 },
      { key: "offerDisc",     width: 14 },
      { key: "couponDisc",    width: 14 },
      { key: "netRevenue",    width: 14 },
      { key: "paymentMethod", width: 16 },
      { key: "paymentStatus", width: 14 }
    ];

    sales.forEach((item, i) => {
      salesSheet.addRow({
        sno:           i + 1,
        orderId:       item.orderId,
        date:          new Date(item.createdAt).toLocaleDateString("en-IN"),
        product:       item.productName || "-",
        qty:           item.quantity,
        price:         Number(item.price).toFixed(2),
        offerDisc:     Number(item.offerDiscount || 0).toFixed(2),
        couponDisc:    Number(item.couponShare || 0).toFixed(2),
        netRevenue:    Number(item.netRevenue || 0).toFixed(2),
        paymentMethod: item.paymentMethod,
        paymentStatus: item.paymentStatus
      });
    });

    // ── Sheet 2: Refunds ────────────────────────
    const refundSheet = workbook.addWorksheet("Returns & Cancellations");

    refundSheet.addRow(["Returns & Cancellations Report"]).font = { bold: true, size: 14 };
    refundSheet.addRow([]);
    refundSheet.addRow(["Total Refunded Items",  refundTotals.totalRefundQty]);
    refundSheet.addRow(["Total Refund Amount",   `₹${refundTotals.totalRefundAmount.toFixed(2)}`]);
    refundSheet.addRow([]);

    const refundHeaderRow = refundSheet.addRow([
      "#", "Order ID", "Date", "Product", "Qty",
      "Unit Price (₹)", "Type", "Refund Amount (₹)", "Payment Method", "Payment Status"
    ]);
    refundHeaderRow.font = { bold: true };
    refundHeaderRow.fill = {
      type: "pattern", pattern: "solid", fgColor: { argb: "FFfff0f0" }
    };

    refundSheet.columns = [
      { key: "sno",           width: 6  },
      { key: "orderId",       width: 24 },
      { key: "date",          width: 14 },
      { key: "product",       width: 32 },
      { key: "qty",           width: 6  },
      { key: "price",         width: 14 },
      { key: "type",          width: 12 },
      { key: "refundAmount",  width: 16 },
      { key: "paymentMethod", width: 16 },
      { key: "paymentStatus", width: 14 }
    ];

    refunds.forEach((item, i) => {
      refundSheet.addRow({
        sno:           i + 1,
        orderId:       item.orderId,
        date:          new Date(item.createdAt).toLocaleDateString("en-IN"),
        product:       item.productName || "-",
        qty:           item.quantity,
        price:         Number(item.price).toFixed(2),
        type:          item.itemStatus === "returned" ? "Returned" : "Cancelled",
        refundAmount:  Number(item.refundAmount || 0).toFixed(2),
        paymentMethod: item.paymentMethod,
        paymentStatus: item.paymentStatus
      });
    });

    res.setHeader("Content-Disposition", "attachment; filename=sales-report.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.log("Excel Error:", err);
    res.redirect("/admin/sales");
  }
};


module.exports = {
  loadSales,
  downloadSalesPDF,
  downloadSalesExcel
};