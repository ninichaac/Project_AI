const express = require('express');
const router = express.Router(); // เปลี่ยนจาก router() เป็น express.Router()
const passport = require('passport'); 

router.use(passport.initialize()); 
router.use(passport.session());

const userController = require('../controllers/userController');

router.get('/', userController.loadAuth);

// Auth 
router.get('/auth', passport.authenticate('google', { scope: ['email', 'profile'] }));

// Auth Callback 
router.get('/auth/google', passport.authenticate('google', { 
  successRedirect: '/success', 
  failureRedirect: '/failure'
}));

// Success 
router.get('/success', userController.successGoogleLogin); 

// Failure 
router.get('/failure', userController.failureGoogleLogin);

module.exports = router;
