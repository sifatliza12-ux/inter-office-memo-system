const express = require('express');

const userController = require('../controllers/user.controller');
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');

const router = express.Router();

router.use(protect, authorize('admin'));

router.post('/', userController.createUser);
router.get('/', userController.listUsers);
router.get('/:id', userController.getUser);
router.patch('/:id', userController.updateUser);
router.patch('/:id/status', userController.updateUserStatus);

module.exports = router;
