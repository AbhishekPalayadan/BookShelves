const about = (req, res) => {
    res.render('user/about', { user: req.user || null });
  };
  
  const contact = (req, res) => {
    res.render('user/contact', { user: req.user || null });
  };
  
  const pageNotFound = (req, res) => {
    res.render("user/page-404", { user: req.user || null });
  };
  


  module.exports={
    about,
    contact,
    pageNotFound
  }