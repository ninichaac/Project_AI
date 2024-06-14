const loadAuth = (req, res) => {
    res.render('auth');
  };
  
  const successGoogleLogin = (req, res) => {
    if (!req.user) {
      res.redirect('/failure');
    } else {
      console.log(req.user);
      res.redirect('/home'); // Redirect to /home which will serve pro.html
    }
  };
  
  const failureGoogleLogin = (req, res) => {
    res.send("Error");
  };
  
  module.exports = {
    loadAuth,
    successGoogleLogin,
    failureGoogleLogin
  };
  