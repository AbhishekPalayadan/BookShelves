const express=require('express')
const router=express.Router();

router.get('/home',(req,res)=>{
    res.send('its admin home')
})

module.exports=router;