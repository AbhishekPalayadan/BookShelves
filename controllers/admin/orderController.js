const Order=require('../../models/orderSchema');

const loadOrders=async(req,res)=>{
    try {
        const orders=await Order.find()
        .populate('userId')
        .sort({createdAt:-1});

        res.render("admin/orders",{
            orders
        })
    } catch (error) {
        console.log(error);
        res.redirect('/admin/pageError')
    }
}

const updateOrderStatus = async(req,res)=>{
    try {
        const {orderId,status}=req.body;

        const order=await Order.findById(orderId);

        if(!order){
            return res.json({success:false,message:"Order not found"})
        }

        const validTransitions={
            pending:['shipped','cancelled'],
            shipped:['delivered'],
            cancelled:[],
            delivered:[]
        }

        if(!validTransitions[order.status].includes(status)){
            return res.json({success:false,message:"Invalid status change"})
        }

        order.status=status;
        await order.save();

        res.json({
            success:true,
            message:"Order status updated"
        })

    } catch (error) {
        console.log(error)
        res.json({
            success:false,
            message:"Update failed"
        })
    }
}

module.exports={
    loadOrders,
    updateOrderStatus
}