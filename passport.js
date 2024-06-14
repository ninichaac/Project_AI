const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const User = require('./models/User'); // แก้ไข path ให้ถูกต้อง

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google",
  passReqToCallback: true
}, async (request, accessToken, refreshToken, profile, done) => {
  try {
    const { sub, name, email } = profile._json;

    // ตรวจสอบว่าผู้ใช้มีอยู่แล้วในฐานข้อมูลหรือไม่
    let user = await User.findOne({ googleId: sub });

    if (!user) {
      // ถ้าผู้ใช้ไม่พบในฐานข้อมูล ให้เพิ่มใหม่
      user = new User({
        googleId: sub,
        name: name,
        email: email
      });
      await user.save();
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));
