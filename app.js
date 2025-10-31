const express=require('express')
const app=express();
const env=require('dotenv').config()
const port=process.env.PORT;
const db=require('./config/db')
app.set('view engine','ejs')

db();

app.listen(port,()=>{
    console.log(`Server is running on http://localhost:${port}`);
})

app.get('/login',(req,res)=>{
    res.render('user/login')
    console.log('dhofhlfhhl')
})

module.exports=app;
