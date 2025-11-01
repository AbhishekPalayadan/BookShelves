const loadHomePage=async(req,res)=>{
    try{
        return res.render("home")
    }
    catch(err){
        console.log('Home page is not found')
        res.status(500).res.send("server error")
    }
}

const pageNotFound=async(req,res)=>{
    try{
        return res.render('page-404')
    }
    catch(err){
        res.redirect("/pageNotFound")
    }
}

module.exports={
    loadHomePage,
    pageNotFound
}