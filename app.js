const express=require('express')
const app=express();
const path=require('path');
const env=require('dotenv').config()
const port=process.env.PORT;
const db=require('./config/db')
const userRoutes=require("./routes/userRoutes");
const adminRoutes=require("./routes/adminRoutes")
db();

app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.set('view engine','ejs')
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')])
app.use(express.static(path.join(__dirname,'public')));

app.use('/user',userRoutes);
app.use('/admin',adminRoutes)


app.listen(port,()=>{
    console.log(`Server is running on http://localhost:${port}`);
})
module.exports=app;
