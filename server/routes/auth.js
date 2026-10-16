// routes/auth.js
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { register, login, refresh, logout } = require('../controllers/authController');

router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], login);

router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
