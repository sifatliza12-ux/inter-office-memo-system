const express = require('express');

const authController = require('../controllers/auth.controller');
const protect = require('../middleware/auth');

const router = express.Router();

router.post('/login', authController.login);
router.get('/me', protect, authController.getMe);

module.exports = router;
