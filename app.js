const express=require('express')
const app=express();
const env=require('dotenv').config()
const port=process.env.PORT;
const db=require('./config/db')

db();

app.listen(port,()=>{
    console.log(`Server is running on http://localhost:${port}`);
})

module.exports=app;