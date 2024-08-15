const loadAuth = (req, res) => {
    res.render('auth');
  };
  
  const successGoogleLogin = (req, res) => {
    if (!req.user) {
      res.redirect('/failure');
    } else {
      console.log(req.user);
      const googleId = encodeURIComponent(req.user.googleId);
      res.redirect(`/home?${googleId}`);
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
  