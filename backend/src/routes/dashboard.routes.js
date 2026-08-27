const express = require('express');

const dashboardController = require('../controllers/dashboard.controller');
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');

const router = express.Router();

router.use(protect);

router.get('/', dashboardController.getDashboard);
router.get('/organization', authorize('admin'), dashboardController.getOrganizationDashboard);

module.exports = router;
