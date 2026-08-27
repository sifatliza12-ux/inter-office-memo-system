const express = require('express');

const reportController = require('../controllers/report.controller');
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', reportController.getOrganizationReport);

module.exports = router;
