const express=require('express')
const router=express.Router();
const salesController=require('../../controllers/admin/salesController')
const {adminAuth}=require('../../middlewares/auth')

router.get('/sales',adminAuth,salesController.loadSales);

router.get("/sales/pdf", salesController.downloadSalesPDF);
router.get("/sales/excel", salesController.downloadSalesExcel);

module.exports=router;