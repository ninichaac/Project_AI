require('dotenv').config(); // เพื่อใช้ environment variables จากไฟล์ .env

const express = require('express');
const app = express();
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/project";
const CLIENT_ID = process.env.CLIENT_ID; // ใช้ environment variable ที่เก็บ Google Client ID
const client = new OAuth2Client(CLIENT_ID);
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const passport = require('passport');
require('./passport'); 
const GoogleStrategy = require('passport-google-oauth2').Strategy;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.log(err)); 

  
// Middleware
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(express.json());

app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET
}));

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

app.set('view engine', 'ejs');

app.use(passport.initialize());
app.use(passport.session());

const userRoutes = require('./router/user');
app.use('/',userRoutes);

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/Login.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/pro.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
