const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const User = require('./models/User');

passport.serializeUser((user, done) => {
  done(null, user.googleId);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findOne({ googleId: id });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google",
  passReqToCallback: true
}, async (request, accessToken, refreshToken, profile, done) => {
  try {
    const { sub, name, email } = profile._json;

    // Check if the user already exists in the database.
    let user = await User.findOne({ googleId: sub });

    if (!user) {
      // If the user is not found in the database, add a new one.
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
